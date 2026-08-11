import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

// Lazily-created singleton so tests and dev can run without a DB connection.
let _db: ReturnType<typeof drizzle> | null = null
let _sql: ReturnType<typeof postgres> | null = null

export function getDb() {
  if (_db) return _db

  const url = process.env.DATABASE_URL
  if (!url) {
    throw new Error('DATABASE_URL is not set')
  }

  _sql = postgres(url, { max: 10, prepare: false })
  _db = drizzle(_sql, { schema })
  return _db
}

export function getSql() {
  getDb()
  return _sql!
}

export { schema }
