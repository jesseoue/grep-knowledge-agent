import { z } from 'zod'
import { streamText, stepCountIs } from 'ai'
import { createSavoir } from '@grep/sdk'
import { routeQuestion, buildChatSystemPrompt } from '@grep/agent'
import { getAgentConfig } from '../lib/agent-config'
import { requireUserSession } from '../lib/session'
import { resolveRouterModel, resolveModelForComplexity, hasAIProvider } from '../lib/models'
import { getAiBudgetConfig } from '../lib/ai-budget-config'
import { getOpenRouterCostUsd } from '../lib/openrouter-usage'
import {
  checkQuota,
  recordUsage,
  reserveDailyBudget,
  settleDailyBudget,
} from '../lib/usage'

const bodySchema = z.object({
  messages: z.array(z.object({
    role: z.enum(['user', 'assistant', 'system']),
    content: z.string().min(1).max(8000),
  })).min(1).max(50),
})

// Rate limiter — uses Redis when available (works across replicas),
// falls back to in-memory for local dev.
const RATE_LIMIT_WINDOW_S = 60
const rateLimitMap = new Map<string, { count: number, resetAt: number }>()

async function checkRateLimit(userId: string, maxRequests: number): Promise<{ ok: boolean, retryAfter?: number }> {
  // Try Redis first (works across multiple replicas in production)
  const { kvIncr } = await import('../lib/redis')
  const count = await kvIncr(`ratelimit:${userId}`, RATE_LIMIT_WINDOW_S)
  if (count !== null) {
    if (count > maxRequests) {
      return { ok: false, retryAfter: RATE_LIMIT_WINDOW_S }
    }
    return { ok: true }
  }

  // Redis is unavailable: preserve rate limiting with a per-process fallback.
  const now = Date.now()
  const entry = rateLimitMap.get(userId)

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_S * 1000 })
    return { ok: true }
  }

  if (entry.count >= maxRequests) {
    return { ok: false, retryAfter: Math.ceil((entry.resetAt - now) / 1000) }
  }

  entry.count++
  return { ok: true }
}

