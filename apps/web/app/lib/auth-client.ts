import { createAuthClient } from 'better-auth/vue'

// Better Auth requires an absolute base URL (it throws "Invalid base URL: /api/auth"
// if given a relative path, which crashes Vue hydration and breaks all click handlers).
// On the client we derive it from window.location.origin; on the server we use env vars.
const baseURL = import.meta.server
  ? (process.env.PUBLIC_SITE_URL || (process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : `http://localhost:${process.env.PORT || 3000}`)) + '/api/auth'
  : (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000') + '/api/auth'

export const authClient = createAuthClient({
  baseURL,
})

export const { signIn, signUp, signOut, useSession } = authClient
