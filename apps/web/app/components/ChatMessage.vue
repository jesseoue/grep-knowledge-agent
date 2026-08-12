<script setup lang="ts">
// Reusable chat bubble that renders assistant answers as markdown (MDC)
// and surfaces file references as terminal-style chips.
defineProps<{
  role: 'user' | 'assistant'
  content: string
  references?: string[]
}>()
</script>

<template>
  <div class="flex w-full" :class="role === 'user' ? 'justify-end' : 'justify-start'">
    <div class="max-w-[85%]" :class="role === 'user' ? 'ml-auto' : 'mr-auto'">
      <!-- User: prompt line -->
      <div v-if="role === 'user'" class="flex justify-end">
        <div class="prompt-line rounded-lg border border-amber-400/20 bg-amber-400/[0.06] px-4 py-2.5 font-mono text-[13px] leading-relaxed text-zinc-200">
          {{ content }}
        </div>
      </div>

      <!-- Assistant: markdown-rendered answer -->
      <div v-else class="min-w-0">
        <div class="mdc-prose rounded-lg border border-zinc-800/70 bg-[#0d0d10] px-5 py-4 text-[13px] leading-relaxed text-zinc-300">
          <MDC
            v-if="content"
            :value="content"
            :data="{ theme: 'terminal' }"
            tag="div"
          />
          <span v-else class="flex items-center gap-1 text-zinc-500">
            <span class="cursor-blink inline-block h-3.5 w-2 bg-amber-400/80" />
          </span>
        </div>

        <!-- References -->
        <div v-if="references?.length" class="mt-2 flex flex-wrap gap-1.5">
          <span
            v-for="ref in references"
            :key="ref"
            class="rounded border border-cyan-400/20 bg-cyan-400/[0.06] px-2 py-0.5 font-mono text-[11px] text-cyan-300"
          >
            <span class="text-cyan-500">#</span> {{ ref }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>
