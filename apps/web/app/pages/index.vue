<script setup lang="ts">
import { ref, onMounted, nextTick } from 'vue'
import { authClient } from '~/lib/auth-client'

interface ChatMsg {
  role: 'user' | 'assistant'
  content: string
  references?: string[]
  trace?: { cmd: string, tool: string }[]
}
interface Usage { inputTokens?: number, outputTokens?: number, totalTokens?: number }

const message = ref('')
const loading = ref(false)
const messages = ref<ChatMsg[]>([])
const sources = ref<{ total: number, snapshotRepo: string | null } | null>(null)
const chatScroll = ref<HTMLDivElement | null>(null)
const showTrace = ref(false)
const lastUsage = ref<Usage | null>(null)
const usageSummary = ref<{ totalTokens: number, totalRequests: number, quota: number | null, remaining: number | null } | null>(null)

const session = authClient.useSession()

async function logout() {
  await authClient.signOut()
  await navigateTo('/login')
}

onMounted(async () => {
  try {
    const res = await fetch('/api/sources')
    if (res.ok) {
      const data = await res.json()
      sources.value = { total: data.total || 0, snapshotRepo: data.snapshotRepo || null }
    }
  } catch {
    // sources unavailable — non-fatal
  }

  try {
    const res = await fetch('/api/usage')
    if (res.ok) {
      usageSummary.value = await res.json()
    }
  } catch {
    // usage unavailable — non-fatal
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
      trace: data.trace,
    })
    lastUsage.value = data.usage || null
  } catch (error) {
    messages.value.push({
      role: 'assistant',
      content: `⚠️ ${error instanceof Error ? error.message : 'Something went wrong'}`,
    })
  } finally {
    loading.value = false
    await nextTick()
    chatScroll.value?.scrollTo({ top: chatScroll.value.scrollHeight, behavior: 'smooth' })
  }
}
</script>

