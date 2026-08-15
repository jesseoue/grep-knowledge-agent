import { z } from 'zod'
import { getDb, schema } from '../../db'
import { requireUserSession } from '../../lib/session'
import { branchSchema, contentPathSchema, repoSchema } from '../../lib/source-validation'

const sourceSchema = z.object({
  type: z.enum(['github', 'youtube', 'file']),
  label: z.string().trim().min(1).max(80),
  basePath: z.string().trim().max(240).default('/docs'),
  repo: repoSchema.optional(),
  branch: branchSchema.default('main'),
  contentPath: contentPathSchema.optional(),
  outputPath: z.string().trim().max(240).optional(),
  readmeOnly: z.boolean().default(false),
  channelId: z.string().trim().max(120).optional(),
  maxVideos: z.number().int().default(50),
}).superRefine((source, context) => {
  if (source.type === 'github' && !source.repo) {
    context.addIssue({
      code: 'custom',
      path: ['repo'],
      message: 'Repository is required for a GitHub source',
    })
  }
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
