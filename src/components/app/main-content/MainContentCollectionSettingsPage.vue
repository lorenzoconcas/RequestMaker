<script setup lang="ts">
import { ref } from 'vue'

import { Eye, EyeOff, FileCode2, Plus, Save } from 'lucide-vue-next'

import type { AppController } from '@/composables/useAppController'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'

const { controller } = defineProps<{ controller: AppController }>()

const {
  store,
  collectionTabs,
  collectionSettingsTab,
  selectedCollection,
  selectedCollectionNameDraft,
  collectionBaseUrlDraft,
  handleSaveSelectedCollectionName,
  handleCreateRequest,
  triggerOpenApiImport,
  handleSaveSelectedCollectionBaseUrl,
  requestsForSelectedCollection,
  secretsForSelectedCollection,
  handleDeleteSelectedCollection,
  selectRequestFromTree,
  methodTagClass,
  collectionSecretKey,
  collectionSecretValue,
  selectedCollectionSecretVisibility,
  secretVisibilityOptions,
  handleSaveSelectedCollectionSecret,
  handleDeleteCollectionSecret,
} = controller

const showSelectedCollectionSecrets = ref(false)
</script>

<template>
  <div class="min-h-0 flex-1 border-border/80">
    <CardHeader class="pb-3">
      <CardTitle class="text-base">Collection Settings</CardTitle>
    </CardHeader>

    <CardContent class="space-y-4">
      <div class="flex flex-wrap items-center gap-1 border-b border-border/70">
        <button
          v-for="tab in collectionTabs"
          :key="tab.value"
          type="button"
          class="border-b-2 px-3 py-2 text-xs font-medium transition-colors"
          :class="
            collectionSettingsTab === tab.value
              ? 'border-primary text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          "
          @click="collectionSettingsTab = tab.value as 'overview' | 'requests' | 'secrets'"
        >
          {{ tab.label }}
        </button>
      </div>

      <div v-if="collectionSettingsTab === 'overview'" class="space-y-4">
        <div class="grid gap-2 md:grid-cols-[minmax(0,1fr)_auto_auto_auto]">
          <Input v-model="selectedCollectionNameDraft" placeholder="Nome collection" />
          <Button variant="secondary" @click="handleSaveSelectedCollectionName">
            <Save class="mr-2 h-4 w-4" />
            Salva nome
          </Button>
          <Button variant="outline" @click="selectedCollection && handleCreateRequest(selectedCollection.id)">
            <Plus class="mr-2 h-4 w-4" />
            Nuova request
          </Button>
          <Button variant="outline" @click="triggerOpenApiImport">
            <FileCode2 class="mr-2 h-4 w-4" />
            Import OpenAPI JSON
          </Button>
        </div>

        <div class="grid gap-2 md:grid-cols-[minmax(0,1fr)_auto]">
          <Input
            v-model="collectionBaseUrlDraft"
            placeholder="Base URL collection (es. https://api.example.com)"
          />
          <Button variant="secondary" @click="handleSaveSelectedCollectionBaseUrl">
            Salva Base URL
          </Button>
        </div>
        <p class="text-xs text-muted-foreground">
          Dopo averla impostata, nelle request puoi usare URL relativi come <code>/controller</code>.
        </p>

        <div class="flex flex-wrap items-center gap-2">
          <Badge variant="outline">{{ requestsForSelectedCollection.length }} request</Badge>
          <Badge variant="outline">{{ secretsForSelectedCollection.length }} segreti</Badge>
          <Button
            class="ml-auto text-red-600 hover:text-red-700 dark:text-red-300 dark:hover:text-red-200"
            variant="ghost"
            @click="handleDeleteSelectedCollection"
          >
            Elimina collection
          </Button>
        </div>
      </div>

      <div v-else-if="collectionSettingsTab === 'requests'" class="space-y-2">
        <div
          v-for="requestItem in requestsForSelectedCollection"
          :key="requestItem.id"
          class="flex items-center justify-between rounded-md border border-border/70 px-3 py-2"
        >
          <button
            type="button"
            class="flex min-w-0 flex-1 items-center gap-2 text-left"
            @click="selectRequestFromTree(requestItem.id)"
          >
            <span class="rounded px-1.5 py-0.5 text-[10px] font-semibold" :class="methodTagClass(requestItem.method)">
              {{ requestItem.method }}
            </span>
            <span class="truncate text-sm">{{ requestItem.name }}</span>
          </button>
          <Button size="sm" variant="outline" @click="selectRequestFromTree(requestItem.id)">Apri</Button>
        </div>

        <div v-if="requestsForSelectedCollection.length === 0" class="rounded-md border border-dashed border-border/70 p-3">
          <p class="text-sm text-muted-foreground">Nessuna request in questa collection.</p>
        </div>
      </div>

      <div v-else class="space-y-4">
        <div class="rounded-md border border-border/70 bg-muted/20 px-3 py-2">
          <p class="text-sm font-medium">Segreti collection</p>
          <p class="text-xs text-muted-foreground">
            Usa i token nel formato <code>&#123;&#123;SECRET_KEY&#125;&#125;</code> in URL, header e body.
            I segreti collection hanno priorità rispetto ai segreti team.
          </p>
        </div>

        <div class="flex items-center justify-between">
          <p class="text-xs text-muted-foreground">Mostra/Nascondi valori segreti</p>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            class="h-8 w-8"
            @click="showSelectedCollectionSecrets = !showSelectedCollectionSecrets"
          >
            <Eye v-if="!showSelectedCollectionSecrets" class="h-4 w-4" />
            <EyeOff v-else class="h-4 w-4" />
          </Button>
        </div>

        <div class="grid items-end gap-3 md:grid-cols-[1fr_1fr_180px_auto]">
          <div class="space-y-1">
            <Label class="text-xs">Chiave variabile</Label>
            <Input v-model="collectionSecretKey" placeholder="es. API_TOKEN o BASE_URL" />
          </div>

          <div class="space-y-1">
            <Label class="text-xs">Valore segreto</Label>
            <Input
              v-model="collectionSecretValue"
              :type="showSelectedCollectionSecrets ? 'text' : 'password'"
              placeholder="es. sk_live_xxx oppure https://api.example.com"
            />
          </div>

          <div class="space-y-1">
            <Label class="text-xs">Visibilita</Label>
            <Select v-model="selectedCollectionSecretVisibility" :options="secretVisibilityOptions" />
          </div>

          <Button variant="secondary" @click="handleSaveSelectedCollectionSecret">Salva</Button>
        </div>

        <p class="text-xs text-muted-foreground">
          Esempio uso: <code>&#123;&#123;BASE_URL&#125;&#125;/users</code> oppure
          <code>Authorization: Bearer &#123;&#123;API_TOKEN&#125;&#125;</code>.
        </p>

        <div v-if="secretsForSelectedCollection.length === 0" class="rounded-md border border-dashed border-border/70 p-3">
          <p class="text-sm text-muted-foreground">Nessun segreto impostato su questa collection.</p>
        </div>

        <div v-else class="space-y-2">
          <div
            v-for="secret in secretsForSelectedCollection"
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
                  showSelectedCollectionSecrets && (store.canManageRestrictedSecrets || secret.visibility !== 'admin')
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
    </CardContent>
  </div>
</template>
