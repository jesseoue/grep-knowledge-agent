import { getDb, schema } from '../db'
import { and, eq, sql } from 'drizzle-orm'
import {
  getAiBudgetConfig,
  microusdToUsd,
  nextUtcBudgetReset,
  usdToMicrousd,
  utcBudgetDate,
} from './ai-budget-config'

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
  requestId?: string
  callKind?: 'router' | 'answer'
  costUsd?: number
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
      costMicrousd: usage.costUsd === undefined ? null : usdToMicrousd(usage.costUsd),
      requestId: usage.requestId || null,
      callKind: usage.callKind || 'answer',
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
  dailyBudget: DailyBudgetSummary | null
}

export interface DailyBudgetSummary {
  limitUsd: number
  usedUsd: number
  remainingUsd: number
  resetAt: string
}

async function getDailyBudgetSummaryForDate(budgetDate: string): Promise<DailyBudgetSummary | null> {
  const { dailyBudgetMicrousd } = getAiBudgetConfig()
  if (dailyBudgetMicrousd <= 0) return null

  const db = getDb()
  const rows = await db.select({
    usedMicrousd: sql<number>`coalesce(sum(case
      when ${schema.budgetReservations.status} = 'reserved' then ${schema.budgetReservations.reservedMicrousd}
      when ${schema.budgetReservations.status} = 'settled' then ${schema.budgetReservations.chargedMicrousd}
      else 0 end), 0)`,
  }).from(schema.budgetReservations).where(eq(schema.budgetReservations.budgetDate, budgetDate))

  const usedMicrousd = Number(rows[0]?.usedMicrousd || 0)
  return {
    limitUsd: microusdToUsd(dailyBudgetMicrousd),
    usedUsd: microusdToUsd(usedMicrousd),
    remainingUsd: microusdToUsd(Math.max(0, dailyBudgetMicrousd - usedMicrousd)),
    resetAt: nextUtcBudgetReset(),
  }
}

/** Aggregate token usage for a user (all time). */
export async function getUsageSummary(userId: string): Promise<UsageSummary> {
  const quota = MAX_TOKENS_PER_USER > 0 ? MAX_TOKENS_PER_USER : null
  try {
    const db = getDb()
    const rows = await db.select({
      totalTokens: sql<number>`coalesce(sum(${schema.usage.totalTokens}), 0)`,
      totalRequests: sql<number>`count(distinct coalesce(${schema.usage.requestId}, ${schema.usage.id}))`,
    }).from(schema.usage).where(sql`${schema.usage.userId} = ${userId}`)

    const totalTokens = Number(rows[0]?.totalTokens || 0)
    const totalRequests = Number(rows[0]?.totalRequests || 0)

    const dailyBudget = await getDailyBudgetSummaryForDate(utcBudgetDate())
    return {
      totalTokens,
      totalRequests,
      quota,
      remaining: quota !== null ? Math.max(0, quota - totalTokens) : null,
      dailyBudget,
    }
  } catch {
    return { totalTokens: 0, totalRequests: 0, quota, remaining: quota, dailyBudget: null }
  }
}

export interface BudgetAdmission {
  allowed: boolean
  reservationId: string | null
  summary: DailyBudgetSummary | null
}

/** Atomically reserve the maximum permitted cost before either model call. */
export async function reserveDailyBudget(userId: string): Promise<BudgetAdmission> {
  const { dailyBudgetMicrousd, requestReservationMicrousd } = getAiBudgetConfig()
  if (dailyBudgetMicrousd <= 0) {
    return { allowed: true, reservationId: null, summary: null }
  }

  const budgetDate = utcBudgetDate()
  const reservationId = crypto.randomUUID()
  const db = getDb()

  return db.transaction(async (tx) => {
    // Serializes admission for this UTC day across every application replica.
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`llm-budget:${budgetDate}`}))`)

    const rows = await tx.select({
      usedMicrousd: sql<number>`coalesce(sum(case
        when ${schema.budgetReservations.status} = 'reserved' then ${schema.budgetReservations.reservedMicrousd}
        when ${schema.budgetReservations.status} = 'settled' then ${schema.budgetReservations.chargedMicrousd}
        else 0 end), 0)`,
    }).from(schema.budgetReservations).where(eq(schema.budgetReservations.budgetDate, budgetDate))

    const usedMicrousd = Number(rows[0]?.usedMicrousd || 0)
    const summary: DailyBudgetSummary = {
      limitUsd: microusdToUsd(dailyBudgetMicrousd),
      usedUsd: microusdToUsd(usedMicrousd),
      remainingUsd: microusdToUsd(Math.max(0, dailyBudgetMicrousd - usedMicrousd)),
      resetAt: nextUtcBudgetReset(),
    }

    if (usedMicrousd + requestReservationMicrousd > dailyBudgetMicrousd) {
      return { allowed: false, reservationId: null, summary }
    }

    await tx.insert(schema.budgetReservations).values({
      id: reservationId,
      userId,
      budgetDate,
      reservedMicrousd: requestReservationMicrousd,
    })

    return {
      allowed: true,
      reservationId,
      summary: {
        ...summary,
        usedUsd: microusdToUsd(usedMicrousd + requestReservationMicrousd),
        remainingUsd: microusdToUsd(dailyBudgetMicrousd - usedMicrousd - requestReservationMicrousd),
      },
    }
  })
}

/** Reconcile a reservation to exact provider cost, or conservatively charge it. */
export async function settleDailyBudget(reservationId: string | null, costUsd?: number): Promise<void> {
  if (!reservationId) return

  const db = getDb()
  const chargedMicrousd = costUsd === undefined ? null : usdToMicrousd(costUsd)
  await db.update(schema.budgetReservations).set({
    status: 'settled',
    chargedMicrousd: chargedMicrousd ?? sql`${schema.budgetReservations.reservedMicrousd}`,
    updatedAt: new Date(),
  }).where(and(
    eq(schema.budgetReservations.id, reservationId),
    eq(schema.budgetReservations.status, 'reserved'),
  ))
}

/** Check if a user has exceeded their quota. Returns true when allowed. */
export async function checkQuota(userId: string): Promise<{ allowed: boolean, summary: UsageSummary }> {
  const summary = await getUsageSummary(userId)
  if (summary.quota === null) return { allowed: true, summary }
  return { allowed: summary.totalTokens < summary.quota, summary }
}
