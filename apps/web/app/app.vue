<script setup lang="ts">
const route = useRoute()
const requestUrl = useRequestURL()

const description = 'Deploy a self-hosted AI knowledge agent that searches GitHub repositories with grep, streams cited answers, and keeps your data inside your Railway project.'
const title = 'Grep Knowledge Agent — Search your code. See the proof.'
const isPublicLanding = computed(() => route.path === '/login')
const publicOrigin = useState('public-origin', () => {
  if (import.meta.server) {
    const candidates = [
      process.env.PUBLIC_SITE_URL,
      process.env.RAILWAY_PUBLIC_DOMAIN,
      process.env.RAILWAY_STATIC_URL,
    ]

    for (const candidate of candidates) {
      if (!candidate) continue
      try {
        const url = new URL(candidate.includes('://') ? candidate : `https://${candidate}`)
        if (['http:', 'https:'].includes(url.protocol) && !url.username && !url.password) return url.origin
      } catch {
        // Ignore invalid optional configuration and use the request origin.
      }
    }
  }

  return requestUrl.origin
})
const canonicalUrl = computed(() => new URL('/login', publicOrigin.value).toString())
const socialImageUrl = computed(() => new URL('/og.png', publicOrigin.value).toString())

const softwareApplicationSchema = computed(() => ({
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'Grep Knowledge Agent',
  description,
  url: canonicalUrl.value,
  applicationCategory: 'DeveloperApplication',
  operatingSystem: 'Web',
  isAccessibleForFree: true,
  license: 'https://opensource.org/license/mit',
  codeRepository: 'https://github.com/jesseoue/grep-knowledge-agent',
  image: socialImageUrl.value,
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'USD',
  },
  featureList: [
    'Source-grounded answers with file citations',
    'Read-only grep, find, and cat retrieval',
    'Self-hosted Railway deployment',
    'OpenRouter, OpenAI, Anthropic, and Google Gemini support',
  ],
}))

useSeoMeta({
  title,
  description,
  robots: () => isPublicLanding.value ? 'index, follow, max-image-preview:large' : 'noindex, nofollow',
  ogTitle: title,
  ogDescription: description,
  ogImage: () => socialImageUrl.value,
  ogImageAlt: 'Grep Knowledge Agent — source-grounded AI answers with a complete command trace',
  ogUrl: () => canonicalUrl.value,
  ogType: 'website',
  ogSiteName: 'Grep Knowledge Agent',
  ogLocale: 'en_US',
  twitterCard: 'summary_large_image',
  twitterTitle: title,
  twitterDescription: description,
  twitterImage: () => socialImageUrl.value,
  twitterImageAlt: 'Grep Knowledge Agent — search your code and see the proof',
})

useHead(() => ({
  htmlAttrs: { lang: 'en', class: 'dark' },
  link: [
    { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
    ...(isPublicLanding.value ? [{ rel: 'canonical' as const, href: canonicalUrl.value }] : []),
  ],
  meta: [
    { name: 'theme-color', content: '#0a0a0b' },
    { name: 'author', content: 'Grep Knowledge Agent' },
  ],
  script: isPublicLanding.value
    ? [{
        type: 'application/ld+json',
        innerHTML: JSON.stringify(softwareApplicationSchema.value),
      }]
    : [],
}))
</script>

<template>
  <UApp>
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>
