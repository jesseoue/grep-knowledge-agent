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
  <div class="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-12">
    <!-- Ambient glow -->
    <div class="pointer-events-none absolute inset-0">
      <div class="absolute left-1/2 top-0 h-[400px] w-[700px] -translate-x-1/2 rounded-full bg-amber-500/10 blur-[120px]" />
      <div class="absolute bottom-0 right-0 h-[300px] w-[500px] rounded-full bg-cyan-500/5 blur-[100px]" />
    </div>

    <div class="relative grid w-full max-w-4xl items-stretch gap-6 lg:grid-cols-[1.1fr_1fr]">
      <!-- Left: terminal hero -->
      <div class="rise hidden flex-col lg:flex" style="animation-delay: 0.05s">
        <div class="terminal-window flex-1">
          <div class="terminal-titlebar">
            <span class="terminal-dot bg-red-400/80" />
            <span class="terminal-dot bg-amber-400/80" />
            <span class="terminal-dot bg-green-400/80" />
            <span class="ml-3 font-mono text-[11px] text-zinc-500">grep — interactive</span>
          </div>
          <div class="p-6 font-mono text-[13px] leading-relaxed">
            <p class="text-zinc-400"><span class="text-green-400">$</span> grep -r "rate limit" ~/docs</p>
            <p class="mt-1 text-zinc-500"><span class="text-cyan-300">docs/limits.md</span><span class="text-zinc-600">:12</span>  <span class="grep-hit">rate_limit</span> = 60</p>
            <p class="mt-1 text-zinc-500"><span class="text-cyan-300">docs/api.md</span><span class="text-zinc-600">:34</span>   429 <span class="grep-hit">rate limit</span> exceeded</p>
            <p class="mt-4 text-zinc-400"><span class="text-green-400">$</span> cat docs/limits.md <span class="text-zinc-600">| head -20</span></p>
            <p class="mt-1 text-zinc-500"># Rate limiting</p>
            <p class="text-zinc-500">The API allows <span class="text-amber-300">60 req/min</span> per key.</p>
            <p class="mt-4 flex items-center gap-1 text-zinc-400"><span class="text-green-400">$</span><span class="cursor-blink inline-block h-4 w-2 bg-amber-400/80" /></p>
          </div>
        </div>
        <div class="mt-4 flex items-center gap-2 text-[11px] text-zinc-500">
          <span class="inline-block h-1.5 w-1.5 rounded-full bg-green-400 shadow-[0_0_8px_2px_rgba(74,222,128,0.5)]" />
          no embeddings · no vector DB · grep, find &amp; cat
        </div>
      </div>

      <!-- Right: login card -->
      <div class="rise flex items-center lg:pl-2" style="animation-delay: 0.15s">
        <div class="w-full">
          <div class="mb-8">
            <div class="flex items-center gap-2">
              <span class="text-2xl font-bold text-amber-400">❯</span>
              <h1 class="text-2xl font-bold tracking-tight text-zinc-100">Grep Knowledge Agent</h1>
            </div>
            <p class="mt-2 font-mono text-[12px] text-zinc-500">
              grep, not embeddings — a filesystem, bash, and an LLM
            </p>
          </div>

          <div class="terminal-window">
            <div class="terminal-titlebar">
              <span class="ml-1 font-mono text-[11px] text-zinc-500">{{ mode === 'signin' ? 'auth/login' : 'auth/register' }}</span>
            </div>

            <div class="p-6">
              <UAlert v-if="error" type="error" :title="error" class="mb-4" icon="i-lucide-triangle-alert" />

              <!-- GitHub OAuth -->
              <UButton
                block
                color="neutral"
                variant="outline"
                icon="i-lucide-github"
                :loading="githubLoading"
                class="!border-zinc-700 !bg-transparent !text-zinc-200 hover:!bg-zinc-900"
                @click="githubLogin"
              >
                Continue with GitHub
              </UButton>

              <div class="my-5 flex items-center gap-3 text-[11px] text-zinc-600">
                <div class="h-px flex-1 bg-zinc-800"></div>
                or continue with email
                <div class="h-px flex-1 bg-zinc-800"></div>
              </div>

              <!-- Mode toggle -->
              <div class="mb-5 grid grid-cols-2 gap-1 rounded-lg border border-zinc-800 bg-zinc-950 p-1 font-mono text-[12px]">
                <button
                  type="button"
                  class="rounded-md py-1.5 font-medium transition"
                  :class="mode === 'signin' ? 'bg-amber-400/15 text-amber-300' : 'text-zinc-500 hover:text-zinc-300'"
                  @click="mode = 'signin'"
                >
                  sign_in
                </button>
                <button
                  type="button"
                  class="rounded-md py-1.5 font-medium transition"
                  :class="mode === 'signup' ? 'bg-amber-400/15 text-amber-300' : 'text-zinc-500 hover:text-zinc-300'"
                  @click="mode = 'signup'"
                >
                  register
                </button>
              </div>

              <!-- Email / Password form -->
              <form class="space-y-4" @submit.prevent="submit">
                <div v-if="mode === 'signup'">
                  <label class="mb-1.5 block font-mono text-[11px] text-zinc-500">name</label>
                  <UInput v-model.trim="name" placeholder="jane_doe" autocomplete="name" />
                </div>
                <div>
                  <label class="mb-1.5 block font-mono text-[11px] text-zinc-500">email</label>
                  <UInput v-model.trim="email" type="email" placeholder="you@example.com" autocomplete="email" required />
                </div>
                <div>
                  <label class="mb-1.5 block font-mono text-[11px] text-zinc-500">password</label>
                  <UInput v-model.trim="password" type="password" placeholder="••••••••" autocomplete="current-password" required />
                </div>
                <UButton
                  block
                  type="submit"
                  color="primary"
                  :loading="loading"
                  icon="i-lucide-terminal"
                  class="!font-semibold"
                >
                  {{ mode === 'signin' ? '$ ./auth --signin' : '$ ./auth --register' }}
                </UButton>
              </form>
            </div>
          </div>

          <p class="mt-6 text-center font-mono text-[11px] text-zinc-600">
            self-hosted on Railway · MIT · fork of vercel-labs/knowledge-agent-template
          </p>
        </div>
      </div>
    </div>
  </div>
</template>
