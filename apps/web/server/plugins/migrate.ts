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
    await migrate(db, { migrationsFolder: 'server/db/migrations' })
    console.log('[db] migrations applied')
    // Close the raw connection pool used only for migration setup
    await sql.end()
  } catch (error) {
    console.error('[db] migration failed:', error)
  }
})