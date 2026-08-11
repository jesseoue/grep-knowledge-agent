/**
 * Central model registry — single source of truth for all AI model identifiers.
 *
 * Model IDs are kept current with each provider's latest stable releases.
 * Update here and every consumer (router, chat, agent) picks it up.
 *
 * @see https://ai-sdk.dev/providers/ai-sdk-providers/openai
 * @see https://ai-sdk.dev/providers/ai-sdk-providers/anthropic
 * @see https://ai-sdk.dev/providers/ai-sdk-providers/google-generative-ai
 */

/** Short alias → full provider model ID. */
export const MODEL_ALIASES = {
  /** Google Gemini 2.0 Flash — fast/cheap, for trivial & simple questions */
  'gemini-flash': 'gemini-2.0-flash',
  /** Google Gemini 2.5 Flash — balanced, fallback for moderate */
  'gemini-flash-latest': 'gemini-2.5-flash',
  /** Anthropic Claude Sonnet 4 — strong reasoning, for moderate questions */
  'sonnet': 'claude-sonnet-4-20250514',
  /** Anthropic Claude Haiku 4 — fast/cheap router model */
  'haiku': 'claude-haiku-4-20250514',
  /** Anthropic Claude Opus 4 — deepest reasoning, for complex questions */
  'opus': 'claude-opus-4-20250514',
  /** OpenAI GPT-4o mini — fast/cheap, alternative for trivial/simple */
  'gpt-4o-mini': 'gpt-4o-mini',
  /** OpenAI GPT-4o — strong general-purpose, alternative for moderate */
  'gpt-4o': 'gpt-4o',
} as const

export type ModelAlias = keyof typeof MODEL_ALIASES

/** Router model — lightweight, used to classify question complexity. */
export const ROUTER_MODEL_ALIAS: ModelAlias = 'haiku'

/** Default model when routing fails or no preference is expressed. */
export const DEFAULT_MODEL_ALIAS: ModelAlias = 'sonnet'

/** All valid model aliases for the router schema enum. */
export const ROUTER_MODEL_CHOICES = [
  'gemini-flash',
  'sonnet',
  'opus',
  'gpt-4o-mini',
  'gpt-4o',
] as const

/** Resolve a short alias to a full provider model ID. */
export function resolveModelId(alias: string): string {
  return (MODEL_ALIASES as Record<string, string>)[alias] ?? alias
}
