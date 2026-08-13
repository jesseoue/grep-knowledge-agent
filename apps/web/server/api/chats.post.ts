import { z } from 'zod'
import { generateText, stepCountIs } from 'ai'
import { createSavoir } from '@grep/sdk'
import { routeQuestion, buildChatSystemPrompt } from '@grep/agent'
import { getAgentConfig } from '../lib/agent-config'
import { requireUserSession } from '../lib/session'
import { resolveRouterModel, resolveModelForComplexity, hasAIProvider } from '../lib/models'
import { checkQuota, recordUsage } from '../lib/usage'

const bodySchema = z.object({
  messages: z.array(z.object({
    role: z.enum(['user', 'assistant', 'system']),
    content: z.string(),
  })),
})

// Rate limiter — uses Redis when available (works across replicas),
// falls back to in-memory for local dev.
const RATE_LIMIT_WINDOW_S = 60
const RATE_LIMIT_MAX_REQUESTS = 20
const rateLimitMap = new Map<string, { count: number, resetAt: number }>()

async function checkRateLimit(userId: string): Promise<{ ok: boolean, retryAfter?: number }> {
  // Try Redis first (works across multiple replicas in production)
  try {
    const { kvIncr } = await import('../lib/redis')
    const count = await kvIncr(`ratelimit:${userId}`, RATE_LIMIT_WINDOW_S)
    if (count > RATE_LIMIT_MAX_REQUESTS) {
      return { ok: false, retryAfter: RATE_LIMIT_WINDOW_S }
    }
    return { ok: true }
  } catch {
    // Fallback: in-memory rate limiter (single replica / local dev)
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

  // Credit quota — block if the user exceeded their token budget
  const quota = await checkQuota(session.user.id)
  if (!quota.allowed) {
    throw createError({
      statusCode: 429,
      statusMessage: 'Quota exceeded',
      data: {
        why: `You've used ${quota.summary.totalTokens} of ${quota.summary.quota} tokens.`,
        fix: 'Upgrade your plan or wait for your quota to reset.',
      },
    })
  }

  if (!hasAIProvider()) {
    throw createError({
      statusCode: 500,
      statusMessage: 'No AI provider configured',
      data: {
        why: 'Set at least one of OPENAI_API_KEY, ANTHROPIC_API_KEY, or GOOGLE_GENERATIVE_AI_API_KEY.',
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

  try {
    const { text, steps, usage, finishReason } = await generateText({
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
      // Propagate the request abort signal so disconnecting stops the model
      // from generating (and billing) in the background.
      abortSignal: AbortSignal.timeout(120_000), // 2 min cap
    })

    // Log total usage for cost attribution
    if (usage) {
      console.log('[chat] total usage', {
        userId: session.user.id,
        complexity: routerConfig.complexity,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        totalTokens: usage.totalTokens,
        steps: steps?.length || 0,
        finishReason,
      })

      // Persist usage to the credit ledger (best-effort — never blocks the reply)
      await recordUsage(session.user.id, {
        complexity: routerConfig.complexity,
        inputTokens: usage.inputTokens ?? 0,
        outputTokens: usage.outputTokens ?? 0,
        totalTokens: usage.totalTokens ?? 0,
      })
    }

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
    // Powers the "command trace" panel in the UI (no black box).
    const trace = (steps || []).flatMap((s: any) => {
      const toolCalls = s.toolCalls || []
      return toolCalls.flatMap((tc: any) => {
        const args = tc.args as any
        const commands = args?.commands || (args?.command ? [args.command] : [])
        return commands.map((cmd: string) => ({ cmd, tool: tc.toolName || 'bash' }))
      })
    })

    return {
      text,
      references,
      trace,
      usage: usage ? { inputTokens: usage.inputTokens, outputTokens: usage.outputTokens, totalTokens: usage.totalTokens } : undefined,
    }
  } catch (error: any) {
    // Don't log abort errors — they're expected when users disconnect
    if (error?.name === 'AbortError') {
      throw createError({
        statusCode: 499,
        statusMessage: 'Request cancelled',
      })
    }
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
})
