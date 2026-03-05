<script setup lang="ts">
import { Info, LogIn, LogOut, PanelLeft, PanelLeftClose, Send, User } from 'lucide-vue-next'

import type { AppController } from '@/composables/useAppController'
import type { ThemePreference } from '@/composables/useTheme'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'

const { controller } = defineProps<{ controller: AppController }>()

const {
  store,
  sidebarCollapsed,
  toggleSidebar,
  showUserMenu,
  toggleUserMenu,
  openMainPage,
  handleSelectWorkspaceFromUserMenu,
  openWorkspaceSettingsFromUserMenu,
  workspaceOptions,
  themeOptions,
  lightThemeOptions,
  darkThemeOptions,
  accentColorOptions,
  selectedTheme,
  selectedLightTheme,
  selectedDarkTheme,
  selectedAccentColor,
  handleThemeFromUserMenu,
  handleUserMenuAuthAction,
} = controller
</script>

<template>
  <header class="sticky top-0 z-30 border-b border-border/70 bg-background/95 backdrop-blur">
    <div class="mx-auto flex w-full max-w-[1900px] items-center justify-between px-4 py-2.5">
      <div class="flex items-center gap-3">
        <Button size="icon" variant="ghost" @click="toggleSidebar">
          <PanelLeftClose v-if="!sidebarCollapsed" class="h-4 w-4" />
          <PanelLeft v-else class="h-4 w-4" />
        </Button>

        <div class="rounded-md bg-primary/10 p-2 text-primary">
          <Send class="h-4 w-4" />
        </div>
        <div>
          <h1 class="text-base font-semibold tracking-tight">RequestMaker</h1>
        </div>
      </div>

      <div class="flex items-center gap-2">
        <div v-if="store.workspaces.length > 1" class="hidden min-w-[240px] lg:block">
          <Select v-model="store.selectedWorkspaceId" :options="workspaceOptions" />
        </div>

        <Badge v-if="store.isRemoteMode" variant="secondary">
          Firebase Sync ON
        </Badge>
        <div v-else class="group relative">
          <button
            id="local-mode-trigger"
            type="button"
            aria-describedby="local-mode-tooltip"
            class="inline-flex h-8 w-8 items-center justify-center rounded-md border border-amber-300 bg-amber-100 text-amber-800 transition-colors hover:bg-amber-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/40 dark:border-amber-900/50 dark:bg-amber-900/30 dark:text-amber-200 dark:hover:bg-amber-900/40"
          >
            <Info class="h-4 w-4" />
            <span class="sr-only">Modalita locale attiva</span>
          </button>

          <div
            id="local-mode-tooltip"
            role="tooltip"
            aria-labelledby="local-mode-trigger"
            class="pointer-events-none absolute right-0 top-10 z-40 w-72 translate-y-1 rounded-md border border-border/80 bg-popover px-3 py-2 text-xs text-popover-foreground opacity-0 shadow-lg transition-all group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:translate-y-0 group-focus-within:opacity-100"
          >
            Modalita locale attiva: i dati restano su questo dispositivo e non vengono sincronizzati su Firebase.
          </div>
        </div>

        <div class="relative">
          <Button size="icon" variant="outline" @click.stop="toggleUserMenu">
            <User class="h-4 w-4" />
          </Button>

          <div
            v-if="showUserMenu"
            class="absolute right-0 top-11 z-40 w-72 rounded-lg border border-border bg-popover p-2 shadow-lg"
            @click.stop
          >
            <div class="rounded-md border border-border/70 px-3 py-2">
              <p class="text-sm font-medium">{{ store.user?.displayName || 'Guest' }}</p>
              <p class="truncate text-xs text-muted-foreground">{{ store.user?.email || 'Modalita locale' }}</p>
            </div>

            <div class="mt-2 space-y-1">
              <div class="rounded-md border border-border/70 p-2">
                <div class="mb-1 flex items-center justify-between">
                  <p class="text-xs font-medium text-muted-foreground">Workspace</p>
                  <button
                    type="button"
                    class="text-xs text-muted-foreground hover:text-foreground"
                    @click="openWorkspaceSettingsFromUserMenu"
                  >
                    Gestisci
                  </button>
                </div>

                <div v-if="store.workspaces.length > 0" class="space-y-1">
                  <button
                    v-for="workspaceItem in store.workspaces"
                    :key="workspaceItem.id"
                    type="button"
                    class="w-full rounded-md px-2 py-1.5 text-left text-sm transition-colors"
                    :class="
                      store.selectedWorkspaceId === workspaceItem.id
                        ? 'bg-primary/15 text-primary'
                        : 'hover:bg-accent'
                    "
                    @click="handleSelectWorkspaceFromUserMenu(workspaceItem.id)"
                  >
                    {{ workspaceItem.name }}
                  </button>
                </div>

                <p v-else class="text-xs text-muted-foreground">Nessun workspace disponibile</p>
              </div>

              <button
                type="button"
                class="w-full rounded-md px-3 py-2 text-left text-sm hover:bg-accent"
                @click="openMainPage('user')"
              >
                Profilo Utente
              </button>
              <button
                type="button"
                class="w-full rounded-md px-3 py-2 text-left text-sm hover:bg-accent"
                @click="openMainPage('settings')"
              >
                Impostazioni
              </button>
            </div>

            <div class="my-2 border-t border-border/70" />

            <p class="px-1 pb-1 text-xs font-medium text-muted-foreground">Aspetto</p>
            <div class="grid grid-cols-3 gap-1">
              <button
                v-for="themeOption in themeOptions"
                :key="themeOption.value"
                type="button"
                class="rounded-md px-2 py-1.5 text-xs transition-colors"
                :class="
                  selectedTheme === themeOption.value
                    ? 'bg-primary/15 text-primary'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                "
                @click="handleThemeFromUserMenu(themeOption.value as ThemePreference)"
              >
                {{ themeOption.label }}
              </button>
            </div>

            <div class="mt-2 space-y-2">
              <div class="space-y-1">
                <p class="px-1 text-xs text-muted-foreground">Tema chiaro</p>
                <Select v-model="selectedLightTheme" :options="lightThemeOptions" class="h-8 text-xs" />
              </div>

              <div class="space-y-1">
                <p class="px-1 text-xs text-muted-foreground">Tema scuro</p>
                <Select v-model="selectedDarkTheme" :options="darkThemeOptions" class="h-8 text-xs" />
              </div>

              <div class="space-y-1">
                <p class="px-1 text-xs text-muted-foreground">Accento</p>
                <Select v-model="selectedAccentColor" :options="accentColorOptions" class="h-8 text-xs" />
              </div>
            </div>

            <div class="my-2 border-t border-border/70" />

            <Button class="w-full" variant="outline" size="sm" @click="handleUserMenuAuthAction">
              <LogOut v-if="store.user" class="mr-2 h-4 w-4" />
              <LogIn v-else class="mr-2 h-4 w-4" />
              {{ store.user ? 'Logout' : 'Login con Google' }}
            </Button>
          </div>
        </div>
      </div>
    </div>
  </header>
</template>
