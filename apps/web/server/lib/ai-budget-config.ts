const USD_TO_MICROUSD = 1_000_000

function numberFromEnv(name: string, fallback: number, minimum: number, maximum: number): number {
  const raw = process.env[name]
  if (raw === undefined || raw.trim() === '') return fallback

  const value = Number(raw)
  if (!Number.isFinite(value)) {
    console.warn(`[ai-budget] ignoring invalid ${name}`)
    return fallback
  }

  return Math.min(maximum, Math.max(minimum, value))
}

function integerFromEnv(name: string, fallback: number, minimum: number, maximum: number): number {
  return Math.trunc(numberFromEnv(name, fallback, minimum, maximum))
}

export interface AiBudgetConfig {
  enabled: boolean
  dailyBudgetMicrousd: number
  requestReservationMicrousd: number
  maxOutputTokens: number
  maxSteps: number
  rateLimitRequests: number
  maxModelTier: 'cheap' | 'balanced' | 'powerful'
  routerEnabled: boolean
}

function modelTierFromEnv(): AiBudgetConfig['maxModelTier'] {
  const value = process.env.AI_MAX_MODEL_TIER?.trim().toLowerCase()
  return value === 'cheap' || value === 'balanced' || value === 'powerful' ? value : 'powerful'
}

/** Central source of truth for every server-side AI spend control. */
export function getAiBudgetConfig(): AiBudgetConfig {
  const dailyBudgetUsd = numberFromEnv('DAILY_LLM_BUDGET_USD', 0, 0, 10_000)
  const requestReservationUsd = numberFromEnv('MAX_LLM_REQUEST_USD', 0.25, 0.001, 100)

  return {
    enabled: process.env.AI_ENABLED?.trim().toLowerCase() !== 'false',
    dailyBudgetMicrousd: Math.round(dailyBudgetUsd * USD_TO_MICROUSD),
    requestReservationMicrousd: Math.round(
      Math.min(requestReservationUsd, dailyBudgetUsd || requestReservationUsd) * USD_TO_MICROUSD,
    ),
    maxOutputTokens: integerFromEnv('AI_MAX_OUTPUT_TOKENS', 800, 64, 4096),
    maxSteps: integerFromEnv('AI_MAX_STEPS', 8, 1, 30),
    rateLimitRequests: integerFromEnv('AI_RATE_LIMIT_PER_MINUTE', 10, 1, 120),
    maxModelTier: modelTierFromEnv(),
    routerEnabled: process.env.AI_ROUTER_ENABLED?.trim().toLowerCase() !== 'false',
  }
}

export function microusdToUsd(value: number): number {
  return value / USD_TO_MICROUSD
}

export function usdToMicrousd(value: number): number {
  if (!Number.isFinite(value) || value < 0) return 0
  return Math.round(value * USD_TO_MICROUSD)
}

export function utcBudgetDate(now = new Date()): string {
  return now.toISOString().slice(0, 10)
}

export function nextUtcBudgetReset(now = new Date()): string {
  return new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + 1,
  )).toISOString()
}
