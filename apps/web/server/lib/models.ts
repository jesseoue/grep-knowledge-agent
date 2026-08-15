/**
 * AI model resolver — constructs provider-specific model instances from the
 * user's configured API keys. Bring-your-own-key: set at least one of
 *   OPENROUTER_API_KEY, OPENAI_API_KEY, ANTHROPIC_API_KEY, GOOGLE_GENERATIVE_AI_API_KEY.
 *
 * OpenRouter is preferred: one key unlocks every model from every vendor via
 * a single compatible endpoint. The complexity router is *provider-agnostic* —
 * it uses whatever provider is configured (any single key works), falling back
 * through the provider priority list.
 */
import { createOpenAI } from '@ai-sdk/openai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import type { LanguageModel } from 'ai'
import {
  MODEL_TIERS,
  PROVIDER_PRIORITY,
  tierForComplexity,
} from '@grep/agent'
import type { Provider, ModelTier, Complexity } from '@grep/agent'
import { openRouterMetadataExtractor } from './openrouter-usage'

interface RuntimeAIConfig {
  openrouterApiKey: string
  openaiApiKey: string
  anthropicApiKey: string
  googleApiKey: string
}

function getRuntimeConfig(): RuntimeAIConfig {
  const config = useRuntimeConfig()
  return {
    openrouterApiKey: config.openrouterApiKey || process.env.OPENROUTER_API_KEY || '',
    openaiApiKey: config.openaiApiKey || process.env.OPENAI_API_KEY || '',
    anthropicApiKey: config.anthropicApiKey || process.env.ANTHROPIC_API_KEY || '',
    googleApiKey: config.googleApiKey || process.env.GOOGLE_GENERATIVE_AI_API_KEY || '',
  }
}

/** Keys grouped by provider, only including configured ones. */
function configuredProviders(): Record<Provider, string> {
  const { openrouterApiKey, openaiApiKey, anthropicApiKey, googleApiKey } = getRuntimeConfig()
  return {
    openrouter: openrouterApiKey,
    anthropic: anthropicApiKey,
    openai: openaiApiKey,
    gemini: googleApiKey,
  }
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
    case 'openrouter':
      if (!keys.openrouter) throw noProviderError('OPENROUTER_API_KEY')
      // OpenRouter exposes an OpenAI-compatible API at /api/v1.
      return createOpenAICompatible({
        name: 'openrouter',
        baseURL: 'https://openrouter.ai/api/v1',
        apiKey: keys.openrouter,
        metadataExtractor: openRouterMetadataExtractor,
        supportsStructuredOutputs: true,
        headers: {
          'HTTP-Referer': process.env.PUBLIC_SITE_URL || 'https://railway.com',
          'X-Title': 'Grep Knowledge Agent',
        },
      })(modelId)
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
  if (!provider) throw noProviderError('OPENROUTER_API_KEY')
  return buildModel(provider, MODEL_TIERS[tier][provider])
}

/** Get the router model — provider-agnostic, uses the cheapest tier available. */
export function resolveRouterModel(): LanguageModel {
  return resolveModelForTier('cheap')
}

/** Resolve the model that should answer a question of a given complexity. */
export function resolveModelForComplexity(
  complexity: Complexity,
  maxTier: ModelTier = 'powerful',
): LanguageModel {
  const tiers: ModelTier[] = ['cheap', 'balanced', 'powerful']
  const requestedTier = tierForComplexity(complexity)
  const cappedTier = tiers[Math.min(tiers.indexOf(requestedTier), tiers.indexOf(maxTier))] || 'cheap'
  return resolveModelForTier(cappedTier)
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
      fix: `Set at least one of OPENROUTER_API_KEY (recommended), OPENAI_API_KEY, ANTHROPIC_API_KEY, or GOOGLE_GENERATIVE_AI_API_KEY in your Railway project variables. See docs/ENVIRONMENT.md for where to get a key.`,
    },
  })
}
