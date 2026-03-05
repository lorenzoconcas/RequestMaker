<script setup lang="ts">
import { AlertCircle, CheckCircle2, Info, MessageSquareText, X } from 'lucide-vue-next'

import { useToast, type ToastVariant } from '@/composables/useToast'

const { toasts, dismissToast } = useToast()

function toastContainerClass(variant: ToastVariant) {
  if (variant === 'error') {
    return 'border-red-300/80 bg-red-50 text-red-900 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-100'
  }

  if (variant === 'success') {
    return 'border-emerald-300/80 bg-emerald-50 text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-100'
  }

  if (variant === 'info') {
    return 'border-blue-300/80 bg-blue-50 text-blue-900 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-100'
  }

  return 'border-border bg-popover text-popover-foreground'
}
</script>

<template>
  <div class="pointer-events-none fixed right-4 top-4 z-[120] w-[min(92vw,420px)]">
    <TransitionGroup name="toast-stack" tag="div" class="space-y-2">
      <div
        v-for="toastItem in toasts"
        :key="toastItem.id"
        class="pointer-events-auto rounded-md border px-3 py-2 shadow-lg backdrop-blur-sm"
        :class="toastContainerClass(toastItem.variant)"
      >
        <div class="flex items-start gap-2">
          <AlertCircle v-if="toastItem.variant === 'error'" class="mt-0.5 h-4 w-4 shrink-0" />
          <CheckCircle2 v-else-if="toastItem.variant === 'success'" class="mt-0.5 h-4 w-4 shrink-0" />
          <Info v-else-if="toastItem.variant === 'info'" class="mt-0.5 h-4 w-4 shrink-0" />
          <MessageSquareText v-else class="mt-0.5 h-4 w-4 shrink-0" />

          <div class="min-w-0 flex-1">
            <p class="text-sm font-medium leading-5">{{ toastItem.title }}</p>
            <p class="mt-0.5 text-xs leading-5 opacity-90">{{ toastItem.description }}</p>
          </div>

          <button
            type="button"
            class="rounded p-1 opacity-70 transition-opacity hover:opacity-100"
            @click="dismissToast(toastItem.id)"
          >
            <X class="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </TransitionGroup>
  </div>
</template>

<style scoped>
.toast-stack-enter-active,
.toast-stack-leave-active {
  transition: all 0.2s ease;
}

.toast-stack-enter-from,
.toast-stack-leave-to {
  opacity: 0;
  transform: translateY(-8px) scale(0.98);
}
</style>
