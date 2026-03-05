<script setup lang="ts">
import {
  ChevronDown,
  ChevronRight,
  FileCode2,
  Folder,
  FolderKanban,
  FolderOpen,
  GripVertical,
  MoreHorizontal,
  Plus,
} from 'lucide-vue-next'

import type { AppController } from '@/composables/useAppController'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

const { controller } = defineProps<{ controller: AppController }>()

const {
  store,
  sidebarCollapsed,
  newCollectionName,
  handleCreateCollection,
  handleCreateQuickRequest,
  treeSelection,
  draggedCollectionId,
  dragOverRequestCollectionId,
  dragOverCollectionId,
  dragOverCollectionPosition,
  openCollectionContextMenu,
  handleCollectionDragOver,
  handleCollectionDrop,
  toggleCollection,
  isCollectionExpanded,
  handleCollectionDragStart,
  handleCollectionDragEnd,
  selectCollectionFromTree,
  handleCreateRequest,
  requestsGroupedByCollection,
  methodTagClass,
  draggedRequestId,
  openRequestContextMenu,
  handleRequestDragStart,
  handleRequestDragEnd,
  selectRequestFromTree,
} = controller
</script>

<template>
  <aside
    class="shrink-0 border-r border-sidebar-border/70 bg-sidebar text-sidebar-foreground transition-all duration-200"
    :class="sidebarCollapsed ? 'w-[72px]' : 'w-[360px]'"
  >
    <div class="flex h-full flex-col">
      <div v-if="sidebarCollapsed" class="flex flex-1 flex-col items-center gap-2 p-3">
        <div class="rounded-md bg-sidebar-accent/70 p-2 text-sidebar-foreground/70">
          <FolderKanban class="h-4 w-4" />
        </div>
      </div>

      <div v-else class="flex min-h-0 flex-1 flex-col">
        <div class="space-y-2 border-b border-sidebar-border/70 px-3 py-3">
          <div class="flex gap-2">
            <Input v-model="newCollectionName" placeholder="Nuova collection" />
            <Button variant="secondary" size="icon" @click="handleCreateCollection">
              <Plus class="h-4 w-4" />
            </Button>
          </div>
          <Button class="w-full" variant="outline" @click="handleCreateQuickRequest">+ Quick Request</Button>
        </div>

        <div class="min-h-0 flex-1 overflow-y-auto px-2 py-3">
          <div class="space-y-1">
            <div v-for="collectionItem in store.collectionsInWorkspace" :key="collectionItem.id" class="space-y-1">
              <div
                class="group flex items-center gap-1 rounded-md px-1 py-1"
                :class="[
                  treeSelection.type === 'collection' && treeSelection.collectionId === collectionItem.id
                    ? 'bg-primary/15 text-primary'
                    : 'hover:bg-sidebar-accent',
                  draggedCollectionId === collectionItem.id ? 'opacity-60' : '',
                  dragOverRequestCollectionId === collectionItem.id ? 'ring-2 ring-primary/40' : '',
                  dragOverCollectionId === collectionItem.id &&
                  draggedCollectionId !== collectionItem.id &&
                  dragOverCollectionPosition === 'before'
                    ? 'border-t-2 border-primary'
                    : '',
                  dragOverCollectionId === collectionItem.id &&
                  draggedCollectionId !== collectionItem.id &&
                  dragOverCollectionPosition === 'after'
                    ? 'border-b-2 border-primary'
                    : '',
                ]"
                @contextmenu.prevent="openCollectionContextMenu($event, collectionItem.id)"
                @dragover="handleCollectionDragOver($event, collectionItem.id)"
                @drop="handleCollectionDrop($event, collectionItem.id)"
              >
                <button
                  type="button"
                  class="rounded p-1 text-sidebar-foreground/70 hover:bg-sidebar-accent"
                  @click.stop="toggleCollection(collectionItem.id)"
                >
                  <ChevronDown v-if="isCollectionExpanded(collectionItem.id)" class="h-3.5 w-3.5" />
                  <ChevronRight v-else class="h-3.5 w-3.5" />
                </button>

                <FolderOpen v-if="isCollectionExpanded(collectionItem.id)" class="h-4 w-4 text-sidebar-primary" />
                <Folder v-else class="h-4 w-4 text-sidebar-foreground/70" />

                <button
                  type="button"
                  class="cursor-grab rounded p-1 text-sidebar-foreground/50 hover:bg-sidebar-accent active:cursor-grabbing"
                  draggable="true"
                  @dragstart="handleCollectionDragStart($event, collectionItem.id)"
                  @dragend="handleCollectionDragEnd"
                >
                  <GripVertical class="h-3.5 w-3.5" />
                </button>

                <button
                  type="button"
                  class="min-w-0 flex-1 truncate text-left text-sm"
                  @click.stop="selectCollectionFromTree(collectionItem.id)"
                >
                  {{ collectionItem.name }}
                </button>

                <Button
                  size="sm"
                  variant="ghost"
                  class="h-6 px-2 text-xs opacity-70 group-hover:opacity-100"
                  @click.stop="handleCreateRequest(collectionItem.id)"
                >
                  +
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  class="h-6 w-6 opacity-70 group-hover:opacity-100"
                  @click.stop="openCollectionContextMenu($event, collectionItem.id)"
                >
                  <MoreHorizontal class="h-3.5 w-3.5" />
                </Button>
              </div>

              <div
                v-if="isCollectionExpanded(collectionItem.id)"
                class="ml-4 space-y-1 border-l border-sidebar-border/70 pl-2"
                @dragover="handleCollectionDragOver($event, collectionItem.id)"
                @drop="handleCollectionDrop($event, collectionItem.id)"
              >
                <div
                  v-for="requestItem in requestsGroupedByCollection[collectionItem.id]"
                  :key="requestItem.id"
                  class="group flex items-center gap-1 rounded-md px-1 py-0.5"
                  :class="[
                    treeSelection.type === 'request' && treeSelection.requestId === requestItem.id
                      ? 'bg-primary/15 text-primary'
                      : 'text-sidebar-foreground/80 hover:bg-sidebar-accent',
                    draggedRequestId === requestItem.id ? 'opacity-60' : '',
                  ]"
                  @contextmenu.prevent="openRequestContextMenu($event, requestItem.id, collectionItem.id)"
                >
                  <button
                    type="button"
                    class="cursor-grab rounded p-1 text-sidebar-foreground/50 opacity-0 transition-opacity hover:bg-sidebar-accent active:cursor-grabbing group-hover:opacity-100"
                    draggable="true"
                    @dragstart="handleRequestDragStart($event, requestItem.id, collectionItem.id)"
                    @dragend="handleRequestDragEnd"
                  >
                    <GripVertical class="h-3 w-3" />
                  </button>

                  <button
                    type="button"
                    class="flex min-w-0 flex-1 items-center gap-2 rounded-md px-1 py-1 text-left text-xs transition-colors"
                    @click="selectRequestFromTree(requestItem.id)"
                  >
                    <span class="rounded px-1.5 py-0.5 text-[10px] font-semibold" :class="methodTagClass(requestItem.method)">
                      {{ requestItem.method }}
                    </span>
                    <FileCode2 class="h-3.5 w-3.5 shrink-0" />
                    <span class="truncate">{{ requestItem.name }}</span>
                  </button>
                  <Button
                    size="icon"
                    variant="ghost"
                    class="h-5 w-5 opacity-0 group-hover:opacity-100"
                    @click.stop="openRequestContextMenu($event, requestItem.id, collectionItem.id)"
                  >
                    <MoreHorizontal class="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </div>

            <div v-if="store.collectionsInWorkspace.length === 0" class="rounded-md border border-dashed border-sidebar-border/70 p-3">
              <p class="text-xs text-sidebar-foreground/70">Nessuna collection. Creane una per iniziare.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </aside>
</template>
