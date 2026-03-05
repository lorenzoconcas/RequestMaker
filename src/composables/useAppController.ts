import {
  computed,
  nextTick,
  onMounted,
  onUnmounted,
  ref,
  watch,
} from 'vue'

import {
  defaultContentTypeForBodyMode,
  formatBytes,
  inferResponseExtension,
  methodTagClass as resolveMethodTagClass,
  resolveAutoBodyMode,
  sanitizeFileNamePart,
} from '@/composables/app-controller/helpers'
import {
  ACCENT_COLOR_OPTIONS,
  AUTH_API_KEY_IN_OPTIONS,
  AUTH_TYPE_OPTIONS,
  BODY_CONTENT_TYPE_OPTIONS,
  BODY_MODE_OPTIONS,
  COLLECTION_TABS,
  DARK_THEME_OPTIONS,
  LIGHT_THEME_OPTIONS,
  DND_COLLECTION_ID_MIME,
  DND_KIND_MIME,
  DND_REQUEST_ID_MIME,
  DND_REQUEST_SOURCE_COLLECTION_ID_MIME,
  EDITOR_TABS,
  METHOD_OPTIONS,
  RESPONSE_SECTION_TABS,
  RESPONSE_VIEWER_TABS,
  SETTINGS_TABS,
  THEME_OPTIONS,
  USER_TABS,
} from '@/composables/app-controller/options'
import {
  useTheme,
  type AccentColor,
  type DarkThemeVariant,
  type LightThemeVariant,
  type ThemePreference,
} from '@/composables/useTheme'
import { useToast } from '@/composables/useToast'
import { useAppStore } from '@/stores/app-store'
import type { MenuActionId } from '@/types/electron'
import type {
  HttpMethod,
  RequestAuth,
  RequestAuthApiKeyIn,
  RequestAuthType,
  RequestBodyMode,
  RequestTransportMode,
} from '@/types/domain'

export type SidebarDragKind = 'collection' | 'request'
export type TreeContextMenuType = 'collection' | 'request'

export interface TreeContextMenuState {
  visible: boolean
  x: number
  y: number
  type: TreeContextMenuType
  collectionId: string | null
  requestId: string | null
}

export interface TreeSelectionState {
  type: TreeContextMenuType
  collectionId: string | null
  requestId: string | null
}

