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

export type { UIMessage }
