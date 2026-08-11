/**
 * Sandbox service — the gVisor-protected read-only shell.
 *
 * Mounts the shared snapshot volume at /snapshot and executes allowlisted
 * read-only commands (grep/find/cat/head/...) inside it. This replaces the
 * Vercel Sandbox primitive with a Railway sidecar service.
 *
 * Communication: HTTP POST /run { commands, sessionId }
 * The web service reaches it via the Railway private network (SANDBOX_URL).
 */

import { createServer } from 'node:http'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { validateShellCommand } from './shell-policy.ts'

const execFileAsync = promisify(execFile)

const SNAPSHOT_DIR = process.env.SNAPSHOT_DIR || '/snapshot'
const PORT = Number(process.env.PORT || 3200)
interface RunRequest {
  commands?: string[]
  sessionId?: string
  cwd?: string
}

function json(res: import('node:http').ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(body))
}

async function runCommand(command: string, cwd: string): Promise<{ command: string, stdout: string, stderr: string, exitCode: number }> {
  const validation = validateShellCommand(command, { allowedBaseDirectory: SNAPSHOT_DIR })
  if (!validation.ok) {
    return { command, stdout: '', stderr: validation.reason, exitCode: 1 }
  }

  // Use bash on Linux (Docker/Railway), fall back to sh on macOS for local dev.
  const shell = process.platform === 'linux' ? '/bin/bash' : '/bin/sh'

  try {
    const { stdout, stderr } = await execFileAsync(shell, ['-c', command], {
      cwd,
      timeout: 15_000,
      maxBuffer: 5 * 1024 * 1024,
    })
    return { command, stdout, stderr, exitCode: 0 }
  } catch (error: any) {
    return {
      command,
      stdout: error.stdout?.toString() || '',
      stderr: error.stderr?.toString() || error.message || String(error),
      exitCode: error.code ?? 1,
    }
  }
}

const server = createServer(async (req, res) => {
  // CORS not needed (private network), but allow same-origin for dev
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS')

  if (req.method === 'OPTIONS') {
    res.writeHead(204)
    res.end()
    return
  }

  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`)

  if (req.method === 'GET' && (url.pathname === '/health' || url.pathname === '/api/health')) {
    json(res, 200, { status: 'ok', snapshotDir: SNAPSHOT_DIR })
    return
  }

  if (req.method === 'POST' && url.pathname === '/run') {
    let body = ''
    for await (const chunk of req) body += chunk

    let parsed: RunRequest
    try {
      parsed = JSON.parse(body)
    } catch {
      json(res, 400, { error: 'Invalid JSON body' })
      return
    }

    const commands = parsed.commands || []
    if (!commands.length || commands.length > 10) {
      json(res, 400, { error: 'Provide between 1 and 10 commands' })
      return
    }

    const cwd = parsed.cwd || SNAPSHOT_DIR
    const sessionId = parsed.sessionId || `sess_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`

    const results = []
    for (const command of commands) {
      results.push(await runCommand(command, cwd))
    }

    json(res, 200, { sessionId, results })
    return
  }

  json(res, 404, { error: 'Not found' })
})

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[sandbox] listening on :${PORT}, snapshot dir: ${SNAPSHOT_DIR}`)
})
