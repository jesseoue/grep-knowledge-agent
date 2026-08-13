import { z } from 'zod'
import { getDb, schema } from '../db'
import { requireUserSession } from '../lib/session'

// Strict validation: `owner/repo` only, no scheme/host/path that could smuggle
// arbitrary commands into the shell. Branch is restricted to safe git ref chars.
const repoPattern = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/
const branchPattern = /^[A-Za-z0-9._/-]{1,100}$/

const syncBodySchema = z.object({
  sources: z.array(z.string()).optional(),
  repo: z.string().regex(repoPattern, 'repo must be "owner/repo"').optional(),
  branch: z.string().regex(branchPattern).default('main').optional(),
  contentPath: z.string().optional(),
})

export default defineEventHandler(async (event) => {
  await requireUserSession(event)
  const body = await readValidatedBody(event, syncBodySchema.parse).catch((): z.infer<typeof syncBodySchema> => ({}))

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

  // If a raw repo was supplied (from the "Snapshot repository" field),
  // sync it directly without needing a DB source record.
  if (body?.repo && !sources.length) {
    const repo = body.repo.trim()
    try {
      await syncRepoToSandbox(repo, body.branch || 'main', body.contentPath || undefined)
      return {
        success: true,
        summary: { total: 1, synced: 1, failed: 0 },
        results: [{ sourceId: null, label: repo, success: true }],
      }
    } catch (error) {
      return {
        success: false,
        summary: { total: 1, synced: 0, failed: 1 },
        results: [{ sourceId: null, label: repo, success: false, error: error instanceof Error ? error.message : String(error) }],
      }
    }
  }

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
      return { success: false, summary: { total: 1, synced: 0, failed: 1 }, results: [{ sourceId: null, label: snapshotRepo, success: false, error: error instanceof Error ? error.message : String(error) }] }
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

  return {
    success: results.every(r => r.success),
    summary: {
      total: results.length,
      synced: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
    },
    results,
  }
})

async function syncRepoToSandbox(repo: string, branch: string, contentPath?: string) {
  const target = contentPath ? `${contentPath}` : '.'
  const safeDir = repo.split('/').join('_')

  // Clone (or pull) the repo inside the snapshot volume via the sandbox service.
  // The sandbox service is the only one with the volume mounted. Commands are
  // simple, validated commands (no compound if/fi) that the sandbox's
  // validateSyncCommand allows; repo/branch are validated against strict
  // patterns above to prevent shell injection.
  const commands = [
    `mkdir -p /snapshot/gh/${safeDir}`,
    `rm -rf /snapshot/gh/${safeDir}`,
    `git clone --depth 1 --branch ${branch} https://github.com/${repo}.git /snapshot/gh/${safeDir}`,
    `find /snapshot/gh/${safeDir} -type f ! \\( -name "*.md" -o -name "*.mdx" -o -name "*.yml" -o -name "*.yaml" -o -name "*.json" \\) -delete`,
    `find /snapshot/gh/${safeDir} -type d -empty -delete`,
  ]

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
