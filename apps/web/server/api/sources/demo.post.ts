import { getDb, schema } from '../../db'
import { requireUserSession } from '../../lib/session'
import { and, eq } from 'drizzle-orm'

// Adds a pre-configured demo source so a brand-new user can try the agent
// immediately without typing a repo URL. Syncs the original template's docs.
export default defineEventHandler(async (event) => {
  await requireUserSession(event)
  const db = getDb()

  try {
    const [existing] = await db.select().from(schema.sources).where(and(
      eq(schema.sources.type, 'github'),
      eq(schema.sources.repo, 'vercel-labs/knowledge-agent-template'),
    )).limit(1)

    if (existing) {
      return { success: true, source: existing, created: false }
    }

    const result = await db.insert(schema.sources).values({
      type: 'github',
      label: 'Knowledge Agent Template (Demo)',
      basePath: '/docs',
      repo: 'vercel-labs/knowledge-agent-template',
      branch: 'main',
      contentPath: 'docs',
      readmeOnly: false,
      maxVideos: 50,
    }).returning()

    return { success: true, source: result[0], created: true }
  } catch (error) {
    console.error('[sources.demo]', error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to add demo source',
      data: { why: error instanceof Error ? error.message : 'Unknown error', fix: 'Try again or add a source manually' },
    })
  }
})
