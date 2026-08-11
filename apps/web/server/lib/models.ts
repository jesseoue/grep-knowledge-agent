/**
 * Shared AI model resolver — constructs provider-specific model instances
 * from environment keys. Used by both the chat endpoint and the router.
 *
 * Bring-your-own-key: set at least one of
 *   OPENAI_API_KEY, ANTHROPIC_API_KEY, GOOGLE_GENERATIVE_AI_API_KEY
 */
import { createOpenAI } from '@ai-sdk/openai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import type { LanguageModel } from 'ai'
import { resolveModelId, ROUTER_MODEL_ALIAS, DEFAULT_MODEL_ALIAS } from '@grep/agent'

interface RuntimeAIConfig {
  openaiApiKey: string
  anthropicApiKey: string
  googleApiKey: string
}

function getRuntimeConfig(): RuntimeAIConfig {
  const config = useRuntimeConfig()
  return {
    openaiApiKey: config.openaiApiKey || process.env.OPENAI_API_KEY || '',
    anthropicApiKey: config.anthropicApiKey || process.env.ANTHROPIC_API_KEY || '',
    googleApiKey: config.googleApiKey || process.env.GOOGLE_GENERATIVE_AI_API_KEY || '',
  }
}

/** Build a model instance from a short alias (e.g. "sonnet" → claude-sonnet-4). */
export function resolveModel(alias: string): LanguageModel {
  const { openaiApiKey, anthropicApiKey, googleApiKey } = getRuntimeConfig()
  const modelId = resolveModelId(alias)

  // Route to the correct provider based on the resolved model ID prefix
  if (modelId.startsWith('claude-')) {
    if (!anthropicApiKey) throw noProviderError('ANTHROPIC_API_KEY')
    return createAnthropic({ apiKey: anthropicApiKey })(modelId)
  }
  if (modelId.startsWith('gemini-')) {
    if (!googleApiKey) throw noProviderError('GOOGLE_GENERATIVE_AI_API_KEY')
    return createGoogleGenerativeAI({ apiKey: googleApiKey })(modelId)
  }
  // Default: OpenAI
  if (!openaiApiKey) throw noProviderError('OPENAI_API_KEY')
  return createOpenAI({ apiKey: openaiApiKey })(modelId)
}

/** Get the router model — lightweight model for classifying question complexity. */
export function resolveRouterModel(): LanguageModel {
  return resolveModel(ROUTER_MODEL_ALIAS)
}

/** Get the default/fallback model. */
export function resolveDefaultModel(): LanguageModel {
  return resolveModel(DEFAULT_MODEL_ALIAS)
}

/** Check if at least one AI provider is configured. */
export function hasAIProvider(): boolean {
  const { openaiApiKey, anthropicApiKey, googleApiKey } = getRuntimeConfig()
  return !!(openaiApiKey || anthropicApiKey || googleApiKey)
}

function noProviderError(envVar: string) {
  return createError({
    statusCode: 500,
    statusMessage: `Missing ${envVar}`,
    data: {
      why: `The selected model requires ${envVar} to be set.`,
      fix: `Add ${envVar} in your Railway project variables. See docs/ENVIRONMENT.md for where to get a key.`,
    },
  })
}
