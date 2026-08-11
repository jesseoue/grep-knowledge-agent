import { z } from 'zod'
import { getDb, schema } from '../../db'

const sourceSchema = z.object({
  type: z.enum(['github', 'youtube', 'file']),
  label: z.string().min(1),
  basePath: z.string().default('/docs'),
  repo: z.string().optional(),
  branch: z.string().default('main'),
  contentPath: z.string().optional(),
  outputPath: z.string().optional(),
  readmeOnly: z.boolean().default(false),
  channelId: z.string().optional(),
  maxVideos: z.number().int().default(50),
})

export default defineEventHandler(async (event) => {
  await requireUserSession(event)

  const body = await readValidatedBody(event, sourceSchema.parse)
  const db = getDb()

  try {
    const result = await db.insert(schema.sources).values({
      type: body.type,
      label: body.label,
      basePath: body.basePath,
      repo: body.repo,
      branch: body.branch,
      contentPath: body.contentPath,
      outputPath: body.outputPath,
      readmeOnly: body.readmeOnly,
      channelId: body.channelId,
      maxVideos: body.maxVideos,
    }).returning()

    return { success: true, source: result[0] }
  } catch (error) {
    console.error('[sources.post]', error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to create source',
      data: { why: error instanceof Error ? error.message : 'Unknown error', fix: 'Check the source configuration' },
    })
  }
})
