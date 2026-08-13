import { migrate } from 'drizzle-orm/postgres-js/migrator'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'

/**
 * Runs pending database migrations at server startup.
 *
 * This makes the template work out-of-the-box on a fresh Railway deploy —
 * no manual `drizzle-kit migrate` step required. Migrations are idempotent
 * (tracked in the `__drizzle_migrations` table), so this is safe to run on
 * every boot.
 *
 * IMPORTANT: this uses its OWN short-lived postgres connection and closes it
 * when done. It must NOT reuse `getDb()`/`getSql()` — the migration would
 * close the app's shared connection pool and every later query (auth, chat,
 * usage) would fail with "write CONNECTION_ENDED".
 */
export default defineNitroPlugin(async () => {
  let sql: ReturnType<typeof postgres> | undefined
  try {
    const url = process.env.DATABASE_URL
    if (!url) {
      console.error('[db] DATABASE_URL is not set — skipping migrations')
      return
    }

    // Fresh, dedicated connection for migrations (closed below).
    sql = postgres(url, { max: 1, prepare: false })
    const db = drizzle(sql, { schema: undefined })

    // In production (Docker), CWD is /app and migrations are at apps/web/server/db/migrations
    // In dev, CWD is apps/web and migrations are at server/db/migrations
    const migrationsFolder = process.env.NODE_ENV === 'production'
      ? 'apps/web/server/db/migrations'
      : 'server/db/migrations'

    await migrate(db, { migrationsFolder })
    console.log('[db] migrations applied')
  } catch (error) {
    console.error('[db] migration failed:', error)
  } finally {
    // Only close the migration's own connection, never the app pool.
    await sql?.end().catch(() => {})
  }
})
