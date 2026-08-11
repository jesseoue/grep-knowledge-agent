import { getDb, schema } from '../../db'

export default defineEventHandler(async (event) => {
  await requireUserSession(event)

  try {
    const db = getDb()
    const allSources = await db.select().from(schema.sources)

    const github = allSources.filter(s => s.type === 'github')
    const youtube = allSources.filter(s => s.type === 'youtube')
    const file = allSources.filter(s => s.type === 'file')

    return {
      total: allSources.length,
      github: { count: github.length, sources: github },
      youtube: { count: youtube.length, sources: youtube },
      file: { count: file.length, sources: file },
      snapshotRepo: process.env.SNAPSHOT_REPO || null,
      lastSyncAt: null,
    }
  } catch (error) {
    console.error('[sources]', error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to load sources',
      data: { why: error instanceof Error ? error.message : 'Unknown error', fix: 'Check DATABASE_URL is configured' },
    })
  }
})
