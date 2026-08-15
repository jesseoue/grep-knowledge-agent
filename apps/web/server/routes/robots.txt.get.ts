import { getPublicOrigin } from '../lib/public-origin'

export default defineEventHandler((event) => {
  const origin = getPublicOrigin(event)
  setHeader(event, 'content-type', 'text/plain; charset=utf-8')
  setHeader(event, 'cache-control', 'public, max-age=3600')

  return [
    'User-agent: *',
    'Allow: /',
    'Disallow: /api/',
    'Disallow: /settings',
    `Sitemap: ${origin}/sitemap.xml`,
    '',
  ].join('\n')
})
