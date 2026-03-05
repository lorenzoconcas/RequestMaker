<script setup lang="ts">
import type { AppController } from '@/composables/useAppController'
import MainContentCollectionSettingsPage from '@/components/app/main-content/MainContentCollectionSettingsPage.vue'
import MainContentEmptyState from '@/components/app/main-content/MainContentEmptyState.vue'
import MainContentRequestEditor from '@/components/app/main-content/MainContentRequestEditor.vue'
import MainContentRequestTabs from '@/components/app/main-content/MainContentRequestTabs.vue'
import MainContentSettingsPage from '@/components/app/main-content/MainContentSettingsPage.vue'

const { controller } = defineProps<{ controller: AppController }>()

const {
  store,
  activeMainPage,
  openRequestTabs,
  selectedCollection,
  treeSelection,
} = controller
</script>

<template>
  <section class="relative min-w-0 flex-1 bg-background">
    <div class="flex h-full flex-col">
      <MainContentRequestTabs
        v-if="activeMainPage === 'workspace' && openRequestTabs.length > 0"
        :controller="controller"
      />

      <MainContentSettingsPage
        v-if="activeMainPage === 'settings'"
        :controller="controller"
      />

      <MainContentCollectionSettingsPage
        v-else-if="selectedCollection"
        :controller="controller"
      />

      <MainContentRequestEditor
        v-else-if="treeSelection.type === 'request' && store.activeRequest"
        :controller="controller"
      />

      <MainContentEmptyState v-else />
    </div>
  </section>
</template>
