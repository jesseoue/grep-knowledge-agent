import { createAuthClient } from 'better-auth/vue'

// Better Auth requires an absolute base URL — a relative path like '/api/auth'
// throws "Invalid base URL" during hydration, crashing the entire Vue app
// mount and making ALL click handlers non-functional.
//
// We compute a single value that is identical on both server and client to
// avoid hydration mismatches. On the server we use env vars; on the client
// we use window.location.origin. Because this module is evaluated once per
// request (SSR) and once on the client, the values match as long as the
// deployed URL is consistent.
function resolveBaseURL(): string {
  // Server-side: use PUBLIC_SITE_URL or Railway's injected domain
  if (import.meta.server) {
    const server =
      process.env.PUBLIC_SITE_URL ||
      (process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : '') ||
      `http://localhost:${process.env.PORT || 3000}`
    return server.replace(/\/$/, '') + '/api/auth'
  }
  // Client-side: derive from the current origin (always absolute, always correct)
  return window.location.origin + '/api/auth'
}

export const authClient = createAuthClient({
  baseURL: resolveBaseURL(),
})

export const { signIn, signUp, signOut, useSession } = authClient
