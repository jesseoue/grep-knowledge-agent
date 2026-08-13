/**
 * AI model resolver — constructs provider-specific model instances from the
 * user's configured API keys. Bring-your-own-key: set at least one of
 *   OPENAI_API_KEY, ANTHROPIC_API_KEY, GOOGLE_GENERATIVE_AI_API_KEY.
 *
 * The complexity router is *provider-agnostic*: it uses whatever provider is
 * configured (any single key works), falling back through the provider
 * priority list.
 */
import { createOpenAI } from '@ai-sdk/openai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import type { LanguageModel } from 'ai'
import {
  MODEL_TIERS,
  PROVIDER_PRIORITY,
  tierForComplexity,
} from '@grep/agent'
import type { Provider, ModelTier, Complexity } from '@grep/agent'

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

/** Keys grouped by provider, only including configured ones. */
function configuredProviders(): Record<Provider, string> {
  const { openaiApiKey, anthropicApiKey, googleApiKey } = getRuntimeConfig()
  const map: Record<Provider, string> = {
    anthropic: anthropicApiKey,
    openai: openaiApiKey,
    gemini: googleApiKey,
  }
  return map
}

function availableProviders(): Provider[] {
  const keys = configuredProviders()
  return PROVIDER_PRIORITY.filter(p => keys[p])
}

/** Resolve the preferred provider (first in priority order that is configured). */
export function preferredProvider(): Provider | null {
  return availableProviders()[0] || null
}

/** Build a model instance for a provider + model ID. */
function buildModel(provider: Provider, modelId: string): LanguageModel {
  const keys = configuredProviders()
  switch (provider) {
    case 'anthropic':
      if (!keys.anthropic) throw noProviderError('ANTHROPIC_API_KEY')
      return createAnthropic({ apiKey: keys.anthropic })(modelId)
    case 'gemini':
      if (!keys.gemini) throw noProviderError('GOOGLE_GENERATIVE_AI_API_KEY')
      return createGoogleGenerativeAI({ apiKey: keys.gemini })(modelId)
    default:
      if (!keys.openai) throw noProviderError('OPENAI_API_KEY')
      return createOpenAI({ apiKey: keys.openai })(modelId)
  }
}

/** Build a model from a tier, using the preferred available provider. */
export function resolveModelForTier(tier: ModelTier): LanguageModel {
  const provider = preferredProvider()
  if (!provider) throw noProviderError('OPENAI_API_KEY')
  return buildModel(provider, MODEL_TIERS[tier][provider])
}

/** Get the router model — provider-agnostic, uses the cheapest tier available. */
export function resolveRouterModel(): LanguageModel {
  return resolveModelForTier('cheap')
}

/** Resolve the model that should answer a question of a given complexity. */
export function resolveModelForComplexity(complexity: Complexity): LanguageModel {
  return resolveModelForTier(tierForComplexity(complexity))
}

/** Check if at least one AI provider is configured. */
export function hasAIProvider(): boolean {
  return availableProviders().length > 0
}

function noProviderError(envVar: string) {
  return createError({
    statusCode: 500,
    statusMessage: `Missing ${envVar}`,
    data: {
      why: `No AI provider is configured.`,
      fix: `Set at least one of OPENAI_API_KEY, ANTHROPIC_API_KEY, or GOOGLE_GENERATIVE_AI_API_KEY in your Railway project variables. See docs/ENVIRONMENT.md for where to get a key.`,
    },
  })
}
