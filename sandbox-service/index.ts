/**
 * Sandbox service — the gVisor-protected read-only shell.
 *
 * Mounts the shared snapshot volume at /snapshot and executes allowlisted
 * read-only commands (grep/find/cat/head/...) inside it. This replaces the
 * Vercel Sandbox primitive with a Railway sidecar service.
 *
 * Communication:
 *   POST /run       — read-only commands (agent: grep/find/cat)
 *   POST /sync-run  — sync commands (web service: git/mkdir/find for repo cloning)
 * The web service reaches it via the Railway private network (SANDBOX_URL).
 */

import { createServer } from 'node:http'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import {
  validateShellCommand,
  BLOCKED_SHELL_PATTERNS,
  isPathWithinDirectory,
} from './shell-policy.ts'

const execFileAsync = promisify(execFile)

const SNAPSHOT_DIR = process.env.SNAPSHOT_DIR || '/snapshot'
const PORT = Number(process.env.PORT || 3200)
interface RunRequest {
  commands?: string[]
  sessionId?: string
  cwd?: string
}

/**
 * Commands allowed for sync operations (repo cloning/cleanup).
 * These are write operations initiated by the web service — NOT by the AI agent.
 * The agent's /run endpoint stays strictly read-only.
 */
const SYNC_ALLOWED_COMMANDS = new Set([
  'git', 'mkdir', 'rm', 'find', 'cd',
])

/**
 * Validate a sync command — allows git/mkdir/find but restricts all paths
 * to the snapshot directory and blocks dangerous patterns.
 */
function validateSyncCommand(command: string): { ok: true } | { ok: false, reason: string } {
  // Reuse the blocked patterns (no $(), eval, exec, write redirection, interpreters)
  for (const pattern of BLOCKED_SHELL_PATTERNS) {
    if (pattern.test(command)) {
      return { ok: false, reason: `Sync command contains blocked pattern: ${command.slice(0, 80)}` }
    }
  }

  // Extract path tokens and verify they're within /snapshot
  const tokens = extractPotentialPathTokens(command)
  for (const token of tokens) {
    if (token.startsWith('../')) {
      return { ok: false, reason: `Path traversal not allowed: ${token}` }
    }
    // Allow http(s) URLs for git clone
    if (token.startsWith('http://') || token.startsWith('https://')) continue
    if (token.startsWith('/')) {
      if (!isPathWithinDirectory(token, SNAPSHOT_DIR)) {
        return { ok: false, reason: `Path outside snapshot not allowed: ${token}` }
      }
    }
  }

  // Check that command segments use allowed sync commands
  // For compound commands (if/then/else/fi), we check the actual command keywords
  const segments = command.split(/\s*(?:\|(?!\|)|\|\||&&|;)\s*/)
  for (const segment of segments) {
    const trimmed = segment.trim()
    if (!trimmed) continue
    // Skip shell control flow keywords
    if (/^(if|then|else|elif|fi|for|do|done|while|case|esac|in)$/.test(trimmed)) continue
    // Skip test brackets and conditions
    if (/^\[/.test(trimmed) || /^-\w/.test(trimmed)) continue
    const words = trimmed.split(/\s+/)
    const cmdName = words.find(w => !w.includes('=') && !w.startsWith('-')) || words[0]
    if (!cmdName) continue
    if (!SYNC_ALLOWED_COMMANDS.has(cmdName)) {
      return { ok: false, reason: `Sync command not allowed: ${cmdName}` }
    }
  }

  return { ok: true }
}

function json(res: import('node:http').ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(body))
}

/** Extract path-like tokens from a command string for path validation. */
function extractPotentialPathTokens(command: string): string[] {
  const tokenRegex = /(?:^|\s)(\/[^\s|;&]+|\.{1,2}\/[^\s|;&]+)/g
  const tokens: string[] = []
  let match: RegExpExecArray | null = null
  while ((match = tokenRegex.exec(command)) !== null) {
    const [, token] = match
    if (token) {
      tokens.push(token.replace(/^['"]|['"]$/g, ''))
    }
  }
  return tokens
}

async function runCommand(command: string, cwd: string): Promise<{ command: string, stdout: string, stderr: string, exitCode: number }> {
  const validation = validateShellCommand(command, { allowedBaseDirectory: SNAPSHOT_DIR })
  if (!validation.ok) {
    return { command, stdout: '', stderr: validation.reason, exitCode: 1 }
  }

  return runCommandUnchecked(command, cwd)
}

/** Execute a command without read-only validation (used by /sync-run which has its own validation). */
async function runCommandUnchecked(command: string, cwd: string): Promise<{ command: string, stdout: string, stderr: string, exitCode: number }> {
  // Use bash on Linux (Docker/Railway), fall back to sh on macOS for local dev.
  const shell = process.platform === 'linux' ? '/bin/bash' : '/bin/sh'

  try {
    const { stdout, stderr } = await execFileAsync(shell, ['-c', command], {
      cwd,
      timeout: 120_000, // 2 min for git clone
      maxBuffer: 10 * 1024 * 1024,
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

  // Sync endpoint — allows git/mkdir/find for repo cloning (write operations).
  // Only the web service uses this; the AI agent's /run stays read-only.
  if (req.method === 'POST' && url.pathname === '/sync-run') {
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
    const sessionId = parsed.sessionId || `sync_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`

    const results = []
    for (const command of commands) {
      const validation = validateSyncCommand(command)
      if (!validation.ok) {
        results.push({ command, stdout: '', stderr: validation.reason, exitCode: 1 })
        continue
      }
      results.push(await runCommandUnchecked(command, cwd))
    }

    json(res, 200, { sessionId, results })
    return
  }

  json(res, 404, { error: 'Not found' })
})

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[sandbox] listening on :${PORT}, snapshot dir: ${SNAPSHOT_DIR}`)
})