// Clean up expired in-memory rate limit entries periodically
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of rateLimitMap) {
    if (now > entry.resetAt) rateLimitMap.delete(key)
  }
}, 60_000).unref?.()

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const body = await readValidatedBody(event, bodySchema.parse)
  const aiLimits = getAiBudgetConfig()

  if (!aiLimits.enabled) {
    throw createError({
      statusCode: 503,
      statusMessage: 'AI is temporarily paused',
      data: {
        why: 'The workspace owner paused model requests with the emergency kill switch.',
        fix: 'Try again later.',
      },
    })
  }

  const rateLimit = await checkRateLimit(session.user.id, aiLimits.rateLimitRequests)
  if (!rateLimit.ok) {
    setHeader(event, 'retry-after', rateLimit.retryAfter || 60)
    throw createError({
      statusCode: 429,
      statusMessage: 'Too many requests',
      data: {
        why: `Rate limit: ${aiLimits.rateLimitRequests} requests per minute`,
        fix: `Wait ${rateLimit.retryAfter || 60}s and try again.`,
      },
    })
  }

  // Credit quota — block if the user exceeded their token budget.
  // Returns a friendly error so the UI can show "out of credits" instead of a 500.
  const quota = await checkQuota(session.user.id)
  if (!quota.allowed) {
    throw createError({
      statusCode: 402,
      statusMessage: 'Credit quota exceeded',
      data: {
        why: `You've used ${quota.summary.totalTokens.toLocaleString()} of ${quota.summary.quota?.toLocaleString()} tokens.`,
        fix: 'Upgrade your plan or contact an admin to increase your quota.',
      },
    })
  }

  if (!hasAIProvider()) {
    throw createError({
      statusCode: 500,
      statusMessage: 'No AI provider configured',
      data: {
        why: 'Set at least one of OPENROUTER_API_KEY (recommended), OPENAI_API_KEY, ANTHROPIC_API_KEY, or GOOGLE_GENERATIVE_AI_API_KEY.',
        fix: 'Add an API key in Railway project variables. See docs/ENVIRONMENT.md for instructions.',
      },
    })
  }

  const agentConfig = await getAgentConfig()
  const messages = body.messages.map(m => ({
    role: m.role,
    parts: [{ type: 'text', text: m.content }],
  }))

  const routerModel = resolveRouterModel()

  const baseUrl = getRequestURL(event).origin
  const savoir = createSavoir({
    apiUrl: baseUrl,
    headers: { cookie: getHeader(event, 'cookie') || '' },
  })

  const searchInstructions = [
    'Use the bash tool to search and read files in the knowledge base.',
    'Start with `find . -type f -name "*.md" | head -50` to see what is available.',
    'Use grep with --include="*.md" to search across docs.',
    'Read the most relevant files fully before answering.',
  ].join('\n')

  // Reserve before either provider call. PostgreSQL serializes this check
  // across replicas, so simultaneous requests cannot race through the limit.
  let budget
  try {
    budget = await reserveDailyBudget(session.user.id)
  } catch (error) {
    console.error('[ai-budget] admission failed:', error)
    throw createError({
      statusCode: 503,
      statusMessage: 'Budget check unavailable',
      data: {
        why: 'The server could not safely verify the daily model budget.',
        fix: 'Try again shortly.',
      },
    })
  }

  if (!budget.allowed) {
    throw createError({
      statusCode: 402,
      statusMessage: 'Daily demo budget reached',
      data: {
        why: `Today's $${budget.summary?.limitUsd.toFixed(2)} model budget has been used.`,
        fix: `The demo resets at ${budget.summary?.resetAt || 'midnight UTC'}.`,
        resetAt: budget.summary?.resetAt,
      },
    })
  }

  const requestId = budget.reservationId || crypto.randomUUID()
  const settleConservatively = () => settleDailyBudget(budget.reservationId).catch(settleError => {
    console.error('[ai-budget] conservative settlement failed:', settleError)
  })
  let routerTelemetry: Parameters<NonNullable<Parameters<typeof routeQuestion>[2]>>[0] | undefined
  let routerConfig: Awaited<ReturnType<typeof routeQuestion>>
  let mainModel: ReturnType<typeof resolveModelForComplexity>
  let routerWasCalled = false

  // Stream the response as SSE. Each event is either:
  //   data: {"type":"text","delta":"..."}     — incremental text
  //   data: {"type":"done","text":...,"references":[...],"trace":[...],"usage":{...}}
  // This keeps the command-trace + references features while streaming tokens.
  setHeader(event, 'content-type', 'text/event-stream; charset=utf-8')
  setHeader(event, 'cache-control', 'no-cache, no-transform')
  setHeader(event, 'connection', 'keep-alive')

  const send = (data: Record<string, unknown>) => {
    event.node.res.write(`data: ${JSON.stringify(data)}\n\n`)
  }

  let result
  try {
    if (aiLimits.routerEnabled) {
      // Classification improves automatic tiering for private deployments, but
      // public demos can skip this extra provider call entirely.
      routerWasCalled = true
      routerConfig = await routeQuestion(messages as any, routerModel, telemetry => {
        routerTelemetry = telemetry
      })
    } else {
      routerConfig = {
        complexity: 'moderate',
        maxSteps: aiLimits.maxSteps,
        reasoning: 'Model router disabled by owner configuration',
      }
    }

    // Enforce the owner-controlled ceiling even if the classifier asks for more.
    const maxSteps = Math.min(routerConfig.maxSteps, aiLimits.maxSteps)
    mainModel = resolveModelForComplexity(routerConfig.complexity, aiLimits.maxModelTier)

    result = streamText({
      model: mainModel,
      system: buildChatSystemPrompt({
        ...agentConfig,
        searchInstructions,
      }),
      messages: body.messages,
      tools: {
        bash: savoir.tools.bash,
        bash_batch: savoir.tools.bash_batch,
      },
      stopWhen: stepCountIs(maxSteps),
      maxOutputTokens: aiLimits.maxOutputTokens,
      temperature: agentConfig.temperature ?? 0.7,
      abortSignal: AbortSignal.timeout(120_000), // 2 min cap
      onError: ({ error }) => {
        console.error('[chat] stream error', error)
        send({ type: 'error', message: error instanceof Error ? error.message : 'Agent stream failed' })
      },
    })
  } catch (error: any) {
    // A provider call was attempted, so a missing exact cost is charged at the
    // reserved maximum. This keeps crashes and provider errors fail-safe.
    await settleConservatively()
    console.error('[chat]', error)
    throw createError({
      statusCode: 502,
      statusMessage: 'Agent request failed',
      data: {
        why: error instanceof Error ? error.message : 'Unknown agent error',
        fix: 'Check your AI provider key and try again. See docs/ENVIRONMENT.md for setup.',
      },
    })
  }

  let finalText
  let steps
  let usage
  try {
    // Stream text deltas as they arrive.
    for await (const part of result.fullStream) {
      if (part.type === 'text-delta') {
        send({ type: 'text', delta: part.text })
      }
    }

    // Collect final results (text, steps/trace, usage) once the stream completes.
    [finalText, steps, usage] = await Promise.all([
      result.text,
      result.steps,
      result.totalUsage,
    ])
  } catch (error) {
    await settleConservatively()
    console.error('[chat] stream failed:', error)
    send({ type: 'error', message: error instanceof Error ? error.message : 'Agent stream failed' })
    event.node.res.end()
    return
  }

  const routerCostUsd = getOpenRouterCostUsd(routerTelemetry?.providerMetadata)
  const answerStepCosts = (steps || []).map(step => getOpenRouterCostUsd(step.providerMetadata))
  const hasExactOpenRouterCost = (!routerWasCalled || routerCostUsd !== undefined)
    && answerStepCosts.length > 0
    && answerStepCosts.every(cost => cost !== undefined)
  const answerCostUsd = answerStepCosts.every(cost => cost !== undefined)
    ? answerStepCosts.reduce((total, cost) => total + (cost || 0), 0)
    : undefined
  const exactRequestCostUsd = hasExactOpenRouterCost
    ? (routerCostUsd || 0) + (answerCostUsd || 0)
    : undefined

  // Extract file references from the commands the agent ran
  const references = Array.from(new Set(
    (steps || []).flatMap((s: any) => {
      const toolCalls = s.toolCalls || []
      return toolCalls.flatMap((tc: any) => {
        const args = tc.args as any
        const commands = args?.commands || (args?.command ? [args.command] : [])
        return commands.flatMap((cmd: string) => {
          const matches = cmd.match(/(?:cat|head|grep -rl|grep -r)\s+([^\s|]+)/g) || []
          return matches.map((m) => m.split(/\s+/).pop()!.split('/').pop()!)
        })
      })
    })
  )).slice(0, 8)

  // Extract the command trace — every shell command the agent ran.
  const trace = (steps || []).flatMap((s: any) => {
    const toolCalls = s.toolCalls || []
    return toolCalls.flatMap((tc: any) => {
      const args = tc.args as any
      const commands = args?.commands || (args?.command ? [args.command] : [])
      return commands.map((cmd: string) => ({ cmd, tool: tc.toolName || 'bash' }))
    })
  })

  // Persist usage to the credit ledger (best-effort — never blocks the reply)
  const usageWrites: Promise<void>[] = []
  if (routerTelemetry?.usage) {
    usageWrites.push(recordUsage(session.user.id, {
      requestId,
      callKind: 'router',
      model: (routerModel as any).modelId,
      costUsd: routerCostUsd,
      inputTokens: routerTelemetry.usage.inputTokens ?? 0,
      outputTokens: routerTelemetry.usage.outputTokens ?? 0,
      totalTokens: routerTelemetry.usage.totalTokens ?? 0,
    }))
  }
  if (usage) {
    usageWrites.push(recordUsage(session.user.id, {
      requestId,
      callKind: 'answer',
      model: (mainModel as any).modelId,
      complexity: routerConfig.complexity,
      costUsd: answerCostUsd,
      inputTokens: usage.inputTokens ?? 0,
      outputTokens: usage.outputTokens ?? 0,
      totalTokens: usage.totalTokens ?? 0,
    }))
  }

  const persistenceResults = await Promise.allSettled([
    ...usageWrites,
    settleDailyBudget(budget.reservationId, exactRequestCostUsd),
  ])
  const settlement = persistenceResults.at(-1)
  if (settlement?.status === 'rejected') {
    console.error('[ai-budget] exact settlement failed:', settlement.reason)
  }

  send({
    type: 'done',
    text: finalText,
    references,
    trace,
    usage: usage ? {
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      totalTokens: usage.totalTokens,
    } : undefined,
  })

  event.node.res.end()
})
