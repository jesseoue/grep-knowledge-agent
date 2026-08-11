<script setup lang="ts">
import { ref } from 'vue'
import { signIn, signUp } from '~/lib/auth-client'

const mode = ref<'signin' | 'signup'>('signin')
const email = ref('')
const password = ref('')
const name = ref('')
const loading = ref(false)
const githubLoading = ref(false)
const error = ref('')

async function submit() {
  error.value = ''
  loading.value = true
  try {
    if (mode.value === 'signup') {
      const { error: err } = await signUp.email({
        email: email.value,
        password: password.value,
        name: name.value || email.value.split('@')[0] || 'User',
      })
      if (err) throw new Error(err.message || 'Sign up failed')
    } else {
      const { error: err } = await signIn.email({
        email: email.value,
        password: password.value,
      })
      if (err) throw new Error(err.message || 'Sign in failed')
    }
    // Redirect to home after successful auth
    await navigateTo('/', { redirectCode: 302 })
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Authentication failed'
  } finally {
    loading.value = false
  }
}

async function githubLogin() {
  error.value = ''
  githubLoading.value = true
  try {
    const { error: err } = await signIn.social({
      provider: 'github',
      callbackURL: '/',
    })
    if (err) throw new Error(err.message || 'GitHub sign in failed')
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'GitHub sign in failed'
    githubLoading.value = false
  }
}
</script>

<template>
  <div class="flex min-h-screen items-center justify-center bg-gray-50 px-4 dark:bg-gray-950">
    <div class="w-full max-w-md">
      <div class="mb-8 text-center">
        <UButton icon="i-lucide-search" color="primary" variant="soft" size="xl" square />
        <h1 class="mt-4 text-2xl font-bold">Grep Knowledge Agent</h1>
        <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
          grep, not embeddings — no vector DB
        </p>
      </div>

      <div class="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-200 dark:bg-gray-900 dark:ring-gray-800">
        <UAlert v-if="error" type="error" :title="error" class="mb-4" />

        <!-- Mode toggle -->
        <div class="mb-6 grid grid-cols-2 gap-1 rounded-xl bg-gray-100 p-1 dark:bg-gray-800">
          <button
            type="button"
            class="rounded-lg py-2 text-sm font-medium transition"
            :class="mode === 'signin' ? 'bg-white shadow-sm dark:bg-gray-900' : 'text-gray-500'"
            @click="mode = 'signin'"
          >
            Sign in
          </button>
          <button
            type="button"
            class="rounded-lg py-2 text-sm font-medium transition"
            :class="mode === 'signup' ? 'bg-white shadow-sm dark:bg-gray-900' : 'text-gray-500'"
            @click="mode = 'signup'"
          >
            Create account
          </button>
        </div>

        <!-- GitHub OAuth -->
        <UButton
          block
          color="neutral"
          variant="outline"
          icon="i-lucide-github"
          :loading="githubLoading"
          @click="githubLogin"
        >
          Continue with GitHub
        </UButton>

        <div class="my-5 flex items-center gap-3 text-xs text-gray-400">
          <div class="h-px flex-1 bg-gray-200 dark:bg-gray-700"></div>
          or continue with email
          <div class="h-px flex-1 bg-gray-200 dark:bg-gray-700"></div>
        </div>

        <!-- Email / Password form -->
        <form class="space-y-4" @submit.prevent="submit">
          <UFormField v-if="mode === 'signup'" label="Name">
            <UInput v-model.trim="name" placeholder="Jane Doe" autocomplete="name" />
          </UFormField>
          <UFormField label="Email">
            <UInput v-model.trim="email" type="email" placeholder="you@example.com" autocomplete="email" required />
          </UFormField>
          <UFormField label="Password">
            <UInput v-model.trim="password" type="password" placeholder="" autocomplete="" required />
          </UFormField>
          <UButton block type="submit" color="primary" :loading="loading">
            {{ mode === 'signin' ? 'Sign in' : 'Create account' }}
          </UButton>
        </form>
      </div>

      <p class="mt-6 text-center text-xs text-gray-400">
        Self-hosted on Railway · MIT licensed · fork of vercel-labs/knowledge-agent-template
      </p>
    </div>
  </div>
</template>
