<script setup lang="ts">
import { ref, onMounted } from 'vue'

const sources = ref<Array<{ id: string, type: string, label: string, repo?: string, branch?: string }>>([])
const snapshotRepo = ref('')
const snapshotBranch = ref('main')
const loading = ref(false)
const message = ref('')
const error = ref('')

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
</script>

<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-950">
    <header class="border-b border-gray-200 bg-white px-6 py-4 dark:border-gray-800 dark:bg-gray-900">
      <div class="mx-auto flex max-w-4xl items-center justify-between">
        <div class="flex items-center gap-3">
          <UButton to="/" icon="i-lucide-arrow-left" color="gray" variant="ghost" square />
          <h1 class="text-lg font-semibold">Settings</h1>
        </div>
        <UButton :loading="loading" icon="i-lucide-refresh-cw" color="primary" size="sm" @click="runSync">
          Sync sources
        </UButton>
      </div>
    </header>

    <main class="mx-auto max-w-4xl px-6 py-8">
      <UAlert v-if="error" type="error" :title="error" class="mb-6" />
      <UAlert v-if="message" type="success" :title="message" class="mb-6" />

      <section class="mb-10">
        <h2 class="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">Snapshot repository</h2>
        <div class="rounded-2xl bg-white p-6 ring-1 ring-gray-200 dark:bg-gray-900 dark:ring-gray-800">
          <p class="mb-4 text-sm text-gray-600 dark:text-gray-400">
            The snapshot repo is what the agent searches with <code>grep</code>. You can set it here or via the
            <code class="rounded bg-gray-100 px-1.5 py-0.5 dark:bg-gray-800">SNAPSHOT_REPO</code> env var.
          </p>
          <div class="flex gap-3">
            <UInput v-model="snapshotRepo" class="flex-1" placeholder="owner/repo (e.g. vercel-labs/knowledge-agent-template)" />
            <UButton icon="i-lucide-git-branch" :loading="loading" @click="runSync">Sync</UButton>
          </div>
        </div>
      </section>

      <section class="mb-10">
        <h2 class="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">Add GitHub source</h2>
        <div class="rounded-2xl bg-white p-6 ring-1 ring-gray-200 dark:bg-gray-900 dark:ring-gray-800">
          <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
            <UFormField label="Label">
              <UInput v-model="newSource.label" placeholder="e.g. Nuxt docs" />
            </UFormField>
            <UFormField label="Repository">
              <UInput v-model="newSource.repo" placeholder="owner/repo" />
            </UFormField>
            <UFormField label="Branch">
              <UInput v-model="newSource.branch" placeholder="main" />
            </UFormField>
            <UFormField label="Content path (optional)">
              <UInput v-model="newSource.contentPath" placeholder="docs/" />
            </UFormField>
          </div>
          <UButton class="mt-4" icon="i-lucide-plus" color="primary" :loading="loading" @click="addSource">
            Add source
          </UButton>
        </div>
      </section>

      <section>
        <h2 class="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">Sources ({{ sources.length }})</h2>
        <div v-if="sources.length === 0" class="rounded-2xl border-2 border-dashed border-gray-200 p-8 text-center text-sm text-gray-500 dark:border-gray-800">
          No sources yet — add a GitHub repo above or set <code>SNAPSHOT_REPO</code>.
        </div>
        <div v-else class="space-y-2">
          <div
            v-for="s in sources"
            :key="s.id"
            class="flex items-center justify-between rounded-2xl bg-white px-4 py-3 ring-1 ring-gray-200 dark:bg-gray-900 dark:ring-gray-800"
          >
            <div>
              <p class="text-sm font-medium">{{ s.label }}</p>
              <p class="text-xs text-gray-500">{{ s.repo }} · {{ s.branch }}</p>
            </div>
            <UButton icon="i-lucide-trash-2" color="gray" variant="ghost" size="sm" @click="removeSource(s.id)" />
          </div>
        </div>
      </section>
    </main>
  </div>
</template>
