import { generateText, Output } from 'ai'
import type { LanguageModelUsage, ProviderMetadata, UIMessage } from 'ai'
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
  onUsage?: (telemetry: {
    usage: LanguageModelUsage
    providerMetadata: ProviderMetadata | undefined
  }) => void,
): Promise<AgentConfig> {
  const question = extractQuestionFromMessages(messages)
  if (!question) {
    return getDefaultConfig()
  }

  try {
    const result = await generateText({
      model,
      output: Output.object({ schema: agentConfigSchema }),
      instructions: ROUTER_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: `Question: ${question}` }],
      maxOutputTokens: 800,
    })

    onUsage?.({
      usage: result.totalUsage,
      providerMetadata: result.providerMetadata,
    })

    if (!result.output) {
      return getDefaultConfig()
    }

    return result.output
  } catch {
    return getDefaultConfig()
  }
}
