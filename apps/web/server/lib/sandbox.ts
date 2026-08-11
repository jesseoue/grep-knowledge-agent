import { validateShellCommand } from '@grep/sdk'

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
 */
export async function executeInSandbox(options: ShellExecuteOptions): Promise<{
  sessionId: string
  results: CommandResult[]
}> {
  const sandboxUrl = (process.env.SANDBOX_URL || DEFAULT_SANDBOX_URL).replace(/\/$/, '')

  for (const command of options.commands) {
    const validation = validateShellCommand(command, {
      allowedBaseDirectory: '/snapshot',
    })
    if (!validation.ok) {
      throw createError({
        statusCode: 400,
        message: validation.reason,
        data: { why: 'The command failed security validation', fix: 'Use only allowed commands within /snapshot' },
      })
    }
  }

  const response = await fetch(`${sandboxUrl}/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      commands: options.commands,
      sessionId: options.sessionId,
      cwd: options.cwd || '/snapshot',
    }),
    signal: AbortSignal.timeout(30_000),
  })

  if (!response.ok) {
    const body = await response.text()
    throw createError({
      statusCode: 502,
      message: `Sandbox service error (${response.status})`,
      data: { why: 'The sandbox service returned an error', fix: body.slice(0, 500) },
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
}

function truncateOutput(output: string): string {
  if (output.length > MAX_OUTPUT) {
    return `${output.slice(0, MAX_OUTPUT)}\n... (truncated, ${output.length} total chars)`
  }
  return output
}
