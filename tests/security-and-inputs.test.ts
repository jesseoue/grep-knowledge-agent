import { afterEach, describe, expect, test } from 'bun:test'
import {
  validateShellCommand as validateSdkCommand,
} from '../packages/sdk/src/shell-policy'
import {
  validateShellCommand as validateSandboxCommand,
} from '../sandbox-service/shell-policy'
import {
  branchSchema,
  contentPathSchema,
  repoSchema,
} from '../apps/web/server/lib/source-validation'
import { getSnapshotDir } from '../apps/web/server/lib/snapshot-path'
import { normalizePublicOrigin } from '../apps/web/server/lib/public-origin'
import { allowsPublicSignup } from '../apps/web/server/lib/registration'

const policies = [
  ['SDK', validateSdkCommand],
  ['sandbox', validateSandboxCommand],
] as const

const allowedCommands = [
  'grep -Rni "rate limit" .',
  'find . -type f -name "*.md" | head -20',
  'cat ./docs/README.md',
  'sort ./docs/index.txt | head -10',
]

const rejectedCommands = [
  'cat /etc/passwd',
  'cat ./../etc/passwd',
  'cat <(echo unsafe)',
  'find . -delete',
  'find . -exec cat {} ;',
  'printf unsafe | tee ./output.txt',
  'printf rm | xargs rm',
  'awk "BEGIN { system(\"rm file\") }"',
  'sort ./input.txt -o ./output.txt',
  'sort ./input.txt -o./output.txt',
  'grep secret . > ./result.txt',
]

for (const [name, validate] of policies) {
  describe(`${name} read-only shell policy`, () => {
    for (const command of allowedCommands) {
      test(`allows ${command}`, () => {
        expect(validate(command, { allowedBaseDirectory: '/snapshot' }).ok).toBe(true)
      })
    }

    for (const command of rejectedCommands) {
      test(`rejects ${command}`, () => {
        expect(validate(command, { allowedBaseDirectory: '/snapshot' }).ok).toBe(false)
      })
    }
  })
}

describe('source input normalization', () => {
  test('normalizes common GitHub repository URLs', () => {
    expect(repoSchema.parse('https://github.com/vercel-labs/knowledge-agent-template.git')).toBe('vercel-labs/knowledge-agent-template')
    expect(repoSchema.parse('github.com/nuxt/nuxt/')).toBe('nuxt/nuxt')
  })

  test('rejects unsafe repositories, branches, and content paths', () => {
    expect(() => repoSchema.parse('../unsafe')).toThrow()
    expect(() => branchSchema.parse('main;touch-file')).toThrow()
    expect(() => branchSchema.parse('feature/')).toThrow()
    expect(() => contentPathSchema.parse('../secrets')).toThrow()
  })
})

describe('snapshot root validation', () => {
  const originalSnapshotDir = process.env.SNAPSHOT_DIR

  afterEach(() => {
    if (originalSnapshotDir === undefined) delete process.env.SNAPSHOT_DIR
    else process.env.SNAPSHOT_DIR = originalSnapshotDir
  })

  test('accepts and normalizes a safe absolute path', () => {
    process.env.SNAPSHOT_DIR = '/tmp/grep-snapshot/'
    expect(getSnapshotDir()).toBe('/tmp/grep-snapshot')
  })

  test('rejects root, relative, traversal, and shell-like paths', () => {
    for (const value of ['/', 'snapshot', '/tmp/../etc', '/tmp/snapshot;whoami']) {
      process.env.SNAPSHOT_DIR = value
      expect(() => getSnapshotDir()).toThrow()
    }
  })
})

describe('public URL normalization', () => {
  test('accepts configured domains and strips paths', () => {
    expect(normalizePublicOrigin('grep-agent.up.railway.app')).toBe('https://grep-agent.up.railway.app')
    expect(normalizePublicOrigin('https://grep.example.com/login')).toBe('https://grep.example.com')
  })

  test('rejects unsafe or invalid public origins', () => {
    expect(normalizePublicOrigin('javascript:alert(1)')).toBeNull()
    expect(normalizePublicOrigin('https://user:pass@example.com')).toBeNull()
    expect(normalizePublicOrigin('')).toBeNull()
  })
})

describe('private workspace registration', () => {
  const originalValue = process.env.ALLOW_PUBLIC_SIGNUP

  afterEach(() => {
    if (originalValue === undefined) delete process.env.ALLOW_PUBLIC_SIGNUP
    else process.env.ALLOW_PUBLIC_SIGNUP = originalValue
  })

  test('requires an explicit true value to reopen public signup', () => {
    for (const value of ['', 'false', '1', 'yes']) {
      process.env.ALLOW_PUBLIC_SIGNUP = value
      expect(allowsPublicSignup()).toBe(false)
    }
    process.env.ALLOW_PUBLIC_SIGNUP = ' TRUE '
    expect(allowsPublicSignup()).toBe(true)
  })
})
