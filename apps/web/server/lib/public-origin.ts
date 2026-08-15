import type { H3Event } from 'h3'

export function normalizePublicOrigin(value: string | undefined): string | null {
  const candidate = value?.trim()
  if (!candidate) return null

  try {
    const url = new URL(candidate.includes('://') ? candidate : `https://${candidate}`)
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return null
    return url.origin
  } catch {
    return null
  }
}

export function getPublicOrigin(event: H3Event): string {
  const configured = [
    process.env.PUBLIC_SITE_URL,
    process.env.RAILWAY_PUBLIC_DOMAIN,
    process.env.RAILWAY_STATIC_URL,
  ]

  for (const candidate of configured) {
    const origin = normalizePublicOrigin(candidate)
    if (origin) return origin
  }

  return getRequestURL(event).origin
}
