<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { authClient } from '~/lib/auth-client'

const sources = ref<Array<{ id: string, type: string, label: string, repo?: string, branch?: string }>>([])
const snapshotRepo = ref('')
const snapshotBranch = ref('main')
const snapshotContentPath = ref('')
const loading = ref(false)
const message = ref('')
const error = ref('')
const currentPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const changingPassword = ref(false)
const securityMessage = ref('')
const securityError = ref('')

async function logout() {
  await authClient.signOut()
  await navigateTo('/login')
}

const newSource = ref({
  type: 'github' as string,
  label: '',
  repo: '',
  branch: 'main',
  contentPath: '',
})

async function load() {
  try {
    const res = await fetch('/api/sources')
    const data = await res.json()
    if (!res.ok) throw new Error(data.data?.why || data.statusMessage || 'Failed to load sources')
    sources.value = data.github.sources || []
    snapshotRepo.value = data.snapshotRepo || ''
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to load sources'
  }
}

onMounted(load)

async function addSource() {
  error.value = ''
  message.value = ''
  loading.value = true
  try {
    const res = await fetch('/api/sources', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newSource.value),
    })
    if (!res.ok) {
      const err = await res.json()
      throw new Error(err.data?.why || err.statusMessage || err.message || 'Failed to add source')
    }
    message.value = `Added "${newSource.value.label}". Run sync to fetch its content.`
    newSource.value = { type: 'github', label: '', repo: '', branch: 'main', contentPath: '' }
    await load()
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to add source'
  } finally {
    loading.value = false
  }
}

async function removeSource(id: string) {
  error.value = ''
  loading.value = true
  try {
    const res = await fetch(`/api/sources/${id}`, { method: 'DELETE' })
    if (!res.ok) {
      const data = await res.json().catch(() => null)
      throw new Error(data?.data?.why || data?.statusMessage || 'Failed to remove source')
    }
    sources.value = sources.value.filter(s => s.id !== id)
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to remove source'
  } finally {
    loading.value = false
  }
}

async function runSync() {
  error.value = ''
  message.value = ''
  loading.value = true
  try {
    const res = await fetch('/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sources: sources.value.map(s => s.id) }),
    })
    const data = await res.json()
    if (!res.ok || data.success === false) {
      throw new Error(data.data?.why || data.results?.find((result: { success: boolean, error?: string }) => !result.success)?.error || data.statusMessage || 'Sync failed')
    }
    message.value = `Synced ${data.summary?.synced}/${data.summary?.total} sources`
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Sync failed'
  } finally {
    loading.value = false
  }
}

async function syncSnapshotRepo() {
  error.value = ''
  message.value = ''
  const repo = snapshotRepo.value.trim()
  if (!repo) {
    error.value = 'Enter an owner/repo to sync (e.g. vercel-labs/knowledge-agent-template)'
    return
  }
  loading.value = true
  try {
    const res = await fetch('/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ repo, branch: snapshotBranch.value, contentPath: snapshotContentPath.value || undefined }),
    })
    const data = await res.json()
    if (!res.ok || data.success === false) {
      throw new Error(data.data?.why || data.statusMessage || 'Sync failed')
    }
    message.value = `Synced ${repo}`
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Sync failed'
  } finally {
    loading.value = false
  }
}

// One-click demo: add a pre-configured source and sync it immediately.
async function addDemoSource() {
  error.value = ''
  message.value = ''
  loading.value = true
  try {
    const addRes = await fetch('/api/sources/demo', { method: 'POST' })
    if (!addRes.ok) {
      const err = await addRes.json().catch(() => null)
      throw new Error(err?.message || err?.statusMessage || 'Failed to add demo source')
    }
    const added = await addRes.json()
    await load()
    const syncRes = await fetch('/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sources: [added.source.id] }),
    })
    const data = await syncRes.json()
    if (!syncRes.ok || data.success === false) throw new Error(data.data?.why || data.statusMessage || 'Demo sync failed')
    message.value = `Demo ready — ask the agent anything about the template docs.`
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to set up demo'
  } finally {
    loading.value = false
  }
}

async function changePassword() {
  securityError.value = ''
  securityMessage.value = ''

  if (newPassword.value.length < 12) {
    securityError.value = 'Use at least 12 characters for the new password.'
    return
  }
  if (newPassword.value !== confirmPassword.value) {
    securityError.value = 'New passwords do not match.'
    return
  }

  changingPassword.value = true
  try {
    const { error: authError } = await authClient.changePassword({
      currentPassword: currentPassword.value,
      newPassword: newPassword.value,
      revokeOtherSessions: true,
    })
    if (authError) throw new Error(authError.message || 'Could not change password')

    currentPassword.value = ''
    newPassword.value = ''
    confirmPassword.value = ''
    securityMessage.value = 'Password updated. Other sessions have been revoked.'
  } catch (e) {
    securityError.value = e instanceof Error ? e.message : 'Could not change password'
  } finally {
    changingPassword.value = false
  }
}
</script>

