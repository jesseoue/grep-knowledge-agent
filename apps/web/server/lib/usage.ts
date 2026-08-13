import { getDb, schema } from '../db'
import { sql } from 'drizzle-orm'

/**
 * Usage metering + credit-based quota.
 *
 * A "credit" is 1 token. Every chat request records its token usage in the
 * `usage` ledger, and users are capped at MAX_TOKENS_PER_USER (configurable,
 * unlimited by default). This supports credit/user-based business models:
 *   - Set MAX_TOKENS_PER_USER to cap free usage.
 *   - Read total tokens per user from the ledger to bill against credits.
 */

/** Default quota. Set MAX_TOKENS_PER_USER (or MAX_CREDITS_PER_USER) to cap. */
const MAX_TOKENS_PER_USER = Number(process.env.MAX_TOKENS_PER_USER || 0)

export interface UsageRecord {
  model?: string
  complexity?: 'trivial' | 'simple' | 'moderate' | 'complex'
  inputTokens: number
  outputTokens: number
  totalTokens: number
}

/** Record a chat request's token usage in the ledger. Best-effort. */
export async function recordUsage(userId: string, usage: UsageRecord): Promise<void> {
  try {
    const db = getDb()
    await db.insert(schema.usage).values({
      userId,
      model: usage.model || null,
      complexity: usage.complexity || null,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      totalTokens: usage.totalTokens,
    })
  } catch (error) {
    // Usage tracking must never break the chat. Log and continue.
    console.error('[usage] failed to record usage:', error)
  }
}

export interface UsageSummary {
  totalTokens: number
  totalRequests: number
  quota: number | null
  remaining: number | null
}

/** Aggregate token usage for a user (all time). */
export async function getUsageSummary(userId: string): Promise<UsageSummary> {
  const quota = MAX_TOKENS_PER_USER > 0 ? MAX_TOKENS_PER_USER : null
  try {
    const db = getDb()
    const rows = await db.select({
      totalTokens: sql<number>`coalesce(sum(${schema.usage.totalTokens}), 0)`,
      totalRequests: sql<number>`count(*)`,
    }).from(schema.usage).where(sql`${schema.usage.userId} = ${userId}`)

    const totalTokens = Number(rows[0]?.totalTokens || 0)
    const totalRequests = Number(rows[0]?.totalRequests || 0)

    return {
      totalTokens,
      totalRequests,
      quota,
      remaining: quota !== null ? Math.max(0, quota - totalTokens) : null,
    }
  } catch {
    return { totalTokens: 0, totalRequests: 0, quota, remaining: quota }
  }
}

/** Check if a user has exceeded their quota. Returns true when allowed. */
export async function checkQuota(userId: string): Promise<{ allowed: boolean, summary: UsageSummary }> {
  const summary = await getUsageSummary(userId)
  if (summary.quota === null) return { allowed: true, summary }
  return { allowed: summary.totalTokens < summary.quota, summary }
}
