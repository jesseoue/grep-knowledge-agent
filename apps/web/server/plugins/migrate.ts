import { migrate } from 'drizzle-orm/postgres-js/migrator'
import { getDb, getSql } from '../db'

/**
 * Runs pending database migrations at server startup.
 *
 * This makes the template work out-of-the-box on a fresh Railway deploy —
 * no manual `drizzle-kit migrate` step required. Migrations are idempotent
 * (tracked in the `__drizzle_migrations` table), so this is safe to run on
 * every boot.
 */
export default defineNitroPlugin(async () => {
  try {
    const db = getDb()
    const sql = getSql()

    // In production (Docker), CWD is /app and migrations are at apps/web/server/db/migrations
    // In dev, CWD is apps/web and migrations are at server/db/migrations
    const migrationsFolder = process.env.NODE_ENV === 'production'
      ? 'apps/web/server/db/migrations'
      : 'server/db/migrations'

    await migrate(db, { migrationsFolder })
    console.log('[db] migrations applied')
    await sql.end()
  } catch (error) {
    console.error('[db] migration failed:', error)
  }
})