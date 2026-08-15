<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from 'vue'
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
const quotaExceeded = ref(false)
const rateLimited = ref(false)
const copiedIdx = ref<number | null>(null)
const awaitingFirstToken = computed(() => {
  const last = messages.value.at(-1)
  return loading.value && last?.role === 'assistant' && !last.content
})

// Clickable example prompts shown on the empty state
const examplePrompts = [
  'How do I configure rate limiting?',
  "What's in the architecture docs?",
  'Explain the auth flow',
]

async function logout() {
  await authClient.signOut()
  await navigateTo('/login')
}

function clearChat() {
  messages.value = []
  lastUsage.value = null
}

function sendExample(prompt: string) {
  message.value = prompt
  sendMessage()
}

async function copyAnswer(idx: number) {
  const msg = messages.value[idx]
  if (!msg?.content) return
  try {
    await navigator.clipboard.writeText(msg.content)
    copiedIdx.value = idx
    setTimeout(() => { copiedIdx.value = null }, 2000)
  } catch {}
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter') {
    e.preventDefault()
    sendMessage()
  }
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

  // Push an empty assistant message that we'll fill as tokens stream in.
  const assistantMsg = ref<ChatMsg>({ role: 'assistant', content: '' })
  messages.value.push(assistantMsg.value)

  try {
    const res = await fetch('/api/chats', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: messages.value.filter(m => m !== assistantMsg.value) }),
    })

    if (!res.ok) {
      let why = 'Request failed'
      let statusCode = res.status
      try {
        const err = await res.json()
        why = err.data?.why || err.statusMessage || err.message || why
      } catch {}
      // Detect quota exhaustion (402) — show persistent banner
      if (statusCode === 402) {
        quotaExceeded.value = true
      }
      // Detect rate limiting (429) — show transient notice
      if (statusCode === 429) {
        rateLimited.value = true
        setTimeout(() => { rateLimited.value = false }, 5000)
      }
      throw new Error(why)
    }

    // Read the SSE stream manually — each `data:` line is a JSON event.
    const reader = res.body!.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })

      // SSE events are separated by \n\n
      let idx
      while ((idx = buffer.indexOf('\n\n')) !== -1) {
        const raw = buffer.slice(0, idx).trim()
        buffer = buffer.slice(idx + 2)
        if (!raw.startsWith('data: ')) continue
        const data = JSON.parse(raw.slice(6))

        if (data.type === 'text') {
          assistantMsg.value.content += data.delta
          await nextTick()
          chatScroll.value?.scrollTo({ top: chatScroll.value.scrollHeight, behavior: 'smooth' })
        } else if (data.type === 'done') {
          // Only update metadata; the text was already streamed token-by-token.
          // If content is empty (e.g. tool-only response), use the final text.
          if (!assistantMsg.value.content && data.text) {
            assistantMsg.value.content = data.text
          }
          assistantMsg.value.references = data.references
          assistantMsg.value.trace = data.trace
          lastUsage.value = data.usage || null
        } else if (data.type === 'error') {
          throw new Error(data.message || 'Agent stream failed')
        }
      }
    }
  } catch (error) {
    // If we streamed partial text, append the error; otherwise replace the empty msg
    if (assistantMsg.value.content) {
      assistantMsg.value.content += `\n\n⚠️ ${error instanceof Error ? error.message : 'Something went wrong'}`
    } else {
      assistantMsg.value.content = `⚠️ ${error instanceof Error ? error.message : 'Something went wrong'}`
    }
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
    <header class="relative z-20 flex items-center justify-between border-b border-zinc-800/80 bg-[#0a0a0b]/90 px-3 py-3 backdrop-blur-xl sm:px-5">
      <div class="flex items-center gap-3">
        <div class="flex h-9 w-9 items-center justify-center rounded-lg border border-amber-400/30 bg-amber-400/10 shadow-[inset_0_0_18px_rgba(251,191,36,0.08)]">
          <span class="text-lg font-bold text-amber-400">⌕</span>
        </div>
        <div class="min-w-0">
          <h1 class="truncate text-sm font-bold tracking-tight text-zinc-100">Grep Agent</h1>
          <p class="hidden font-mono text-[10px] text-zinc-500 sm:block">search your code · see the proof</p>
        </div>
      </div>
      <div class="flex items-center gap-0.5 sm:gap-2">
        <!-- Session-dependent buttons wrapped in ClientOnly to prevent hydration mismatch -->
        <ClientOnly>
          <span v-if="sources" class="hidden items-center gap-1.5 font-mono text-[11px] text-zinc-500 sm:flex">
            <span class="inline-block h-1.5 w-1.5 rounded-full bg-green-400 shadow-[0_0_6px_2px_rgba(74,222,128,0.4)]" />
            {{ sources.total }} sources
            <span v-if="sources.snapshotRepo" class="text-zinc-600">· {{ sources.snapshotRepo }}</span>
          </span>
          <UButton
            v-if="messages.length > 0"
            icon="i-lucide-eraser"
            color="neutral"
            variant="ghost"
            size="sm"
            class="!text-zinc-400 hover:!text-zinc-100"
            :disabled="loading"
            @click="clearChat"
          >
            <span class="hidden sm:inline">clear</span>
          </UButton>
        </ClientOnly>
        <UButton
          to="/settings"
          icon="i-lucide-terminal-square"
          color="neutral"
          variant="ghost"
          size="sm"
          class="!text-zinc-400 hover:!text-zinc-100"
        >
          <span class="hidden sm:inline">sources</span>
        </UButton>
        <UButton
          icon="i-lucide-file-search"
          color="neutral"
          variant="ghost"
          size="sm"
          class="!text-zinc-400 hover:!text-zinc-100"
          @click="showTrace = !showTrace"
        >
          <span class="hidden sm:inline">trace</span>
        </UButton>
        <UButton
          icon="i-lucide-log-out"
          color="neutral"
          variant="ghost"
          size="sm"
          class="!text-zinc-500 hover:!text-red-400"
          @click="logout"
        >
          <span class="hidden sm:inline">exit</span>
        </UButton>
      </div>
    </header>

    <!-- Quota exceeded banner -->
    <ClientOnly>
      <div v-if="quotaExceeded" class="flex items-center justify-between border-b border-amber-400/30 bg-amber-400/10 px-5 py-2">
        <p class="font-mono text-[11px] text-amber-300">
          ⚠️ Credit quota exceeded — contact an admin to increase your limit.
        </p>
        <button class="font-mono text-[11px] text-amber-400 hover:text-amber-200" @click="quotaExceeded = false">dismiss</button>
      </div>

      <!-- Rate limit notice -->
      <div v-if="rateLimited" class="flex items-center justify-between border-b border-cyan-400/30 bg-cyan-400/10 px-5 py-2">
        <p class="font-mono text-[11px] text-cyan-300">
          ⏱ Slow down — too many requests. Wait a moment and try again.
        </p>
        <button class="font-mono text-[11px] text-cyan-400 hover:text-cyan-200" @click="rateLimited = false">dismiss</button>
      </div>
    </ClientOnly>

    <!-- Body -->
    <div class="flex flex-1 overflow-hidden">
      <!-- Chat area -->
      <main ref="chatScroll" class="flex-1 overflow-y-auto px-3 py-5 sm:px-5 sm:py-8">
        <div class="mx-auto flex max-w-3xl flex-col gap-5">
          <!-- Empty state -->
          <div v-if="messages.length === 0" class="rise mx-auto mt-3 w-full max-w-2xl sm:mt-10">
            <div class="mb-7 text-center">
              <div class="mb-3 inline-flex items-center gap-2 rounded-full border border-amber-400/20 bg-amber-400/[0.06] px-3 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-amber-300">
                <span class="h-1.5 w-1.5 rounded-full bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.8)]" />
                grounded answers
              </div>
              <h2 class="text-2xl font-bold tracking-[-0.04em] text-zinc-100 sm:text-4xl">Ask your codebase.<br><span class="text-amber-300">Get receipts.</span></h2>
              <p class="mx-auto mt-3 max-w-lg text-[12px] leading-relaxed text-zinc-500 sm:text-[13px]">The agent searches the real files, reads the relevant source, and shows every command behind its answer.</p>
            </div>
            <div class="mx-auto mb-6">
              <div class="terminal-window border-zinc-700/70 shadow-[0_30px_90px_rgba(0,0,0,0.48)]">
                <div class="terminal-titlebar">
                  <span class="terminal-dot bg-red-400/80" />
                  <span class="terminal-dot bg-amber-400/80" />
                  <span class="terminal-dot bg-green-400/80" />
                  <span class="ml-3 font-mono text-[11px] text-zinc-500">knowledge/snapshot</span>
                </div>
                <div class="px-4 py-5 text-left font-mono text-[12px] leading-relaxed sm:px-6 sm:text-[12.5px]">
                  <p class="text-zinc-500"><span class="text-green-400">$</span> grep-agent --ask</p>
                  <p class="mt-2 text-zinc-300">
                    usage: <span class="text-amber-300">ask</span> anything about your synced repositories.
                  </p>
                  <p class="mt-1 text-zinc-500">retrieval: <span class="text-cyan-300">grep</span> + <span class="text-cyan-300">find</span> + <span class="text-cyan-300">cat</span> · vectors: <span class="text-zinc-400">none</span></p>
                  <p class="mt-4 text-[10px] uppercase tracking-[0.16em] text-zinc-600">try a real question</p>
                  <button
                    v-for="p in examplePrompts"
                    :key="p"
                    class="mt-1.5 flex w-full items-start gap-2 rounded-md border border-transparent px-2 py-1.5 text-left font-mono text-[11px] text-zinc-400 transition hover:border-zinc-800 hover:bg-zinc-900/60 hover:text-amber-300 sm:text-[12px]"
                    @click="sendExample(p)"
                  >
                    <span class="text-zinc-600">❯</span> {{ p }}
                  </button>
                  <ClientOnly>
                    <button
                      v-if="sources && sources.total === 0"
                      class="mt-5 inline-flex items-center gap-1.5 rounded-md border border-amber-400/30 bg-amber-400/10 px-3 py-2 font-mono text-[11px] font-semibold text-amber-300 transition hover:bg-amber-400/20"
                      @click="navigateTo('/settings')"
                    >
                      connect your first source →
                    </button>
                  </ClientOnly>
                </div>
              </div>
            </div>
          </div>

          <!-- Messages -->
          <div v-for="(msg, i) in messages" :key="i" class="group">
            <ChatMessage
              :role="msg.role"
              :content="msg.content"
              :references="msg.references"
            />
            <!-- Copy button on assistant messages (appears on hover) -->
            <div v-if="msg.role === 'assistant' && msg.content && !loading" class="mt-1 flex justify-start opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
              <button
                class="flex items-center gap-1 font-mono text-[10px] text-zinc-600 hover:text-zinc-300"
                @click="copyAnswer(i)"
              >
                <span v-if="copiedIdx === i" class="text-green-400">✓ copied</span>
                <span v-else>⧉ copy</span>
              </button>
            </div>
          </div>

          <!-- Loading indicator (only shows before the first token arrives) -->
          <div v-if="awaitingFirstToken" class="flex justify-start">
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
        class="fixed inset-y-0 right-0 z-50 w-[min(22rem,92vw)] shrink-0 overflow-y-auto border-l border-zinc-800 bg-[#0a0a0b]/95 shadow-2xl shadow-black backdrop-blur-xl md:static md:z-auto md:w-80 md:bg-[#0a0a0b]/60 md:shadow-none"
      >
        <div class="flex items-start justify-between border-b border-zinc-800 px-4 py-3">
          <div><p class="font-mono text-[11px] font-semibold text-zinc-300"><span class="text-amber-400">❯</span> command trace</p>
          <p class="mt-0.5 font-mono text-[10px] text-zinc-600">every shell command the agent ran</p>
          <!-- Source indicator (client-only — sources load via fetch) -->
          <ClientOnly>
            <div v-if="sources && sources.total > 0" class="mt-2 flex flex-wrap gap-1">
              <span class="rounded border border-zinc-700/50 bg-zinc-800/50 px-1.5 py-0.5 font-mono text-[9px] text-zinc-400">
                {{ sources.total }} source{{ sources.total > 1 ? 's' : '' }}
              </span>
              <span v-if="sources.snapshotRepo" class="rounded border border-amber-400/20 bg-amber-400/5 px-1.5 py-0.5 font-mono text-[9px] text-amber-300/80">
                {{ sources.snapshotRepo }}
              </span>
            </div>
          </ClientOnly></div>
          <button class="rounded p-1 text-zinc-500 hover:bg-zinc-900 hover:text-zinc-200 md:hidden" aria-label="Close command trace" @click="showTrace = false">✕</button>
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
          <ClientOnly>
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
          </ClientOnly>
        </div>
      </aside>
    </div>

    <!-- Footer input -->
    <footer class="border-t border-zinc-800 bg-[#0a0a0b]/90 px-3 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-xl sm:px-4">
      <div class="mx-auto flex max-w-3xl items-center gap-2 rounded-xl border border-zinc-800/80 bg-zinc-950/80 px-3 shadow-[0_10px_40px_rgba(0,0,0,0.25)] focus-within:border-amber-400/30">
        <span class="font-mono text-amber-400">❯</span>
        <UInput
          v-model="message"
          class="flex-1"
          size="lg"
          variant="none"
          placeholder="Ask about your codebase…"
          @keydown="onKeydown"
        />
        <UButton
          icon="i-lucide-arrow-right"
          color="primary"
          size="lg"
          square
          aria-label="Send message"
          :disabled="!message.trim() || loading"
          :loading="loading"
          @click="sendMessage"
        />
      </div>
    </footer>
  </div>
</template>
