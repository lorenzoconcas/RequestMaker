<script setup lang="ts">
import { ref } from 'vue'

import { Eye, EyeOff } from 'lucide-vue-next'

import type { AppController } from '@/composables/useAppController'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'

const { controller } = defineProps<{ controller: AppController }>()

const {
  store,
  settingsTabs,
  settingsPageTab,
  selectedTheme,
  themeOptions,
  selectedLightTheme,
  lightThemeOptions,
  selectedDarkTheme,
  darkThemeOptions,
  selectedAccentColor,
  accentColorOptions,
  selectedTransport,
  transportOptions,
  workspaceOptions,
  newWorkspaceName,
  newWorkspaceTeamId,
  teamOptions,
  handleCreateWorkspace,
  handleDeleteWorkspace,
  teamSecretKey,
  teamSecretValue,
  teamSecretVisibility,
  handleSaveTeamSecret,
  handleDeleteTeamSecret,
  selectedCollectionSecretsId,
  secretVisibilityOptions,
  collectionSecretOptions,
  collectionSecretKey,
  collectionSecretValue,
  collectionSecretVisibility,
  collectionSecretsForSelectedCollection,
  handleSaveCollectionSecret,
  handleDeleteCollectionSecret,
} = controller

const showTeamSecrets = ref(false)
const showWorkspaceCollectionSecrets = ref(false)
</script>

