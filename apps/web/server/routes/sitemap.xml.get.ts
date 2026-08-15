import { getPublicOrigin } from '../lib/public-origin'

export default defineEventHandler((event) => {
  const origin = getPublicOrigin(event)
  const landingUrl = `${origin}/login`
  setHeader(event, 'content-type', 'application/xml; charset=utf-8')
  setHeader(event, 'cache-control', 'public, max-age=3600')

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    '  <url>',
    `    <loc>${landingUrl}</loc>`,
    '  </url>',
    '</urlset>',
    '',
  ].join('\n')
})