export function useAppController() {
  const store = useAppStore()
  const {
    themePreference,
    lightThemeVariant,
    darkThemeVariant,
    accentColor,
    setTheme,
    setLightThemeVariant,
    setDarkThemeVariant,
    setAccentColor,
  } = useTheme()
  const { error: showErrorToast } = useToast()
  
  const sidebarCollapsed = ref(false)
  const showUserMenu = ref(false)
  const showUserDialog = ref(false)
  const activeEditorTab = ref<'headers' | 'body' | 'authorization' | 'description'>('headers')
  const userPageTab = ref<'profile' | 'team'>('profile')
  const settingsPageTab = ref<'general' | 'workspace' | 'secrets'>('general')
  const collectionSettingsTab = ref<'overview' | 'requests' | 'secrets'>('overview')
  const expandedCollections = ref<Record<string, boolean>>({})
  const activeMainPage = ref<'workspace' | 'user' | 'settings'>('workspace')
  const openRequestTabIds = ref<string[]>([])
  const draggedCollectionId = ref<string | null>(null)
  const dragOverCollectionId = ref<string | null>(null)
  const dragOverCollectionPosition = ref<'before' | 'after' | null>(null)
  const draggedRequestId = ref<string | null>(null)
  const draggedRequestSourceCollectionId = ref<string | null>(null)
  const dragOverRequestCollectionId = ref<string | null>(null)
  
  const treeContextMenu = ref<TreeContextMenuState>({
    visible: false,
    x: 0,
    y: 0,
    type: 'collection',
    collectionId: null,
    requestId: null,
  })
  
  const treeSelection = ref<TreeSelectionState>({
    type: 'request',
    collectionId: null,
    requestId: null,
  })
  
  const newTeamName = ref('')
  const inviteEmail = ref('')
  const inviteTeamId = ref('')
  const newWorkspaceName = ref('')
  const newWorkspaceTeamId = ref('')
  const newCollectionName = ref('')
  const selectedCollectionNameDraft = ref('')
  const collectionBaseUrlDraft = ref('')
  const teamSecretKey = ref('')
  const teamSecretValue = ref('')
  const teamSecretVisibility = ref<'team' | 'admin'>('team')
  const collectionSecretKey = ref('')
  const collectionSecretValue = ref('')
  const collectionSecretVisibility = ref<'team' | 'admin'>('team')
  const selectedCollectionSecretVisibility = ref<'team' | 'admin'>('team')
  const selectedCollectionSecretsId = ref('')
  
  const openApiInputRef = ref<HTMLInputElement | null>(null)
  const bodyFileInputRef = ref<HTMLInputElement | null>(null)
  let removeElectronMenuListener: (() => void) | null = null

  const methodOptions = METHOD_OPTIONS
  const themeOptions = THEME_OPTIONS
  const lightThemeOptions = LIGHT_THEME_OPTIONS
  const darkThemeOptions = DARK_THEME_OPTIONS
  const accentColorOptions = ACCENT_COLOR_OPTIONS
  const editorTabs = EDITOR_TABS
  const authTypeOptions = AUTH_TYPE_OPTIONS
  const authApiKeyInOptions = AUTH_API_KEY_IN_OPTIONS
  const bodyModeOptions = BODY_MODE_OPTIONS
  const bodyContentTypeOptions = BODY_CONTENT_TYPE_OPTIONS
  const userTabs = USER_TABS
  const settingsTabs = SETTINGS_TABS
  const collectionTabs = COLLECTION_TABS
  const responseViewerTabs = RESPONSE_VIEWER_TABS
  const responseSectionTabs = RESPONSE_SECTION_TABS

  function getCollectionBaseUrlSecret(collectionId: string) {
    const matchingSecrets = store.collectionSecretsInWorkspace.filter((secret) => secret.collectionId === collectionId)
    return (
      matchingSecrets.find((secret) => secret.key.trim().toUpperCase() === 'BASE_URL') ??
      matchingSecrets.find((secret) => secret.key.trim().toUpperCase() === 'BASE') ??
      null
    )
  }
  
  const transportOptions = computed(() => {
    const options = [{ label: 'Browser (CORS)', value: 'browser' }]
  
    if (store.canUseNativeTransport) {
      options.push(
        { label: 'Electron Fetch (native)', value: 'electron' },
        { label: 'cURL nativo', value: 'curl' },
      )
    }
  
    return options
  })

  const secretVisibilityOptions = computed(() => {
    const options = [{ label: 'Team', value: 'team' }]

    if (store.canManageRestrictedSecrets) {
      options.push({ label: 'Solo admin', value: 'admin' })
    }

    return options
  })
  
  const selectedTheme = computed({
    get: () => themePreference.value,
    set: (value: string) => setTheme(value as ThemePreference),
  })

  const selectedLightTheme = computed({
    get: () => lightThemeVariant.value,
    set: (value: string) => setLightThemeVariant(value as LightThemeVariant),
  })

  const selectedDarkTheme = computed({
    get: () => darkThemeVariant.value,
    set: (value: string) => setDarkThemeVariant(value as DarkThemeVariant),
  })

  const selectedAccentColor = computed({
    get: () => accentColor.value,
    set: (value: string) => setAccentColor(value as AccentColor),
  })
  
  const selectedTransport = computed({
    get: () => store.requestTransport,
    set: (value: string) => store.setRequestTransport(value as RequestTransportMode),
  })
  
  const workspaceOptions = computed(() =>
    store.workspaces.map((workspace) => ({
      label: workspace.name,
      value: workspace.id,
    })),
  )
  
  const teamOptions = computed(() => [
    { label: 'Nessun team (workspace personale)', value: '' },
    ...store.teams.map((team) => ({ label: team.name, value: team.id })),
  ])
  
  const inviteTeamOptions = computed(() =>
    store.teams.map((team) => ({
      label: team.name,
      value: team.id,
    })),
  )
  
  const collectionSecretOptions = computed(() =>
    store.collectionsInWorkspace.map((collectionItem) => ({
      label: collectionItem.name,
      value: collectionItem.id,
    })),
  )
  
  const collectionSecretsForSelectedCollection = computed(() =>
    store.collectionSecretsInWorkspace.filter((secret) => secret.collectionId === selectedCollectionSecretsId.value),
  )
  
  const requestsGroupedByCollection = computed(() => {
    const groups: Record<string, typeof store.requestsInWorkspace> = {}
  
    for (const collectionItem of store.collectionsInWorkspace) {
      groups[collectionItem.id] = store.requestsInWorkspace.filter(
        (requestItem) => requestItem.collectionId === collectionItem.id,
      )
    }
  
    return groups
  })
  
  const contextCollection = computed(() =>
    treeContextMenu.value.collectionId
      ? store.collectionsInWorkspace.find((collectionItem) => collectionItem.id === treeContextMenu.value.collectionId) ?? null
      : null,
  )
  
  const contextRequest = computed(() =>
    treeContextMenu.value.requestId
      ? store.requestsInWorkspace.find((requestItem) => requestItem.id === treeContextMenu.value.requestId) ?? null
      : null,
  )
  
  const selectedCollection = computed(() =>
    treeSelection.value.type === 'collection' && treeSelection.value.collectionId
      ? store.collectionsInWorkspace.find((collectionItem) => collectionItem.id === treeSelection.value.collectionId) ?? null
      : null,
  )
  
  const requestsForSelectedCollection = computed(() => {
    if (!selectedCollection.value) {
      return []
    }
  
    return store.requestsInWorkspace.filter((requestItem) => requestItem.collectionId === selectedCollection.value?.id)
  })
  
  const secretsForSelectedCollection = computed(() => {
    if (!selectedCollection.value) {
      return []
    }
  
    return store.collectionSecretsInWorkspace.filter((secret) => secret.collectionId === selectedCollection.value?.id)
  })
  
  const openRequestTabs = computed(() => {
    const requestsById = new Map(store.requestsInWorkspace.map((requestItem) => [requestItem.id, requestItem]))
    return openRequestTabIds.value.flatMap((requestId) => {
      const requestItem = requestsById.get(requestId)
      return requestItem ? [requestItem] : []
    })
  })
  
  const activeMethod = computed({
    get: () => store.activeRequest?.method ?? 'GET',
    set: (value: string) => store.upsertActiveRequestDraft({ method: value as HttpMethod }),
  })
  
  const activeUrl = computed({
    get: () => store.activeRequest?.url ?? '',
    set: (value: string) => store.upsertActiveRequestDraft({ url: value }),
  })

  const activeRequestSecretTokens = computed(() => {
    const collectionId = store.activeRequest?.collectionId ?? ''
    const byKey = new Map<string, { key: string; token: string; scope: 'team' | 'collection' }>()

    for (const secret of store.teamSecretsInActiveTeam) {
      const key = secret.key.trim()
      if (!key) {
        continue
      }

      byKey.set(key, {
        key,
        token: `{{${key}}}`,
        scope: 'team',
      })
    }

    for (const secret of store.collectionSecretsInWorkspace) {
      if (secret.collectionId !== collectionId) {
        continue
      }

      const key = secret.key.trim()
      if (!key) {
        continue
      }

      byKey.set(key, {
        key,
        token: `{{${key}}}`,
        scope: 'collection',
      })
    }

    return Array.from(byKey.values()).sort((left, right) => left.key.localeCompare(right.key))
  })

  function applySecretTokenAsBaseUrl(secretKey: string) {
    const key = secretKey.trim()
    if (!key) {
      return
    }

    const token = `{{${key}}}`
    const currentUrl = activeUrl.value.trim()

    if (!currentUrl) {
      activeUrl.value = `${token}/`
      return
    }

    const existingTokenPrefixMatch = currentUrl.match(/^{{[^}]+}}(.*)$/)
    if (existingTokenPrefixMatch) {
      const suffix = existingTokenPrefixMatch[1] || '/'
      activeUrl.value = `${token}${suffix.startsWith('/') ? suffix : `/${suffix}`}`
      return
    }

    const candidateUrl = currentUrl.startsWith('//') ? `https:${currentUrl}` : currentUrl
    const hasExplicitScheme = /^[A-Za-z][A-Za-z0-9+.-]*:/.test(candidateUrl)

    if (!hasExplicitScheme) {
      const suffix = currentUrl.startsWith('/') ? currentUrl : `/${currentUrl}`
      activeUrl.value = `${token}${suffix}`
      return
    }

    try {
      const parsed = new URL(candidateUrl)
      const suffix = `${parsed.pathname}${parsed.search}${parsed.hash}` || '/'
      activeUrl.value = `${token}${suffix.startsWith('/') ? suffix : `/${suffix}`}`
    } catch {
      const suffix = currentUrl.startsWith('/') ? currentUrl : `/${currentUrl}`
      activeUrl.value = `${token}${suffix}`
    }
  }
  
  const activeName = computed({
    get: () => store.activeRequest?.name ?? '',
    set: (value: string) => store.upsertActiveRequestDraft({ name: value }),
  })
  
  const activeDescription = computed({
    get: () => store.activeRequest?.description ?? '',
    set: (value: string) => store.upsertActiveRequestDraft({ description: value }),
  })
  
  const activeBody = computed({
    get: () => store.activeRequest?.body ?? '',
    set: (value: string) => store.upsertActiveRequestDraft({ body: value }),
  })
  
  function getActiveBodyMode(): RequestBodyMode {
    return store.activeRequest?.bodyMode ?? (store.activeRequest?.body?.trim() ? 'raw' : 'none')
  }
  
  const activeBodyMode = computed({
    get: () => getActiveBodyMode(),
    set: (value: string) => {
      const nextMode = value as RequestBodyMode
      const fallbackContentType = defaultContentTypeForBodyMode(nextMode)
      const previousContentType = store.activeRequest?.bodyContentType ?? ''
      const nextContentType =
        nextMode === 'none'
          ? ''
          : nextMode === 'raw'
            ? previousContentType || fallbackContentType
            : nextMode === 'auto'
              ? previousContentType
              : fallbackContentType
  
      store.upsertActiveRequestDraft({
        bodyMode: nextMode,
        bodyContentType: nextContentType,
        formFields:
          nextMode === 'urlencoded' || nextMode === 'form-data'
            ? (store.activeRequest?.formFields?.length ? store.activeRequest.formFields : [{ key: '', value: '' }])
            : store.activeRequest?.formFields ?? [],
      })
    },
  })
  
  const activeBodyContentType = computed({
    get: () =>
      store.activeRequest?.bodyContentType ||
      defaultContentTypeForBodyMode(getActiveBodyMode()),
    set: (value: string) => store.upsertActiveRequestDraft({ bodyContentType: value }),
  })
  
  const activeFormFields = computed(() => store.activeRequest?.formFields ?? [])
  const activeBodyFile = computed(() => store.activeRequestBodyFile)
  
  const resolvedBodyEditorMode = computed<RequestBodyMode>(() => {
    if (activeBodyMode.value !== 'auto') {
      return activeBodyMode.value
    }
  
    return resolveAutoBodyMode(activeBodyContentType.value, activeFormFields.value, activeBody.value)
  })
  
  function addFormFieldToActiveRequest() {
    const nextFields = [...activeFormFields.value, { key: '', value: '' }]
    store.upsertActiveRequestDraft({ formFields: nextFields })
  }
  
  function removeFormFieldFromActiveRequest(index: number) {
    const nextFields = activeFormFields.value.filter((_, fieldIndex) => fieldIndex !== index)
    store.upsertActiveRequestDraft({ formFields: nextFields })
  }
  
  function setActiveFormField(index: number, keyOrValue: 'key' | 'value', nextValue: string) {
    const nextFields = activeFormFields.value.map((field, fieldIndex) =>
      fieldIndex === index ? { ...field, [keyOrValue]: nextValue } : field,
    )
  
    store.upsertActiveRequestDraft({ formFields: nextFields })
  }

  function triggerBodyFilePicker() {
    if (!bodyFileInputRef.value) {
      return
    }

    bodyFileInputRef.value.click()
  }

  async function handleBodyFileSelected(event: Event) {
    const input = event.target as HTMLInputElement
    const selectedFile = input.files?.[0]

    if (!selectedFile) {
      return
    }

    try {
      store.lastError = null
      await store.setActiveRequestBodyFile(selectedFile)
    } catch (error) {
      store.lastError = error instanceof Error ? error.message : 'Errore durante caricamento file body.'
    } finally {
      input.value = ''
    }
  }

  function clearActiveBodyFile() {
    store.clearActiveRequestBodyFile()
  }
  
  function getActiveRequestAuth(): RequestAuth {
    return (
      store.activeRequest?.auth ?? {
        type: 'none',
        bearerToken: '',
        oauth2AccessToken: '',
        jwtToken: '',
        basicUsername: '',
        basicPassword: '',
        apiKeyName: '',
        apiKeyValue: '',
        apiKeyIn: 'header',
        awsAccessKeyId: '',
        awsSecretAccessKey: '',
        awsSessionToken: '',
        awsRegion: '',
        awsService: '',
        hawkId: '',
        hawkKey: '',
        hawkAlgorithm: 'sha256',
      }
    )
  }
  
  function updateActiveRequestAuth(partial: Partial<RequestAuth>) {
    const nextAuth: RequestAuth = {
      ...getActiveRequestAuth(),
      ...partial,
    }
  
    store.upsertActiveRequestDraft({ auth: nextAuth })
  }
  
  const activeAuthType = computed({
    get: () => getActiveRequestAuth().type,
    set: (value: string) => updateActiveRequestAuth({ type: value as RequestAuthType }),
  })
  
  const activeAuthBearerToken = computed({
    get: () => getActiveRequestAuth().bearerToken,
    set: (value: string) => updateActiveRequestAuth({ bearerToken: value }),
  })
  
  const activeAuthOauth2AccessToken = computed({
    get: () => getActiveRequestAuth().oauth2AccessToken,
    set: (value: string) => updateActiveRequestAuth({ oauth2AccessToken: value }),
  })
  
  const activeAuthJwtToken = computed({
    get: () => getActiveRequestAuth().jwtToken,
    set: (value: string) => updateActiveRequestAuth({ jwtToken: value }),
  })
  
  const activeAuthBasicUsername = computed({
    get: () => getActiveRequestAuth().basicUsername,
    set: (value: string) => updateActiveRequestAuth({ basicUsername: value }),
  })
  
  const activeAuthBasicPassword = computed({
    get: () => getActiveRequestAuth().basicPassword,
    set: (value: string) => updateActiveRequestAuth({ basicPassword: value }),
  })
  
  const activeAuthApiKeyName = computed({
    get: () => getActiveRequestAuth().apiKeyName,
    set: (value: string) => updateActiveRequestAuth({ apiKeyName: value }),
  })
  
  const activeAuthApiKeyValue = computed({
    get: () => getActiveRequestAuth().apiKeyValue,
    set: (value: string) => updateActiveRequestAuth({ apiKeyValue: value }),
  })
  
  const activeAuthApiKeyIn = computed({
    get: () => getActiveRequestAuth().apiKeyIn,
    set: (value: string) => updateActiveRequestAuth({ apiKeyIn: value as RequestAuthApiKeyIn }),
  })
  
  const activeAuthAwsAccessKeyId = computed({
    get: () => getActiveRequestAuth().awsAccessKeyId,
    set: (value: string) => updateActiveRequestAuth({ awsAccessKeyId: value }),
  })
  
  const activeAuthAwsSecretAccessKey = computed({
    get: () => getActiveRequestAuth().awsSecretAccessKey,
    set: (value: string) => updateActiveRequestAuth({ awsSecretAccessKey: value }),
  })
  
  const activeAuthAwsSessionToken = computed({
    get: () => getActiveRequestAuth().awsSessionToken,
    set: (value: string) => updateActiveRequestAuth({ awsSessionToken: value }),
  })
  
  const activeAuthAwsRegion = computed({
    get: () => getActiveRequestAuth().awsRegion,
    set: (value: string) => updateActiveRequestAuth({ awsRegion: value }),
  })
  
  const activeAuthAwsService = computed({
    get: () => getActiveRequestAuth().awsService,
    set: (value: string) => updateActiveRequestAuth({ awsService: value }),
  })
  
  const activeAuthHawkId = computed({
    get: () => getActiveRequestAuth().hawkId,
    set: (value: string) => updateActiveRequestAuth({ hawkId: value }),
  })
  
  const activeAuthHawkKey = computed({
    get: () => getActiveRequestAuth().hawkKey,
    set: (value: string) => updateActiveRequestAuth({ hawkKey: value }),
  })
  
  const activeAuthHawkAlgorithm = computed({
    get: () => getActiveRequestAuth().hawkAlgorithm || 'sha256',
    set: (value: string) => updateActiveRequestAuth({ hawkAlgorithm: value }),
  })
  
  const responseViewerMode = ref<'raw' | 'html' | 'json'>('raw')
  const responseSectionTab = ref<'response' | 'headers' | 'raw'>('response')
  
  const responseContentType = computed(() => {
    if (!store.response) {
      return ''
    }
  
    const header = store.response.headers.find((item) => item.key.toLowerCase() === 'content-type')
    return header?.value ?? ''
  })
  
  const responseSizeBytes = computed(() => {
    const body = store.response?.body ?? ''
  
    if (typeof TextEncoder !== 'undefined') {
      return new TextEncoder().encode(body).length
    }
  
    return body.length
  })
  
  const parsedResponseJson = computed(() => {
    const body = store.response?.body ?? ''
    if (!body.trim()) {
      return null
    }
  
    try {
      return JSON.parse(body)
    } catch {
      return null
    }
  })
  
  const formattedResponseJson = computed(() => {
    if (parsedResponseJson.value === null) {
      return ''
    }
  
    return JSON.stringify(parsedResponseJson.value, null, 2)
  })
  
  function saveResponseBody() {
    if (!store.response || typeof window === 'undefined' || typeof document === 'undefined') {
      return
    }
  
    const contentType = responseContentType.value || 'text/plain;charset=utf-8'
    const extension = inferResponseExtension(contentType)
    const requestName = sanitizeFileNamePart(store.activeRequest?.name ?? 'response')
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const fileName = `${requestName}-${timestamp}.${extension}`
    const blob = new Blob([store.response.body], { type: contentType })
    const downloadUrl = window.URL.createObjectURL(blob)
    const anchor = document.createElement('a')
  
    anchor.href = downloadUrl
    anchor.download = fileName
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    window.URL.revokeObjectURL(downloadUrl)
  }
  
  function selectCollectionFromTree(collectionId: string) {
    activeMainPage.value = 'workspace'
    showUserMenu.value = false
    treeSelection.value = {
      type: 'collection',
      collectionId,
      requestId: null,
    }
  
    selectedCollectionSecretsId.value = collectionId
    expandedCollections.value = {
      ...expandedCollections.value,
      [collectionId]: true,
    }
  }
  
  function selectRequestFromTree(requestId: string) {
    activeMainPage.value = 'workspace'
    showUserMenu.value = false
    const requestItem = store.requestsInWorkspace.find((item) => item.id === requestId) ?? null
  
    if (!requestItem) {
      return
    }
  
    treeSelection.value = {
      type: 'request',
      collectionId: requestItem?.collectionId ?? null,
      requestId,
    }
  
    if (requestItem?.collectionId) {
      expandedCollections.value = {
        ...expandedCollections.value,
        [requestItem.collectionId]: true,
      }
    }
  
    if (!openRequestTabIds.value.includes(requestId)) {
      openRequestTabIds.value = [...openRequestTabIds.value, requestId]
    }
  
    store.selectRequest(requestId)
  }
  
  function openRequestTab(requestId: string) {
    selectRequestFromTree(requestId)
  }
  
  function closeRequestTab(requestId: string, event?: MouseEvent) {
    event?.stopPropagation()
  
    const currentTabIds = openRequestTabIds.value
    const closedIndex = currentTabIds.indexOf(requestId)
  
    if (closedIndex < 0) {
      return
    }
  
    const nextTabIds = currentTabIds.filter((tabId) => tabId !== requestId)
    openRequestTabIds.value = nextTabIds
  
    if (store.activeRequestId !== requestId) {
      return
    }
  
    const fallbackRequestId = nextTabIds[closedIndex] ?? nextTabIds[closedIndex - 1] ?? null
  
    if (fallbackRequestId) {
      selectRequestFromTree(fallbackRequestId)
      return
    }
  
    store.selectRequest('')
  
    const fallbackCollectionId =
      treeSelection.value.collectionId ??
      store.activeRequest?.collectionId ??
      store.collectionsInWorkspace[0]?.id ??
      null
  
    if (fallbackCollectionId) {
      selectCollectionFromTree(fallbackCollectionId)
      return
    }
  
    treeSelection.value = {
      type: 'collection',
      collectionId: null,
      requestId: null,
    }
  }
  
  function handleCollectionDragStart(event: DragEvent, collectionId: string) {
    draggedRequestId.value = null
    draggedRequestSourceCollectionId.value = null
    dragOverRequestCollectionId.value = null
    draggedCollectionId.value = collectionId
    dragOverCollectionId.value = null
    dragOverCollectionPosition.value = null
  
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move'
      event.dataTransfer.setData(DND_KIND_MIME, 'collection')
      event.dataTransfer.setData(DND_COLLECTION_ID_MIME, collectionId)
    }
  }
  
  function handleRequestDragStart(event: DragEvent, requestId: string, sourceCollectionId: string) {
    draggedCollectionId.value = null
    dragOverCollectionId.value = null
    dragOverCollectionPosition.value = null
    draggedRequestId.value = requestId
    draggedRequestSourceCollectionId.value = sourceCollectionId
    dragOverRequestCollectionId.value = null
  
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move'
      event.dataTransfer.setData(DND_KIND_MIME, 'request')
      event.dataTransfer.setData(DND_REQUEST_ID_MIME, requestId)
      event.dataTransfer.setData(DND_REQUEST_SOURCE_COLLECTION_ID_MIME, sourceCollectionId)
    }
  }
  
  function resolveDragKind(event: DragEvent): SidebarDragKind | null {
    if (draggedRequestId.value) {
      return 'request'
    }
  
    if (draggedCollectionId.value) {
      return 'collection'
    }
  
    const kind = event.dataTransfer?.getData(DND_KIND_MIME)
  
    if (kind === 'collection' || kind === 'request') {
      return kind
    }
  
    return null
  }
  
  function resolveDraggedCollectionId(event: DragEvent): string {
    return draggedCollectionId.value || event.dataTransfer?.getData(DND_COLLECTION_ID_MIME) || ''
  }
  
  function resolveDraggedRequest(event: DragEvent): { requestId: string; sourceCollectionId: string | null } {
    const requestId = draggedRequestId.value || event.dataTransfer?.getData(DND_REQUEST_ID_MIME) || ''
    const sourceCollectionId = draggedRequestSourceCollectionId.value ||
      event.dataTransfer?.getData(DND_REQUEST_SOURCE_COLLECTION_ID_MIME) ||
      null
  
    return {
      requestId,
      sourceCollectionId,
    }
  }
  
  function getDropPosition(event: DragEvent): 'before' | 'after' {
    const currentTarget = event.currentTarget as HTMLElement | null
  
    if (!currentTarget) {
      return 'after'
    }
  
    const { top, height } = currentTarget.getBoundingClientRect()
    return event.clientY < top + height / 2 ? 'before' : 'after'
  }
  
  function handleCollectionDragOver(event: DragEvent, collectionId: string) {
    const dragKind = resolveDragKind(event)
  
    if (!dragKind) {
      return
    }
  
    if (dragKind === 'collection') {
      const sourceCollectionId = resolveDraggedCollectionId(event)
  
      if (!sourceCollectionId || sourceCollectionId === collectionId) {
        return
      }
  
      event.preventDefault()
      dragOverCollectionId.value = collectionId
      dragOverCollectionPosition.value = getDropPosition(event)
      dragOverRequestCollectionId.value = null
  
      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = 'move'
      }
  
      return
    }
  
    const { requestId, sourceCollectionId } = resolveDraggedRequest(event)
  
    if (!requestId || !sourceCollectionId || sourceCollectionId === collectionId) {
      return
    }
  
    event.preventDefault()
    dragOverRequestCollectionId.value = collectionId
    dragOverCollectionId.value = null
    dragOverCollectionPosition.value = null
  
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move'
    }
  }
  
  async function handleCollectionDrop(event: DragEvent, collectionId: string) {
    event.preventDefault()
  
    const dragKind = resolveDragKind(event)
  
    if (dragKind === 'request') {
      const { requestId, sourceCollectionId } = resolveDraggedRequest(event)
  
      draggedRequestId.value = null
      draggedRequestSourceCollectionId.value = null
      dragOverRequestCollectionId.value = null
      draggedCollectionId.value = null
      dragOverCollectionId.value = null
      dragOverCollectionPosition.value = null
  
      if (!requestId || !sourceCollectionId || sourceCollectionId === collectionId) {
        return
      }
  
      await store.moveRequestToCollection(requestId, collectionId)
      expandedCollections.value = {
        ...expandedCollections.value,
        [collectionId]: true,
      }
      return
    }
  
    if (dragKind !== 'collection') {
      draggedCollectionId.value = null
      dragOverCollectionId.value = null
      dragOverCollectionPosition.value = null
      draggedRequestId.value = null
      draggedRequestSourceCollectionId.value = null
      dragOverRequestCollectionId.value = null
      return
    }
  
    const sourceCollectionId = resolveDraggedCollectionId(event)
    const dropPosition =
      dragOverCollectionId.value === collectionId && dragOverCollectionPosition.value
        ? dragOverCollectionPosition.value
        : getDropPosition(event)
  
    draggedCollectionId.value = null
    dragOverCollectionId.value = null
    dragOverCollectionPosition.value = null
    draggedRequestId.value = null
    draggedRequestSourceCollectionId.value = null
    dragOverRequestCollectionId.value = null
  
    if (!sourceCollectionId || sourceCollectionId === collectionId) {
      return
    }
  
    const orderedCollections = store.collectionsInWorkspace
    const sourceIndex = orderedCollections.findIndex((collectionItem) => collectionItem.id === sourceCollectionId)
    const targetIndex = orderedCollections.findIndex((collectionItem) => collectionItem.id === collectionId)
  
    if (sourceIndex < 0 || targetIndex < 0) {
      return
    }
  
    const insertionIndex =
      dropPosition === 'before'
        ? sourceIndex < targetIndex
          ? targetIndex - 1
          : targetIndex
        : sourceIndex < targetIndex
          ? targetIndex
          : targetIndex + 1
  
    const boundedInsertionIndex = Math.max(0, Math.min(insertionIndex, orderedCollections.length - 1))
    await store.moveCollection(sourceCollectionId, boundedInsertionIndex)
  }
  
  function handleCollectionDragEnd() {
    draggedCollectionId.value = null
    dragOverCollectionId.value = null
    dragOverCollectionPosition.value = null
    draggedRequestId.value = null
    draggedRequestSourceCollectionId.value = null
    dragOverRequestCollectionId.value = null
  }
  
  function handleRequestDragEnd() {
    draggedRequestId.value = null
    draggedRequestSourceCollectionId.value = null
    dragOverRequestCollectionId.value = null
    draggedCollectionId.value = null
    dragOverCollectionId.value = null
    dragOverCollectionPosition.value = null
  }
  
  onMounted(() => {
    store.initialize()
    window.addEventListener('click', closeFloatingMenus)
    window.addEventListener('resize', closeFloatingMenus)
    window.addEventListener('keydown', handleGlobalKeydown)
  
    if (window.requestmakerElectron?.onMenuAction) {
      removeElectronMenuListener = window.requestmakerElectron.onMenuAction((actionId) => {
        void handleElectronMenuAction(actionId)
      })
    }
  })
  
  onUnmounted(() => {
    window.removeEventListener('click', closeFloatingMenus)
    window.removeEventListener('resize', closeFloatingMenus)
    window.removeEventListener('keydown', handleGlobalKeydown)
    removeElectronMenuListener?.()
    removeElectronMenuListener = null
  })
  
  watch(
    () => store.collectionsInWorkspace.map((collectionItem) => collectionItem.id),
    (collectionIds) => {
      const nextExpanded: Record<string, boolean> = {}
  
      for (const collectionId of collectionIds) {
        nextExpanded[collectionId] = expandedCollections.value[collectionId] ?? true
      }
  
      expandedCollections.value = nextExpanded
  
      if (!collectionIds.includes(selectedCollectionSecretsId.value)) {
        selectedCollectionSecretsId.value = collectionIds[0] ?? ''
      }
    },
    { immediate: true },
  )
  
  watch(
    () => store.activeRequest?.collectionId,
    (collectionId) => {
      if (!collectionId) {
        return
      }
  
      expandedCollections.value = {
        ...expandedCollections.value,
        [collectionId]: true,
      }
    },
  )
  
  watch(
    [
      () => store.collectionsInWorkspace.map((collectionItem) => collectionItem.id),
      () =>
        store.requestsInWorkspace.map((requestItem) => ({
          id: requestItem.id,
          collectionId: requestItem.collectionId,
        })),
      () => store.activeRequestId,
    ],
    ([collectionIds, requestItems, activeRequestId]) => {
      const requestIds = requestItems.map((requestItem) => requestItem.id)
  
      if (treeSelection.value.type === 'collection') {
        if (treeSelection.value.collectionId && collectionIds.includes(treeSelection.value.collectionId)) {
          return
        }
  
        if (collectionIds[0]) {
          selectCollectionFromTree(collectionIds[0])
          return
        }
  
        const fallbackRequestId = (activeRequestId && requestIds.includes(activeRequestId) ? activeRequestId : null) ?? requestIds[0]
        if (fallbackRequestId) {
          selectRequestFromTree(fallbackRequestId)
          return
        }
  
        treeSelection.value = {
          type: 'collection',
          collectionId: null,
          requestId: null,
        }
        return
      }
  
      if (treeSelection.value.requestId && requestIds.includes(treeSelection.value.requestId)) {
        const selectedRequestItem = store.requestsInWorkspace.find((item) => item.id === treeSelection.value.requestId) ?? null
        treeSelection.value = {
          type: 'request',
          collectionId: selectedRequestItem?.collectionId ?? null,
          requestId: treeSelection.value.requestId,
        }
        return
      }
  
      const fallbackRequestId = (activeRequestId && requestIds.includes(activeRequestId) ? activeRequestId : null) ?? requestIds[0]
      if (fallbackRequestId) {
        selectRequestFromTree(fallbackRequestId)
        return
      }
  
      if (collectionIds[0]) {
        selectCollectionFromTree(collectionIds[0])
        return
      }
  
      treeSelection.value = {
        type: 'request',
        collectionId: null,
        requestId: null,
      }
    },
    { immediate: true },
  )
  
  watch(
    () => selectedCollection.value,
    (collectionItem) => {
      if (!collectionItem) {
        selectedCollectionNameDraft.value = ''
        collectionBaseUrlDraft.value = ''
        selectedCollectionSecretVisibility.value = 'team'
        return
      }
  
      selectedCollectionNameDraft.value = collectionItem.name
      selectedCollectionSecretsId.value = collectionItem.id
      collectionBaseUrlDraft.value = getCollectionBaseUrlSecret(collectionItem.id)?.value ?? ''
      selectedCollectionSecretVisibility.value = 'team'
    },
    { immediate: true },
  )

  watch(
    () => store.canManageRestrictedSecrets,
    (canManage) => {
      if (canManage) {
        return
      }

      teamSecretVisibility.value = 'team'
      collectionSecretVisibility.value = 'team'
      selectedCollectionSecretVisibility.value = 'team'
    },
    { immediate: true },
  )
  
  watch(
    [() => store.requestsInWorkspace.map((requestItem) => requestItem.id), () => store.activeRequestId],
    ([requestIds, activeRequestId]) => {
      const requestIdSet = new Set(requestIds)
      const filteredTabIds = openRequestTabIds.value.filter((tabId) => requestIdSet.has(tabId))
  
      if (
        filteredTabIds.length !== openRequestTabIds.value.length ||
        filteredTabIds.some((tabId, index) => tabId !== openRequestTabIds.value[index])
      ) {
        openRequestTabIds.value = filteredTabIds
      }
  
      if (activeRequestId && requestIdSet.has(activeRequestId) && !openRequestTabIds.value.includes(activeRequestId)) {
        openRequestTabIds.value = [...openRequestTabIds.value, activeRequestId]
      }
    },
    { immediate: true },
  )

  watch(
    () => store.lastError,
    (message) => {
      if (!message) {
        return
      }

      showErrorToast(message)
    },
  )
  
  function closeContextMenu() {
    treeContextMenu.value.visible = false
  }
  
  function closeUserMenu() {
    showUserMenu.value = false
  }
  
  function closeFloatingMenus() {
    closeContextMenu()
    closeUserMenu()
  }
  
  function clampContextMenuPosition(clientX: number, clientY: number) {
    const menuWidth = 220
    const menuHeight = 220
    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight
  
    const x = Math.min(clientX, Math.max(12, viewportWidth - menuWidth - 12))
    const y = Math.min(clientY, Math.max(12, viewportHeight - menuHeight - 12))
  
    return { x: Math.max(12, x), y: Math.max(12, y) }
  }
  
  function openCollectionContextMenu(event: MouseEvent, collectionId: string) {
    event.preventDefault()
    event.stopPropagation()
    closeUserMenu()
  
    const { x, y } = clampContextMenuPosition(event.clientX, event.clientY)
    treeContextMenu.value = {
      visible: true,
      x,
      y,
      type: 'collection',
      collectionId,
      requestId: null,
    }
  }
  
  function openRequestContextMenu(event: MouseEvent, requestId: string, collectionId: string) {
    event.preventDefault()
    event.stopPropagation()
    closeUserMenu()
  
    const { x, y } = clampContextMenuPosition(event.clientX, event.clientY)
    treeContextMenu.value = {
      visible: true,
      x,
      y,
      type: 'request',
      collectionId,
      requestId,
    }
  }
  
  function handleGlobalKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      closeFloatingMenus()
    }
  }
  
  function methodTagClass(method: string) {
    return resolveMethodTagClass(method)
  }
  
  function isCollectionExpanded(collectionId: string) {
    return expandedCollections.value[collectionId] ?? true
  }
  
  function toggleCollection(collectionId: string) {
    expandedCollections.value = {
      ...expandedCollections.value,
      [collectionId]: !isCollectionExpanded(collectionId),
    }
  }
  
  function toggleSidebar() {
    sidebarCollapsed.value = !sidebarCollapsed.value
  }
  
  function toggleUserMenu(event: MouseEvent) {
    event.stopPropagation()
    closeContextMenu()
    showUserMenu.value = !showUserMenu.value
  }
  
  function openMainPage(page: 'workspace' | 'user' | 'settings') {
    if (page === 'user') {
      showUserDialog.value = true
      showUserMenu.value = false
      return
    }

    activeMainPage.value = page
    showUserMenu.value = false
  }

  function closeUserDialog() {
    showUserDialog.value = false
  }

  function handleSelectWorkspaceFromUserMenu(workspaceId: string) {
    const normalizedWorkspaceId = workspaceId.trim()

    if (!normalizedWorkspaceId) {
      return
    }

    const workspaceExists = store.workspaces.some((workspaceItem) => workspaceItem.id === normalizedWorkspaceId)

    if (!workspaceExists) {
      return
    }

    store.selectedWorkspaceId = normalizedWorkspaceId
    activeMainPage.value = 'workspace'
    showUserMenu.value = false
  }

  function openWorkspaceSettingsFromUserMenu() {
    activeMainPage.value = 'settings'
    settingsPageTab.value = 'workspace'
    showUserMenu.value = false
  }
  
  function handleThemeFromUserMenu(nextTheme: ThemePreference) {
    setTheme(nextTheme)
  }

  function handleDarkThemeFromUserMenu(nextDarkTheme: DarkThemeVariant) {
    setDarkThemeVariant(nextDarkTheme)
  }

  function handleAccentColorFromUserMenu(nextAccentColor: AccentColor) {
    setAccentColor(nextAccentColor)
  }
  
  async function handleUserMenuAuthAction() {
    if (store.user) {
      await store.logout()
      showUserMenu.value = false
      return
    }
  
    await store.loginWithGoogle()
    showUserMenu.value = false
  }

  async function handleDeleteOwnAccount() {
    if (!store.user) {
      return
    }

    const confirmed = window.confirm('Eliminare definitivamente il tuo account? Verrai scollegato.')
    if (!confirmed) {
      return
    }

    await store.deleteOwnAccount()
    showUserDialog.value = false
    showUserMenu.value = false
  }
  
  async function handleCreateTeam() {
    await store.createTeam(newTeamName.value)
    newTeamName.value = ''
  }
  
  async function handleInviteMember() {
    if (!inviteTeamId.value) {
      return
    }
  
    await store.inviteToTeam(inviteTeamId.value, inviteEmail.value)
    inviteEmail.value = ''
  }

  function formatTeamInviteExpiresAt(expiresAtIso: string) {
    const date = new Date(expiresAtIso)

    if (Number.isNaN(date.getTime())) {
      return expiresAtIso
    }

    return date.toLocaleString('it-IT')
  }

  async function handleAcceptTeamInvite(inviteId: string) {
    await store.acceptTeamInvite(inviteId)
  }

  async function handleDeclineTeamInvite(inviteId: string) {
    await store.declineTeamInvite(inviteId)
  }
  
  async function handleCreateWorkspace() {
    await store.createWorkspace(newWorkspaceName.value, newWorkspaceTeamId.value || null)
    newWorkspaceName.value = ''
    newWorkspaceTeamId.value = ''
  }

  async function handleDeleteWorkspace(workspaceId?: string) {
    const targetWorkspaceId = (workspaceId ?? store.selectedWorkspaceId ?? '').trim()

    if (!targetWorkspaceId) {
      return
    }

    const workspaceItem = store.workspaces.find((item) => item.id === targetWorkspaceId)
    if (!workspaceItem) {
      return
    }

    const confirmed = window.confirm(
      `Eliminare workspace "${workspaceItem.name}" e tutti i dati collegati (collection, request, segreti)?`,
    )

    if (!confirmed) {
      return
    }

    await store.deleteWorkspace(targetWorkspaceId)
  }
  
  async function handleCreateCollection() {
    const createdCollectionId = await store.createCollection(newCollectionName.value)
    if (createdCollectionId) {
      selectCollectionFromTree(createdCollectionId)
    }
  
    newCollectionName.value = ''
  }
  
  async function handleSaveTeamSecret() {
    if (!store.activeWorkspaceTeamId) {
      return
    }
  
    await store.upsertTeamSecret(
      store.activeWorkspaceTeamId,
      teamSecretKey.value,
      teamSecretValue.value,
      teamSecretVisibility.value,
    )
    teamSecretKey.value = ''
    teamSecretValue.value = ''
  }
  
  async function handleDeleteTeamSecret(secretId: string) {
    if (!store.activeWorkspaceTeamId) {
      return
    }
  
    await store.deleteTeamSecret(store.activeWorkspaceTeamId, secretId)
  }
  
  async function handleSaveCollectionSecret() {
    if (!selectedCollectionSecretsId.value) {
      return
    }
  
    await store.upsertCollectionSecret(
      selectedCollectionSecretsId.value,
      collectionSecretKey.value,
      collectionSecretValue.value,
      collectionSecretVisibility.value,
    )
    collectionSecretKey.value = ''
    collectionSecretValue.value = ''
  }
  
  async function handleDeleteCollectionSecret(secretId: string) {
    await store.deleteCollectionSecret(secretId)
  }

  async function handleSaveSelectedCollectionBaseUrl() {
    if (!selectedCollection.value) {
      return
    }

    const collectionId = selectedCollection.value.id
    const normalizedBaseUrl = collectionBaseUrlDraft.value.trim()
    const matchingSecrets = store.collectionSecretsInWorkspace.filter((secret) => secret.collectionId === collectionId)
    const baseSecrets = matchingSecrets.filter((secret) => {
      const normalizedKey = secret.key.trim().toUpperCase()
      return normalizedKey === 'BASE_URL' || normalizedKey === 'BASE'
    })

    if (!normalizedBaseUrl) {
      for (const secret of baseSecrets) {
        await store.deleteCollectionSecret(secret.id)
      }
      return
    }

    await store.upsertCollectionSecret(collectionId, 'BASE_URL', normalizedBaseUrl, 'team')

    for (const secret of baseSecrets) {
      if (secret.key.trim().toUpperCase() === 'BASE_URL') {
        continue
      }

      await store.deleteCollectionSecret(secret.id)
    }
  }
  
  async function handleCreateRequest(collectionId?: string) {
    let finalCollectionId = collectionId || store.collectionsInWorkspace[0]?.id
  
    if (!finalCollectionId) {
      finalCollectionId = (await store.createCollection('Default Collection')) || store.collectionsInWorkspace[0]?.id
    }
  
    if (!finalCollectionId) {
      return
    }
  
    await store.createRequest({
      collectionId: finalCollectionId,
      method: 'GET',
      name: 'New Request',
      url: '',
      body: '',
      bodyMode: 'none',
      bodyContentType: '',
      formFields: [],
      headers: [],
    })
  
    if (store.activeRequestId) {
      selectRequestFromTree(store.activeRequestId)
    }
  }
  
  async function handleCreateQuickRequest() {
    await store.createQuickRequest()
  
    if (store.activeRequestId) {
      selectRequestFromTree(store.activeRequestId)
    }
  }
  
  async function handleSaveSelectedCollectionName() {
    if (!selectedCollection.value) {
      return
    }
  
    const nextName = selectedCollectionNameDraft.value.trim()
    if (!nextName) {
      return
    }
  
    await store.renameCollection(selectedCollection.value.id, nextName)
  }
  
  async function handleDeleteSelectedCollection() {
    if (!selectedCollection.value) {
      return
    }
  
    const confirmed = window.confirm(
      `Eliminare la collection \"${selectedCollection.value.name}\" e tutte le richieste collegate?`,
    )
  
    if (!confirmed) {
      return
    }
  
    await store.deleteCollection(selectedCollection.value.id)
  }
  
  async function handleSaveSelectedCollectionSecret() {
    if (!selectedCollection.value) {
      return
    }
  
    await store.upsertCollectionSecret(
      selectedCollection.value.id,
      collectionSecretKey.value,
      collectionSecretValue.value,
      selectedCollectionSecretVisibility.value,
    )
    collectionSecretKey.value = ''
    collectionSecretValue.value = ''
  }
  
  async function handleSaveRequest() {
    if (!store.activeRequest) {
      return
    }
  
    await store.saveRequest(store.activeRequest)
  }

  function triggerOpenApiImport() {
    if (!openApiInputRef.value) {
      store.lastError = 'Import OpenAPI non disponibile. Ricarica l’app.'
      return
    }

    store.lastError = null
    openApiInputRef.value.click()
  }
  
  async function handleOpenApiImport(event: Event) {
    const input = event.target as HTMLInputElement
    const selectedFile = input.files?.[0]
  
    if (!selectedFile) {
      return
    }
  
    try {
      const rawText = await selectedFile.text()
      const targetCollectionId = resolveMenuCollectionId()
      await store.importOpenApi(rawText, targetCollectionId ?? undefined)
  
      if (store.activeRequestId) {
        selectRequestFromTree(store.activeRequestId)
      }
    } catch (error) {
      store.lastError = error instanceof Error ? error.message : 'Errore durante import OpenAPI.'
    } finally {
      input.value = ''
    }
  }
  
  function resolveMenuCollectionId() {
    if (selectedCollection.value?.id) {
      return selectedCollection.value.id
    }
  
    if (treeSelection.value.type === 'collection' && treeSelection.value.collectionId) {
      return treeSelection.value.collectionId
    }
  
    if (store.activeRequest?.collectionId) {
      return store.activeRequest.collectionId
    }
  
    return store.collectionsInWorkspace[0]?.id ?? null
  }
  
  async function handleMenuCreateCollection() {
    const createdCollectionId = await store.createCollection('New Collection')
  
    if (createdCollectionId) {
      selectCollectionFromTree(createdCollectionId)
    }
  }
  
  async function handleMenuCreateWorkspace() {
    await store.createWorkspace('New Workspace', null)
    activeMainPage.value = 'settings'
    settingsPageTab.value = 'workspace'
  }
  
  async function handleMenuDuplicateRequest() {
    if (!store.activeRequestId) {
      return
    }
  
    await store.duplicateRequest(store.activeRequestId)
  
    if (store.activeRequestId) {
      selectRequestFromTree(store.activeRequestId)
    }
  }
  
  async function handleMenuDeleteRequest() {
    if (!store.activeRequest) {
      return
    }
  
    const confirmed = window.confirm(`Eliminare la request \"${store.activeRequest.name}\"?`)
  
    if (!confirmed) {
      return
    }
  
    await store.deleteRequest(store.activeRequest.id)
  }
  
  async function handleMenuRenameSelectedCollection() {
    const collectionId = resolveMenuCollectionId()
  
    if (!collectionId) {
      return
    }
  
    const currentCollection = store.collectionsInWorkspace.find((collectionItem) => collectionItem.id === collectionId)
  
    if (!currentCollection) {
      return
    }
  
    const nextName = window.prompt('Nuovo nome collection', currentCollection.name)
  
    if (!nextName?.trim()) {
      return
    }
  
    await store.renameCollection(currentCollection.id, nextName.trim())
  }
  
  async function handleMenuDeleteSelectedCollection() {
    const collectionId = resolveMenuCollectionId()
  
    if (!collectionId) {
      return
    }
  
    const currentCollection = store.collectionsInWorkspace.find((collectionItem) => collectionItem.id === collectionId)
  
    if (!currentCollection) {
      return
    }
  
    const confirmed = window.confirm(
      `Eliminare la collection \"${currentCollection.name}\" e tutte le richieste collegate?`,
    )
  
    if (!confirmed) {
      return
    }
  
    await store.deleteCollection(currentCollection.id)
  }
  
  async function handleElectronMenuAction(actionId: MenuActionId) {
    if (actionId === 'new-request') {
      await handleCreateRequest()
      return
    }
  
    if (actionId === 'new-quick-request') {
      await handleCreateQuickRequest()
      return
    }
  
    if (actionId === 'new-request-in-selected-collection') {
      const collectionId = resolveMenuCollectionId()
      await handleCreateRequest(collectionId ?? undefined)
      return
    }
  
    if (actionId === 'new-collection') {
      await handleMenuCreateCollection()
      return
    }
  
    if (actionId === 'new-workspace') {
      await handleMenuCreateWorkspace()
      return
    }
  
    if (actionId === 'import-openapi') {
      triggerOpenApiImport()
      return
    }
  
    if (actionId === 'save-request') {
      await handleSaveRequest()
      return
    }
  
    if (actionId === 'send-request') {
      await store.sendActiveRequest()
      return
    }
  
    if (actionId === 'duplicate-request') {
      await handleMenuDuplicateRequest()
      return
    }
  
    if (actionId === 'delete-request') {
      await handleMenuDeleteRequest()
      return
    }
  
    if (actionId === 'rename-selected-collection') {
      await handleMenuRenameSelectedCollection()
      return
    }
  
    if (actionId === 'delete-selected-collection') {
      await handleMenuDeleteSelectedCollection()
      return
    }
  
    if (actionId === 'open-workspace-page') {
      openMainPage('workspace')
      return
    }
  
    if (actionId === 'open-user-page') {
      openMainPage('user')
      return
    }
  
    if (actionId === 'open-settings-page') {
      openMainPage('settings')
      return
    }
  
    if (actionId === 'toggle-sidebar') {
      toggleSidebar()
      return
    }
  
    if (actionId === 'set-theme-system') {
      handleThemeFromUserMenu('system')
      return
    }
  
    if (actionId === 'set-theme-light') {
      handleThemeFromUserMenu('light')
      return
    }
  
    if (actionId === 'set-theme-dark') {
      handleThemeFromUserMenu('dark')
      return
    }
  
    if (actionId === 'toggle-auth') {
      await handleUserMenuAuthAction()
    }
  }
  
  function setActiveHeader(index: number, keyOrValue: 'key' | 'value', nextValue: string) {
    store.setActiveHeader(index, keyOrValue, nextValue)
  }
  
  async function handleContextCreateRequest() {
    if (treeContextMenu.value.type !== 'collection' || !treeContextMenu.value.collectionId) {
      return
    }
  
    await handleCreateRequest(treeContextMenu.value.collectionId)
    closeContextMenu()
  }
  
  async function handleContextRenameCollection() {
    if (treeContextMenu.value.type !== 'collection' || !contextCollection.value) {
      return
    }
  
    const nextName = window.prompt('Nuovo nome collection', contextCollection.value.name)
    if (!nextName?.trim()) {
      return
    }
  
    await store.renameCollection(contextCollection.value.id, nextName.trim())
    closeContextMenu()
  }
  
  async function handleContextDeleteCollection() {
    if (treeContextMenu.value.type !== 'collection' || !contextCollection.value) {
      return
    }
  
    const confirmed = window.confirm(
      `Eliminare la collection \"${contextCollection.value.name}\" e tutte le richieste collegate?`,
    )
  
    if (!confirmed) {
      return
    }
  
    await store.deleteCollection(contextCollection.value.id)
    closeContextMenu()
  }
  
  async function handleContextRenameRequest() {
    if (treeContextMenu.value.type !== 'request' || !contextRequest.value) {
      return
    }
  
    const nextName = window.prompt('Nuovo nome request', contextRequest.value.name)
    if (!nextName?.trim()) {
      return
    }
  
    await store.saveRequest({
      ...contextRequest.value,
      name: nextName.trim(),
    })
    closeContextMenu()
  }
  
  async function handleContextDuplicateRequest() {
    if (treeContextMenu.value.type !== 'request' || !contextRequest.value) {
      return
    }
  
    await store.duplicateRequest(contextRequest.value.id)
  
    if (store.activeRequestId) {
      selectRequestFromTree(store.activeRequestId)
    }
  
    closeContextMenu()
  }
  
  async function handleContextSendRequest() {
    if (treeContextMenu.value.type !== 'request' || !contextRequest.value) {
      return
    }
  
    selectRequestFromTree(contextRequest.value.id)
    await nextTick()
    await store.sendActiveRequest()
    closeContextMenu()
  }
  
  async function handleContextDeleteRequest() {
    if (treeContextMenu.value.type !== 'request' || !contextRequest.value) {
      return
    }
  
    const confirmed = window.confirm(`Eliminare la request \"${contextRequest.value.name}\"?`)
    if (!confirmed) {
      return
    }
  
    await store.deleteRequest(contextRequest.value.id)
    closeContextMenu()
  }

  return {
    store,
    sidebarCollapsed,
    showUserMenu,
    showUserDialog,
    activeEditorTab,
    userPageTab,
    settingsPageTab,
    collectionSettingsTab,
    expandedCollections,
    activeMainPage,
    openRequestTabIds,
    draggedCollectionId,
    dragOverCollectionId,
    dragOverCollectionPosition,
    draggedRequestId,
    draggedRequestSourceCollectionId,
    dragOverRequestCollectionId,
    treeContextMenu,
    treeSelection,
    newTeamName,
    inviteEmail,
    inviteTeamId,
    newWorkspaceName,
    newWorkspaceTeamId,
    newCollectionName,
    selectedCollectionNameDraft,
    collectionBaseUrlDraft,
    teamSecretKey,
    teamSecretValue,
    teamSecretVisibility,
    collectionSecretKey,
    collectionSecretValue,
    collectionSecretVisibility,
    selectedCollectionSecretVisibility,
    selectedCollectionSecretsId,
    openApiInputRef,
    bodyFileInputRef,
    methodOptions,
    themeOptions,
    lightThemeOptions,
    darkThemeOptions,
    accentColorOptions,
    editorTabs,
    authTypeOptions,
    authApiKeyInOptions,
    bodyModeOptions,
    bodyContentTypeOptions,
    userTabs,
    settingsTabs,
    collectionTabs,
    responseViewerTabs,
    responseSectionTabs,
    transportOptions,
    secretVisibilityOptions,
    selectedTheme,
    selectedLightTheme,
    selectedDarkTheme,
    selectedAccentColor,
    selectedTransport,
    workspaceOptions,
    teamOptions,
    inviteTeamOptions,
    collectionSecretOptions,
    collectionSecretsForSelectedCollection,
    requestsGroupedByCollection,
    contextCollection,
    contextRequest,
    selectedCollection,
    requestsForSelectedCollection,
    secretsForSelectedCollection,
    openRequestTabs,
    activeRequestSecretTokens,
    activeMethod,
    activeUrl,
    applySecretTokenAsBaseUrl,
    activeName,
    activeDescription,
    activeBody,
    activeBodyMode,
    activeBodyContentType,
    activeFormFields,
    activeBodyFile,
    resolvedBodyEditorMode,
    activeAuthType,
    activeAuthBearerToken,
    activeAuthOauth2AccessToken,
    activeAuthJwtToken,
    activeAuthBasicUsername,
    activeAuthBasicPassword,
    activeAuthApiKeyName,
    activeAuthApiKeyValue,
    activeAuthApiKeyIn,
    activeAuthAwsAccessKeyId,
    activeAuthAwsSecretAccessKey,
    activeAuthAwsSessionToken,
    activeAuthAwsRegion,
    activeAuthAwsService,
    activeAuthHawkId,
    activeAuthHawkKey,
    activeAuthHawkAlgorithm,
    responseViewerMode,
    responseSectionTab,
    responseContentType,
    responseSizeBytes,
    parsedResponseJson,
    formattedResponseJson,
    formatBytes,
    saveResponseBody,
    selectCollectionFromTree,
    selectRequestFromTree,
    openRequestTab,
    closeRequestTab,
    handleCollectionDragStart,
    handleRequestDragStart,
    handleCollectionDragOver,
    handleCollectionDrop,
    handleCollectionDragEnd,
    handleRequestDragEnd,
    closeContextMenu,
    closeUserMenu,
    closeFloatingMenus,
    openCollectionContextMenu,
    openRequestContextMenu,
    methodTagClass,
    isCollectionExpanded,
    toggleCollection,
    toggleSidebar,
    toggleUserMenu,
    openMainPage,
    closeUserDialog,
    handleSelectWorkspaceFromUserMenu,
    openWorkspaceSettingsFromUserMenu,
    handleThemeFromUserMenu,
    handleDarkThemeFromUserMenu,
    handleAccentColorFromUserMenu,
    handleUserMenuAuthAction,
    handleDeleteOwnAccount,
    handleCreateTeam,
    handleInviteMember,
    handleAcceptTeamInvite,
    handleDeclineTeamInvite,
    formatTeamInviteExpiresAt,
    handleCreateWorkspace,
    handleDeleteWorkspace,
    handleCreateCollection,
    handleSaveTeamSecret,
    handleDeleteTeamSecret,
    handleSaveCollectionSecret,
    handleDeleteCollectionSecret,
    handleSaveSelectedCollectionBaseUrl,
    handleCreateRequest,
    handleCreateQuickRequest,
    handleSaveSelectedCollectionName,
    handleDeleteSelectedCollection,
    handleSaveSelectedCollectionSecret,
    handleSaveRequest,
    triggerOpenApiImport,
    handleOpenApiImport,
    handleElectronMenuAction,
    setActiveHeader,
    addFormFieldToActiveRequest,
    removeFormFieldFromActiveRequest,
    setActiveFormField,
    triggerBodyFilePicker,
    handleBodyFileSelected,
    clearActiveBodyFile,
    handleContextCreateRequest,
    handleContextRenameCollection,
    handleContextDeleteCollection,
    handleContextRenameRequest,
    handleContextDuplicateRequest,
    handleContextSendRequest,
    handleContextDeleteRequest,
  }
}

export type AppController = ReturnType<typeof useAppController>
