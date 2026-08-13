<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { authClient } from '~/lib/auth-client'

const sources = ref<Array<{ id: string, type: string, label: string, repo?: string, branch?: string }>>([])
const snapshotRepo = ref('')
const snapshotBranch = ref('main')
const loading = ref(false)
const message = ref('')
const error = ref('')

const session = authClient.useSession()

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
    if (res.ok) {
      const data = await res.json()
      sources.value = data.github.sources || []
      snapshotRepo.value = data.snapshotRepo || ''
    }
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
      throw new Error(err.message || 'Failed to add source')
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
    if (!res.ok) throw new Error('Failed to remove source')
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
    if (!res.ok) throw new Error(data.message || 'Sync failed')
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
      body: JSON.stringify({ repo, branch: snapshotBranch.value }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.message || 'Sync failed')
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
    await load()
    const syncRes = await fetch('/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sources: sources.value.map(s => s.id) }),
    })
    const data = await syncRes.json()
    if (!syncRes.ok) throw new Error(data.message || 'Demo sync failed')
    message.value = `Demo ready — ask the agent anything about the template docs.`
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to set up demo'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="min-h-screen bg-[#0a0a0b]">
    <header class="border-b border-zinc-800 bg-[#0a0a0b]/80 px-5 py-3 backdrop-blur">
      <div class="mx-auto flex max-w-4xl items-center justify-between">
        <div class="flex items-center gap-3">
          <UButton to="/" icon="i-lucide-arrow-left" color="neutral" variant="ghost" square class="!text-zinc-400 hover:!text-zinc-100" />
          <div>
            <h1 class="text-sm font-bold tracking-tight text-zinc-100">sources &amp; sync</h1>
            <p class="font-mono text-[10px] text-zinc-500">manage the filesystem the agent greps</p>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <UButton :loading="loading" icon="i-lucide-refresh-cw" color="primary" size="sm" @click="runSync">
            sync all
          </UButton>
          <UButton
            v-if="session?.data"
            icon="i-lucide-log-out"
            color="neutral"
            variant="ghost"
            size="sm"
            class="!text-zinc-500 hover:!text-red-400"
            @click="logout"
          >
            exit
          </UButton>
        </div>
      </div>
    </header>

    <main class="mx-auto max-w-4xl px-5 py-8">
      <UAlert v-if="error" type="error" :title="error" class="mb-6" icon="i-lucide-triangle-alert" />
      <UAlert v-if="message" type="success" :title="message" class="mb-6" icon="i-lucide-check-circle" />

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
            <div class="flex gap-2">
              <UInput v-model="snapshotRepo" class="flex-1" placeholder="owner/repo (e.g. vercel-labs/knowledge-agent-template)" />
              <UButton icon="i-lucide-git-branch" :loading="loading" color="primary" @click="syncSnapshotRepo">sync</UButton>
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
          <div class="p-5">
            <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div>
                <label class="mb-1.5 block font-mono text-[11px] text-zinc-500">label</label>
                <UInput v-model="newSource.label" placeholder="e.g. Nuxt docs" />
              </div>
              <div>
                <label class="mb-1.5 block font-mono text-[11px] text-zinc-500">repository</label>
                <UInput v-model="newSource.repo" placeholder="owner/repo" />
              </div>
              <div>
                <label class="mb-1.5 block font-mono text-[11px] text-zinc-500">branch</label>
                <UInput v-model="newSource.branch" placeholder="main" />
              </div>
              <div>
                <label class="mb-1.5 block font-mono text-[11px] text-zinc-500">content path (optional)</label>
                <UInput v-model="newSource.contentPath" placeholder="docs/" />
              </div>
            </div>
            <UButton class="mt-4" icon="i-lucide-plus" color="primary" :loading="loading" @click="addSource">
              add source
            </UButton>
          </div>
        </div>
      </section>

      <!-- Sources list -->
      <section>
        <h2 class="mb-2 font-mono text-[11px] font-semibold uppercase tracking-wider text-amber-400">❯ sources ({{ sources.length }})</h2>
        <div v-if="sources.length === 0" class="terminal-window">
          <div class="p-8 text-center font-mono text-[12px] text-zinc-600">
            <span class="text-zinc-500">$ ls ~/snapshot</span><br />
            <span class="text-zinc-600">ls: no such directory</span><br /><br />
            add a GitHub repo above, set <code class="rounded bg-zinc-800/80 px-1.5 py-0.5 text-amber-200">SNAPSHOT_REPO</code>,
            or
            <button class="text-amber-300 underline decoration-dotted underline-offset-2 hover:text-amber-200" @click="addDemoSource">
              try the demo
            </button>
            <span class="text-zinc-600">(adds a pre-configured source + syncs it)</span>
          </div>
        </div>
        <div v-else class="space-y-2">
          <div
            v-for="s in sources"
            :key="s.id"
            class="flex items-center justify-between rounded-lg border border-zinc-800/70 bg-[#0d0d10] px-4 py-3"
          >
            <div class="flex items-center gap-3">
              <span class="text-green-400">▸</span>
              <div>
                <p class="text-sm font-medium text-zinc-200">{{ s.label }}</p>
                <p class="font-mono text-[11px] text-zinc-500">{{ s.repo }} · {{ s.branch }}</p>
              </div>
            </div>
            <UButton icon="i-lucide-trash-2" color="neutral" variant="ghost" size="sm" class="!text-zinc-500 hover:!text-red-400" @click="removeSource(s.id)" />
          </div>
        </div>
      </section>
    </main>
  </div>
</template>
