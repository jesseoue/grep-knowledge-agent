export default defineEventHandler(async (event) => {
  const checks: Record<string, string> = {}

  // A green healthcheck means the template is actually ready to use.
  try {
    const { getDb } = await import('../db')
    const db = getDb()
    const { sql } = await import('drizzle-orm')
    await db.execute(sql`SELECT 1`)
    checks.db = 'ok'
  } catch {
    checks.db = 'error'
  }

  // Check Redis (best-effort)
  try {
    const { getRedis } = await import('../lib/redis')
    const redis = getRedis()
    await redis.ping()
    checks.redis = 'ok'
  } catch {
    checks.redis = 'error'
  }

  try {
    const sandboxUrl = (process.env.SANDBOX_URL || 'http://sandbox.railway.internal:3200').replace(/\/$/, '')
    const response = await fetch(`${sandboxUrl}/health`, { signal: AbortSignal.timeout(2_000) })
    checks.sandbox = response.ok ? 'ok' : 'error'
  } catch {
    checks.sandbox = 'error'
  }

  try {
    const { hasAIProvider } = await import('../lib/models')
    checks.ai = hasAIProvider() ? 'ok' : 'error'
  } catch {
    checks.ai = 'error'
  }

  const { getAiBudgetConfig, microusdToUsd } = await import('../lib/ai-budget-config')
  const aiBudget = getAiBudgetConfig()
  checks.aiBudget = !aiBudget.enabled
    ? 'paused'
    : aiBudget.dailyBudgetMicrousd > 0
      ? `$${microusdToUsd(aiBudget.dailyBudgetMicrousd).toFixed(2)}/day`
      : 'unlimited'

  if (aiBudget.dailyBudgetMicrousd > 0) {
    try {
      const { getDb, schema } = await import('../db')
      await getDb().select({ id: schema.budgetReservations.id }).from(schema.budgetReservations).limit(1)
      checks.aiBudgetStore = 'ok'
    } catch {
      checks.aiBudgetStore = 'error'
    }
  }

  // Provider keys are user configuration, not process readiness. Keeping them
  // out of the 503 decision lets a fresh Railway deploy become reachable so
  // the owner can finish setup without the platform killing the service.
  const requiredChecks = ['db', 'redis', 'sandbox']
  if (aiBudget.dailyBudgetMicrousd > 0) requiredChecks.push('aiBudgetStore')
  const infrastructureOk = requiredChecks.every(name => checks[name] === 'ok')
  const fullyConfigured = infrastructureOk && checks.ai === 'ok'
  setResponseStatus(event, infrastructureOk ? 200 : 503)

  return {
    status: fullyConfigured ? 'ok' : infrastructureOk ? 'needs_configuration' : 'degraded',
    service: 'grep-knowledge-agent',
    checks,
    time: new Date().toISOString(),
  }
})
