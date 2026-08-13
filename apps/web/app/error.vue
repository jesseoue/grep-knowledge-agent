<script setup lang="ts">
import type { NuxtError } from '#app'

const props = defineProps<{ error: NuxtError }>()

const is404 = computed(() => props.error?.statusCode === 404)
</script>

<template>
  <div class="flex min-h-screen items-center justify-center bg-[#0a0a0b] px-4">
    <!-- Ambient glow -->
    <div class="pointer-events-none absolute inset-0">
      <div class="absolute left-1/2 top-1/3 h-[300px] w-[500px] -translate-x-1/2 rounded-full bg-red-500/10 blur-[120px]" />
    </div>

    <div class="relative text-center">
      <div class="terminal-window mx-auto max-w-md">
        <div class="terminal-titlebar">
          <span class="terminal-dot bg-red-400/80" />
          <span class="terminal-dot bg-amber-400/80" />
          <span class="terminal-dot bg-green-400/80" />
          <span class="ml-3 font-mono text-[11px] text-zinc-500">error — {{ error?.statusCode || 500 }}</span>
        </div>
        <div class="p-8 font-mono text-[13px] leading-relaxed">
          <p class="text-red-400"><span class="text-green-400">$</span> {{ is404 ? 'cat /not-found' : 'grep --diagnose' }}</p>
          <p class="mt-3 text-zinc-400">
            {{ is404 ? '404 — page not found' : 'Something went wrong.' }}
          </p>
          <p v-if="error?.message" class="mt-2 text-[12px] text-zinc-600">
            {{ error.message }}
          </p>
          <div class="mt-6">
            <UButton
              to="/"
              icon="i-lucide-arrow-left"
              color="primary"
              size="sm"
            >
              back to safety
            </UButton>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
