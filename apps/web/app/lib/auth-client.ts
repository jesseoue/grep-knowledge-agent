import { createAuthClient } from 'better-auth/vue'

// During SSR, we need an absolute URL; on the client, a relative path works.
const baseURL = import.meta.server
  ? (process.env.PUBLIC_SITE_URL || `http://localhost:${process.env.PORT || 3000}`) + '/api/auth'
  : '/api/auth'

export const authClient = createAuthClient({
  baseURL,
})

export const { signIn, signUp, signOut, useSession } = authClient
