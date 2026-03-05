<script setup lang="ts">
import AppContextMenu from '@/components/app/AppContextMenu.vue'
import AppHeader from '@/components/app/AppHeader.vue'
import AppMainContent from '@/components/app/AppMainContent.vue'
import AppSidebar from '@/components/app/AppSidebar.vue'
import AppToaster from '@/components/app/AppToaster.vue'
import AppUserDialog from '@/components/app/AppUserDialog.vue'
import AppWebMenuBar from '@/components/app/AppWebMenuBar.vue'
import { useAppController } from '@/composables/useAppController'

const controller = useAppController()
const openApiInputRef = controller.openApiInputRef
</script>

<template>
  <div class="min-h-screen bg-background text-foreground">
    <input
      ref="openApiInputRef"
      type="file"
      accept="application/json,.json"
      class="hidden"
      @change="controller.handleOpenApiImport"
    />

    <AppWebMenuBar :controller="controller" />
    <AppHeader :controller="controller" />

    <div class="relative mx-auto flex w-full max-w-[1900px] min-h-[calc(100vh-57px)]">
      <AppSidebar :controller="controller" />
      <AppMainContent :controller="controller" />
    </div>

    <AppContextMenu :controller="controller" />
    <AppUserDialog :controller="controller" />
    <AppToaster />
  </div>
</template>
