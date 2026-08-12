import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { randomBytes } from 'node:crypto'
import { getDb } from '../db'
let authInstance: ReturnType<typeof createAuth> | null = null

/** Build the list of origins Better Auth will trust for OAuth callbacks + cookies. */
function buildTrustedOrigins(): string[] {
  const origins = new Set<string>([
    'http://localhost:3000',
  ])

  // Public site URL (if set by the user)
  if (process.env.PUBLIC_SITE_URL) origins.add(process.env.PUBLIC_SITE_URL.replace(/\/$/, ''))

  // Railway injects these automatically. Include both so the app works
  // out-of-the-box on *.up.railway.app and custom domains without config.
  if (process.env.RAILWAY_PUBLIC_DOMAIN) {
    origins.add(`https://${process.env.RAILWAY_PUBLIC_DOMAIN}`)
  }
  if (process.env.RAILWAY_STATIC_URL) {
    origins.add(`https://${process.env.RAILWAY_STATIC_URL}`)
  }

  return Array.from(origins)
}

/**
 * Resolve the session signing secret.
 *
 * Priority:
 *   1. BETTER_AUTH_SECRET env var (set on Railway via ${{secret()}}, or locally)
 *   2. Auto-generate a random secret at runtime (one-click deploys keep working)
 *
 * A runtime-generated secret is not persisted across restarts (sessions will
 * reset), but it guarantees the app boots and login works out-of-the-box.
 */
function resolveSecret(): string {
  if (process.env.BETTER_AUTH_SECRET) return process.env.BETTER_AUTH_SECRET
  const generated = randomBytes(32).toString('hex')
  console.warn(
    '[auth] BETTER_AUTH_SECRET is not set — using an ephemeral runtime secret. ' +
    'Sessions will reset on redeploy. Set BETTER_AUTH_SECRET to persist them.',
  )
  return generated
}

function createAuth() {
  const db = getDb()

  // Determine the canonical base URL so OAuth callbacks + redirects resolve
  // correctly. Priority: PUBLIC_SITE_URL → Railway public domain → localhost.
  const baseURL = (
    process.env.PUBLIC_SITE_URL
    || (process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : '')
    || 'http://localhost:3000'
  ).replace(/\/$/, '')

  return betterAuth({
    baseURL,
    database: drizzleAdapter(db, {
      provider: 'pg',
    }),
    socialProviders: {
      github: {
        clientId: process.env.GITHUB_CLIENT_ID || '',
        clientSecret: process.env.GITHUB_CLIENT_SECRET || '',
        // Scopes needed to access the snapshot repo as the user.
        // The template reads public repos without scopes.
      },
    },
    secret: resolveSecret(),
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false,
    },
    session: {
      cookieCache: {
        enabled: true,
        maxAge: 60 * 5, // 5 minutes
      },
    },
    trustedOrigins: buildTrustedOrigins(),
  })
}

export function getAuth() {
  if (!authInstance) {
    authInstance = createAuth()
  }
  return authInstance
}

export type Auth = ReturnType<typeof createAuth>
