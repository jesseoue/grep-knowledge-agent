import { z } from 'zod'
import { generateText, stepCountIs } from 'ai'
import { createSavoir } from '@grep/sdk'
import { routeQuestion } from '@grep/agent'
import { getAgentConfig } from '../lib/agent-config'
import { requireUserSession } from '../lib/session'
import { resolveRouterModel, resolveModel, hasAIProvider } from '../lib/models'

const bodySchema = z.object({
  messages: z.array(z.object({
    role: z.enum(['user', 'assistant', 'system']),
    content: z.string(),
  })),
})

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const body = await readValidatedBody(event, bodySchema.parse)

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

  // Classify question complexity to budget model + steps
  const routerModel = resolveRouterModel()
  const routerConfig = await routeQuestion(messages as any, routerModel)

  // Resolve the main model from the router's choice
  const mainModel = resolveModel(routerConfig.model)

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
    const { text, steps } = await generateText({
      model: mainModel,
      system: [
        'You are a knowledge agent. Answer questions using the files in the knowledge base.',
        `Response style: ${agentConfig.responseStyle || 'concise'}`,
        agentConfig.additionalPrompt || '',
        searchInstructions,
        'Cite the files you read inline as [filename].',
      ].filter(Boolean).join('\n\n'),
      messages: body.messages,
      tools: {
        bash: savoir.tools.bash,
        bash_batch: savoir.tools.bash_batch,
      },
      stopWhen: stepCountIs(routerConfig.maxSteps),
      temperature: agentConfig.temperature ?? 0.7,
    })

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

    return { text, references }
  } catch (error) {
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
