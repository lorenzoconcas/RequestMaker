<script setup lang="ts">
import { Plus } from 'lucide-vue-next'

import type { AppController } from '@/composables/useAppController'

const { controller } = defineProps<{ controller: AppController }>()

const {
  openRequestTabs,
  treeSelection,
  store,
  methodTagClass,
  openRequestTab,
  closeRequestTab,
  handleCreateRequest,
} = controller
</script>

<template>
  <div class="mb-3">
    <div class="flex items-end gap-1 overflow-x-auto border-b border-border/70">
      <button
        v-for="requestItem in openRequestTabs"
        :key="`request-tab-${requestItem.id}`"
        type="button"
        class="group inline-flex max-w-[260px] shrink-0 items-center gap-2 border-b-2 px-3 py-2 text-xs font-medium transition-colors"
        :class="
          treeSelection.type === 'request' && store.activeRequestId === requestItem.id
            ? 'border-primary text-foreground'
            : 'border-transparent text-muted-foreground hover:text-foreground'
        "
        @click="openRequestTab(requestItem.id)"
      >
        <span class="rounded px-1.5 py-0.5 text-[10px] font-semibold" :class="methodTagClass(requestItem.method)">
          {{ requestItem.method }}
        </span>
        <span class="truncate">{{ requestItem.name || 'New Request' }}</span>
        <span
          class="rounded px-1 text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground"
          @click="closeRequestTab(requestItem.id, $event)"
        >
          ×
        </span>
      </button>

      <button
        type="button"
        class="inline-flex h-9 shrink-0 items-center justify-center border-b-2 border-transparent px-3 text-muted-foreground transition-colors hover:text-foreground"
        title="Nuova request"
        @click="handleCreateRequest()"
      >
        <Plus class="h-4 w-4" />
      </button>
    </div>
  </div>
</template>
