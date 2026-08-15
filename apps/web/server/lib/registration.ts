import { getDb, schema } from '../db'

export function allowsPublicSignup(): boolean {
  return process.env.ALLOW_PUBLIC_SIGNUP?.trim().toLowerCase() === 'true'
}

/**
 * Self-hosted deployments are private by default: the first account becomes
 * the workspace owner, then new registrations close. Operators who genuinely
 * want a shared deployment can opt in explicitly.
 */
export async function canCreateAccount(): Promise<boolean> {
  if (allowsPublicSignup()) return true

  const [existingUser] = await getDb()
    .select({ id: schema.users.id })
    .from(schema.users)
    .limit(1)

  return !existingUser
}
