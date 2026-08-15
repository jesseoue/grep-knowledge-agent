import { validateShellCommand } from '@grep/sdk'
import { getSnapshotDir } from './snapshot-path'

export interface CommandResult {
  command: string
  stdout: string
  stderr: string
  exitCode: number
}

export interface ShellExecuteOptions {
  commands: string[]
  sessionId?: string
  cwd?: string
}

const MAX_OUTPUT = 50000
const DEFAULT_SANDBOX_URL = 'http://sandbox.railway.internal:3200'

/**
 * Calls the sandbox service to execute read-only commands inside the snapshot volume.
 * The sandbox service runs on Railway as a sidecar, mounted with the snapshot volume.
 *
 * Includes retry with exponential backoff for cold-start resilience — if the
 * sandbox service isn't up yet when the web service tries to connect, it
 * retries up to 3 times instead of failing immediately.
 */
export async function executeInSandbox(options: ShellExecuteOptions): Promise<{
  sessionId: string
  results: CommandResult[]
}> {
  const sandboxUrl = (process.env.SANDBOX_URL || DEFAULT_SANDBOX_URL).replace(/\/$/, '')
  const sandboxSecret = process.env.SANDBOX_SECRET || ''
  const snapshotDir = getSnapshotDir()

  const reqHeaders: Record<string, string> = { 'Content-Type': 'application/json' }
  if (sandboxSecret) reqHeaders['X-Sandbox-Key'] = sandboxSecret

  for (const command of options.commands) {
    const validation = validateShellCommand(command, {
      allowedBaseDirectory: snapshotDir,
    })
    if (!validation.ok) {
      throw createError({
        statusCode: 400,
        message: validation.reason,
        data: { why: 'The command failed security validation', fix: `Use only allowed commands within ${snapshotDir}` },
      })
    }
  }

  const body = JSON.stringify({
    commands: options.commands,
    sessionId: options.sessionId,
    cwd: options.cwd || snapshotDir,
  })

  // Retry with exponential backoff — handles sandbox cold starts
  const MAX_RETRIES = 3
  let lastError: Error | null = null

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(`${sandboxUrl}/run`, {
        method: 'POST',
        headers: reqHeaders,
        body,
        signal: AbortSignal.timeout(30_000),
      })

      if (!response.ok) {
        const errorBody = await response.text()
        throw createError({
          statusCode: 502,
          message: `Sandbox service error (${response.status})`,
          data: { why: 'The sandbox service returned an error', fix: errorBody.slice(0, 500) },
        })
      }

      const data = await response.json() as {
        sessionId: string
        results: Array<{ command: string, stdout: string, stderr: string, exitCode: number }>
      }

      return {
        sessionId: data.sessionId,
        results: data.results.map(r => ({
          command: r.command,
          stdout: truncateOutput(r.stdout),
          stderr: truncateOutput(r.stderr),
          exitCode: r.exitCode,
        })),
      }
    } catch (error: any) {
      lastError = error
      // Only retry on connection errors (ECONNREFUSED, ETIMEDOUT, fetch failed),
      // not on validation or HTTP errors.
      const isConnectionError =
        error?.code === 'ECONNREFUSED' ||
        error?.code === 'ETIMEDOUT' ||
        error?.code === 'UND_ERR_CONNECT_TIMEOUT' ||
        error?.cause?.code === 'ECONNREFUSED' ||
        /fetch failed|network|connect/i.test(error?.message || '')

      if (!isConnectionError || attempt === MAX_RETRIES - 1) throw error

      // Exponential backoff: 500ms, 1000ms, 2000ms
      const delay = 500 * Math.pow(2, attempt)
      console.warn(`[sandbox] connection failed (attempt ${attempt + 1}/${MAX_RETRIES}), retrying in ${delay}ms…`)
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }

  throw lastError || createError({ statusCode: 502, message: 'Sandbox service unavailable after retries' })
}

function truncateOutput(output: string): string {
  if (output.length > MAX_OUTPUT) {
    return `${output.slice(0, MAX_OUTPUT)}\n... (truncated, ${output.length} total chars)`
  }
  return output
}
