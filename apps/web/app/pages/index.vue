<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'

const message = ref('')
const loading = ref(false)
const messages = ref<Array<{ role: 'user' | 'assistant', content: string, references?: string[] }>>([])
const sources = ref<{ total: number, github: { count: number }, youtube: { count: number }, file: { count: number }, snapshotRepo: string | null } | null>(null)

const chatScroll = ref<HTMLDivElement | null>(null)

onMounted(async () => {
  try {
    const res = await fetch('/api/sources')
    if (res.ok) {
      sources.value = await res.json()
    }
  } catch {
    // sources unavailable — non-fatal
  }
})

async function sendMessage() {
  const text = message.value.trim()
  if (!text || loading.value) return

  messages.value.push({ role: 'user', content: text })
  message.value = ''
  loading.value = true

  try {
    const res = await fetch('/api/chats', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: messages.value }),
    })

    if (!res.ok) {
      const err = await res.json()
      throw new Error(err.message || 'Request failed')
    }

    const data = await res.json()
    messages.value.push({
      role: 'assistant',
      content: data.text,
      references: data.references,
    })
  } catch (error) {
    messages.value.push({
      role: 'assistant',
      content: `⚠️ ${error instanceof Error ? error.message : 'Something went wrong'}`,
    })
  } finally {
    loading.value = false
    nextTick(() => {
      chatScroll.value?.scrollTo({ top: chatScroll.value.scrollHeight, behavior: 'smooth' })
    })
  }
}
</script>

<template>
  <div class="flex h-screen flex-col">
    <header class="flex items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-gray-800">
      <div class="flex items-center gap-3">
        <UButton icon="i-lucide-search" color="primary" variant="soft" square />
        <div>
          <h1 class="text-lg font-semibold">Grep Knowledge Agent</h1>
          <p class="text-xs text-gray-500 dark:text-gray-400">
            grep, not embeddings — no vector DB
          </p>
        </div>
      </div>
      <div class="flex items-center gap-4">
        <span v-if="sources" class="text-xs text-gray-500">
          {{ sources.total }} sources
          <span v-if="sources.snapshotRepo" class="ml-1 font-mono">· {{ sources.snapshotRepo }}</span>
        </span>
        <UButton to="/settings" icon="i-lucide-settings" color="neutral" variant="ghost" size="sm">
          Settings
        </UButton>
      </div>
    </header>

    <main ref="chatScroll" class="flex-1 overflow-y-auto px-6 py-8">
      <div v-if="messages.length === 0" class="mx-auto max-w-2xl py-20 text-center">
        <UButton icon="i-lucide-search" color="primary" variant="soft" size="xl" square />
        <h2 class="mt-6 text-2xl font-bold">Ask your knowledge base</h2>
        <p class="mt-2 text-gray-500 dark:text-gray-400">
          The agent searches your sources with <code class="rounded bg-gray-100 px-1.5 py-0.5 text-sm dark:bg-gray-800">grep</code>,
          <code class="rounded bg-gray-100 px-1.5 py-0.5 text-sm dark:bg-gray-800">find</code>, and
          <code class="rounded bg-gray-100 px-1.5 py-0.5 text-sm dark:bg-gray-800">cat</code> — no embeddings, no chunking, no vector DB.
        </p>
      </div>

      <div v-for="(msg, i) in messages" :key="i" class="mx-auto mb-6 max-w-2xl">
        <div :class="msg.role === 'user' ? 'ml-auto max-w-[80%]' : 'mr-auto max-w-[85%]'">
          <div
            class="rounded-2xl px-4 py-3 text-sm leading-relaxed"
            :class="msg.role === 'user'
              ? 'bg-primary-500 text-white'
              : 'bg-white ring-1 ring-gray-200 dark:bg-gray-900 dark:ring-gray-800'"
          >
            <pre class="whitespace-pre-wrap font-sans">{{ msg.content }}</pre>
          </div>
          <div v-if="msg.references?.length" class="mt-2 flex flex-wrap gap-1.5">
            <span
              v-for="ref in msg.references"
              :key="ref"
              class="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-600 dark:bg-gray-800 dark:text-gray-400"
            >
              {{ ref }}
            </span>
          </div>
        </div>
      </div>

      <div v-if="loading" class="mx-auto flex max-w-2xl items-center gap-2 text-sm text-gray-500">
        <UIcon name="i-lucide-loader-2" class="animate-spin" />
        Searching with grep…
      </div>
    </main>

    <footer class="border-t border-gray-200 px-6 py-4 dark:border-gray-800">
      <div class="mx-auto flex max-w-2xl gap-3">
        <UInput
          v-model="message"
          class="flex-1"
          size="lg"
          placeholder="Ask about your docs, e.g. “How do I configure rate limiting?”"
          @keyup.enter="sendMessage"
        />
        <UButton
          icon="i-lucide-send"
          color="primary"
          size="lg"
          :loading="loading"
          @click="sendMessage"
        />
      </div>
    </footer>
  </div>
</template>
