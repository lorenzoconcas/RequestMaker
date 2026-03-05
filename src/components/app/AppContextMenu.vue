<script setup lang="ts">
import type { AppController } from '@/composables/useAppController'

const { controller } = defineProps<{ controller: AppController }>()

const {
  treeContextMenu,
  closeContextMenu,
  handleContextCreateRequest,
  handleContextRenameCollection,
  handleContextDeleteCollection,
  handleContextSendRequest,
  handleContextRenameRequest,
  handleContextDuplicateRequest,
  handleContextDeleteRequest,
} = controller
</script>

<template>
  <div
    v-if="treeContextMenu.visible"
    class="fixed inset-0 z-50"
    @click="closeContextMenu"
    @contextmenu.prevent="closeContextMenu"
  >
    <div
      class="absolute w-[220px] rounded-lg border border-border bg-popover p-1 shadow-lg"
      :style="{ left: `${treeContextMenu.x}px`, top: `${treeContextMenu.y}px` }"
      @click.stop
      @contextmenu.prevent
    >
      <template v-if="treeContextMenu.type === 'collection'">
        <button
          type="button"
          class="w-full rounded-md px-3 py-2 text-left text-sm hover:bg-accent"
          @click="handleContextCreateRequest"
        >
          Nuova request
        </button>
        <button
          type="button"
          class="w-full rounded-md px-3 py-2 text-left text-sm hover:bg-accent"
          @click="handleContextRenameCollection"
        >
          Rinomina collection
        </button>
        <button
          type="button"
          class="w-full rounded-md px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-950/20"
          @click="handleContextDeleteCollection"
        >
          Elimina collection
        </button>
      </template>

      <template v-else>
        <button
          type="button"
          class="w-full rounded-md px-3 py-2 text-left text-sm hover:bg-accent"
          @click="handleContextSendRequest"
        >
          Invia request
        </button>
        <button
          type="button"
          class="w-full rounded-md px-3 py-2 text-left text-sm hover:bg-accent"
          @click="handleContextRenameRequest"
        >
          Rinomina request
        </button>
        <button
          type="button"
          class="w-full rounded-md px-3 py-2 text-left text-sm hover:bg-accent"
          @click="handleContextDuplicateRequest"
        >
          Duplica request
        </button>
        <button
          type="button"
          class="w-full rounded-md px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-950/20"
          @click="handleContextDeleteRequest"
        >
          Elimina request
        </button>
      </template>
    </div>
  </div>
</template>
