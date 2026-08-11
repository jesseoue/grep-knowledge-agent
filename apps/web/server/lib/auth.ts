import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { getDb } from '../db'
let authInstance: ReturnType<typeof createAuth> | null = null

function createAuth() {
  const db = getDb()

  return betterAuth({
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
    secret: process.env.BETTER_AUTH_SECRET || 'dev-secret-change-me',
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
    trustedOrigins: [
      process.env.PUBLIC_SITE_URL || 'http://localhost:3000',
      'http://localhost:3000',
    ],
  })
}

export function getAuth() {
  if (!authInstance) {
    authInstance = createAuth()
  }
  return authInstance
}

export type Auth = ReturnType<typeof createAuth>
