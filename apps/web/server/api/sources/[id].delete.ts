import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { getDb, schema } from '../../db'
import { requireUserSession } from '../../lib/session'

export default defineEventHandler(async (event) => {
  await requireUserSession(event)

  const { id } = await getValidatedRouterParams(event, z.object({ id: z.string() }).parse)
  const db = getDb()

  try {
    await db.delete(schema.sources).where(eq(schema.sources.id, id))
    return { success: true }
  } catch (error) {
    console.error('[sources.delete]', error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to delete source',
      data: { why: error instanceof Error ? error.message : 'Unknown error' },
    })
  }
})