<template>
  <div class="min-h-screen bg-[#0a0a0b]">
    <header class="sticky top-0 z-20 border-b border-zinc-800 bg-[#0a0a0b]/90 px-3 py-3 backdrop-blur-xl sm:px-5">
      <div class="mx-auto flex max-w-4xl items-center justify-between">
        <div class="flex items-center gap-3">
          <UButton to="/" icon="i-lucide-arrow-left" color="neutral" variant="ghost" square aria-label="Back to chat" class="!text-zinc-400 hover:!text-zinc-100" />
          <div>
            <h1 class="text-sm font-bold tracking-tight text-zinc-100">Knowledge sources</h1>
            <p class="hidden font-mono text-[10px] text-zinc-500 sm:block">choose exactly what the agent can search</p>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <UButton :loading="loading" :disabled="sources.length === 0" icon="i-lucide-refresh-cw" color="primary" size="sm" @click="runSync">
            <span class="hidden sm:inline">sync all</span>
          </UButton>
          <UButton
            icon="i-lucide-log-out"
            color="neutral"
            variant="ghost"
            size="sm"
            aria-label="Sign out"
            class="!text-zinc-500 hover:!text-red-400"
            @click="logout"
          >
            <span class="hidden sm:inline">exit</span>
          </UButton>
        </div>
      </div>
    </header>

    <main class="mx-auto max-w-4xl px-4 py-7 sm:px-5 sm:py-10">
      <div class="mb-8 max-w-2xl">
        <p class="font-mono text-[10px] uppercase tracking-[0.18em] text-amber-400">retrieval control plane</p>
        <h2 class="mt-2 text-2xl font-bold tracking-[-0.04em] text-zinc-100 sm:text-3xl">Put your knowledge on disk.</h2>
        <p class="mt-2 text-[12px] leading-relaxed text-zinc-500 sm:text-[13px]">Sync public GitHub repositories into the read-only snapshot. The agent can only search the Markdown, YAML, and JSON files you choose.</p>
      </div>

      <UAlert v-if="error" color="error" variant="subtle" :title="error" class="mb-6" icon="i-lucide-triangle-alert" />
      <UAlert v-if="message" color="success" variant="subtle" :title="message" class="mb-6" icon="i-lucide-check-circle" />

      <section v-if="sources.length === 0" class="mb-8 rounded-xl border border-amber-400/20 bg-amber-400/[0.04] p-5 sm:flex sm:items-center sm:justify-between sm:gap-6">
        <div>
          <p class="text-sm font-semibold text-zinc-200">Want to see it work first?</p>
          <p class="mt-1 font-mono text-[10px] leading-relaxed text-zinc-500">Load a safe public demo repository and start asking questions in one click.</p>
        </div>
        <UButton class="mt-4 shrink-0 sm:mt-0" icon="i-lucide-zap" color="primary" :loading="loading" @click="addDemoSource">Load demo source</UButton>
      </section>

      <!-- Snapshot repository -->
      <section class="mb-8">
        <h2 class="mb-2 font-mono text-[11px] font-semibold uppercase tracking-wider text-amber-400">❯ snapshot repository</h2>
        <div class="terminal-window">
          <div class="terminal-titlebar">
            <span class="ml-1 font-mono text-[11px] text-zinc-500">~/snapshot</span>
          </div>
          <div class="p-5">
            <p class="mb-4 font-mono text-[12px] text-zinc-400">
              the repo the agent searches with <span class="text-cyan-300">grep</span>. set it here or via
              <code class="rounded bg-zinc-800/80 px-1.5 py-0.5 text-amber-200">SNAPSHOT_REPO</code>.
            </p>
            <div class="grid gap-2 sm:grid-cols-[minmax(0,1fr)_8rem]">
              <UInput v-model="snapshotRepo" placeholder="owner/repo or GitHub URL" aria-label="Repository" />
              <UInput v-model="snapshotBranch" placeholder="main" aria-label="Branch" />
            </div>
            <div class="mt-2 flex flex-col gap-2 sm:flex-row">
              <UInput v-model="snapshotContentPath" class="min-w-0 flex-1" placeholder="optional path, e.g. docs/" aria-label="Optional content path" />
              <UButton icon="i-lucide-download" :loading="loading" :disabled="!snapshotRepo.trim()" color="primary" @click="syncSnapshotRepo">Sync now</UButton>
            </div>
          </div>
        </div>
      </section>

      <!-- Add GitHub source -->
      <section class="mb-8">
        <h2 class="mb-2 font-mono text-[11px] font-semibold uppercase tracking-wider text-amber-400">❯ add github source</h2>
        <div class="terminal-window">
          <div class="terminal-titlebar">
            <span class="ml-1 font-mono text-[11px] text-zinc-500">$ add-source --type github</span>
          </div>
          <form class="p-5" @submit.prevent="addSource">
            <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div>
                <label class="mb-1.5 block font-mono text-[11px] text-zinc-500">label</label>
                <UInput v-model="newSource.label" class="w-full" placeholder="e.g. Nuxt docs" required />
              </div>
              <div>
                <label class="mb-1.5 block font-mono text-[11px] text-zinc-500">repository</label>
                <UInput v-model="newSource.repo" class="w-full" placeholder="owner/repo or GitHub URL" required />
              </div>
              <div>
                <label class="mb-1.5 block font-mono text-[11px] text-zinc-500">branch</label>
                <UInput v-model="newSource.branch" class="w-full" placeholder="main" />
              </div>
              <div>
                <label class="mb-1.5 block font-mono text-[11px] text-zinc-500">content path (optional)</label>
                <UInput v-model="newSource.contentPath" class="w-full" placeholder="docs/" />
              </div>
            </div>
            <UButton type="submit" class="mt-4" icon="i-lucide-plus" color="primary" :loading="loading">
              add source
            </UButton>
          </form>
        </div>
      </section>

      <!-- Sources list -->
      <section class="mb-8">
        <h2 class="mb-2 font-mono text-[11px] font-semibold uppercase tracking-wider text-amber-400">❯ sources ({{ sources.length }})</h2>
        <div v-if="sources.length === 0" class="terminal-window">
          <div class="p-8 text-center font-mono text-[11px] leading-relaxed text-zinc-600">
            <span class="text-zinc-500">$ find ~/snapshot -type f</span><br />
            <span class="text-zinc-600">no searchable files yet</span><br /><br />
            Add a repository above or load the demo source.
          </div>
        </div>
        <div v-else class="space-y-2">
          <div
            v-for="s in sources"
            :key="s.id"
            class="flex items-center justify-between gap-3 rounded-lg border border-zinc-800/70 bg-[#0d0d10] px-4 py-3"
          >
            <div class="flex min-w-0 items-center gap-3">
              <span class="text-green-400">▸</span>
              <div class="min-w-0">
                <p class="truncate text-sm font-medium text-zinc-200">{{ s.label }}</p>
                <p class="truncate font-mono text-[10px] text-zinc-500">{{ s.repo }} · {{ s.branch }}</p>
              </div>
            </div>
            <UButton icon="i-lucide-trash-2" color="neutral" variant="ghost" size="sm" aria-label="Remove source" class="shrink-0 !text-zinc-500 hover:!text-red-400" @click="removeSource(s.id)" />
          </div>
        </div>
      </section>

      <!-- Workspace security -->
      <section>
        <h2 class="mb-2 font-mono text-[11px] font-semibold uppercase tracking-wider text-amber-400">❯ workspace security</h2>
        <div class="terminal-window">
          <div class="terminal-titlebar justify-between">
            <span class="ml-1 font-mono text-[11px] text-zinc-500">session/change-password</span>
            <span class="font-mono text-[9px] uppercase tracking-[0.12em] text-green-400">owner only</span>
          </div>
          <div class="p-5">
            <div class="mb-5 flex gap-3 rounded-lg border border-zinc-800 bg-zinc-950/70 p-4">
              <UIcon name="i-lucide-shield-check" class="mt-0.5 h-4 w-4 shrink-0 text-green-400" />
              <div>
                <p class="text-sm font-semibold text-zinc-200">Keep owner access recoverable</p>
                <p class="mt-1 font-mono text-[10px] leading-relaxed text-zinc-500">Changing the password revokes other sessions. If you lose access completely, use the Railway SSH recovery command in the deployment guide—public signup never needs to be reopened.</p>
              </div>
            </div>

            <UAlert v-if="securityError" color="error" variant="subtle" :title="securityError" class="mb-4" icon="i-lucide-triangle-alert" />
            <UAlert v-if="securityMessage" color="success" variant="subtle" :title="securityMessage" class="mb-4" icon="i-lucide-check-circle" />

            <form class="space-y-3" @submit.prevent="changePassword">
              <div>
                <label for="current-password" class="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-500">current password</label>
                <UInput id="current-password" v-model="currentPassword" class="w-full" type="password" autocomplete="current-password" required />
              </div>
              <div class="grid gap-3 sm:grid-cols-2">
                <div>
                  <label for="new-password" class="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-500">new password</label>
                  <UInput id="new-password" v-model="newPassword" class="w-full" type="password" autocomplete="new-password" minlength="12" required />
                </div>
                <div>
                  <label for="confirm-password" class="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-500">confirm password</label>
                  <UInput id="confirm-password" v-model="confirmPassword" class="w-full" type="password" autocomplete="new-password" minlength="12" required />
                </div>
              </div>
              <div class="flex flex-col gap-3 pt-1 sm:flex-row sm:items-center sm:justify-between">
                <span class="font-mono text-[9px] text-zinc-600">12–128 characters · other sessions revoked</span>
                <UButton type="submit" color="primary" icon="i-lucide-key-round" :loading="changingPassword">Update password</UButton>
              </div>
            </form>
          </div>
        </div>
      </section>
    </main>
  </div>
</template>