<template>
  <div class="min-h-0 flex-1 border-border/80">
    <CardHeader class="pb-3">
      <CardTitle class="text-base">Impostazioni</CardTitle>
    </CardHeader>

    <CardContent class="space-y-4">
      <div class="flex flex-wrap items-center gap-1 border-b border-border/70">
        <button
          v-for="tab in settingsTabs"
          :key="tab.value"
          type="button"
          class="border-b-2 px-3 py-2 text-xs font-medium transition-colors"
          :class="
            settingsPageTab === tab.value
              ? 'border-primary text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          "
          @click="settingsPageTab = tab.value as 'general' | 'workspace' | 'secrets'"
        >
          {{ tab.label }}
        </button>
      </div>

      <div v-if="settingsPageTab === 'general'" class="grid gap-4 md:grid-cols-2">
        <div class="space-y-2">
          <Label>Modalita tema</Label>
          <Select v-model="selectedTheme" :options="themeOptions" />
        </div>

        <div class="space-y-2">
          <Label>Tema chiaro</Label>
          <Select v-model="selectedLightTheme" :options="lightThemeOptions" />
        </div>

        <div class="space-y-2">
          <Label>Tema scuro</Label>
          <Select v-model="selectedDarkTheme" :options="darkThemeOptions" />
        </div>

        <div class="space-y-2">
          <Label>Accento colore</Label>
          <Select v-model="selectedAccentColor" :options="accentColorOptions" />
        </div>

        <div class="space-y-2">
          <Label>Trasporto richieste</Label>
          <Select v-model="selectedTransport" :options="transportOptions" />
        </div>
      </div>

      <div v-else-if="settingsPageTab === 'workspace'" class="space-y-4">
        <div class="space-y-2">
          <Label>Workspace corrente</Label>
          <Select v-model="store.selectedWorkspaceId" :options="workspaceOptions" />
        </div>

        <div class="space-y-2">
          <Label>Nuovo workspace</Label>
          <div class="grid gap-2 md:grid-cols-[1fr_220px_auto]">
            <Input v-model="newWorkspaceName" placeholder="Es. Backend Gateway" />
            <Select v-model="newWorkspaceTeamId" :options="teamOptions" />
            <Button variant="secondary" @click="handleCreateWorkspace">Crea Workspace</Button>
          </div>
        </div>

        <div class="space-y-2">
          <Label>Gestione workspace</Label>
          <div v-if="store.workspaces.length > 0" class="space-y-2">
            <div
              v-for="workspaceItem in store.workspaces"
              :key="workspaceItem.id"
              class="flex items-center justify-between rounded-md border border-border/70 px-3 py-2"
            >
              <button
                type="button"
                class="min-w-0 flex-1 text-left"
                @click="store.selectedWorkspaceId = workspaceItem.id"
              >
                <p class="truncate text-sm font-medium">{{ workspaceItem.name }}</p>
              </button>

              <div class="ml-3 flex shrink-0 items-center gap-2">
                <Badge v-if="store.selectedWorkspaceId === workspaceItem.id" variant="secondary">Attivo</Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  class="text-red-600 hover:text-red-700 dark:text-red-300 dark:hover:text-red-200"
                  @click="handleDeleteWorkspace(workspaceItem.id)"
                >
                  Elimina
                </Button>
              </div>
            </div>
          </div>

          <p v-else class="text-xs text-muted-foreground">Nessun workspace disponibile.</p>
        </div>
      </div>

      <div v-else class="space-y-5">
        <div class="space-y-3">
          <div class="flex items-start justify-between gap-2">
            <div>
              <p class="text-sm font-semibold">Segreti Team</p>
              <p class="text-xs text-muted-foreground">Condivisi su tutte le collection del team.</p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              class="h-8 w-8"
              @click="showTeamSecrets = !showTeamSecrets"
            >
              <Eye v-if="!showTeamSecrets" class="h-4 w-4" />
              <EyeOff v-else class="h-4 w-4" />
            </Button>
          </div>

          <div v-if="store.activeWorkspaceTeamId" class="space-y-3">
            <div class="grid gap-2 md:grid-cols-[1fr_1fr_180px_auto]">
              <Input v-model="teamSecretKey" placeholder="SECRET_KEY" />
              <Input v-model="teamSecretValue" :type="showTeamSecrets ? 'text' : 'password'" placeholder="secret value" />
              <Select v-model="teamSecretVisibility" :options="secretVisibilityOptions" />
              <Button variant="secondary" @click="handleSaveTeamSecret">Salva</Button>
            </div>

            <div class="space-y-2">
              <div
                v-for="secret in store.teamSecretsInActiveTeam"
                :key="secret.id"
                class="flex items-center justify-between rounded-md border border-border/70 px-3 py-2"
              >
                <div>
                  <p class="flex items-center gap-2 text-sm font-medium">
                    <span>{{ secret.key }}</span>
                    <Badge v-if="secret.visibility === 'admin'" variant="outline">Admin</Badge>
                  </p>
                  <p class="truncate text-xs text-muted-foreground">
                    {{
                      showTeamSecrets && (store.canManageRestrictedSecrets || secret.visibility !== 'admin')
                        ? secret.value
                        : '••••••••'
                    }}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  :disabled="secret.visibility === 'admin' && !store.canManageRestrictedSecrets"
                  @click="handleDeleteTeamSecret(secret.id)"
                >
                  Rimuovi
                </Button>
              </div>
            </div>
          </div>

          <p v-else class="text-sm text-muted-foreground">Il workspace corrente non è collegato a un team.</p>
        </div>

        <Separator />

        <div class="space-y-3">
          <div class="flex items-start justify-between gap-2">
            <div>
              <p class="text-sm font-semibold">Segreti Collection (override)</p>
              <p class="text-xs text-muted-foreground">
                Usa <code>&#123;&#123;SECRET_KEY&#125;&#125;</code> in URL/header/body. Priorità: collection &gt; team.
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              class="h-8 w-8"
              @click="showWorkspaceCollectionSecrets = !showWorkspaceCollectionSecrets"
            >
              <Eye v-if="!showWorkspaceCollectionSecrets" class="h-4 w-4" />
              <EyeOff v-else class="h-4 w-4" />
            </Button>
          </div>

          <div class="grid gap-3 md:grid-cols-[220px_minmax(0,1fr)]">
            <div class="space-y-2">
              <Label>Collection target</Label>
              <Select v-model="selectedCollectionSecretsId" :options="collectionSecretOptions" />
            </div>

            <div v-if="selectedCollectionSecretsId" class="space-y-2">
              <div class="grid gap-2 md:grid-cols-[1fr_1fr_180px_auto]">
                <Input v-model="collectionSecretKey" placeholder="SECRET_KEY" />
                <Input
                  v-model="collectionSecretValue"
                  :type="showWorkspaceCollectionSecrets ? 'text' : 'password'"
                  placeholder="secret value"
                />
                <Select v-model="collectionSecretVisibility" :options="secretVisibilityOptions" />
                <Button variant="secondary" @click="handleSaveCollectionSecret">Salva</Button>
              </div>

              <div class="space-y-2">
                <div
                  v-for="secret in collectionSecretsForSelectedCollection"
                  :key="secret.id"
                  class="flex items-center justify-between rounded-md border border-border/70 px-3 py-2"
                >
                  <div>
                    <p class="flex items-center gap-2 text-sm font-medium">
                      <span>{{ secret.key }}</span>
                      <Badge v-if="secret.visibility === 'admin'" variant="outline">Admin</Badge>
                    </p>
                    <p class="truncate text-xs text-muted-foreground">
                      {{
                        showWorkspaceCollectionSecrets && (store.canManageRestrictedSecrets || secret.visibility !== 'admin')
                          ? secret.value
                          : '••••••••'
                      }}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    :disabled="secret.visibility === 'admin' && !store.canManageRestrictedSecrets"
                    @click="handleDeleteCollectionSecret(secret.id)"
                  >
                    Rimuovi
                  </Button>
                </div>
              </div>
            </div>

            <p v-else class="text-xs text-muted-foreground">Crea prima una collection per definire segreti dedicati.</p>
          </div>
        </div>
      </div>
    </CardContent>
  </div>
</template>
