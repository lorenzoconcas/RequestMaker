<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'

import type { AppController } from '@/composables/useAppController'
import type { MenuActionId } from '@/types/electron'

interface WebMenuItem {
  actionId?: MenuActionId
  danger?: boolean
  divider?: boolean
  label?: string
  onClick?: () => void
  shortcut?: string
}

interface WebMenuSection {
  id: string
  items: WebMenuItem[]
  label: string
}

const { controller } = defineProps<{ controller: AppController }>()

const { store, handleElectronMenuAction, openCorsBypassDialog } = controller

const rootRef = ref<HTMLElement | null>(null)
const openMenuId = ref<string | null>(null)

const isMac = computed(() => {
  if (typeof navigator === 'undefined') {
    return false
  }

  return /Mac|iPhone|iPad|iPod/.test(navigator.platform)
})

const mod = computed(() => (isMac.value ? 'Cmd' : 'Ctrl'))

function runDocumentCommand(command: string) {
  if (typeof document === 'undefined') {
    return
  }

  const documentWithExec = document as Document & { execCommand?: (commandId: string) => boolean }
  documentWithExec.execCommand?.(command)
}

const menuSections = computed<WebMenuSection[]>(() => [
  {
    id: 'file',
    label: 'File',
    items: [
      { label: 'Nuova richiesta', actionId: 'new-request', shortcut: `${mod.value}+N` },
      { label: 'Nuova richiesta rapida', actionId: 'new-quick-request', shortcut: `Shift+${mod.value}+N` },
      {
        label: 'Nuova request nella collection selezionata',
        actionId: 'new-request-in-selected-collection',
        shortcut: `Shift+${mod.value}+R`,
      },
      { label: 'Nuova collection', actionId: 'new-collection', shortcut: `Shift+${mod.value}+C` },
      { label: 'Nuovo workspace', actionId: 'new-workspace', shortcut: `Shift+${mod.value}+W` },
      { divider: true },
      { label: 'Importa OpenAPI JSON...', actionId: 'import-openapi', shortcut: `${mod.value}+O` },
      { divider: true },
      { label: 'Salva richiesta', actionId: 'save-request', shortcut: `${mod.value}+S` },
      { label: 'Invia richiesta', actionId: 'send-request', shortcut: `${mod.value}+Enter` },
      { label: 'Duplica richiesta', actionId: 'duplicate-request', shortcut: `${mod.value}+D` },
      { label: 'Elimina richiesta', actionId: 'delete-request', shortcut: 'Shift+Del', danger: true },
    ],
  },
  {
    id: 'edit',
    label: 'Modifica',
    items: [
      { label: 'Annulla', onClick: () => runDocumentCommand('undo'), shortcut: `${mod.value}+Z` },
      { label: 'Ripeti', onClick: () => runDocumentCommand('redo'), shortcut: `Shift+${mod.value}+Z` },
      { divider: true },
      { label: 'Taglia', onClick: () => runDocumentCommand('cut'), shortcut: `${mod.value}+X` },
      { label: 'Copia', onClick: () => runDocumentCommand('copy'), shortcut: `${mod.value}+C` },
      { label: 'Incolla', onClick: () => runDocumentCommand('paste'), shortcut: `${mod.value}+V` },
      { label: 'Seleziona tutto', onClick: () => runDocumentCommand('selectAll'), shortcut: `${mod.value}+A` },
    ],
  },
  {
    id: 'collection',
    label: 'Collection',
    items: [
      { label: 'Rinomina collection selezionata', actionId: 'rename-selected-collection' },
      { label: 'Elimina collection selezionata', actionId: 'delete-selected-collection', danger: true },
    ],
  },
  {
    id: 'go',
    label: 'Vai',
    items: [
      { label: 'Workspace', actionId: 'open-workspace-page' },
      { label: 'Utente', actionId: 'open-user-page' },
      { label: 'Impostazioni', actionId: 'open-settings-page', shortcut: isMac.value ? 'Cmd+,' : 'Ctrl+,' },
    ],
  },
  {
    id: 'view',
    label: 'Vista',
    items: [
      { label: 'Mostra/Nascondi sidebar', actionId: 'toggle-sidebar', shortcut: `${mod.value}+B` },
      { divider: true },
      { label: 'Tema Sistema', actionId: 'set-theme-system' },
      { label: 'Tema Chiaro', actionId: 'set-theme-light' },
      { label: 'Tema Scuro', actionId: 'set-theme-dark' },
    ],
  },
  {
    id: 'account',
    label: 'Account',
    items: [{ label: store.user ? 'Logout' : 'Login con Google', actionId: 'toggle-auth' }],
  },
  {
    id: 'help',
    label: 'Aiuto',
    items: [
      { label: 'Apri pagina impostazioni', actionId: 'open-settings-page' },
      { divider: true },
      { label: 'Comandi Chrome bypass CORS', onClick: openCorsBypassDialog },
    ],
  },
])

function closeMenu() {
  openMenuId.value = null
}

function toggleMenu(menuId: string) {
  openMenuId.value = openMenuId.value === menuId ? null : menuId
}

function handleMenuMouseEnter(menuId: string) {
  if (!openMenuId.value) {
    return
  }

  openMenuId.value = menuId
}

async function handleMenuItemClick(item: WebMenuItem) {
  if (item.divider) {
    return
  }

  closeMenu()

  if (item.onClick) {
    item.onClick()
    return
  }

  if (item.actionId) {
    await handleElectronMenuAction(item.actionId)
  }
}

function handleWindowClick(event: MouseEvent) {
  const target = event.target as Node | null
  if (!rootRef.value || (target && rootRef.value.contains(target))) {
    return
  }

  closeMenu()
}

function handleWindowKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    closeMenu()
  }
}

onMounted(() => {
  window.addEventListener('click', handleWindowClick)
  window.addEventListener('keydown', handleWindowKeydown)
})

onUnmounted(() => {
  window.removeEventListener('click', handleWindowClick)
  window.removeEventListener('keydown', handleWindowKeydown)
})
</script>

<template>
  <div
    v-if="!store.canUseNativeTransport"
    ref="rootRef"
    class="relative z-40 border-t border-border/60 bg-background/90 backdrop-blur"
  >
    <div class="mx-auto flex w-full max-w-[1900px] items-center px-2 py-1">
      <div
        v-for="section in menuSections"
        :key="section.id"
        class="relative"
        @mouseenter="handleMenuMouseEnter(section.id)"
      >
        <button
          type="button"
          class="rounded-md px-2 py-1 text-xs text-foreground/80 transition-colors hover:bg-accent hover:text-foreground"
          :class="openMenuId === section.id ? 'bg-accent text-foreground' : ''"
          @click.stop="toggleMenu(section.id)"
        >
          {{ section.label }}
        </button>

        <div
          v-if="openMenuId === section.id"
          class="absolute left-0 top-8 z-[70] min-w-[260px] rounded-md border border-border bg-popover p-1 shadow-lg"
          @click.stop
        >
          <template v-for="(item, itemIndex) in section.items" :key="`${section.id}-${itemIndex}`">
            <div v-if="item.divider" class="my-1 h-px bg-border/70" />
            <button
              v-else
              type="button"
              class="flex w-full items-center justify-between gap-6 rounded px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent"
              :class="item.danger ? 'text-red-600 dark:text-red-300' : ''"
              @click="void handleMenuItemClick(item)"
            >
              <span>{{ item.label }}</span>
              <span v-if="item.shortcut" class="text-xs text-muted-foreground">{{ item.shortcut }}</span>
            </button>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>
