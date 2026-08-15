import path from 'node:path'

/**
 * Read-only shell policy for the sandbox.
 * Adapted from vercel-labs/knowledge-agent-template (MIT) @savoir/sdk.
 */
export const ALLOWED_BASH_COMMANDS = new Set([
  // File discovery
  'find',
  'ls',
  'tree',
  // Content search
  'grep',
  'egrep',
  'fgrep',
  // File reading
  'cat',
  'head',
  'tail',
  // Text processing (output filtering)
  'wc',
  'sort',
  'cut',
  'tr',
  'column',
  // Utilities
  'echo',
  'printf',
  'test',
  '[',
  'true',
  'false',
  'basename',
  'dirname',
  'realpath',
  'stat',
  'du',
  'diff',
  'comm',
  // String/path helpers
  'md5sum',
  'sha256sum',
])

export const BLOCKED_SHELL_PATTERNS = [
  /\$\(/, // command substitution $(...)
  /`[^`]+`/, // backtick substitution
  /[<>]\(/, // process substitution <(...) or >(...)
  /\beval\b/, // eval
  /\bexec\b/, // exec
  /\bsource\b/, // source
  /\bbash\b/, // nested bash
  /\bsh\b/, // nested sh
  /\bzsh\b/, // nested zsh
  /\benv\b/, // env (can run arbitrary commands)
  />\s*[^\s|]/, // write redirection (> file)
  /\bpython\b/, // interpreter
  /\bnode\b/, // interpreter
  /\bperl\b/, // interpreter
  /\bruby\b/, // interpreter
]

export function isPathWithinDirectory(filePath: string, directory: string): boolean {
  const resolvedDir = path.resolve(directory)
  const resolvedPath = path.isAbsolute(filePath)
    ? path.resolve(filePath)
    : path.resolve(resolvedDir, filePath)
  return resolvedPath.startsWith(`${resolvedDir}${path.sep}`) || resolvedPath === resolvedDir
}

export interface ShellValidationOptions {
  allowedCommands?: Set<string>
  blockedPatterns?: RegExp[]
  allowedBaseDirectory?: string
}

export type ShellValidationResult =
  | { ok: true }
  | { ok: false, reason: string }

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

function validatePaths(command: string, allowedBaseDirectory?: string): ShellValidationResult {
  if (!allowedBaseDirectory) {
    return { ok: true }
  }

  const tokens = extractPotentialPathTokens(command)
  for (const token of tokens) {
    if (!isPathWithinDirectory(token, allowedBaseDirectory)) {
      return { ok: false, reason: `Path outside sandbox is not allowed: ${token}` }
    }
  }

  return { ok: true }
}

export function validateShellCommand(
  command: string,
  options?: ShellValidationOptions,
): ShellValidationResult {
  const blockedPatterns = options?.blockedPatterns ?? BLOCKED_SHELL_PATTERNS
  const allowedCommands = options?.allowedCommands ?? ALLOWED_BASH_COMMANDS

  for (const pattern of blockedPatterns) {
    if (pattern.test(command)) {
      return { ok: false, reason: `Command contains blocked pattern: ${command.slice(0, 50)}` }
    }
  }

  // Some allowlisted read utilities also expose write/execute modes. Reject
  // those modes explicitly so the AI-facing endpoint remains truly read-only.
  if (/\bfind\b[^|;&]*\s-(?:delete|exec|execdir|ok|okdir|fprint|fprintf|fls)\b/.test(command)) {
    return { ok: false, reason: 'Write or execute actions are not allowed for find' }
  }
  if (/\bsort\b[^|;&]*(?:\s-o\S*|\s--output(?:\s|=))/.test(command)) {
    return { ok: false, reason: 'Writing sort output to a file is not allowed' }
  }

  const segments = command.split(/\s*(?:\|(?!\|)|\|\||&&|;)\s*/)
  for (const segment of segments) {
    const trimmed = segment.trim()
    if (!trimmed) continue
    const words = trimmed.split(/\s+/)
    const cmdName = words.find(w => !w.includes('=')) || words[0]
    if (!cmdName || !allowedCommands.has(cmdName)) {
      return { ok: false, reason: `Command not allowed: ${cmdName || 'unknown'}` }
    }
  }

  return validatePaths(command, options?.allowedBaseDirectory)
}
