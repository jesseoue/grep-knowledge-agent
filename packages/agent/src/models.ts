/**
 * Central model registry — single source of truth for AI model selection.
 *
 * Models are organized into *tiers* (cheap / balanced / powerful), and each
 * tier maps to a concrete model ID per provider. The resolver in the web app
 * picks the provider the user has configured (bring-your-own-key), so the
 * template works with *any single* API key — OpenAI, Anthropic, or Google.
 *
 * Model IDs are kept current with each provider's latest stable releases.
 * Update here and every consumer (router, chat, agent) picks it up.
 *
 * @see https://ai-sdk.dev/providers/ai-sdk-providers/openai
 * @see https://ai-sdk.dev/providers/ai-sdk-providers/anthropic
 * @see https://ai-sdk.dev/providers/ai-sdk-providers/google-generative-ai
 */

export type ModelTier = 'cheap' | 'balanced' | 'powerful'
export type Complexity = 'trivial' | 'simple' | 'moderate' | 'complex'
export type Provider = 'anthropic' | 'openai' | 'gemini'

/** Concrete model IDs per tier and provider. */
export const MODEL_TIERS: Record<ModelTier, Record<Provider, string>> = {
  // Router / trivial / simple questions — fast + cheap
  cheap: {
    anthropic: 'claude-haiku-4-5',
    openai: 'gpt-4o-mini',
    gemini: 'gemini-2.5-flash',
  },
  // Moderate questions — strong reasoning
  balanced: {
    anthropic: 'claude-sonnet-4-6',
    openai: 'gpt-4o',
    gemini: 'gemini-2.5-flash',
  },
  // Complex questions — deepest reasoning
  powerful: {
    anthropic: 'claude-opus-4-8',
    openai: 'gpt-4o',
    gemini: 'gemini-2.5-flash',
  },
}

/**
 * Preferred provider order when multiple keys are set.
 * Anthropic first (strongest), then OpenAI, then Gemini (free tier).
 */
export const PROVIDER_PRIORITY: Provider[] = ['anthropic', 'openai', 'gemini']

/** Map question complexity to the model tier used to answer it. */
export const COMPLEXITY_TIER: Record<Complexity, ModelTier> = {
  trivial: 'cheap',
  simple: 'cheap',
  moderate: 'balanced',
  complex: 'powerful',
}

export function tierForComplexity(complexity: Complexity): ModelTier {
  return COMPLEXITY_TIER[complexity]
}

/**
 * Back-compat alias resolution. Accepts a short alias ("sonnet") or a full
 * provider model ID and returns the model ID. New code should use tiers.
 */
export function resolveModelId(alias: string): string {
  return MODEL_ALIASES[alias as ModelAlias] ?? alias
}

/** Short aliases kept for convenience / docs. */
export const MODEL_ALIASES = {
  'gemini-flash': MODEL_TIERS.cheap.gemini,
  'haiku': MODEL_TIERS.cheap.anthropic,
  'sonnet': MODEL_TIERS.balanced.anthropic,
  'opus': MODEL_TIERS.powerful.anthropic,
  'gpt-4o-mini': MODEL_TIERS.cheap.openai,
  'gpt-4o': MODEL_TIERS.balanced.openai,
} as const

export type ModelAlias = keyof typeof MODEL_ALIASES
