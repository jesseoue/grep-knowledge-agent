import { authClient } from '~/lib/auth-client'

export default defineNuxtRouteMiddleware(async (to) => {
  // Allow unauthenticated access to the login page
  if (to.path === '/login') return

  const session = await authClient.useSession(useFetch)
  if (!session.data.value) {
    return navigateTo({ path: '/login', query: { redirect: to.fullPath } })
  }
})