<template>
  <div class="flex h-screen flex-col">
    <!-- Header -->
    <header class="flex items-center justify-between border-b border-zinc-800 bg-[#0a0a0b]/80 px-5 py-3 backdrop-blur">
      <div class="flex items-center gap-3">
        <div class="flex h-8 w-8 items-center justify-center rounded-md border border-amber-400/30 bg-amber-400/10">
          <span class="text-amber-400">❯</span>
        </div>
        <div>
          <h1 class="text-sm font-bold tracking-tight text-zinc-100">grep-agent</h1>
          <p class="font-mono text-[10px] text-zinc-500">filesystem + bash + llm · no vector db</p>
        </div>
      </div>
      <div class="flex items-center gap-3">
        <span v-if="sources" class="hidden items-center gap-1.5 font-mono text-[11px] text-zinc-500 sm:flex">
          <span class="inline-block h-1.5 w-1.5 rounded-full bg-green-400 shadow-[0_0_6px_2px_rgba(74,222,128,0.4)]" />
          {{ sources.total }} sources
          <span v-if="sources.snapshotRepo" class="text-zinc-600">· {{ sources.snapshotRepo }}</span>
        </span>
        <UButton
          to="/settings"
          icon="i-lucide-terminal-square"
          color="neutral"
          variant="ghost"
          size="sm"
          class="!text-zinc-400 hover:!text-zinc-100"
        >
          sources
        </UButton>
        <UButton
          icon="i-lucide-file-search"
          color="neutral"
          variant="ghost"
          size="sm"
          class="!text-zinc-400 hover:!text-zinc-100"
          @click="showTrace = !showTrace"
        >
          trace
        </UButton>
        <UButton
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
    </header>

    <!-- Body -->
    <div class="flex flex-1 overflow-hidden">
      <!-- Chat area -->
      <main ref="chatScroll" class="flex-1 overflow-y-auto px-4 py-6">
        <div class="mx-auto flex max-w-2xl flex-col gap-5">
          <!-- Empty state -->
          <div v-if="messages.length === 0" class="rise mt-16 text-center">
            <div class="mx-auto mb-6 inline-block">
              <div class="terminal-window">
                <div class="terminal-titlebar">
                  <span class="terminal-dot bg-red-400/80" />
                  <span class="terminal-dot bg-amber-400/80" />
                  <span class="terminal-dot bg-green-400/80" />
                  <span class="ml-3 font-mono text-[11px] text-zinc-500">zsh — 80×24</span>
                </div>
                <div class="px-6 py-5 text-left font-mono text-[12.5px] leading-relaxed">
                  <p class="text-zinc-500"><span class="text-green-400">$</span> grep --help</p>
                  <p class="mt-2 text-zinc-300">
                    usage: <span class="text-amber-300">ask</span> the agent anything about your synced docs.
                  </p>
                  <p class="mt-1 text-zinc-500">the agent will <span class="text-cyan-300">grep</span>, <span class="text-cyan-300">find</span> &amp; <span class="text-cyan-300">cat</span> your files to answer.</p>
                  <p class="mt-3 text-zinc-500">try:</p>
                  <p class="mt-1 text-zinc-400">  ❯ "how do I configure rate limiting?"</p>
                  <p class="text-zinc-400">  ❯ "what's in the architecture docs?"</p>
                  <p class="text-zinc-400">  ❯ "explain the auth flow"</p>
                </div>
              </div>
            </div>
          </div>

          <!-- Messages -->
          <ChatMessage
            v-for="(msg, i) in messages"
            :key="i"
            :role="msg.role"
            :content="msg.content"
            :references="msg.references"
          />

          <!-- Loading indicator -->
          <div v-if="loading" class="flex justify-start">
            <div class="rounded-lg border border-zinc-800/70 bg-[#0d0d10] px-4 py-2.5">
              <p class="font-mono text-[12px] text-zinc-500">
                <span class="text-green-400">$</span> grep<span class="text-amber-400">.</span>running
                <span class="cursor-blink inline-block h-3 w-2 align-middle text-amber-400">▊</span>
              </p>
            </div>
          </div>
        </div>
      </main>

      <!-- Command trace sidebar -->
      <aside
        v-if="showTrace"
        class="w-80 shrink-0 overflow-y-auto border-l border-zinc-800 bg-[#0a0a0b]/60 backdrop-blur"
      >
        <div class="border-b border-zinc-800 px-4 py-3">
          <p class="font-mono text-[11px] font-semibold text-zinc-300">
            <span class="text-amber-400">❯</span> command trace
          </p>
          <p class="mt-0.5 font-mono text-[10px] text-zinc-600">every shell command the agent ran</p>
        </div>
        <div class="space-y-3 p-4">
          <template v-if="messages.some(m => m.trace?.length)">
            <div
              v-for="(msg, mi) in messages.filter(m => m.trace?.length)"
              :key="mi"
              class="space-y-1.5"
            >
              <p class="font-mono text-[10px] text-zinc-600"># step {{ mi + 1 }}</p>
              <div
                v-for="(t, ti) in msg.trace"
                :key="ti"
                class="trace-command rounded-md border border-zinc-800/70 bg-[#0d0d10] px-3 py-2"
              >
                <span class="text-green-400">$</span>
                <span class="ml-1.5 text-cyan-300">{{ t.cmd }}</span>
              </div>
            </div>
          </template>
          <div v-else class="rounded-md border border-dashed border-zinc-800 p-4 text-center font-mono text-[11px] text-zinc-600">
            no commands yet<br /><span class="text-[10px]">ask something to see the trace</span>
          </div>

          <!-- Usage footer -->
          <div v-if="lastUsage" class="mt-4 border-t border-zinc-800 pt-3">
            <p class="font-mono text-[10px] text-zinc-600">tokens used</p>
            <p class="mt-1 font-mono text-[11px] text-zinc-400">
              {{ lastUsage.totalTokens?.toLocaleString() || '—' }} total
            </p>
          </div>

          <!-- Credit / quota meter -->
          <div v-if="usageSummary" class="mt-4 border-t border-zinc-800 pt-3">
            <p class="font-mono text-[10px] text-zinc-600">
              credits
              <span v-if="usageSummary.quota">· {{ usageSummary.remaining?.toLocaleString() }} of {{ usageSummary.quota.toLocaleString() }} left</span>
            </p>
            <p class="mt-1 font-mono text-[11px] text-zinc-400">
              {{ usageSummary.totalTokens.toLocaleString() }} tokens · {{ usageSummary.totalRequests }} requests
            </p>
          </div>
        </div>
      </aside>
    </div>

    <!-- Footer input -->
    <footer class="border-t border-zinc-800 bg-[#0a0a0b]/80 px-4 py-3 backdrop-blur">
      <div class="mx-auto flex max-w-2xl items-center gap-2">
        <span class="font-mono text-amber-400">❯</span>
        <UInput
          v-model="message"
          class="flex-1"
          size="lg"
          variant="none"
          placeholder="ask about your docs…"
          @keyup.enter="sendMessage"
        />
        <UButton
          icon="i-lucide-arrow-right"
          color="primary"
          size="lg"
          square
          :loading="loading"
          @click="sendMessage"
        />
      </div>
    </footer>
  </div>
</template>
