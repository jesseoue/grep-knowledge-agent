import { z } from 'zod'
import { getDb, schema } from '../db'
import { requireUserSession } from '../lib/session'
import { branchSchema, contentPathSchema, repoPattern, repoSchema } from '../lib/source-validation'
import { getSnapshotDir } from '../lib/snapshot-path'

const syncBodySchema = z.object({
  sources: z.array(z.string().uuid()).max(100).optional(),
  repo: repoSchema.optional(),
  branch: branchSchema.default('main'),
  contentPath: contentPathSchema.optional(),
}).superRefine((body, context) => {
  if (body.repo && body.sources?.length) {
    context.addIssue({
      code: 'custom',
      path: ['sources'],
      message: 'Choose either a direct repository or saved sources, not both',
    })
  }
})

export default defineEventHandler(async (event) => {
  await requireUserSession(event)
  const body = await readValidatedBody(event, syncBodySchema.parse)

  // A repository entered in the quick-sync field always takes precedence over
  // saved source records. Previously it was silently ignored once any source
  // existed in the database.
  if (body.repo) {
    try {
      await syncRepoToSandbox(body.repo, body.branch, body.contentPath || undefined)
      return {
        success: true,
        summary: { total: 1, synced: 1, failed: 0 },
        results: [{ sourceId: null, label: body.repo, success: true }],
      }
    } catch (error) {
      throw createError({
        statusCode: 502,
        statusMessage: 'Repository sync failed',
        data: {
          why: error instanceof Error ? error.message : String(error),
          fix: 'Check the repository, branch, content path, and sandbox service',
        },
      })
    }
  }

  const db = getDb()
  let allSources: typeof schema.sources.$inferSelect[]
  try {
    allSources = await db.select().from(schema.sources)
  } catch {
    allSources = []
  }

  const sources = body?.sources?.length
    ? allSources.filter(s => body.sources!.includes(s.id))
    : allSources

  if (sources.length === 0) {
    // Nothing to sync — still ensure the default snapshot repo exists
    const snapshotRepo = process.env.SNAPSHOT_REPO
    if (!snapshotRepo) {
      throw createError({
        statusCode: 400,
        statusMessage: 'No sources to sync',
        data: { why: 'Add a source first, or set SNAPSHOT_REPO', fix: 'Add a GitHub source in the settings page' },
      })
    }
    try {
      await syncRepoToSandbox(snapshotRepo, process.env.SNAPSHOT_BRANCH || 'main')
      return { success: true, summary: { total: 1, synced: 1, failed: 0 }, results: [{ sourceId: null, label: snapshotRepo, success: true }] }
    } catch (error) {
      throw createError({
        statusCode: 502,
        statusMessage: 'Default repository sync failed',
        data: { why: error instanceof Error ? error.message : String(error) },
      })
    }
  }

  const results = []
  for (const source of sources) {
    if (source.type !== 'github' || !source.repo) {
      results.push({ sourceId: source.id, label: source.label, success: false, error: 'Only GitHub sources can be synced' })
      continue
    }
    // Re-validate DB-stored repos at the boundary too (defense in depth).
    if (!repoPattern.test(source.repo)) {
      results.push({ sourceId: source.id, label: source.label, success: false, error: `Invalid repo: ${source.repo}` })
      continue
    }

    try {
      await syncRepoToSandbox(source.repo, source.branch || 'main', source.contentPath || undefined)
      results.push({ sourceId: source.id, label: source.label, success: true })
    } catch (error) {
      results.push({
        sourceId: source.id,
        label: source.label,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  const success = results.every(r => r.success)
  if (!success) setResponseStatus(event, 207)

  return {
    success,
    summary: {
      total: results.length,
      synced: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
    },
    results,
  }
})

async function syncRepoToSandbox(repo: string, branch: string, contentPath?: string) {
  const safeDir = repo.split('/').join('_')
  const snapshotDir = getSnapshotDir()
  const destination = `${snapshotDir}/gh/${safeDir}`

  // Clone (or pull) the repo inside the snapshot volume via the sandbox service.
  // The sandbox service is the only one with the volume mounted. Commands are
  // simple, validated commands (no compound if/fi) that the sandbox's
  // validateSyncCommand allows; repo/branch are validated against strict
  // patterns above to prevent shell injection.
  const commands = [
    `mkdir -p ${destination}`,
    `rm -rf ${destination}`,
    `git clone --depth 1${contentPath ? ' --filter=blob:none --sparse' : ''} --branch ${branch} https://github.com/${repo}.git ${destination}`,
  ]
  if (contentPath) {
    commands.push(`git -C ${destination} sparse-checkout set --no-cone -- ${contentPath}`)
  }
  commands.push(
    `rm -rf ${destination}/.git`,
    `find ${destination} -type f ! \\( -name "*.md" -o -name "*.mdx" -o -name "*.yml" -o -name "*.yaml" -o -name "*.json" \\) -delete`,
    `find ${destination} -type d -empty -delete`,
  )

  const sandboxUrl = (process.env.SANDBOX_URL || 'http://sandbox.railway.internal:3200').replace(/\/$/, '')
  const sandboxSecret = process.env.SANDBOX_SECRET || ''

  const reqHeaders: Record<string, string> = { 'Content-Type': 'application/json' }
  if (sandboxSecret) reqHeaders['X-Sandbox-Key'] = sandboxSecret

  const response = await fetch(`${sandboxUrl}/sync-run`, {
    method: 'POST',
    headers: reqHeaders,
    body: JSON.stringify({ commands }),
    signal: AbortSignal.timeout(120_000),
  })

  if (!response.ok) {
    const errBody = await response.text()
    throw new Error(`Sandbox sync failed: ${errBody.slice(0, 300)}`)
  }

  const data = await response.json() as { results: Array<{ exitCode: number, stderr: string }> }
  const failed = data.results.filter(r => r.exitCode !== 0)
  if (failed.length > 0) {
    throw new Error(`Sync failed: ${failed.map(f => f.stderr).join('; ').slice(0, 300)}`)
  }
}
