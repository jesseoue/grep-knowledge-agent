import { z } from 'zod'
import { streamText, stepCountIs } from 'ai'
import { createSavoir } from '@grep/sdk'
import { routeQuestion, buildChatSystemPrompt } from '@grep/agent'
import { getAgentConfig } from '../lib/agent-config'
import { requireUserSession } from '../lib/session'
import { resolveRouterModel, resolveModelForComplexity, hasAIProvider } from '../lib/models'
import { checkQuota, recordUsage } from '../lib/usage'

const bodySchema = z.object({
  messages: z.array(z.object({
    role: z.enum(['user', 'assistant', 'system']),
    content: z.string().min(1).max(8000),
  })).min(1).max(50),
})

// Rate limiter — uses Redis when available (works across replicas),
// falls back to in-memory for local dev.
const RATE_LIMIT_WINDOW_S = 60
const RATE_LIMIT_MAX_REQUESTS = 20
const rateLimitMap = new Map<string, { count: number, resetAt: number }>()

async function checkRateLimit(userId: string): Promise<{ ok: boolean, retryAfter?: number }> {
  // Try Redis first (works across multiple replicas in production)
  const { kvIncr } = await import('../lib/redis')
  const count = await kvIncr(`ratelimit:${userId}`, RATE_LIMIT_WINDOW_S)
  if (count !== null) {
    if (count > RATE_LIMIT_MAX_REQUESTS) {
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

  if (entry.count >= RATE_LIMIT_MAX_REQUESTS) {
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

  // Rate limit — 20 requests per minute per user
  const rateLimit = await checkRateLimit(session.user.id)
  if (!rateLimit.ok) {
    setHeader(event, 'retry-after', rateLimit.retryAfter || 60)
    throw createError({
      statusCode: 429,
      statusMessage: 'Too many requests',
      data: {
        why: `Rate limit: ${RATE_LIMIT_MAX_REQUESTS} requests per minute`,
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

  // Classify question complexity to budget steps + model tier
  const routerModel = resolveRouterModel()
  const routerConfig = await routeQuestion(messages as any, routerModel)

  // Resolve the main model from the question's complexity (provider-agnostic —
  // works with any single configured API key).
  const mainModel = resolveModelForComplexity(routerConfig.complexity)

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
      stopWhen: stepCountIs(routerConfig.maxSteps),
      temperature: agentConfig.temperature ?? 0.7,
      abortSignal: AbortSignal.timeout(120_000), // 2 min cap
      onError: ({ error }) => {
        console.error('[chat] stream error', error)
        send({ type: 'error', message: error instanceof Error ? error.message : 'Agent stream failed' })
      },
    })
  } catch (error: any) {
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

  // Stream text deltas as they arrive
  for await (const part of result.fullStream) {
    if (part.type === 'text-delta') {
      send({ type: 'text', delta: part.text })
    }
    // Tool calls are visible in fullStream but we don't stream them live;
    // they're collected into the trace at the end via onFinish.
  }

  // Collect final results (text, steps/trace, usage) once the stream completes
  const [finalText, steps, usage] = await Promise.all([
    result.text,
    result.steps,
    result.totalUsage,
  ])

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
  if (usage) {
    recordUsage(session.user.id, {
      complexity: routerConfig.complexity,
      inputTokens: usage.inputTokens ?? 0,
      outputTokens: usage.outputTokens ?? 0,
      totalTokens: usage.totalTokens ?? 0,
    }).catch(() => {})
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
