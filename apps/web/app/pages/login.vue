<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { signIn, signUp } from '~/lib/auth-client'

const mode = ref<'signin' | 'signup'>('signin')
const email = ref('')
const password = ref('')
const name = ref('')
const loading = ref(false)
const githubLoading = ref(false)
const githubEnabled = ref(false)
const signupEnabled = ref(false)
const workspaceClaimed = ref(false)
const configLoaded = ref(false)
const configUnavailable = ref(false)
const error = ref('')
const route = useRoute()

const postAuthPath = computed(() => {
  const requested = typeof route.query.redirect === 'string' ? route.query.redirect : '/'
  return requested.startsWith('/') && !requested.startsWith('//') ? requested : '/'
})

onMounted(async () => {
  try {
    const res = await fetch('/api/auth/config')
    if (!res.ok) throw new Error('Could not load workspace status')
    const data = await res.json()
    githubEnabled.value = !!data.githubEnabled
    signupEnabled.value = !!data.signupEnabled
    workspaceClaimed.value = !!data.workspaceClaimed

    // A fresh private deployment should lead with owner creation. Once the
    // workspace is claimed, sign-in is the only public path.
    if (!workspaceClaimed.value && signupEnabled.value) mode.value = 'signup'
    else if (!signupEnabled.value) mode.value = 'signin'
  } catch {
    githubEnabled.value = false
    configUnavailable.value = true
  } finally {
    configLoaded.value = true
  }
})

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
    await navigateTo(postAuthPath.value, { redirectCode: 302 })
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
  <div class="relative min-h-screen overflow-hidden px-4 py-8 sm:px-6 lg:px-8">
    <div class="pointer-events-none absolute inset-0">
      <div class="absolute left-[12%] top-[-12rem] h-[38rem] w-[38rem] rounded-full bg-amber-500/[0.09] blur-[140px]" />
      <div class="absolute bottom-[-12rem] right-[-8rem] h-[34rem] w-[34rem] rounded-full bg-cyan-500/[0.06] blur-[130px]" />
    </div>

    <div class="relative mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-6xl flex-col">
      <nav class="rise flex items-center justify-between" style="animation-delay: 0.02s">
        <a href="https://github.com/jesseoue/grep-knowledge-agent" class="flex items-center gap-2.5 text-zinc-100" target="_blank" rel="noreferrer">
          <span class="flex h-9 w-9 items-center justify-center rounded-lg border border-amber-400/30 bg-amber-400/10 text-lg font-bold text-amber-300">⌕</span>
          <span class="text-sm font-bold tracking-tight">Grep Agent</span>
        </a>
        <a
          href="https://railway.com/deploy/grep-knowledge-agent?utm_medium=integration&utm_source=app&utm_campaign=grep-knowledge-agent"
          class="inline-flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950/70 px-3 py-2 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-400 transition hover:border-amber-400/30 hover:text-amber-300"
          target="_blank"
          rel="noreferrer"
        >
          deploy your own <span class="text-amber-400">↗</span>
        </a>
      </nav>

      <main class="grid flex-1 items-center gap-10 py-12 lg:grid-cols-[1.15fr_0.85fr] lg:gap-16 lg:py-16">
        <section class="rise" style="animation-delay: 0.08s">
          <div class="mb-5 inline-flex items-center gap-2 rounded-full border border-green-400/20 bg-green-400/[0.05] px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-green-300">
            <span class="h-1.5 w-1.5 rounded-full bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.75)]" />
            self-hosted · source-grounded
          </div>
          <h1 class="max-w-3xl text-[2.65rem] font-bold leading-[0.98] tracking-[-0.065em] text-zinc-100 sm:text-5xl lg:text-6xl">
            Search your code.<br><span class="text-amber-300">See the proof.</span>
          </h1>
          <p class="mt-6 max-w-xl text-sm leading-7 text-zinc-400 sm:text-base">
            A knowledge agent that reads the files you actually own. No embedding pipeline, no vector database, and no mystery retrieval—just direct search with citations and a complete command trace.
          </p>

          <div class="mt-6 flex flex-wrap gap-2 font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-500">
            <span class="rounded border border-zinc-800 bg-zinc-950/60 px-2.5 py-1.5"><span class="text-cyan-300">01</span> sync GitHub</span>
            <span class="rounded border border-zinc-800 bg-zinc-950/60 px-2.5 py-1.5"><span class="text-cyan-300">02</span> ask anything</span>
            <span class="rounded border border-zinc-800 bg-zinc-950/60 px-2.5 py-1.5"><span class="text-cyan-300">03</span> inspect trace</span>
          </div>

          <div class="terminal-window mt-8 max-w-2xl border-zinc-700/70 shadow-[0_32px_100px_rgba(0,0,0,0.46)]">
          <div class="terminal-titlebar">
            <span class="terminal-dot bg-red-400/80" />
            <span class="terminal-dot bg-amber-400/80" />
            <span class="terminal-dot bg-green-400/80" />
            <span class="ml-3 font-mono text-[10px] text-zinc-500">trace / answer #42</span>
          </div>
          <div class="p-4 font-mono text-[11px] leading-relaxed sm:p-6 sm:text-[12px]">
            <p class="text-zinc-400"><span class="text-green-400">$</span> grep -R "RATE_LIMIT" ./docs ./server</p>
            <p class="mt-1.5 text-zinc-500"><span class="text-cyan-300">server/api/chat.ts</span><span class="text-zinc-600">:19</span> RATE_LIMIT_WINDOW_S = <span class="text-amber-300">60</span></p>
            <p class="mt-1 text-zinc-500"><span class="text-cyan-300">docs/operations.md</span><span class="text-zinc-600">:42</span> retries after the window resets</p>
            <div class="signal-line my-4 h-px bg-zinc-800" />
            <p class="text-zinc-300"><span class="text-amber-300">answer</span> Requests use Redis-backed per-user rate limits, with a safe local fallback.</p>
            <p class="mt-3 text-zinc-600">sources: <span class="text-cyan-300">chat.ts:19–49</span> · <span class="text-cyan-300">operations.md:42</span></p>
          </div>
        </div>
          <div class="mt-4 grid max-w-2xl grid-cols-3 divide-x divide-zinc-800 border-y border-zinc-800 py-3 text-center font-mono text-[9px] uppercase tracking-[0.11em] text-zinc-600 sm:text-[10px]">
            <span><b class="block text-zinc-300">BYOK</b> any provider</span>
            <span><b class="block text-zinc-300">read-only</b> shell policy</span>
            <span><b class="block text-zinc-300">MIT</b> own the stack</span>
          </div>
        </section>

        <section class="rise lg:pl-2" style="animation-delay: 0.16s">
          <div class="mb-6">
            <p class="font-mono text-[10px] uppercase tracking-[0.18em] text-amber-400">
              {{ !configLoaded ? 'checking workspace' : workspaceClaimed ? 'owner account configured' : 'first-run setup' }}
            </p>
            <h2 class="mt-2 text-2xl font-bold tracking-[-0.04em] text-zinc-100">
              {{ workspaceClaimed ? 'Welcome back.' : 'Claim your workspace.' }}
            </h2>
            <p class="mt-2 text-[12px] leading-relaxed text-zinc-500">
              {{ workspaceClaimed ? 'Owner setup is complete. Sign in with the first account created for this deployment.' : 'Create the first owner account. Public registration closes automatically afterward.' }}
            </p>
          </div>

          <div class="terminal-window border-zinc-700/70">
            <div class="terminal-titlebar justify-between">
              <span class="ml-1 font-mono text-[10px] text-zinc-500">{{ mode === 'signin' ? 'session/sign-in' : 'session/create-account' }}</span>
              <span class="font-mono text-[9px] uppercase tracking-[0.12em] text-green-400">encrypted</span>
            </div>

            <div class="p-5 sm:p-6">
              <UAlert v-if="error" color="error" variant="subtle" :title="error" class="mb-4" icon="i-lucide-triangle-alert" />
              <UAlert
                v-else-if="configUnavailable"
                color="error"
                variant="subtle"
                title="Workspace status unavailable"
                description="Refresh the page before signing in or creating an account."
                class="mb-4"
                icon="i-lucide-wifi-off"
              />
              <UAlert
                v-else-if="workspaceClaimed"
                color="neutral"
                variant="subtle"
                title="Owner setup complete"
                description="Public signup is closed to protect this private workspace."
                class="mb-4"
                icon="i-lucide-lock-keyhole"
              />
              <UAlert
                v-else-if="configLoaded"
                color="success"
                variant="subtle"
                title="Create the first owner account"
                description="This one-time setup claims the deployment and closes public signup."
                class="mb-4"
                icon="i-lucide-shield-check"
              />

              <div class="mb-5 grid gap-1 rounded-lg border border-zinc-800 bg-zinc-950 p-1 font-mono text-[11px]" :class="signupEnabled ? 'grid-cols-2' : 'grid-cols-1'">
                <button type="button" :disabled="!configLoaded" class="rounded-md py-2 font-medium transition disabled:cursor-wait disabled:opacity-50" :class="mode === 'signin' ? 'bg-amber-400/15 text-amber-300 shadow-[inset_0_0_18px_rgba(251,191,36,0.05)]' : 'text-zinc-500 hover:text-zinc-300'" @click="mode = 'signin'; error = ''">sign in</button>
                <button v-if="signupEnabled" type="button" :disabled="!configLoaded" class="rounded-md py-2 font-medium transition disabled:cursor-wait disabled:opacity-50" :class="mode === 'signup' ? 'bg-amber-400/15 text-amber-300 shadow-[inset_0_0_18px_rgba(251,191,36,0.05)]' : 'text-zinc-500 hover:text-zinc-300'" @click="mode = 'signup'; error = ''">create owner</button>
              </div>

              <form class="space-y-4" @submit.prevent="submit">
                <div v-if="mode === 'signup'">
                  <label for="auth-name" class="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-500">name</label>
                  <UInput id="auth-name" v-model.trim="name" class="w-full" placeholder="Jane Doe" autocomplete="name" required />
                </div>
                <div>
                  <label for="auth-email" class="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-500">email</label>
                  <UInput id="auth-email" v-model.trim="email" class="w-full" type="email" placeholder="you@example.com" autocomplete="email" required />
                </div>
                <div>
                  <div class="mb-1.5 flex items-center justify-between">
                    <label for="auth-password" class="font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-500">password</label>
                    <span v-if="mode === 'signup'" class="font-mono text-[9px] text-zinc-600">8+ characters</span>
                  </div>
                  <UInput id="auth-password" v-model="password" class="w-full" type="password" placeholder="••••••••" :autocomplete="mode === 'signup' ? 'new-password' : 'current-password'" minlength="8" required />
                </div>
                <UButton block type="submit" color="primary" size="lg" :loading="loading" :disabled="!configLoaded || configUnavailable" icon="i-lucide-arrow-right" class="!mt-5 !font-semibold">
                  {{ mode === 'signin' ? 'Enter workspace' : 'Create owner account' }}
                </UButton>
              </form>

              <template v-if="githubEnabled">
                <div class="my-5 flex items-center gap-3 text-[10px] uppercase tracking-[0.12em] text-zinc-600"><div class="h-px flex-1 bg-zinc-800" />or<div class="h-px flex-1 bg-zinc-800" /></div>
                <UButton block color="neutral" variant="outline" icon="i-lucide-github" :loading="githubLoading" class="!border-zinc-700 !bg-transparent !text-zinc-200 hover:!bg-zinc-900" @click="githubLogin">Continue with GitHub</UButton>
              </template>

              <p class="mt-5 text-center font-mono text-[9px] leading-relaxed text-zinc-600">Your credentials and chat history stay inside this deployment.</p>

              <div v-if="workspaceClaimed" class="mt-5 border-t border-zinc-800 pt-4 text-center">
                <p class="text-[11px] font-medium text-zinc-400">Lost access?</p>
                <p class="mt-1 text-[10px] leading-relaxed text-zinc-600">Recover the owner securely through Railway SSH. Signup stays closed and your data is preserved.</p>
                <a
                  href="https://github.com/jesseoue/grep-knowledge-agent#recover-owner-access"
                  target="_blank"
                  rel="noreferrer"
                  class="mt-2 inline-flex items-center gap-1 font-mono text-[10px] text-amber-300 transition hover:text-amber-200"
                >
                  owner recovery guide <span aria-hidden="true">↗</span>
                </a>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer class="flex flex-col items-center justify-between gap-3 border-t border-zinc-900 py-5 font-mono text-[9px] uppercase tracking-[0.12em] text-zinc-700 sm:flex-row">
        <span>Grep Knowledge Agent · MIT</span>
        <span class="flex items-center gap-4"><a href="https://github.com/jesseoue/grep-knowledge-agent" target="_blank" rel="noreferrer" class="hover:text-zinc-400">source ↗</a><a href="https://railway.com" target="_blank" rel="noreferrer" class="hover:text-zinc-400">runs on Railway ↗</a></span>
      </footer>
    </div>
  </div>
</template>
