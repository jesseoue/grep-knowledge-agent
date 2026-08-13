import { authClient } from '~/lib/auth-client'

export default defineNuxtRouteMiddleware(async (to) => {
  // Allow unauthenticated access to the login page
  if (to.path === '/login') return

  // On the server, check the session via the API directly (cookie-based).
  // On the client, use the auth client's session (cached, reactive).
  if (import.meta.server) {
    try {
      const res = await $fetch('/api/auth/get-session', {
        headers: { cookie: useRequestHeaders(['cookie']).cookie || '' },
      })
      if (!res) {
        return navigateTo({ path: '/login', query: { redirect: to.fullPath } })
      }
    } catch {
      return navigateTo({ path: '/login', query: { redirect: to.fullPath } })
    }
  } else {
    // Client-side: use the reactive session from authClient
    const session = authClient.useSession()
    // Wait for session to load on first navigation
    if (session.value === undefined) {
      // Session hasn't loaded yet — let the page render; the layout will
      // redirect if needed via useSession().data
      return
    }
    if (!session.value) {
      return navigateTo({ path: '/login', query: { redirect: to.fullPath } })
    }
  }
})
