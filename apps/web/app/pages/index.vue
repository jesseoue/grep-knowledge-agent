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
const quotaExceeded = ref(false)
const copiedIdx = ref<number | null>(null)

const session = authClient.useSession()

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
  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
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
          // Replace with the final assembled text + metadata
          assistantMsg.value.content = data.text || assistantMsg.value.content
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
          v-if="messages.length > 0"
          icon="i-lucide-eraser"
          color="neutral"
          variant="ghost"
          size="sm"
          class="!text-zinc-400 hover:!text-zinc-100"
          @click="clearChat"
        >
          clear
        </UButton>
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

    <!-- Quota exceeded banner -->
    <div v-if="quotaExceeded" class="flex items-center justify-between border-b border-amber-400/30 bg-amber-400/10 px-5 py-2">
      <p class="font-mono text-[11px] text-amber-300">
        ⚠️ Credit quota exceeded — contact an admin to increase your limit.
      </p>
      <button class="font-mono text-[11px] text-amber-400 hover:text-amber-200" @click="quotaExceeded = false">dismiss</button>
    </div>

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
                  <button
                    v-for="p in examplePrompts"
                    :key="p"
                    class="mt-1 block text-left font-mono text-[12px] text-zinc-400 transition hover:text-amber-300"
                    @click="sendExample(p)"
                  >
                    <span class="text-zinc-600">  ❯</span> "{{ p }}"
                  </button>
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
            <div v-if="msg.role === 'assistant' && msg.content && !loading" class="mt-1 flex justify-start opacity-0 transition group-hover:opacity-100">
              <button
                class="flex items-center gap-1 font-mono text-[10px] text-zinc-600 hover:text-zinc-300"
                @click="copyAnswer(i)"
              >
                <span v-if="copiedIdx === i" class="text-green-400">✓ copied</span>
                <span v-else>⧉ copy</span>
              </button>
            </div>
          </div>

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
          <!-- Source indicator -->
          <div v-if="sources && sources.total > 0" class="mt-2 flex flex-wrap gap-1">
            <span class="rounded border border-zinc-700/50 bg-zinc-800/50 px-1.5 py-0.5 font-mono text-[9px] text-zinc-400">
              {{ sources.total }} source{{ sources.total > 1 ? 's' : '' }}
            </span>
            <span v-if="sources.snapshotRepo" class="rounded border border-amber-400/20 bg-amber-400/5 px-1.5 py-0.5 font-mono text-[9px] text-amber-300/80">
              {{ sources.snapshotRepo }}
            </span>
          </div>
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
          placeholder="ask about your docs…  (⌘+Enter to send)"
          @keydown="onKeydown"
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
