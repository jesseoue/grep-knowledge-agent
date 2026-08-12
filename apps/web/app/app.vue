<script setup lang="ts">
const description = 'A self-hosted AI knowledge agent that answers questions from your own repos and docs using grep, find, and cat. No vector database, no embeddings. One-click deploy on Railway.'
const title = 'Grep Knowledge Agent — deterministic AI over your own code'

// SEO: title, description, Open Graph, and Twitter cards (auto-generates og:* / twitter:* tags)
useSeoMeta({
  title,
  description,
  ogTitle: title,
  ogDescription: description,
  ogImage: '/og.png',
  ogType: 'website',
  ogSiteName: 'Grep Knowledge Agent',
  twitterCard: 'summary_large_image',
  twitterTitle: title,
  twitterDescription: description,
  twitterImage: '/og.png',
})

useHead({
  htmlAttrs: { lang: 'en' },
  link: [
    { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
    { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
    {
      rel: 'stylesheet',
      href: 'https://fonts.googleapis.com/css2?family=JetBrains+Mono:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400&display=swap',
    },
    { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
  ],
  meta: [
    { name: 'robots', content: 'index, follow' },
    { name: 'theme-color', content: '#0a0a0b' },
    { name: 'author', content: 'Grep Knowledge Agent' },
    { name: 'keywords', content: 'knowledge agent, AI agent, grep, RAG alternative, self-hosted, Railway, code search, local AI' },
  ],
})
</script>

<template>
  <div>
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
    <UNotifications />
  </div>
</template>
