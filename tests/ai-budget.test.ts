import { afterEach, describe, expect, test } from 'bun:test'
import {
  getAiBudgetConfig,
  microusdToUsd,
  nextUtcBudgetReset,
  usdToMicrousd,
  utcBudgetDate,
} from '../apps/web/server/lib/ai-budget-config'
import { getOpenRouterCostUsd, openRouterMetadataExtractor } from '../apps/web/server/lib/openrouter-usage'

const envNames = [
  'AI_ENABLED', 'DAILY_LLM_BUDGET_USD', 'MAX_LLM_REQUEST_USD',
  'AI_MAX_OUTPUT_TOKENS', 'AI_MAX_STEPS', 'AI_RATE_LIMIT_PER_MINUTE', 'AI_MAX_MODEL_TIER',
  'AI_ROUTER_ENABLED',
] as const
const originalEnv = Object.fromEntries(envNames.map(name => [name, process.env[name]]))

afterEach(() => {
  for (const name of envNames) {
    const original = originalEnv[name]
    if (original === undefined) delete process.env[name]
    else process.env[name] = original
  }
})

describe('AI budget configuration', () => {
  test('uses bounded generation defaults without forcing a self-hosted budget', () => {
    for (const name of envNames) delete process.env[name]
    expect(getAiBudgetConfig()).toEqual({
      enabled: true,
      dailyBudgetMicrousd: 0,
      requestReservationMicrousd: 250_000,
      maxOutputTokens: 800,
      maxSteps: 8,
      rateLimitRequests: 10,
      maxModelTier: 'powerful',
      routerEnabled: true,
    })
  })

  test('parses, clamps, and normalizes owner controls', () => {
    process.env.AI_ENABLED = ' FALSE '
    process.env.DAILY_LLM_BUDGET_USD = '4'
    process.env.MAX_LLM_REQUEST_USD = '10'
    process.env.AI_MAX_OUTPUT_TOKENS = '12000'
    process.env.AI_MAX_STEPS = '0'
    process.env.AI_RATE_LIMIT_PER_MINUTE = '5'
    process.env.AI_MAX_MODEL_TIER = 'CHEAP'
    process.env.AI_ROUTER_ENABLED = 'false'
    expect(getAiBudgetConfig()).toEqual({
      enabled: false,
      dailyBudgetMicrousd: 4_000_000,
      requestReservationMicrousd: 4_000_000,
      maxOutputTokens: 4096,
      maxSteps: 1,
      rateLimitRequests: 5,
      maxModelTier: 'cheap',
      routerEnabled: false,
    })
  })

  test('converts money and UTC reset boundaries deterministically', () => {
    const now = new Date('2026-08-15T23:59:59.000Z')
    expect(usdToMicrousd(0.123456)).toBe(123_456)
    expect(microusdToUsd(123_456)).toBe(0.123456)
    expect(utcBudgetDate(now)).toBe('2026-08-15')
    expect(nextUtcBudgetReset(now)).toBe('2026-08-16T00:00:00.000Z')
  })
})

describe('OpenRouter cost accounting', () => {
  test('extracts cost from complete and streaming responses', async () => {
    const complete = await openRouterMetadataExtractor.extractMetadata({
      parsedBody: { usage: { cost: 0.012345 } },
    })
    expect(getOpenRouterCostUsd(complete)).toBe(0.012345)

    const stream = openRouterMetadataExtractor.createStreamExtractor()
    stream.processChunk({ choices: [{ delta: { content: 'hello' } }] })
    stream.processChunk({ choices: [], usage: { cost: 0.006789 } })
    expect(getOpenRouterCostUsd(stream.buildMetadata())).toBe(0.006789)
  })

  test('rejects invalid costs', async () => {
    expect(await openRouterMetadataExtractor.extractMetadata({ parsedBody: {} })).toBeUndefined()
    expect(await openRouterMetadataExtractor.extractMetadata({ parsedBody: { usage: { cost: -1 } } })).toBeUndefined()
    expect(await openRouterMetadataExtractor.extractMetadata({ parsedBody: { usage: { cost: '1' } } })).toBeUndefined()
  })
})
