// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: 'latest',

  modules: [
    '@nuxt/ui',
    '@nuxtjs/mdc',
  ],

  icon: {
    clientBundle: {
      scan: true,
      includeCustomCollections: true,
    },
    provider: 'iconify',
  },

  css: ['~/assets/css/main.css'],

  devtools: { enabled: true },

  nitro: {
    experimental: {
      asyncContext: true,
      openAPI: true,
    },
  },

  runtimeConfig: {
    databaseUrl: '',
    redisUrl: '',
    betterAuthSecret: '',
    githubClientId: '',
    githubClientSecret: '',
    snapshotRepo: '',
    snapshotBranch: 'main',
    sandboxUrl: 'http://sandbox.railway.internal:3200',
    // AI provider keys (bring-your-own-key — at least one required)
    openaiApiKey: '',
    anthropicApiKey: '',
    googleApiKey: '',
    public: {
      siteUrl: '',
      githubAppName: 'Grep Knowledge Agent',
    },
  },
})
