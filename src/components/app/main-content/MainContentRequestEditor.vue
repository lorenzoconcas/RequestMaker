<script setup lang="ts">
import {ref} from 'vue'

import {
  Clock3,
  Code2,
  FileJson2,
  FileType2,
  Gauge,
  Globe,
  HardDrive,
  Minus,
  Paperclip,
  Plus,
  Save,
  Send,
  X,
} from 'lucide-vue-next'

import type {AppController} from '@/composables/useAppController'
import {Button} from '@/components/ui/button'
import {Input} from '@/components/ui/input'
import {Label} from '@/components/ui/label'
import {Select} from '@/components/ui/select'
import {Separator} from '@/components/ui/separator'
import {Textarea} from '@/components/ui/textarea'

const {controller} = defineProps<{ controller: AppController }>()

const {
  store,
  activeName,
  activeMethod,
  methodOptions,
  activeUrl,
  activeRequestSecretTokens,
  applySecretTokenAsBaseUrl,
  handleSaveRequest,
  activeEditorTab,
  editorTabs,
  setActiveHeader,
  activeBodyMode,
  bodyModeOptions,
  activeBodyContentType,
  bodyContentTypeOptions,
  resolvedBodyEditorMode,
  bodyFileInputRef,
  activeBodyFile,
  triggerBodyFilePicker,
  handleBodyFileSelected,
  clearActiveBodyFile,
  addFormFieldToActiveRequest,
  activeFormFields,
  setActiveFormField,
  removeFormFieldFromActiveRequest,
  activeBody,
  activeAuthType,
  authTypeOptions,
  activeAuthBearerToken,
  activeAuthOauth2AccessToken,
  activeAuthJwtToken,
  activeAuthBasicUsername,
  activeAuthBasicPassword,
  activeAuthApiKeyIn,
  authApiKeyInOptions,
  activeAuthApiKeyName,
  activeAuthApiKeyValue,
  activeAuthAwsAccessKeyId,
  activeAuthAwsSecretAccessKey,
  activeAuthAwsRegion,
  activeAuthAwsService,
  activeAuthAwsSessionToken,
  activeAuthHawkId,
  activeAuthHawkKey,
  activeAuthHawkAlgorithm,
  activeDescription,
  selectedTransport,
  transportOptions,
  responseSectionTabs,
  responseSectionTab,
  saveResponseBody,
  responseViewerMode,
  parsedResponseJson,
  formattedResponseJson,
  responseContentType,
  formatBytes,
  responseSizeBytes,
  responseViewerTabs,
} = controller

const draftHeaderKey = ref('')
const draftHeaderValue = ref('')

const handleAddHeaderRow = () => {
  if (!store.activeRequest) {
    return
  }

  const key = draftHeaderKey.value
  const value = draftHeaderValue.value

  store.addHeaderToActiveRequest()
  const rowIndex = store.activeRequest.headers.length - 1
  setActiveHeader(rowIndex, 'key', key)
  setActiveHeader(rowIndex, 'value', value)

  draftHeaderKey.value = ''
  draftHeaderValue.value = ''
}
</script>

