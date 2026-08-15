import { getDb, schema } from '../db'

export function allowsPublicSignup(): boolean {
  return process.env.ALLOW_PUBLIC_SIGNUP?.trim().toLowerCase() === 'true'
}

/** The first account created owns a private deployment. */
export async function getWorkspaceOwner(): Promise<{ id: string, email: string, name: string } | null> {
  const [owner] = await getDb()
    .select({ id: schema.users.id, email: schema.users.email, name: schema.users.name })
    .from(schema.users)
    .orderBy(schema.users.createdAt)
    .limit(1)

  return owner ?? null
}

export async function isWorkspaceClaimed(): Promise<boolean> {
  return (await getWorkspaceOwner()) !== null
}

/**
 * Self-hosted deployments are private by default: the first account becomes
 * the workspace owner, then new registrations close. Operators who genuinely
 * want a shared deployment can opt in explicitly.
 */
export async function canCreateAccount(): Promise<boolean> {
  if (allowsPublicSignup()) return true
  return !(await isWorkspaceClaimed())
}
