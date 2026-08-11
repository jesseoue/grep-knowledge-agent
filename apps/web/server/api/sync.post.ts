import { z } from 'zod'
import { getDb, schema } from '../db'

const syncBodySchema = z.object({
  sources: z.array(z.string()).optional(),
})

export default defineEventHandler(async (event) => {
  await requireUserSession(event)
  const body = await readValidatedBody(event, syncBodySchema.parse).catch(() => ({ sources: undefined }))

  const db = getDb()
  let allSources
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
    return { success: true, summary: { total: 0, synced: 0, failed: 0 }, message: 'No sources configured. Set SNAPSHOT_REPO to clone a repo.' }
  }

  const results = []
  for (const source of sources) {
    if (source.type !== 'github' || !source.repo) {
      results.push({ sourceId: source.id, label: source.label, success: false, error: 'Only GitHub sources can be synced' })
      continue
    }

    try {
      await syncRepoToSandbox(source.repo, source.branch || 'main', source.contentPath)
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
  const sandboxUrl = (process.env.SANDBOX_URL || 'http://localhost:3200').replace(/\/$/, '')
  const target = contentPath ? `${contentPath}` : '.'

  // Clone (or pull) the repo inside the snapshot volume via the sandbox service.
  // The sandbox service is the only one with the volume mounted.
  const commands = [
    `mkdir -p /snapshot/gh/${repo.split('/').join('_')}`,
    `if [ -d /snapshot/gh/${repo.split('/').join('_')}/.git ]; then cd /snapshot/gh/${repo.split('/').join('_')} && git fetch origin ${branch} --depth 1 && git reset --hard origin/${branch}; else git clone --depth 1 --branch ${branch} https://github.com/${repo}.git /snapshot/gh/${repo.split('/').join('_')}; fi`,
    `find /snapshot/gh/${repo.split('/').join('_')} -type f ! \\( -name "*.md" -o -name "*.mdx" -o -name "*.yml" -o -name "*.yaml" -o -name "*.json" \\) -delete`,
    `find /snapshot/gh/${repo.split('/').join('_')} -type d -empty -delete`,
  ]

  const response = await fetch(`${sandboxUrl}/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
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