<template>
  <div class="mb-3 space-y-4 px-4">
    <div>
      <Input v-model="activeName" placeholder="New Request" class="h-9 text-base font-semibold"/>
    </div>

    <div class="space-y-4">
      <div class="grid gap-2 md:grid-cols-[150px_minmax(0,1fr)_auto_auto]">
        <Select v-model="activeMethod" :options="methodOptions"/>
        <Input v-model="activeUrl" placeholder="/resource oppure https://api.example.com/resource"/>
        <Button variant="secondary" @click="handleSaveRequest">
          <Save class="mr-2 h-4 w-4"/>
          Save
        </Button>
        <Button @click="store.sendActiveRequest">
          <Send class="mr-2 h-4 w-4"/>
          Send
        </Button>
      </div>

      <div v-if="activeRequestSecretTokens.length > 0" class="flex flex-wrap items-center gap-2">
        <span class="text-xs text-muted-foreground">Variabili disponibili:</span>
        <button
            v-for="secretToken in activeRequestSecretTokens"
            :key="`request-secret-token-${secretToken.key}`"
            type="button"
            class="inline-flex items-center gap-1 rounded-md border border-border/70 px-2 py-1 text-xs hover:bg-muted/60"
            @click="applySecretTokenAsBaseUrl(secretToken.key)"
        >
          <code>{{ secretToken.token }}</code>
          <span class="text-[10px] text-muted-foreground">
              {{ secretToken.scope === 'collection' ? 'collection' : 'team' }}
            </span>
        </button>
      </div>

      <div class="space-y-3">
        <div class="-mx-4 flex flex-wrap items-center gap-1 border-b border-border/70">
          <button
              v-for="tab in editorTabs"
              :key="tab.value"
              type="button"
              class="border-b-2 px-3 py-2 text-xs font-medium transition-colors"
              :class="
                activeEditorTab === tab.value
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              "
              @click="activeEditorTab = tab.value as 'headers' | 'body' | 'authorization' | 'description'"
          >
            {{ tab.label }}
          </button>
        </div>

        <div v-if="activeEditorTab === 'headers'" class="space-y-2">
          <div class="overflow-hidden rounded-md border border-border/70">
            <table class="w-full table-fixed text-sm">
              <thead class="bg-muted/30 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th class="w-12 px-2 py-2 text-left"></th>
                <th class="px-2 py-2 text-left font-medium">Header</th>
                <th class="px-2 py-2 text-left font-medium">Value</th>
              </tr>
              </thead>

              <tbody>
              <tr
                  v-for="(header, index) in store.activeRequest?.headers ?? []"
                  :key="`header-${index}`"
                  class="align-top"
              >
                <td class="border-t border-border/70 px-2 py-1.5">
                  <Button
                      size="icon"
                      variant="ghost"
                      class="h-7 w-7"
                      @click="store.removeHeaderFromActiveRequest(index)"
                  >
                    <Minus class="h-3.5 w-3.5"/>
                  </Button>
                </td>
                <td class="border-t border-border/70 px-2 py-1.5">
                  <Input
                      :model-value="header.key"
                      placeholder="Header"
                      @update:model-value="setActiveHeader(index, 'key', $event)"
                  />
                </td>
                <td class="border-t border-border/70 px-2 py-1.5">
                  <Input
                      :model-value="header.value"
                      placeholder="Value"
                      @update:model-value="setActiveHeader(index, 'value', $event)"
                  />
                </td>
              </tr>

              <tr class="align-top">
                <td class="border-t border-border/70 px-2 py-1.5">
                  <Button size="icon" variant="ghost" class="h-7 w-7" @click="handleAddHeaderRow">
                    <Plus class="h-3.5 w-3.5"/>
                  </Button>
                </td>
                <td class="border-t border-border/70 px-2 py-1.5">
                  <Input
                      v-model="draftHeaderKey"
                      placeholder="Nuovo header"
                      @keyup.enter="handleAddHeaderRow"
                  />
                </td>
                <td class="border-t border-border/70 px-2 py-1.5">
                  <Input
                      v-model="draftHeaderValue"
                      placeholder="Valore"
                      @keyup.enter="handleAddHeaderRow"
                  />
                </td>
              </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div v-if="activeEditorTab === 'body'" class="space-y-3">
          <input
              ref="bodyFileInputRef"
              type="file"
              class="hidden"
              @change="handleBodyFileSelected"
          />

          <div class="grid gap-2 md:grid-cols-[240px_minmax(0,1fr)]">
            <div class="space-y-2">
              <Label>Body Type</Label>
              <Select v-model="activeBodyMode" :options="bodyModeOptions"/>
            </div>

            <div class="space-y-2">
              <Label>Content-Type</Label>
              <Select v-model="activeBodyContentType" :options="bodyContentTypeOptions"/>
            </div>
          </div>

          <div v-if="activeBodyMode === 'auto'" class="rounded-md border border-dashed border-border/70 p-3">
            <p class="text-xs text-muted-foreground">
              Auto attivo: il payload viene scelto in base al Content-Type.
            </p>
          </div>

          <div v-if="resolvedBodyEditorMode === 'none'" class="rounded-md border border-dashed border-border/70 p-3">
            <p class="text-xs text-muted-foreground">Nessun body inviato per questa richiesta.</p>
          </div>

          <div v-else-if="resolvedBodyEditorMode === 'urlencoded' || resolvedBodyEditorMode === 'form-data'"
               class="space-y-2">
            <div class="flex items-center justify-between">
              <Label>Campi Form</Label>
              <Button size="sm" variant="outline" @click="addFormFieldToActiveRequest">+ Campo</Button>
            </div>

            <div
                v-for="(field, index) in activeFormFields"
                :key="`form-field-${index}`"
                class="grid gap-2 md:grid-cols-[1fr_1fr_auto]"
            >
              <Input
                  :model-value="field.key"
                  placeholder="field name"
                  @update:model-value="setActiveFormField(index, 'key', $event)"
              />
              <Input
                  :model-value="field.value"
                  placeholder="field value"
                  @update:model-value="setActiveFormField(index, 'value', $event)"
              />
              <Button variant="ghost" @click="removeFormFieldFromActiveRequest(index)">Rimuovi</Button>
            </div>

            <p class="text-xs text-muted-foreground">
              {{ resolvedBodyEditorMode === 'urlencoded' ? 'Invio URL encoded.' : 'Invio multipart form-data.' }}
            </p>
          </div>

          <div v-else-if="resolvedBodyEditorMode === 'file'" class="space-y-3">
            <div class="flex flex-wrap items-center gap-2">
              <Button variant="outline" @click="triggerBodyFilePicker">
                <Paperclip class="mr-2 h-4 w-4"/>
                Seleziona File
              </Button>
              <Button
                  v-if="activeBodyFile"
                  variant="ghost"
                  @click="clearActiveBodyFile"
              >
                <X class="mr-2 h-4 w-4"/>
                Rimuovi file
              </Button>
            </div>

            <div v-if="activeBodyFile" class="rounded-md border border-border/70 bg-muted/20 p-3">
              <p class="text-sm font-medium">{{ activeBodyFile.name }}</p>
              <p class="text-xs text-muted-foreground">
                {{ activeBodyFile.contentType || 'application/octet-stream' }} • {{ formatBytes(activeBodyFile.size) }}
              </p>
              <p class="mt-1 text-[11px] text-muted-foreground">
                Il contenuto binario del file resta locale e non viene sincronizzato su Firebase.
              </p>
            </div>

            <p v-else class="text-xs text-muted-foreground">
              Nessun file selezionato. Carica un file per inviarlo come body binario.
            </p>
          </div>

          <div v-else class="space-y-2">
            <Label>Body</Label>
            <Textarea
                v-model="activeBody"
                :rows="12"
                :placeholder="resolvedBodyEditorMode === 'json' ? 'JSON payload' : 'Raw payload'"
                class="font-mono text-xs"
            />
          </div>
        </div>

        <div v-if="activeEditorTab === 'authorization'" class="space-y-3">
          <div class="space-y-2">
            <Label>Tipo autorizzazione</Label>
            <Select v-model="activeAuthType" :options="authTypeOptions"/>
          </div>

          <div v-if="activeAuthType === 'inherit'" class="rounded-md border border-dashed border-border/70 p-3">
            <p class="text-xs text-muted-foreground">
              Eredita l'autorizzazione dal livello superiore. Se non configurata, la request viene inviata senza auth.
            </p>
          </div>

          <div v-if="activeAuthType === 'none'" class="rounded-md border border-dashed border-border/70 p-3">
            <p class="text-xs text-muted-foreground">Nessuna autorizzazione applicata alla request.</p>
          </div>

          <div v-if="activeAuthType === 'bearer'" class="space-y-2">
            <Label>Bearer token</Label>
            <Input v-model="activeAuthBearerToken" type="password" placeholder="Inserisci token o {{TOKEN}}"/>
          </div>

          <div v-if="activeAuthType === 'oauth2'" class="space-y-2">
            <Label>Access token</Label>
            <Input v-model="activeAuthOauth2AccessToken" type="password"
                   placeholder="OAuth access token o {{OAUTH_TOKEN}}"/>
          </div>

          <div v-if="activeAuthType === 'jwt'" class="space-y-2">
            <Label>JWT token</Label>
            <Input v-model="activeAuthJwtToken" type="password" placeholder="JWT token o {{JWT_TOKEN}}"/>
          </div>

          <div v-if="activeAuthType === 'basic' || activeAuthType === 'digest'" class="grid gap-2 md:grid-cols-2">
            <div class="space-y-2">
              <Label>Username</Label>
              <Input v-model="activeAuthBasicUsername" placeholder="username"/>
            </div>
            <div class="space-y-2">
              <Label>Password</Label>
              <Input v-model="activeAuthBasicPassword" type="password" placeholder="password"/>
            </div>
          </div>

          <div v-if="activeAuthType === 'digest'" class="rounded-md border border-dashed border-border/70 p-3">
            <p class="text-xs text-muted-foreground">
              Digest Auth è disponibile in configurazione ma non ancora supportata dal motore di invio.
            </p>
          </div>

          <div v-if="activeAuthType === 'apiKey'" class="space-y-3">
            <div class="grid gap-2 md:grid-cols-[200px_1fr]">
              <div class="space-y-2">
                <Label>Posizione</Label>
                <Select v-model="activeAuthApiKeyIn" :options="authApiKeyInOptions"/>
              </div>
              <div class="space-y-2">
                <Label>Chiave</Label>
                <Input v-model="activeAuthApiKeyName" placeholder="x-api-key"/>
              </div>
            </div>

            <div class="space-y-2">
              <Label>Valore</Label>
              <Input v-model="activeAuthApiKeyValue" type="password" placeholder="api-key value o {{API_KEY}}"/>
            </div>
          </div>

          <div v-if="activeAuthType === 'awsSignature'" class="space-y-3">
            <div class="grid gap-2 md:grid-cols-2">
              <div class="space-y-2">
                <Label>Access Key ID</Label>
                <Input v-model="activeAuthAwsAccessKeyId" placeholder="AKIA..."/>
              </div>
              <div class="space-y-2">
                <Label>Secret Access Key</Label>
                <Input v-model="activeAuthAwsSecretAccessKey" type="password"
                       placeholder="AWS secret o {{AWS_SECRET}}"/>
              </div>
            </div>

            <div class="grid gap-2 md:grid-cols-2">
              <div class="space-y-2">
                <Label>Region</Label>
                <Input v-model="activeAuthAwsRegion" placeholder="eu-west-1"/>
              </div>
              <div class="space-y-2">
                <Label>Service</Label>
                <Input v-model="activeAuthAwsService" placeholder="execute-api"/>
              </div>
            </div>

            <div class="space-y-2">
              <Label>Session Token (optional)</Label>
              <Input v-model="activeAuthAwsSessionToken" type="password" placeholder="AWS session token"/>
            </div>

            <div class="rounded-md border border-dashed border-border/70 p-3">
              <p class="text-xs text-muted-foreground">
                AWS Signature è disponibile in configurazione ma non ancora supportata dal motore di invio.
              </p>
            </div>
          </div>

          <div v-if="activeAuthType === 'hawk'" class="space-y-3">
            <div class="grid gap-2 md:grid-cols-2">
              <div class="space-y-2">
                <Label>Hawk ID</Label>
                <Input v-model="activeAuthHawkId" placeholder="hawk-id"/>
              </div>
              <div class="space-y-2">
                <Label>Hawk Key</Label>
                <Input v-model="activeAuthHawkKey" type="password" placeholder="hawk-key o {{HAWK_KEY}}"/>
              </div>
            </div>

            <div class="space-y-2">
              <Label>Algorithm</Label>
              <Input v-model="activeAuthHawkAlgorithm" placeholder="sha256"/>
            </div>

            <div class="rounded-md border border-dashed border-border/70 p-3">
              <p class="text-xs text-muted-foreground">
                HAWK è disponibile in configurazione ma non ancora supportata dal motore di invio.
              </p>
            </div>
          </div>
        </div>

        <div v-if="activeEditorTab === 'description'" class="space-y-3">
          <div class="space-y-2">
            <Label>Descrizione</Label>
            <Input v-model="activeDescription" placeholder="Descrizione opzionale"/>
          </div>

          <div class="space-y-2">
            <Label>Trasporto richiesta</Label>
            <Select v-model="selectedTransport" :options="transportOptions"/>
            <p class="text-xs text-muted-foreground">
              Browser usa fetch renderer (CORS). Electron/cURL usano runtime nativo.
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>

  <div class="min-h-0 flex flex-1 flex-col gap-3 px-4">
    <Separator class="-mx-4"/>

    <div>
      <h2 class="text-base font-semibold">Response</h2>
    </div>

    <div v-if="store.response" class="flex min-h-0 flex-1 flex-col gap-3">
      <div class="-mx-4 flex flex-wrap items-center gap-1 border-b border-border/70">
        <button
            v-for="tab in responseSectionTabs"
            :key="tab.value"
            type="button"
            class="border-b-2 px-3 py-2 text-xs font-medium transition-colors"
            :class="
              responseSectionTab === tab.value
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            "
            @click="responseSectionTab = tab.value as 'response' | 'headers' | 'raw'"
        >
          {{ tab.label }}
        </button>

        <Button size="sm" variant="outline" class="ml-auto h-8 mr-2 mb-1" @click="saveResponseBody">
          <Save class="mr-2 h-3.5 w-3.5"/>
          Salva risposta
        </Button>
      </div>

      <div
          v-if="responseSectionTab === 'headers'"
          class="min-h-0 flex-1 rounded-md  "
      >
