import type { H3Event } from 'h3'
import { getAuth } from './auth'

export async function getUserSession(event: H3Event): Promise<{ user: { id: string, email: string, name: string }, session: { id: string } } | null> {
  try {
    const auth = getAuth()
    const session = await auth.api.getSession({ headers: event.headers })
    if (!session) return null
    return {
      user: {
        id: session.user.id,
        email: session.user.email,
        name: session.user.name,
      },
      session: { id: session.session.id },
    }
  } catch {
    return null
  }
}

export async function requireUserSession(event: H3Event) {
  const session = await getUserSession(event)
  if (!session) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }
  return session
}
