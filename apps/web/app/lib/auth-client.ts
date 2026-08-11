import { createAuthClient } from 'better-auth/vue'

export const authClient = createAuthClient({
  baseURL: '/api/auth',
})

export const { signIn, signUp, signOut, useSession } = authClient