<!--        <p class="mb-2 text-xs font-medium text-muted-foreground">Intestazioni</p>-->
        <div class="max-h-[42vh] space-y-1 overflow-auto text-sm">
          <p v-for="header in store.response.headers" :key="header.key + header.value">
            <span class="text-primary">{{ header.key }}:</span>
            <span class="text-foreground"> {{ header.value }}</span>
          </p>
        </div>
      </div>

      <div
          v-else-if="responseSectionTab === 'raw'"
          class="min-h-0 flex-1 rounded-md "
      >
<!--        <p class="mb-2 text-xs font-medium text-muted-foreground">Raw Body</p>-->
        <pre
            class="max-h-[42vh] overflow-auto whitespace-pre-wrap rounded-md border border-border/70 bg-background p-2 text-xs leading-relaxed text-foreground"
        >{{ store.response.body }}</pre>
      </div>

      <div v-else class="min-h-0 flex-1 rounded-md ">
        <iframe
            v-if="responseViewerMode === 'html'"
            :srcdoc="store.response.body"
            sandbox=""
            class="h-[36vh] w-full rounded-md border border-border/70 bg-white"
        />

        <pre
            v-else-if="responseViewerMode === 'json' && parsedResponseJson !== null"
            class="max-h-[36vh] overflow-auto whitespace-pre-wrap rounded-md border border-border/70 bg-background p-2 text-xs leading-relaxed text-foreground"
        >{{ formattedResponseJson }}</pre>

        <div v-else-if="responseViewerMode === 'json'" class="rounded-md border border-dashed border-border/70 p-3">
          <p class="mb-2 text-xs text-muted-foreground">Body non JSON valido, fallback raw.</p>
          <pre class="max-h-[30vh] overflow-auto whitespace-pre-wrap text-xs leading-relaxed text-foreground">{{
              store.response.body
            }}</pre>
        </div>

        <pre
            v-else
            class="max-h-[36vh] overflow-auto whitespace-pre-wrap rounded-md border border-border/70 bg-background p-2 text-xs leading-relaxed text-foreground"
        >{{ store.response.body }}</pre>
      </div>

      <div class="-mx-4 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border/70 p-2 text-xs">
          <span class="inline-flex items-center gap-1 text-foreground">
            <Gauge class="h-3 w-3"/>
            {{ store.response.status }} {{ store.response.statusText }}
          </span>
        <span class="inline-flex items-center gap-1 text-muted-foreground">
            <Clock3 class="h-3 w-3"/>
            {{ store.response.durationMs }}ms
          </span>
        <span class="inline-flex items-center gap-1 text-muted-foreground">
            <HardDrive class="h-3 w-3"/>
            {{ formatBytes(responseSizeBytes) }}
          </span>
        <span class="inline-flex items-center gap-1 text-muted-foreground">
            <FileType2 class="h-3 w-3"/>
            {{ responseContentType || 'content-type: n/a' }}
          </span>

        <div
            v-if="responseSectionTab === 'response'"
            class="ml-auto flex flex-wrap items-center gap-1"
        >
          <button
              v-for="tab in responseViewerTabs"
              :key="tab.value"
              type="button"
              class="border-b-2 px-2.5 py-1 text-xs font-medium transition-colors"
              :class="
                responseViewerMode === tab.value
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              "
              @click="responseViewerMode = tab.value as 'raw' | 'html' | 'json'"
          >
            <Code2 v-if="tab.value === 'raw'" class="mr-1 inline h-3 w-3"/>
            <Globe v-else-if="tab.value === 'html'" class="mr-1 inline h-3 w-3"/>
            <FileJson2 v-else class="mr-1 inline h-3 w-3"/>
            {{ tab.label }}
          </button>
        </div>
      </div>
    </div>

    <div v-else>
      <p class="text-sm text-muted-foreground">Nessuna risposta disponibile. Invia una richiesta per vedere il
        risultato.</p>
    </div>
  </div>
</template>
