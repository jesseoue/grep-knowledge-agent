import { generateText, Output } from 'ai'
import type { UIMessage } from 'ai'
import { ROUTER_SYSTEM_PROMPT } from '../prompts/router'
import { agentConfigSchema, getDefaultConfig } from './schema'
import type { AgentConfig } from './schema'

function extractQuestionFromMessages(messages: UIMessage[]): string {
  const lastUserMessage = [...messages].reverse().find(m => m.role === 'user')
  if (!lastUserMessage) return ''

  const textParts = lastUserMessage.parts
    ?.filter((p): p is { type: 'text', text: string } => p.type === 'text')
    .map(p => p.text)
    .join('\n')

  return textParts || ''
}

/**
 * Route a question to the appropriate complexity/model configuration.
 * @param model AI SDK language model (must support structured output)
 */
export async function routeQuestion(
  messages: UIMessage[],
  model: Parameters<typeof generateText>[0]['model'],
): Promise<AgentConfig> {
  const question = extractQuestionFromMessages(messages)
  if (!question) {
    return getDefaultConfig()
  }

  try {
    const { output } = await generateText({
      model,
      output: Output.object({ schema: agentConfigSchema }),
      messages: [
        { role: 'system', content: ROUTER_SYSTEM_PROMPT },
        { role: 'user', content: `Question: ${question}` },
      ],
    })

    if (!output) {
      return getDefaultConfig()
    }

    return output
  } catch {
    return getDefaultConfig()
  }
}
