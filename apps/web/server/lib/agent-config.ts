import { eq } from 'drizzle-orm'
import { getDb, schema } from '../db'

export interface AgentConfigData {
  additionalPrompt?: string
  responseStyle?: string
  language?: string
  defaultModel?: string
  maxStepsMultiplier?: number
  temperature?: number
  searchInstructions?: string
  citationFormat?: string
}

const DEFAULT_CONFIG: AgentConfigData = {
  responseStyle: 'concise',
  language: 'en',
  maxStepsMultiplier: 1,
  temperature: 0.7,
  citationFormat: 'inline',
}

export async function getAgentConfig(): Promise<AgentConfigData> {
  try {
    const db = getDb()
    const configs = await db.select().from(schema.agentConfig)
    const active = configs.find(c => c.isActive) || configs[0]
    if (!active) return DEFAULT_CONFIG

    return {
      additionalPrompt: active.additionalPrompt || undefined,
      responseStyle: active.responseStyle || DEFAULT_CONFIG.responseStyle,
      language: active.language || DEFAULT_CONFIG.language,
      defaultModel: active.defaultModel || undefined,
      maxStepsMultiplier: active.maxStepsMultiplier ?? DEFAULT_CONFIG.maxStepsMultiplier,
      temperature: active.temperature ?? DEFAULT_CONFIG.temperature,
      searchInstructions: active.searchInstructions || undefined,
      citationFormat: active.citationFormat || DEFAULT_CONFIG.citationFormat,
    }
  } catch {
    return DEFAULT_CONFIG
  }
}
