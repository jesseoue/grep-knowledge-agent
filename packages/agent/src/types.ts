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
