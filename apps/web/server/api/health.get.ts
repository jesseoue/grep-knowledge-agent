export default defineEventHandler(async () => {
  const checks: Record<string, string> = {}

  // Check DB connectivity (best-effort — don't fail the healthcheck if DB is slow)
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

  const allOk = Object.values(checks).every(v => v === 'ok')

  return {
    status: allOk ? 'ok' : 'degraded',
    service: 'grep-knowledge-agent',
    checks,
    time: new Date().toISOString(),
  }
})
