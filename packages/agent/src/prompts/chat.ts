import type { UIMessage } from 'ai'

export interface AgentConfigData {
  additionalPrompt?: string
  responseStyle?: 'concise' | 'detailed' | 'technical' | 'friendly'
  language?: string
  defaultModel?: string
  maxStepsMultiplier?: number
  temperature?: number
  searchInstructions?: string
  citationFormat?: 'inline' | 'footnote' | 'none'
}

export interface RoutingResult {
  complexity: string
  maxSteps: number
  model: string
  reasoning: string
}

export interface AgentCallOptions {
  model?: string
  context?: Record<string, unknown>
}

export interface AgentExecutionContext {
  mode: 'chat' | 'admin'
  effectiveModel: string
  maxSteps: number
  routerConfig: RoutingResult
  agentConfig: AgentConfigData
  customContext?: Record<string, unknown>
}

export function buildChatSystemPrompt(config: AgentConfigData): string {
  const style = config.responseStyle || 'concise'
  const language = config.language || 'en'
  const searchInstructions = config.searchInstructions
  const additionalPrompt = config.additionalPrompt
  const citationFormat = config.citationFormat || 'inline'

  return `You are a helpful AI assistant with access to a knowledge base of documentation files.

## Response style
- Answer in ${style} style.
- Respond in ${language}.
${searchInstructions ? `## Search instructions\n${searchInstructions}` : ''}
${additionalPrompt ? `## Additional instructions\n${additionalPrompt}` : ''}

## Citations
${citationFormat === 'none'
    ? 'Do not include citations in your responses.'
    : citationFormat === 'footnote'
      ? 'When you reference a file you read, cite it as a footnote.'
      : 'When you reference a file you read, cite it inline as [filename.md].'}

## How to answer
1. Use the bash tool to search for relevant files with grep/find.
2. Read the most relevant files with cat/head.
3. Answer based strictly on what you find in the knowledge base.
4. If the answer is not in the knowledge base, say so clearly rather than guessing.`
}
