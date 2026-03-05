import type { User } from 'firebase/auth'
import {
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
} from 'firebase/firestore'
import { deleteUser, onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth'
import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'

import { auth, db, firebaseAuthDomain, firebaseProjectId, googleProvider, hasFirebaseConfig } from '@/lib/firebase'
import type {
  ApiRequest,
  RequestAuth,
  RequestBodyMode,
  TeamInvite,
  TeamInviteStatus,
  HttpMethod,
  HttpResponse,
  CollectionSecret,
  RequestCollection,
  RequestTransportMode,
  Team,
  TeamSecret,
  Workspace,
} from '@/types/domain'
import { loadLocalSnapshot, saveLocalSnapshot } from '@/utils/localStore'
import { parseOpenApiJson } from '@/utils/openapi'

import {
  COLLECTION_BASE_URL_SECRET_KEYS,
  DEFAULT_REQUEST_BODY,
  REQUEST_TIMEOUT_MS,
  base64ToBytes,
  buildInviteEmailCandidates,
  bytesToBase64,
  compareCollectionsByOrder,
  createDefaultAuth,
  defaultContentTypeForBodyMode,
  extractTemplateKeys,
  generateId,
  getFirebaseErrorCode,
  getHeaderValue,
  getNextCollectionSortOrder,
  inferBodyModeFromLegacy,
  interpolateTemplate,
  isFirestorePermissionDenied,
  normalizeBodyMode,
  normalizeCollection,
  normalizeRequest,
  normalizeRequestAuth,
  resolveAutoBodyMode,
  toIsoDate,
  toStoreErrorMessage,
} from '@/stores/app-store/core-helpers'
import {
  applyAuthToRequest,
  buildMultipartBody,
  buildUrlEncodedBody,
  getHeaderCaseInsensitive,
  getUnsupportedAuthMessage,
  normalizeHttpRequestUrl,
  normalizeRequestExecutionErrorMessage,
  prettifyResponseBody,
  removeHeaderCaseInsensitive,
} from '@/stores/app-store/request-utils'

interface RequestBodyFilePayload {
  base64: string
  name: string
  contentType: string
  size: number
}

type RequestSendBody =
  | {
      kind: 'text'
      value: string
    }
  | {
      kind: 'binary-base64'
      value: string
    }

export const useAppStore = defineStore('app', () => {
  const user = ref<User | null>(null)
  const teams = ref<Team[]>([])
  const teamInvites = ref<TeamInvite[]>([])
  const teamSecrets = ref<TeamSecret[]>([])
  const workspaces = ref<Workspace[]>([])
  const collections = ref<RequestCollection[]>([])
  const collectionSecrets = ref<CollectionSecret[]>([])
  const requests = ref<ApiRequest[]>([])
  const requestBodyFilesByRequestId = ref<Record<string, RequestBodyFilePayload>>({})

  const selectedWorkspaceId = ref<string | null>(null)
  const activeRequestId = ref<string | null>(null)
  const responsesByRequestId = ref<Record<string, HttpResponse>>({})
  const response = computed<HttpResponse | null>(() => {
    const requestId = activeRequestId.value

    if (!requestId) {
      return null
    }

    return responsesByRequestId.value[requestId] ?? null
  })
  const requestTransport = ref<RequestTransportMode>('browser')

  const statusMessage = ref('')
  const lastError = ref<string | null>(null)
  const isLoading = ref(false)
  const localSnapshotHydrated = ref(false)

  const initialized = ref(false)

  let authUnsubscribe: (() => void) | null = null
  let teamsUnsubscribe: (() => void) | null = null
  let teamInvitesUnsubscribe: (() => void) | null = null
  let teamSecretsUnsubscribe: (() => void) | null = null
  let workspacesUnsubscribe: (() => void) | null = null
  const workspaceUnsubscribers: Array<() => void> = []
  let remoteWorkspaceBootstrapInFlight = false
  let remoteWorkspaceBootstrapAttemptedForUserId: string | null = null

  const isFirebaseReady = computed(() => hasFirebaseConfig && Boolean(auth) && Boolean(db))
  const isRemoteMode = computed(() => isFirebaseReady.value && Boolean(user.value))
  const canUseNativeTransport = computed(() =>
    typeof window !== 'undefined' && Boolean(window.requestmakerElectron?.isElectron),
  )

  const activeWorkspace = computed(() => workspaces.value.find((workspace) => workspace.id === selectedWorkspaceId.value) ?? null)
  const activeWorkspaceTeamId = computed(() => activeWorkspace.value?.teamId ?? null)
  const activeWorkspaceTeam = computed(() =>
    activeWorkspaceTeamId.value ? teams.value.find((team) => team.id === activeWorkspaceTeamId.value) ?? null : null,
  )
  const collectionsInWorkspace = computed(() =>
    collections.value
      .filter((collectionItem) => collectionItem.workspaceId === selectedWorkspaceId.value)
      .slice()
      .sort(compareCollectionsByOrder),
  )
  const requestsInWorkspace = computed(() =>
    requests.value.filter((requestItem) => requestItem.workspaceId === selectedWorkspaceId.value),
  )
  const activeRequest = computed(() => requests.value.find((requestItem) => requestItem.id === activeRequestId.value) ?? null)
  const activeRequestBodyFile = computed<RequestBodyFilePayload | null>(() => {
    const requestId = activeRequest.value?.id

    if (!requestId) {
      return null
    }

    return requestBodyFilesByRequestId.value[requestId] ?? null
  })
  const teamSecretsInActiveTeam = computed(() =>
    activeWorkspaceTeamId.value ? teamSecrets.value.filter((secret) => secret.teamId === activeWorkspaceTeamId.value) : [],
  )
  const pendingTeamInvites = computed(() => {
    const now = Date.now()

    return teamInvites.value
      .filter((inviteItem) => inviteItem.status === 'pending' && new Date(inviteItem.expiresAt).getTime() > now)
      .slice()
      .sort((left, right) => left.expiresAt.localeCompare(right.expiresAt))
  })
  const collectionSecretsInWorkspace = computed(() =>
    collectionSecrets.value.filter((secret) => secret.workspaceId === selectedWorkspaceId.value),
  )
  const isActiveWorkspaceOwner = computed(() => {
    if (!isRemoteMode.value) {
      return true
    }

    if (!user.value) {
      return false
    }

    return activeWorkspace.value?.ownerId === user.value.uid
  })
  const isActiveTeamOwner = computed(() => {
    if (!isRemoteMode.value) {
      return true
    }

    if (!user.value) {
      return false
    }

    return activeWorkspaceTeam.value?.ownerId === user.value.uid
  })
  const canManageRestrictedSecrets = computed(() => isActiveWorkspaceOwner.value || isActiveTeamOwner.value)

  function setStatus(message: string) {
    statusMessage.value = message
  }

  function setError(message: string | null) {
    lastError.value = message
  }

  function buildTeamInviteId(teamId: string, emailNormalized: string) {
    return `${teamId}__${emailNormalized}`
  }

  function normalizeTeamInviteStatus(value: unknown): TeamInviteStatus {
    const normalized = String(value ?? 'pending')

    if (
      normalized === 'pending' ||
      normalized === 'accepted' ||
      normalized === 'declined' ||
      normalized === 'expired' ||
      normalized === 'revoked'
    ) {
      return normalized
    }

    return 'pending'
  }

  function normalizeTeamInvite(value: unknown): TeamInvite {
    const data = value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
    const now = new Date().toISOString()

    return {
      id: String(data.id ?? generateId()),
      teamId: String(data.teamId ?? ''),
      teamName: String(data.teamName ?? 'Team'),
      invitedEmail: String(data.invitedEmail ?? ''),
      invitedEmailNormalized: String(data.invitedEmailNormalized ?? ''),
      invitedByUid: String(data.invitedByUid ?? ''),
      invitedByEmail: String(data.invitedByEmail ?? ''),
      status: normalizeTeamInviteStatus(data.status),
      expiresAt: toIsoDate(data.expiresAt ?? now),
      createdAt: toIsoDate(data.createdAt ?? now),
      updatedAt: toIsoDate(data.updatedAt ?? now),
      acceptedAt: data.acceptedAt ? toIsoDate(data.acceptedAt) : undefined,
      declinedAt: data.declinedAt ? toIsoDate(data.declinedAt) : undefined,
    }
  }

  function isInviteExpired(inviteItem: TeamInvite) {
    return new Date(inviteItem.expiresAt).getTime() <= Date.now()
  }

  function handleRemoteListenerError(scope: string, error: unknown) {
    if (isFirestorePermissionDenied(error)) {
      setError(`Permessi Firestore insufficienti per "${scope}". Verifica le Rules pubblicate.`)
      return
    }

    setError(toStoreErrorMessage(error, `Errore sincronizzazione Firebase (${scope}).`))
  }

  function setRequestTransport(nextMode: RequestTransportMode) {
    if ((nextMode === 'electron' || nextMode === 'curl') && !canUseNativeTransport.value) {
      requestTransport.value = 'browser'
      return
    }

    requestTransport.value = nextMode
  }

  function clearResponseCache() {
    responsesByRequestId.value = {}
  }

  function clearResponseForRequest(requestId: string) {
    if (!requestId || !Object.prototype.hasOwnProperty.call(responsesByRequestId.value, requestId)) {
      return
    }

    const nextCache = { ...responsesByRequestId.value }
    delete nextCache[requestId]
    responsesByRequestId.value = nextCache
  }

  function clearRequestBodyFile(requestId: string) {
    if (!requestId || !Object.prototype.hasOwnProperty.call(requestBodyFilesByRequestId.value, requestId)) {
      return
    }

    const nextFiles = { ...requestBodyFilesByRequestId.value }
    delete nextFiles[requestId]
    requestBodyFilesByRequestId.value = nextFiles
  }

  async function setActiveRequestBodyFile(file: File) {
    const current = activeRequest.value

    if (!current || !file) {
      return
    }

    const normalizedName = file.name.trim() || 'body.bin'
    const fileSize = Number.isFinite(file.size) && file.size > 0 ? Math.floor(file.size) : 0
    const contentType = file.type?.trim() || 'application/octet-stream'
    const fileBuffer = await file.arrayBuffer()
    const base64 = bytesToBase64(new Uint8Array(fileBuffer))

    requestBodyFilesByRequestId.value = {
      ...requestBodyFilesByRequestId.value,
      [current.id]: {
        base64,
        name: normalizedName,
        contentType,
        size: fileSize,
      },
    }

    upsertActiveRequestDraft({
      bodyMode: 'file',
      bodyFileName: normalizedName,
      bodyFileContentType: contentType,
      bodyFileSize: fileSize,
      bodyContentType: contentType,
    })
  }

  function clearActiveRequestBodyFile() {
    const current = activeRequest.value

    if (!current) {
      return
    }

    clearRequestBodyFile(current.id)

    upsertActiveRequestDraft({
      bodyFileName: '',
      bodyFileContentType: '',
      bodyFileSize: 0,
    })
  }

  function resolveWorkspaceIdForWrite(): string | null {
    const selectedId = selectedWorkspaceId.value?.trim() || null

    if (selectedId) {
      const hasLocalWorkspaces = workspaces.value.length > 0

      if (!hasLocalWorkspaces || workspaces.value.some((workspaceItem) => workspaceItem.id === selectedId)) {
        return selectedId
      }
    }

    const fallbackWorkspaceId = workspaces.value[0]?.id ?? null
    selectedWorkspaceId.value = fallbackWorkspaceId
    return fallbackWorkspaceId
  }

  function clearWorkspaceSubscriptions() {
    while (workspaceUnsubscribers.length > 0) {
      const unsubscribe = workspaceUnsubscribers.pop()
      unsubscribe?.()
    }
  }

  function stopRemoteSubscriptions() {
    clearWorkspaceSubscriptions()

    if (teamsUnsubscribe) {
      teamsUnsubscribe()
      teamsUnsubscribe = null
    }

    if (teamInvitesUnsubscribe) {
      teamInvitesUnsubscribe()
      teamInvitesUnsubscribe = null
    }

    if (teamSecretsUnsubscribe) {
      teamSecretsUnsubscribe()
      teamSecretsUnsubscribe = null
    }

    if (workspacesUnsubscribe) {
      workspacesUnsubscribe()
      workspacesUnsubscribe = null
    }
  }

  function persistLocal() {
    if (isRemoteMode.value) {
      return
    }

    if (!localSnapshotHydrated.value) {
      return
    }

    saveLocalSnapshot({
      teams: teams.value,
      teamSecrets: teamSecrets.value,
      workspaces: workspaces.value,
      collections: collections.value,
      collectionSecrets: collectionSecrets.value,
      requests: requests.value,
      selectedWorkspaceId: selectedWorkspaceId.value,
    })
  }

  function ensureLocalSeed() {
    if (workspaces.value.length > 0) {
      if (!selectedWorkspaceId.value) {
        selectedWorkspaceId.value = workspaces.value[0].id
      }
      return
    }

    const workspaceId = generateId()

    workspaces.value = [
      {
        id: workspaceId,
        name: 'Local Workspace',
        ownerId: 'local-user',
        teamId: null,
        memberIds: ['local-user'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ]

    selectedWorkspaceId.value = workspaceId

    const collectionId = generateId()
    const requestId = generateId()

    collections.value = [
      {
        id: collectionId,
        workspaceId,
        name: 'Starter Collection',
        sortOrder: 0,
        createdBy: 'local-user',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ]

    requests.value = [
      {
        id: requestId,
        workspaceId,
        collectionId,
        name: 'Example Request',
        method: 'GET',
        url: 'https://jsonplaceholder.typicode.com/todos/1',
        headers: [],
        body: '',
        bodyMode: 'none',
        bodyContentType: '',
        formFields: [],
        auth: createDefaultAuth(),
        description: 'Richiesta demo locale',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ]

    activeRequestId.value = requestId
    persistLocal()
  }

  function loadLocal() {
    const snapshot = loadLocalSnapshot()
    localSnapshotHydrated.value = true
    teams.value = snapshot.teams
    teamInvites.value = []
    teamSecrets.value = snapshot.teamSecrets.map((secret) => ({
      ...secret,
      visibility: secret.visibility === 'admin' ? 'admin' : 'team',
    }))
    workspaces.value = snapshot.workspaces
    const fallbackSortByWorkspace = new Map<string, number>()
    collections.value = snapshot.collections.map((collectionItem) => {
      const workspaceId = collectionItem.workspaceId
      const fallbackSortOrder = fallbackSortByWorkspace.get(workspaceId) ?? 0
      const normalizedCollection = normalizeCollection(collectionItem, undefined, fallbackSortOrder)
      const nextSort = Math.max(fallbackSortOrder + 1, normalizedCollection.sortOrder + 1)
      fallbackSortByWorkspace.set(workspaceId, nextSort)
      return normalizedCollection
    })
    collectionSecrets.value = snapshot.collectionSecrets.map((secret) => ({
      ...secret,
      visibility: secret.visibility === 'admin' ? 'admin' : 'team',
    }))
    requests.value = snapshot.requests.map((requestItem) => normalizeRequest(requestItem))
    selectedWorkspaceId.value = snapshot.selectedWorkspaceId
    clearResponseCache()

    ensureLocalSeed()

    if (!activeRequestId.value) {
      activeRequestId.value = requestsInWorkspace.value[0]?.id ?? requests.value[0]?.id ?? null
    }

    setStatus('Modalita locale attiva')
  }

  async function ensureUserProfile(currentUser: User) {
    if (!db) {
      return
    }

    const email = currentUser.email ?? ''

    await setDoc(
      doc(db, 'users', currentUser.uid),
      {
        email,
        emailNormalized: email.toLowerCase(),
        displayName: currentUser.displayName ?? '',
        photoURL: currentUser.photoURL ?? '',
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    )
  }

  function subscribeTeamInvites() {
    if (teamInvitesUnsubscribe) {
      teamInvitesUnsubscribe()
      teamInvitesUnsubscribe = null
    }

    if (!db || !user.value?.email) {
      teamInvites.value = []
      return
    }

    const normalizedEmail = user.value.email.trim().toLowerCase()

    if (!normalizedEmail) {
      teamInvites.value = []
      return
    }

    const teamInvitesQuery = query(collection(db, 'teamInvites'), where('invitedEmailNormalized', '==', normalizedEmail))
    teamInvitesUnsubscribe = onSnapshot(
      teamInvitesQuery,
      (snapshot) => {
        teamInvites.value = snapshot.docs.map((inviteDoc) =>
          normalizeTeamInvite({
            id: inviteDoc.id,
            ...(inviteDoc.data() as Record<string, unknown>),
          }),
        )
      },
      (error) => handleRemoteListenerError('team-invites', error),
    )
  }

  function subscribeRemoteData() {
    if (!db || !user.value) {
      return
    }

    stopRemoteSubscriptions()
    subscribeTeamInvites()

    const teamsQuery = query(collection(db, 'teams'), where('memberIds', 'array-contains', user.value.uid))
    teamsUnsubscribe = onSnapshot(
      teamsQuery,
      (snapshot) => {
        teams.value = snapshot.docs.map((teamDoc) => {
          const data = teamDoc.data() as Record<string, unknown>

          return {
            id: teamDoc.id,
            name: String(data.name ?? 'Untitled Team'),
            ownerId: String(data.ownerId ?? ''),
            memberIds: Array.isArray(data.memberIds) ? (data.memberIds as string[]) : [],
            createdAt: toIsoDate(data.createdAt),
            updatedAt: toIsoDate(data.updatedAt),
          }
        })
      },
      (error) => handleRemoteListenerError('teams', error),
    )

    const workspacesQuery = query(collection(db, 'workspaces'), where('memberIds', 'array-contains', user.value.uid))
    workspacesUnsubscribe = onSnapshot(
      workspacesQuery,
      (snapshot) => {
        workspaces.value = snapshot.docs.map((workspaceDoc) => {
          const data = workspaceDoc.data() as Record<string, unknown>

          return {
            id: workspaceDoc.id,
            name: String(data.name ?? 'Untitled Workspace'),
            ownerId: String(data.ownerId ?? ''),
            teamId: typeof data.teamId === 'string' ? data.teamId : null,
            memberIds: Array.isArray(data.memberIds) ? (data.memberIds as string[]) : [],
            createdAt: toIsoDate(data.createdAt),
            updatedAt: toIsoDate(data.updatedAt),
          }
        })

        const currentWorkspaceStillVisible = selectedWorkspaceId.value
          ? workspaces.value.some((workspaceItem) => workspaceItem.id === selectedWorkspaceId.value)
          : false

        if (!currentWorkspaceStillVisible) {
          selectedWorkspaceId.value = workspaces.value[0]?.id ?? null
        }

        if (workspaces.value.length > 0) {
          remoteWorkspaceBootstrapAttemptedForUserId = null
          return
        }

        const currentUserId = user.value?.uid ?? null
        if (!currentUserId || remoteWorkspaceBootstrapInFlight) {
          return
        }

        if (remoteWorkspaceBootstrapAttemptedForUserId === currentUserId) {
          return
        }

        remoteWorkspaceBootstrapAttemptedForUserId = currentUserId
        remoteWorkspaceBootstrapInFlight = true

        void createWorkspace('Default Workspace')
          .then((createdWorkspaceId) => {
            if (createdWorkspaceId) {
              setStatus('Workspace predefinito creato')
            }
          })
          .finally(() => {
            remoteWorkspaceBootstrapInFlight = false
          })
      },
      (error) => handleRemoteListenerError('workspaces', error),
    )
  }

  function subscribeTeamSecrets(teamId: string | null) {
    if (teamSecretsUnsubscribe) {
      teamSecretsUnsubscribe()
      teamSecretsUnsubscribe = null
    }

    if (!db || !teamId) {
      teamSecrets.value = []
      return
    }

    const teamSecretsRef = collection(db, 'teams', teamId, 'secrets')
    const teamSecretsSource = canManageRestrictedSecrets.value
      ? teamSecretsRef
      : query(teamSecretsRef, where('visibility', '==', 'team'))
    teamSecretsUnsubscribe = onSnapshot(
      teamSecretsSource,
      (snapshot) => {
        teamSecrets.value = snapshot.docs.map((secretDoc) => {
          const data = secretDoc.data() as Record<string, unknown>

          return {
            id: secretDoc.id,
            teamId,
            key: String(data.key ?? ''),
            value: String(data.value ?? ''),
            visibility: data.visibility === 'admin' ? 'admin' : 'team',
            createdBy: String(data.createdBy ?? ''),
            createdAt: toIsoDate(data.createdAt),
            updatedAt: toIsoDate(data.updatedAt),
          }
        })
      },
      (error) => handleRemoteListenerError('team-secrets', error),
    )
  }

  function subscribeWorkspaceContent(workspaceId: string) {
    if (!db) {
      return
    }

    clearWorkspaceSubscriptions()

    const collectionsRef = collection(db, 'workspaces', workspaceId, 'collections')
    const collectionSecretsRef = collection(db, 'workspaces', workspaceId, 'collectionSecrets')
    const requestsRef = collection(db, 'workspaces', workspaceId, 'requests')
    const collectionSecretsSource = canManageRestrictedSecrets.value
      ? collectionSecretsRef
      : query(collectionSecretsRef, where('visibility', '==', 'team'))

    workspaceUnsubscribers.push(
      onSnapshot(
        collectionsRef,
        (snapshot) => {
          collections.value = snapshot.docs.map((collectionDoc, index) =>
            normalizeCollection(
              {
                id: collectionDoc.id,
                workspaceId,
                ...(collectionDoc.data() as Record<string, unknown>),
              },
              workspaceId,
              index,
            ),
          )
        },
        (error) => handleRemoteListenerError('workspace-collections', error),
      ),
    )

    workspaceUnsubscribers.push(
      onSnapshot(
        collectionSecretsSource,
        (snapshot) => {
          collectionSecrets.value = snapshot.docs.map((secretDoc) => {
            const data = secretDoc.data() as Record<string, unknown>

            return {
              id: secretDoc.id,
              workspaceId,
              collectionId: String(data.collectionId ?? ''),
              key: String(data.key ?? ''),
              value: String(data.value ?? ''),
              visibility: data.visibility === 'admin' ? 'admin' : 'team',
              createdBy: String(data.createdBy ?? ''),
              createdAt: toIsoDate(data.createdAt),
              updatedAt: toIsoDate(data.updatedAt),
            }
          })
        },
        (error) => handleRemoteListenerError('workspace-collection-secrets', error),
      ),
    )

    workspaceUnsubscribers.push(
      onSnapshot(
        requestsRef,
        (snapshot) => {
          requests.value = snapshot.docs.map((requestDoc) =>
            normalizeRequest(
              {
                id: requestDoc.id,
                ...(requestDoc.data() as Record<string, unknown>),
              },
              workspaceId,
            ),
          )

          if (activeRequestId.value && requests.value.some((requestItem) => requestItem.id === activeRequestId.value)) {
            return
          }

          activeRequestId.value = requests.value[0]?.id ?? null
        },
        (error) => handleRemoteListenerError('workspace-requests', error),
      ),
    )
  }

  function initialize() {
    if (initialized.value) {
      return
    }

    initialized.value = true

    if (canUseNativeTransport.value) {
      requestTransport.value = 'electron'
    }

    if (!isFirebaseReady.value || !auth) {
      loadLocal()
      return
    }

    authUnsubscribe = onAuthStateChanged(auth, async (nextUser) => {
      if (!nextUser) {
        remoteWorkspaceBootstrapAttemptedForUserId = null
        remoteWorkspaceBootstrapInFlight = false
      } else if (remoteWorkspaceBootstrapAttemptedForUserId && remoteWorkspaceBootstrapAttemptedForUserId !== nextUser.uid) {
        remoteWorkspaceBootstrapAttemptedForUserId = null
      }

      user.value = nextUser
      clearResponseCache()
      requestBodyFilesByRequestId.value = {}
      setError(null)

      if (!nextUser) {
        stopRemoteSubscriptions()
        loadLocal()
        return
      }

      // Evita race tra stato locale precedente e listener remoti dopo il login.
      teams.value = []
      teamInvites.value = []
      teamSecrets.value = []
      workspaces.value = []
      collections.value = []
      collectionSecrets.value = []
      requests.value = []
      selectedWorkspaceId.value = null
      activeRequestId.value = null

      isLoading.value = true

      try {
        const syncWarnings: string[] = []
        try {
          await ensureUserProfile(nextUser)
        } catch (error) {
          if (isFirestorePermissionDenied(error)) {
            syncWarnings.push('profilo utente')
          } else {
            throw error
          }
        }

        subscribeRemoteData()
        setStatus(
          syncWarnings.length > 0
            ? `Sincronizzazione Firebase attiva (permessi limitati: ${syncWarnings.join(', ')}).`
            : 'Sincronizzazione Firebase attiva',
        )
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Errore durante la sincronizzazione.'
        setError(message)
      } finally {
        isLoading.value = false
      }
    })
  }

  async function loginWithGoogle() {
    if (!auth || !googleProvider) {
      setError('Configura le variabili Firebase per usare login e sync.')
      return
    }

    try {
      setError(null)
      await signInWithPopup(auth, googleProvider)
    } catch (error) {
      const firebaseCode = getFirebaseErrorCode(error)

      if (firebaseCode === 'auth/configuration-not-found') {
        setError(
          `Firebase Auth non configurato per projectId "${firebaseProjectId}" / authDomain "${firebaseAuthDomain}". Abilita Google in Authentication > Sign-in method.`,
        )
        return
      }

      if (firebaseCode === 'auth/unauthorized-domain') {
        setError('Dominio non autorizzato in Firebase Auth. Aggiungi questo host tra Authorized domains.')
        return
      }

      const message = error instanceof Error ? error.message : 'Login Google non riuscito.'
      setError(message)
    }
  }

  async function logout() {
    if (!auth) {
      return
    }

    await signOut(auth)
  }

  async function deleteOwnAccount() {
    if (!auth || !user.value) {
      return
    }

    setError(null)

    const authUser = auth.currentUser
    if (!authUser) {
      await logout()
      return
    }

    try {
      if (db) {
        await deleteDoc(doc(db, 'users', authUser.uid)).catch(() => undefined)
      }

      await deleteUser(authUser)
      setStatus('Account eliminato')
    } catch (error) {
      const firebaseCode = getFirebaseErrorCode(error)

      if (firebaseCode === 'auth/requires-recent-login') {
        setError('Per eliminare l’account devi rifare il login. Sei stato scollegato.')
      } else {
        const message = error instanceof Error ? error.message : 'Errore durante eliminazione account.'
        setError(message)
      }
    } finally {
      if (auth.currentUser) {
        await signOut(auth).catch(() => undefined)
      }
    }
  }

  async function createTeam(name: string) {
    const trimmedName = name.trim()

    if (!trimmedName) {
      return
    }

    if (!isRemoteMode.value || !db || !user.value) {
      const now = new Date().toISOString()
      teams.value.push({
        id: generateId(),
        name: trimmedName,
        ownerId: 'local-user',
        memberIds: ['local-user'],
        createdAt: now,
        updatedAt: now,
      })
      persistLocal()
      return
    }

    const teamRef = doc(collection(db, 'teams'))

    await setDoc(teamRef, {
      name: trimmedName,
      ownerId: user.value.uid,
      memberIds: [user.value.uid],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  }

  async function inviteToTeam(teamId: string, email: string) {
    const inviteEmails = buildInviteEmailCandidates(email)
    const normalizedEmail = inviteEmails[inviteEmails.length - 1] ?? ''

    if (!normalizedEmail) {
      return
    }

    if (!db || !isRemoteMode.value) {
      setError('Gli inviti ai team richiedono Firebase attivo.')
      return
    }

    const normalizedTeamId = teamId.trim()
    if (!normalizedTeamId || !user.value) {
      return
    }

    if (user.value.email?.trim().toLowerCase() === normalizedEmail) {
      setError('Non puoi invitare il tuo stesso account.')
      return
    }

    const teamItem = teams.value.find((team) => team.id === normalizedTeamId)

    if (!teamItem) {
      setError('Team non trovato.')
      return
    }

    const inviteId = buildTeamInviteId(normalizedTeamId, normalizedEmail)
    const inviteRef = doc(db, 'teamInvites', inviteId)
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    const expiresAtTimestamp = Timestamp.fromDate(expiresAt)

    await setDoc(
      inviteRef,
      {
        teamId: normalizedTeamId,
        teamName: teamItem.name,
        invitedEmail: normalizedEmail,
        invitedEmailNormalized: normalizedEmail,
        invitedByUid: user.value.uid,
        invitedByEmail: user.value.email ?? '',
        status: 'pending',
        expiresAt: expiresAtTimestamp,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    )

    try {
      const expiresAtDisplay = expiresAt.toLocaleString('it-IT')
      const inviteText = [
        `Hai ricevuto un invito al team "${teamItem.name}" su RequestMaker.`,
        `Scadenza invito: ${expiresAtDisplay}.`,
        'Per entrare nel team, apri RequestMaker e accetta l’invito da Utente > Team.',
      ].join('\n')

      await setDoc(doc(collection(db, 'mail')), {
        to: [normalizedEmail],
        message: {
          subject: `Invito team RequestMaker: ${teamItem.name}`,
          text: inviteText,
        },
        metadata: {
          type: 'team-invite',
          teamId: normalizedTeamId,
          inviteId,
        },
        createdAt: serverTimestamp(),
      })

      setStatus(
        `Invito creato per ${normalizedEmail}. Se Firebase Trigger Email è configurato sulla collection "mail", la mail verrà inviata automaticamente (scadenza 7 giorni).`,
      )
    } catch (error) {
      if (isFirestorePermissionDenied(error)) {
        setStatus(
          `Invito creato per ${normalizedEmail} (scadenza 7 giorni). Email non inviata: configura Firebase Trigger Email/Rules su collection "mail".`,
        )
        return
      }

      throw error
    }
  }

  async function acceptTeamInvite(inviteId: string) {
    const normalizedInviteId = inviteId.trim()

    if (!normalizedInviteId || !db || !isRemoteMode.value || !user.value) {
      return
    }

    const inviteItem = teamInvites.value.find((invite) => invite.id === normalizedInviteId)
    if (!inviteItem || inviteItem.status !== 'pending') {
      return
    }

    if (isInviteExpired(inviteItem)) {
      await updateDoc(doc(db, 'teamInvites', normalizedInviteId), {
        status: 'expired',
        updatedAt: serverTimestamp(),
      }).catch(() => undefined)
      setError('Invito scaduto.')
      return
    }

    try {
      await updateDoc(doc(db, 'teams', inviteItem.teamId), {
        memberIds: arrayUnion(user.value.uid),
        updatedAt: serverTimestamp(),
      })

      const teamWorkspacesQuery = query(collection(db, 'workspaces'), where('teamId', '==', inviteItem.teamId))
      const teamWorkspacesSnapshot = await getDocs(teamWorkspacesQuery)

      for (const workspaceDoc of teamWorkspacesSnapshot.docs) {
        await updateDoc(workspaceDoc.ref, {
          memberIds: arrayUnion(user.value.uid),
          updatedAt: serverTimestamp(),
        })
      }

      await updateDoc(doc(db, 'teamInvites', normalizedInviteId), {
        status: 'accepted',
        acceptedAt: serverTimestamp(),
        acceptedByUid: user.value.uid,
        updatedAt: serverTimestamp(),
      })

      setStatus(`Invito accettato: ${inviteItem.teamName}`)
    } catch (error) {
      const message = toStoreErrorMessage(error, 'Errore durante accettazione invito.')
      setError(message)
    }
  }

  async function declineTeamInvite(inviteId: string) {
    const normalizedInviteId = inviteId.trim()

    if (!normalizedInviteId || !db || !isRemoteMode.value) {
      return
    }

    const inviteItem = teamInvites.value.find((invite) => invite.id === normalizedInviteId)
    if (!inviteItem || inviteItem.status !== 'pending') {
      return
    }

    const nextStatus: TeamInviteStatus = isInviteExpired(inviteItem) ? 'expired' : 'declined'

    try {
      await updateDoc(doc(db, 'teamInvites', normalizedInviteId), {
        status: nextStatus,
        declinedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })

      setStatus(nextStatus === 'expired' ? 'Invito scaduto.' : `Invito rifiutato: ${inviteItem.teamName}`)
    } catch (error) {
      const message = toStoreErrorMessage(error, 'Errore durante rifiuto invito.')
      setError(message)
    }
  }

  async function createWorkspace(name: string, teamId: string | null = null): Promise<string | null> {
    const trimmedName = name.trim()

    if (!trimmedName) {
      return null
    }

    setError(null)

    if (!isRemoteMode.value || !db || !user.value) {
      const now = new Date().toISOString()
      const workspaceId = generateId()

      workspaces.value.push({
        id: workspaceId,
        name: trimmedName,
        ownerId: 'local-user',
        teamId,
        memberIds: ['local-user'],
        createdAt: now,
        updatedAt: now,
      })

      selectedWorkspaceId.value = workspaceId
      persistLocal()
      return workspaceId
    }

    try {
      const team = teams.value.find((teamItem) => teamItem.id === teamId)
      const memberIds = team ? team.memberIds : [user.value.uid]
      const workspaceRef = doc(collection(db, 'workspaces'))

      await setDoc(workspaceRef, {
        name: trimmedName,
        ownerId: user.value.uid,
        teamId,
        memberIds,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })

      selectedWorkspaceId.value = workspaceRef.id
      return workspaceRef.id
    } catch (error) {
      const message = toStoreErrorMessage(error, 'Errore durante creazione workspace.')
      setError(message)
      return null
    }
  }

  async function deleteWorkspace(workspaceId: string) {
    const normalizedWorkspaceId = workspaceId.trim()

    if (!normalizedWorkspaceId) {
      return
    }

    const workspaceToDelete = workspaces.value.find((workspaceItem) => workspaceItem.id === normalizedWorkspaceId)
    if (!workspaceToDelete) {
      return
    }

    setError(null)

    const remainingWorkspaceIds = workspaces.value
      .filter((workspaceItem) => workspaceItem.id !== normalizedWorkspaceId)
      .map((workspaceItem) => workspaceItem.id)
    const fallbackWorkspaceId = remainingWorkspaceIds[0] ?? null

    const workspaceRequestIds = requests.value
      .filter((requestItem) => requestItem.workspaceId === normalizedWorkspaceId)
      .map((requestItem) => requestItem.id)

    if (!isRemoteMode.value || !db || !user.value) {
      for (const requestId of workspaceRequestIds) {
        clearResponseForRequest(requestId)
        clearRequestBodyFile(requestId)
      }

      workspaces.value = workspaces.value.filter((workspaceItem) => workspaceItem.id !== normalizedWorkspaceId)
      collections.value = collections.value.filter((collectionItem) => collectionItem.workspaceId !== normalizedWorkspaceId)
      collectionSecrets.value = collectionSecrets.value.filter((secret) => secret.workspaceId !== normalizedWorkspaceId)
      requests.value = requests.value.filter((requestItem) => requestItem.workspaceId !== normalizedWorkspaceId)

      if (selectedWorkspaceId.value === normalizedWorkspaceId) {
        selectedWorkspaceId.value = fallbackWorkspaceId
      }

      if (workspaces.value.length === 0) {
        const now = new Date().toISOString()
        const defaultWorkspaceId = generateId()

        workspaces.value.push({
          id: defaultWorkspaceId,
          name: 'Default Workspace',
          ownerId: 'local-user',
          teamId: null,
          memberIds: ['local-user'],
          createdAt: now,
          updatedAt: now,
        })

        selectedWorkspaceId.value = defaultWorkspaceId
      }

      if (activeRequestId.value && !requests.value.some((requestItem) => requestItem.id === activeRequestId.value)) {
        const preferredRequestId =
          requests.value.find((requestItem) => requestItem.workspaceId === selectedWorkspaceId.value)?.id ?? requests.value[0]?.id ?? null
        activeRequestId.value = preferredRequestId
      }

      persistLocal()
      setStatus(`Workspace eliminato: ${workspaceToDelete.name}`)
      return
    }

    if (selectedWorkspaceId.value === normalizedWorkspaceId && fallbackWorkspaceId) {
      selectedWorkspaceId.value = fallbackWorkspaceId
    }

    try {
      const [requestsSnapshot, collectionsSnapshot, collectionSecretsSnapshot] = await Promise.all([
        getDocs(collection(db, 'workspaces', normalizedWorkspaceId, 'requests')),
        getDocs(collection(db, 'workspaces', normalizedWorkspaceId, 'collections')),
        getDocs(collection(db, 'workspaces', normalizedWorkspaceId, 'collectionSecrets')),
      ])

      const requestIdsToClear = requestsSnapshot.docs.map((requestDoc) => requestDoc.id)
      for (const requestId of requestIdsToClear) {
        clearResponseForRequest(requestId)
        clearRequestBodyFile(requestId)
      }

      await Promise.all(requestsSnapshot.docs.map((requestDoc) => deleteDoc(requestDoc.ref)))
      await Promise.all(collectionSecretsSnapshot.docs.map((secretDoc) => deleteDoc(secretDoc.ref)))
      await Promise.all(collectionsSnapshot.docs.map((collectionDoc) => deleteDoc(collectionDoc.ref)))
      await deleteDoc(doc(db, 'workspaces', normalizedWorkspaceId))

      if (selectedWorkspaceId.value === normalizedWorkspaceId) {
        selectedWorkspaceId.value = fallbackWorkspaceId
      }

      setStatus(`Workspace eliminato: ${workspaceToDelete.name}`)
    } catch (error) {
      const message = toStoreErrorMessage(error, 'Errore durante eliminazione workspace.')
      setError(message)
    }
  }

  async function createCollection(name: string): Promise<string | null> {
    const trimmedName = name.trim()

    if (!trimmedName) {
      return null
    }

    setError(null)

    let workspaceId: string | null = resolveWorkspaceIdForWrite()

    if (!workspaceId) {
      try {
        const createdWorkspaceId = await createWorkspace('Default Workspace')
        workspaceId = createdWorkspaceId ?? selectedWorkspaceId.value
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Errore durante creazione workspace.'
        setError(message)
        return null
      }
    }

    if (!workspaceId) {
      if (!lastError.value) {
        setError('Nessun workspace disponibile per creare la collection.')
      }
      return null
    }

    const sortOrder = getNextCollectionSortOrder(collections.value, workspaceId)

    if (!isRemoteMode.value || !db || !user.value) {
      const now = new Date().toISOString()
      const collectionId = generateId()
      collections.value.push({
        id: collectionId,
        workspaceId,
        name: trimmedName,
        sortOrder,
        createdBy: 'local-user',
        createdAt: now,
        updatedAt: now,
      })
      persistLocal()
      return collectionId
    }

    const collectionRef = doc(collection(db, 'workspaces', workspaceId, 'collections'))

    try {
      await setDoc(collectionRef, {
        name: trimmedName,
        sortOrder,
        createdBy: user.value.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    } catch (error) {
      const message = toStoreErrorMessage(error, 'Errore durante creazione collection.')
      setError(message)
      return null
    }

    return collectionRef.id
  }

  async function createRequest(payload: Partial<ApiRequest> & { collectionId: string }) {
    setError(null)

    let workspaceId: string | null = resolveWorkspaceIdForWrite()

    if (!workspaceId) {
      try {
        const createdWorkspaceId = await createWorkspace('Default Workspace')
        workspaceId = createdWorkspaceId ?? selectedWorkspaceId.value
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Errore durante creazione workspace.'
        setError(message)
        return
      }
    }

    if (!workspaceId) {
      if (!lastError.value) {
        setError('Nessun workspace disponibile per creare la request.')
      }
      return
    }

    const now = new Date().toISOString()

    const newRequest = normalizeRequest({
      id: generateId(),
      workspaceId,
      collectionId: payload.collectionId,
      name: payload.name?.trim() || 'New Request',
      method: payload.method,
      url: payload.url?.trim() || '',
      headers: payload.headers ?? [],
      body: payload.body ?? '',
      auth: payload.auth,
      description: payload.description ?? '',
      createdAt: now,
      updatedAt: now,
    })

    if (!isRemoteMode.value || !db || !user.value) {
      requests.value.push(newRequest)
      activeRequestId.value = newRequest.id
      persistLocal()
      return
    }

    try {
      const requestRef = doc(collection(db, 'workspaces', workspaceId, 'requests'))

      await setDoc(requestRef, {
        collectionId: newRequest.collectionId,
        name: newRequest.name,
        method: newRequest.method,
        url: newRequest.url,
        headers: newRequest.headers,
        body: newRequest.body,
        bodyMode: newRequest.bodyMode,
        bodyContentType: newRequest.bodyContentType,
        formFields: newRequest.formFields,
        bodyFileName: newRequest.bodyFileName ?? '',
        bodyFileContentType: newRequest.bodyFileContentType ?? '',
        bodyFileSize: newRequest.bodyFileSize ?? 0,
        auth: newRequest.auth,
        description: newRequest.description,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })

      activeRequestId.value = requestRef.id
    } catch (error) {
      const message = toStoreErrorMessage(error, 'Errore durante creazione request.')
      setError(message)
    }
  }

  async function renameCollection(collectionId: string, name: string) {
    const workspaceId = selectedWorkspaceId.value
    const trimmedName = name.trim()

    if (!workspaceId || !collectionId || !trimmedName) {
      return
    }

    if (!isRemoteMode.value || !db || !user.value) {
      collections.value = collections.value.map((collectionItem) =>
        collectionItem.id === collectionId
          ? {
              ...collectionItem,
              name: trimmedName,
              updatedAt: new Date().toISOString(),
            }
          : collectionItem,
      )
      persistLocal()
      return
    }

    await setDoc(
      doc(db, 'workspaces', workspaceId, 'collections', collectionId),
      {
        name: trimmedName,
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    )
  }

  async function moveCollection(collectionId: string, targetIndex: number) {
    const workspaceId = selectedWorkspaceId.value

    if (!workspaceId) {
      return
    }

    setError(null)

    const orderedCollections = collectionsInWorkspace.value
    const sourceIndex = orderedCollections.findIndex((collectionItem) => collectionItem.id === collectionId)

    if (sourceIndex < 0 || orderedCollections.length <= 1) {
      return
    }

    const boundedTargetIndex = Math.max(0, Math.min(targetIndex, orderedCollections.length - 1))

    if (sourceIndex === boundedTargetIndex) {
      return
    }

    const reorderedCollections = [...orderedCollections]
    const [movedCollection] = reorderedCollections.splice(sourceIndex, 1)
    reorderedCollections.splice(boundedTargetIndex, 0, movedCollection)

    const orderUpdates = reorderedCollections.map((collectionItem, index) => ({
      id: collectionItem.id,
      sortOrder: index,
    }))

    const orderById = new Map(orderUpdates.map((orderUpdate) => [orderUpdate.id, orderUpdate.sortOrder]))
    const now = new Date().toISOString()
    const previousCollections = collections.value

    collections.value = collections.value.map((collectionItem) => {
      if (collectionItem.workspaceId !== workspaceId) {
        return collectionItem
      }

      const nextSortOrder = orderById.get(collectionItem.id)

      if (nextSortOrder === undefined) {
        return collectionItem
      }

      return {
        ...collectionItem,
        sortOrder: nextSortOrder,
        updatedAt: now,
      }
    })

    if (!isRemoteMode.value || !db || !user.value) {
      persistLocal()
      return
    }

    const firestore = db

    try {
      await Promise.all(
        orderUpdates.map((orderUpdate) =>
          updateDoc(doc(firestore, 'workspaces', workspaceId, 'collections', orderUpdate.id), {
            sortOrder: orderUpdate.sortOrder,
            updatedAt: serverTimestamp(),
          }),
        ),
      )
    } catch (error) {
      collections.value = previousCollections
      const message = error instanceof Error ? error.message : 'Errore durante riordino collection.'
      setError(message)
    }
  }

  async function moveRequestToCollection(requestId: string, targetCollectionId: string) {
    const workspaceId = selectedWorkspaceId.value
    const normalizedRequestId = requestId.trim()
    const normalizedTargetCollectionId = targetCollectionId.trim()

    if (!workspaceId || !normalizedRequestId || !normalizedTargetCollectionId) {
      return
    }

    const sourceRequest = requests.value.find(
      (requestItem) => requestItem.id === normalizedRequestId && requestItem.workspaceId === workspaceId,
    )

    if (!sourceRequest) {
      return
    }

    if (sourceRequest.collectionId === normalizedTargetCollectionId) {
      return
    }

    const targetCollectionExists = collections.value.some(
      (collectionItem) =>
        collectionItem.id === normalizedTargetCollectionId && collectionItem.workspaceId === workspaceId,
    )

    if (!targetCollectionExists) {
      setError('Collection di destinazione non trovata.')
      return
    }

    setError(null)

    const now = new Date().toISOString()
    const previousRequests = requests.value

    requests.value = requests.value.map((requestItem) =>
      requestItem.id === normalizedRequestId
        ? {
            ...requestItem,
            collectionId: normalizedTargetCollectionId,
            updatedAt: now,
          }
        : requestItem,
    )

    if (!isRemoteMode.value || !db || !user.value) {
      persistLocal()
      return
    }

    try {
      await updateDoc(doc(db, 'workspaces', workspaceId, 'requests', normalizedRequestId), {
        collectionId: normalizedTargetCollectionId,
        updatedAt: serverTimestamp(),
      })
    } catch (error) {
      requests.value = previousRequests
      const message = error instanceof Error ? error.message : 'Errore durante spostamento request.'
      setError(message)
    }
  }

  async function deleteCollection(collectionId: string) {
    const workspaceId = selectedWorkspaceId.value

    if (!workspaceId || !collectionId) {
      return
    }

    const requestsToDelete = requests.value.filter((requestItem) => requestItem.collectionId === collectionId)
    const secretsToDelete = collectionSecrets.value.filter((secret) => secret.collectionId === collectionId)
    const requestIdsToDelete = requestsToDelete.map((requestItem) => requestItem.id)

    for (const requestId of requestIdsToDelete) {
      clearResponseForRequest(requestId)
      clearRequestBodyFile(requestId)
    }

    if (!isRemoteMode.value || !db || !user.value) {
      collections.value = collections.value.filter((collectionItem) => collectionItem.id !== collectionId)
      requests.value = requests.value.filter((requestItem) => requestItem.collectionId !== collectionId)
      collectionSecrets.value = collectionSecrets.value.filter((secret) => secret.collectionId !== collectionId)

      if (activeRequest.value?.collectionId === collectionId) {
        activeRequestId.value = requests.value[0]?.id ?? null
      }

      persistLocal()
      return
    }

    for (const requestItem of requestsToDelete) {
      await deleteDoc(doc(db, 'workspaces', workspaceId, 'requests', requestItem.id))
    }

    for (const secretItem of secretsToDelete) {
      await deleteDoc(doc(db, 'workspaces', workspaceId, 'collectionSecrets', secretItem.id))
    }

    await deleteDoc(doc(db, 'workspaces', workspaceId, 'collections', collectionId))
  }

  async function duplicateRequest(requestId: string) {
    const sourceRequest = requests.value.find((requestItem) => requestItem.id === requestId)

    if (!sourceRequest) {
      return
    }

    const duplicateName = sourceRequest.name.trim().endsWith('Copy')
      ? `${sourceRequest.name.trim()} 2`
      : `${sourceRequest.name.trim()} Copy`

    await createRequest({
      collectionId: sourceRequest.collectionId,
      name: duplicateName,
      method: sourceRequest.method,
      url: sourceRequest.url,
      headers: sourceRequest.headers.map((header) => ({ ...header })),
      body: sourceRequest.body,
      bodyMode: sourceRequest.bodyMode,
      bodyContentType: sourceRequest.bodyContentType,
      formFields: sourceRequest.formFields.map((field) => ({ ...field })),
      bodyFileName: sourceRequest.bodyFileName ?? '',
      bodyFileContentType: sourceRequest.bodyFileContentType ?? '',
      bodyFileSize: sourceRequest.bodyFileSize ?? 0,
      auth: { ...sourceRequest.auth },
      description: sourceRequest.description ?? '',
    })
  }

  async function deleteRequest(requestId: string) {
    const workspaceId = selectedWorkspaceId.value

    if (!workspaceId || !requestId) {
      return
    }

    const fallbackRequestId =
      requests.value.find((requestItem) => requestItem.id !== requestId && requestItem.workspaceId === workspaceId)?.id ?? null

    if (!isRemoteMode.value || !db || !user.value) {
      requests.value = requests.value.filter((requestItem) => requestItem.id !== requestId)
      clearResponseForRequest(requestId)

      if (activeRequestId.value === requestId) {
        activeRequestId.value = fallbackRequestId
      }

      persistLocal()
      return
    }

    await deleteDoc(doc(db, 'workspaces', workspaceId, 'requests', requestId))
    clearResponseForRequest(requestId)
    clearRequestBodyFile(requestId)

    if (activeRequestId.value === requestId) {
      activeRequestId.value = fallbackRequestId
    }
  }

  function selectRequest(requestId: string) {
    activeRequestId.value = requestId
  }

  async function saveRequest(requestItem: ApiRequest) {
    const workspaceId = selectedWorkspaceId.value

    if (!workspaceId) {
      return
    }

    const nextRequest = normalizeRequest({
      ...requestItem,
      updatedAt: new Date().toISOString(),
    })

    if (!isRemoteMode.value || !db || !user.value) {
      requests.value = requests.value.map((item) => (item.id === requestItem.id ? nextRequest : item))
      persistLocal()
      setStatus('Richiesta salvata localmente')
      return
    }

    await setDoc(
      doc(db, 'workspaces', workspaceId, 'requests', requestItem.id),
      {
        collectionId: nextRequest.collectionId,
        name: nextRequest.name,
        method: nextRequest.method,
        url: nextRequest.url,
        headers: nextRequest.headers,
        body: nextRequest.body,
        bodyMode: nextRequest.bodyMode,
        bodyContentType: nextRequest.bodyContentType,
        formFields: nextRequest.formFields,
        bodyFileName: nextRequest.bodyFileName ?? '',
        bodyFileContentType: nextRequest.bodyFileContentType ?? '',
        bodyFileSize: nextRequest.bodyFileSize ?? 0,
        auth: nextRequest.auth,
        description: nextRequest.description,
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    )

    setStatus('Richiesta sincronizzata con Firebase')
  }

  function upsertActiveRequestDraft(partial: Partial<ApiRequest>) {
    const current = activeRequest.value
    if (!current) {
      return
    }

    const nextDraft = normalizeRequest({
      ...current,
      ...partial,
      headers: partial.headers ?? current.headers,
      auth: partial.auth ?? current.auth,
    })

    requests.value = requests.value.map((item) => (item.id === current.id ? nextDraft : item))

    if (!isRemoteMode.value) {
      persistLocal()
    }
  }

  function addHeaderToActiveRequest() {
    const current = activeRequest.value
    if (!current) {
      return
    }

    upsertActiveRequestDraft({
      headers: [...current.headers, { key: '', value: '' }],
    })
  }

  function removeHeaderFromActiveRequest(index: number) {
    const current = activeRequest.value
    if (!current) {
      return
    }

    const nextHeaders = current.headers.filter((_, headerIndex) => headerIndex !== index)
    upsertActiveRequestDraft({ headers: nextHeaders })
  }

  function setActiveHeader(index: number, keyOrValue: 'key' | 'value', nextValue: string) {
    const current = activeRequest.value
    if (!current) {
      return
    }

    const nextHeaders = current.headers.map((header, headerIndex) =>
      headerIndex === index ? { ...header, [keyOrValue]: nextValue } : header,
    )

    upsertActiveRequestDraft({ headers: nextHeaders })
  }

  async function importOpenApi(rawText: string, targetCollectionId?: string) {
    const parsed = parseOpenApiJson(rawText)

    if (!selectedWorkspaceId.value) {
      await createWorkspace(`${parsed.workspaceName} Workspace`)
    }

    const workspaceId = selectedWorkspaceId.value
    if (!workspaceId) {
      return
    }

    const normalizedTargetCollectionId = targetCollectionId?.trim()
    let collectionId: string | null = null
    let importedCollectionName = parsed.collectionName

    if (normalizedTargetCollectionId) {
      const targetCollection = collectionsInWorkspace.value.find(
        (collectionItem) => collectionItem.id === normalizedTargetCollectionId,
      )

      if (!targetCollection) {
        throw new Error('Collection target non trovata nel workspace corrente.')
      }

      collectionId = targetCollection.id
      importedCollectionName = targetCollection.name
    } else {
      collectionId = await createCollection(parsed.collectionName)
    }

    if (!collectionId) {
      throw new Error('Impossibile creare la collection di import.')
    }

    for (const importedRequest of parsed.requests) {
      await createRequest({
        collectionId,
        ...importedRequest,
      })
    }

    for (const sharedSecret of parsed.sharedSecrets) {
      await upsertCollectionSecret(collectionId, sharedSecret.key, sharedSecret.value)
    }

    setStatus(`Import OpenAPI completato: ${parsed.requests.length} endpoint in ${importedCollectionName}`)
  }

  function resolveSecretsByKey(collectionId: string): Record<string, string> {
    const resolved: Record<string, string> = {}

    for (const teamSecret of teamSecretsInActiveTeam.value) {
      resolved[teamSecret.key] = teamSecret.value
    }

    for (const collectionSecret of collectionSecretsInWorkspace.value) {
      if (collectionSecret.collectionId === collectionId) {
        resolved[collectionSecret.key] = collectionSecret.value
      }
    }

    return resolved
  }

  function resolveCollectionBaseUrlSecretValue(collectionId: string, valuesByKey: Record<string, string>): string {
    if (!collectionId) {
      return ''
    }

    for (const keyName of COLLECTION_BASE_URL_SECRET_KEYS) {
      for (const [secretKey, secretValue] of Object.entries(valuesByKey)) {
        if (secretKey.trim().toUpperCase() !== keyName) {
          continue
        }

        const normalizedValue = String(secretValue ?? '').trim()
        if (normalizedValue) {
          return normalizedValue
        }
      }
    }

    return ''
  }

  function urlHasExplicitProtocol(value: string) {
    return /^[A-Za-z][A-Za-z0-9+.-]*:/.test(value)
  }

  function isRelativeRequestUrl(value: string) {
    const trimmed = value.trim()

    if (!trimmed) {
      return true
    }

    if (trimmed.startsWith('{{')) {
      return false
    }

    if (trimmed.startsWith('//')) {
      return false
    }

    return !urlHasExplicitProtocol(trimmed)
  }

  function applyCollectionBaseUrlToRequestUrl(rawUrl: string, baseUrl: string): string {
    const trimmedUrl = rawUrl.trim()
    const trimmedBaseUrl = baseUrl.trim()

    if (!trimmedBaseUrl || !isRelativeRequestUrl(trimmedUrl)) {
      return rawUrl
    }

    if (!trimmedUrl) {
      return trimmedBaseUrl
    }

    const normalizedBaseUrl = trimmedBaseUrl.replace(/\/+$/, '')
    const normalizedSuffix = trimmedUrl.startsWith('/') ? trimmedUrl : `/${trimmedUrl}`
    return `${normalizedBaseUrl}${normalizedSuffix}`
  }

  function collectMissingSecretKeys(requestItem: ApiRequest, valuesByKey: Record<string, string>) {
    const missing = new Set<string>()
    const bodyText = requestItem.body ?? ''
    const selectedBodyMode = normalizeBodyMode(requestItem.bodyMode) ?? 'none'
    const contentTypeCandidate = requestItem.bodyContentType || getHeaderValue(requestItem.headers, 'content-type')
    const normalizedBodyMode =
      selectedBodyMode === 'auto'
        ? resolveAutoBodyMode(contentTypeCandidate, requestItem.formFields ?? [], bodyText)
        : selectedBodyMode
    const requestAuth = normalizeRequestAuth(requestItem.auth)
    const addMissingFromValue = (rawText: string) => {
      for (const secretKey of extractTemplateKeys(rawText)) {
        if (!Object.prototype.hasOwnProperty.call(valuesByKey, secretKey)) {
          missing.add(secretKey)
        }
      }
    }

    addMissingFromValue(requestItem.url)

    if (normalizedBodyMode === 'raw' || normalizedBodyMode === 'json') {
      addMissingFromValue(bodyText)
    }

    if (normalizedBodyMode === 'urlencoded' || normalizedBodyMode === 'form-data' || selectedBodyMode === 'auto') {
      for (const formField of requestItem.formFields ?? []) {
        addMissingFromValue(formField.key)
        addMissingFromValue(formField.value)
      }
    }

    addMissingFromValue(requestItem.bodyContentType ?? '')

    for (const header of requestItem.headers) {
      addMissingFromValue(header.key)
      addMissingFromValue(header.value)
    }

    if (requestAuth.type === 'bearer') {
      addMissingFromValue(requestAuth.bearerToken)
    }

    if (requestAuth.type === 'oauth2') {
      addMissingFromValue(requestAuth.oauth2AccessToken)
    }

    if (requestAuth.type === 'jwt') {
      addMissingFromValue(requestAuth.jwtToken)
    }

    if (requestAuth.type === 'basic' || requestAuth.type === 'digest') {
      addMissingFromValue(requestAuth.basicUsername)
      addMissingFromValue(requestAuth.basicPassword)
    }

    if (requestAuth.type === 'apiKey') {
      addMissingFromValue(requestAuth.apiKeyName)
      addMissingFromValue(requestAuth.apiKeyValue)
    }

    if (requestAuth.type === 'awsSignature') {
      addMissingFromValue(requestAuth.awsAccessKeyId)
      addMissingFromValue(requestAuth.awsSecretAccessKey)
      addMissingFromValue(requestAuth.awsSessionToken)
      addMissingFromValue(requestAuth.awsRegion)
      addMissingFromValue(requestAuth.awsService)
    }

    if (requestAuth.type === 'hawk') {
      addMissingFromValue(requestAuth.hawkId)
      addMissingFromValue(requestAuth.hawkKey)
      addMissingFromValue(requestAuth.hawkAlgorithm)
    }

    return Array.from(missing)
  }

  async function upsertTeamSecret(teamId: string, key: string, value: string, visibility: 'team' | 'admin' = 'team') {
    const normalizedTeamId = teamId.trim()
    const normalizedKey = key.trim()
    const normalizedVisibility = visibility === 'admin' ? 'admin' : 'team'

    if (!normalizedTeamId || !normalizedKey) {
      return
    }

    const existingSecret = teamSecrets.value.find(
      (secret) => secret.teamId === normalizedTeamId && secret.key === normalizedKey,
    )

    if (normalizedVisibility === 'admin' && !canManageRestrictedSecrets.value) {
      setError('Solo un admin può creare o modificare segreti admin-only.')
      return
    }

    if (existingSecret?.visibility === 'admin' && !canManageRestrictedSecrets.value) {
      setError('Solo un admin può modificare questo segreto.')
      return
    }

    if (!isRemoteMode.value || !db || !user.value) {
      const now = new Date().toISOString()

      if (existingSecret) {
        teamSecrets.value = teamSecrets.value.map((secret) =>
          secret.id === existingSecret.id
            ? {
                ...secret,
                value,
                visibility: normalizedVisibility,
                updatedAt: now,
              }
            : secret,
        )
      } else {
        teamSecrets.value.push({
          id: generateId(),
          teamId: normalizedTeamId,
          key: normalizedKey,
          value,
          visibility: normalizedVisibility,
          createdBy: 'local-user',
          createdAt: now,
          updatedAt: now,
        })
      }

      persistLocal()
      setStatus(`Segreto team salvato: ${normalizedKey}`)
      return
    }

    if (existingSecret) {
      await updateDoc(doc(db, 'teams', normalizedTeamId, 'secrets', existingSecret.id), {
        value,
        visibility: normalizedVisibility,
        updatedAt: serverTimestamp(),
      })
    } else {
      const secretRef = doc(collection(db, 'teams', normalizedTeamId, 'secrets'))
      await setDoc(secretRef, {
        key: normalizedKey,
        value,
        visibility: normalizedVisibility,
        createdBy: user.value.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    }

    setStatus(`Segreto team sincronizzato: ${normalizedKey}`)
  }

  async function deleteTeamSecret(teamId: string, secretId: string) {
    const normalizedTeamId = teamId.trim()
    const normalizedSecretId = secretId.trim()

    if (!normalizedTeamId || !normalizedSecretId) {
      return
    }

    const targetSecret = teamSecrets.value.find((secret) => secret.id === normalizedSecretId && secret.teamId === normalizedTeamId)

    if (targetSecret?.visibility === 'admin' && !canManageRestrictedSecrets.value) {
      setError('Solo un admin può eliminare questo segreto.')
      return
    }

    if (!isRemoteMode.value || !db) {
      teamSecrets.value = teamSecrets.value.filter((secret) => secret.id !== normalizedSecretId)
      persistLocal()
      return
    }

    await deleteDoc(doc(db, 'teams', normalizedTeamId, 'secrets', normalizedSecretId))
  }

  async function upsertCollectionSecret(
    collectionId: string,
    key: string,
    value: string,
    visibility: 'team' | 'admin' = 'team',
  ) {
    const workspaceId = selectedWorkspaceId.value
    const normalizedCollectionId = collectionId.trim()
    const normalizedKey = key.trim()
    const normalizedVisibility = visibility === 'admin' ? 'admin' : 'team'

    if (!workspaceId || !normalizedCollectionId || !normalizedKey) {
      return
    }

    const existingSecret = collectionSecrets.value.find(
      (secret) =>
        secret.workspaceId === workspaceId && secret.collectionId === normalizedCollectionId && secret.key === normalizedKey,
    )

    if (normalizedVisibility === 'admin' && !canManageRestrictedSecrets.value) {
      setError('Solo un admin può creare o modificare segreti admin-only.')
      return
    }

    if (existingSecret?.visibility === 'admin' && !canManageRestrictedSecrets.value) {
      setError('Solo un admin può modificare questo segreto.')
      return
    }

    if (!isRemoteMode.value || !db || !user.value) {
      const now = new Date().toISOString()

      if (existingSecret) {
        collectionSecrets.value = collectionSecrets.value.map((secret) =>
          secret.id === existingSecret.id
            ? {
                ...secret,
                value,
                visibility: normalizedVisibility,
                updatedAt: now,
              }
            : secret,
        )
      } else {
        collectionSecrets.value.push({
          id: generateId(),
          workspaceId,
          collectionId: normalizedCollectionId,
          key: normalizedKey,
          value,
          visibility: normalizedVisibility,
          createdBy: 'local-user',
          createdAt: now,
          updatedAt: now,
        })
      }

      persistLocal()
      setStatus(`Segreto collection salvato: ${normalizedKey}`)
      return
    }

    if (existingSecret) {
      await updateDoc(doc(db, 'workspaces', workspaceId, 'collectionSecrets', existingSecret.id), {
        value,
        visibility: normalizedVisibility,
        updatedAt: serverTimestamp(),
      })
    } else {
      const secretRef = doc(collection(db, 'workspaces', workspaceId, 'collectionSecrets'))
      await setDoc(secretRef, {
        collectionId: normalizedCollectionId,
        key: normalizedKey,
        value,
        visibility: normalizedVisibility,
        createdBy: user.value.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    }

    setStatus(`Segreto collection sincronizzato: ${normalizedKey}`)
  }

  async function deleteCollectionSecret(secretId: string) {
    const workspaceId = selectedWorkspaceId.value
    const normalizedSecretId = secretId.trim()

    if (!workspaceId || !normalizedSecretId) {
      return
    }

    const targetSecret = collectionSecrets.value.find(
      (secret) => secret.id === normalizedSecretId && secret.workspaceId === workspaceId,
    )

    if (targetSecret?.visibility === 'admin' && !canManageRestrictedSecrets.value) {
      setError('Solo un admin può eliminare questo segreto.')
      return
    }

    if (!isRemoteMode.value || !db) {
      collectionSecrets.value = collectionSecrets.value.filter((secret) => secret.id !== normalizedSecretId)
      persistLocal()
      return
    }

    await deleteDoc(doc(db, 'workspaces', workspaceId, 'collectionSecrets', normalizedSecretId))
  }

  async function sendWithBrowser(
    requestItem: ApiRequest,
    headersAsObject: Record<string, string>,
    requestBody: RequestSendBody | undefined,
  ): Promise<HttpResponse> {
    const abortController = new AbortController()
    const timeoutHandle = setTimeout(() => abortController.abort(), REQUEST_TIMEOUT_MS)
    const startedAt = performance.now()

    try {
      let bodyPayload: BodyInit | undefined

      if (requestBody?.kind === 'text') {
        bodyPayload = requestBody.value
      } else if (requestBody?.kind === 'binary-base64') {
        const binaryBytes = base64ToBytes(requestBody.value)
        const binaryBuffer = binaryBytes.buffer.slice(
          binaryBytes.byteOffset,
          binaryBytes.byteOffset + binaryBytes.byteLength,
        ) as ArrayBuffer
        bodyPayload =
          typeof Blob !== 'undefined'
            ? new Blob([binaryBuffer])
            : (binaryBuffer as unknown as BodyInit)
      }

      const result = await fetch(requestItem.url, {
        method: requestItem.method,
        headers: headersAsObject,
        body: bodyPayload,
        signal: abortController.signal,
      })

      const responseBody = await result.text()
      const elapsed = Math.round(performance.now() - startedAt)

      return {
        status: result.status,
        statusText: result.statusText,
        durationMs: elapsed,
        headers: Array.from(result.headers.entries()).map(([key, value]) => ({ key, value })),
        body: prettifyResponseBody(responseBody),
      }
    } finally {
      clearTimeout(timeoutHandle)
    }
  }

  async function sendWithNative(
    transportMode: RequestTransportMode,
    requestItem: ApiRequest,
    headersAsObject: Record<string, string>,
    requestBody: RequestSendBody | undefined,
  ): Promise<HttpResponse> {
    const bridge = typeof window !== 'undefined' ? window.requestmakerElectron : undefined

    if (!bridge) {
      throw new Error('Runtime Electron non disponibile per trasporto nativo.')
    }

    const nativePayload = {
      transport: transportMode === 'curl' ? 'curl' : 'electron-fetch',
      method: requestItem.method,
      url: requestItem.url,
      headers: headersAsObject,
      timeoutMs: REQUEST_TIMEOUT_MS,
    } as {
      transport: 'curl' | 'electron-fetch'
      method: string
      url: string
      headers: Record<string, string>
      body?: string
      bodyBase64?: string
      timeoutMs: number
    }

    if (requestBody?.kind === 'text') {
      nativePayload.body = requestBody.value
    } else if (requestBody?.kind === 'binary-base64') {
      nativePayload.bodyBase64 = requestBody.value
    }

    const nativeResponse = await bridge.sendHttpRequest(nativePayload)

    return {
      ...nativeResponse,
      body: prettifyResponseBody(nativeResponse.body),
    }
  }

  async function sendActiveRequest() {
    const requestItem = activeRequest.value

    if (!requestItem) {
      return
    }

    const resolvedSecrets = resolveSecretsByKey(requestItem.collectionId)
    const missingSecretKeys = collectMissingSecretKeys(requestItem, resolvedSecrets)

    if (missingSecretKeys.length > 0) {
      const missingList = missingSecretKeys.join(', ')
      setError(`Segreti mancanti per questa richiesta: ${missingList}`)
      setStatus('Configurazione segreti incompleta')
      return
    }

    const emptyUrlSecretKeys = extractTemplateKeys(requestItem.url).filter((secretKey) =>
      Object.prototype.hasOwnProperty.call(resolvedSecrets, secretKey) &&
      !String(resolvedSecrets[secretKey] ?? '').trim(),
    )

    if (emptyUrlSecretKeys.length > 0) {
      setError(
        `Variabili URL senza valore: ${emptyUrlSecretKeys.join(', ')}. Imposta un URL completo (es. https://api.example.com).`,
      )
      setStatus('Configurazione segreti incompleta')
      return
    }

    const requestHeaders = requestItem.headers
      .map((header) => ({
        key: interpolateTemplate(header.key, resolvedSecrets).trim(),
        value: interpolateTemplate(header.value, resolvedSecrets),
      }))
      .filter((header) => header.key.trim())

    const headersAsObject: Record<string, string> = {}

    for (const header of requestHeaders) {
      headersAsObject[header.key] = header.value
    }

    const resolvedUrl = interpolateTemplate(requestItem.url, resolvedSecrets)
    const collectionBaseUrl = resolveCollectionBaseUrlSecretValue(requestItem.collectionId, resolvedSecrets)

    if (isRelativeRequestUrl(resolvedUrl) && !collectionBaseUrl) {
      setError('URL relativa senza base URL di collection. Imposta "Base URL collection" nelle impostazioni della collection.')
      setStatus('Configurazione URL incompleta')
      return
    }

    const urlWithCollectionBase = applyCollectionBaseUrlToRequestUrl(resolvedUrl, collectionBaseUrl)
    const requestAuth = normalizeRequestAuth(requestItem.auth)
    const unsupportedAuthMessage = getUnsupportedAuthMessage(requestAuth.type)

    if (unsupportedAuthMessage) {
      setError(unsupportedAuthMessage)
      setStatus('Metodo autorizzazione non supportato')
      return
    }

    const requestWithAuth = applyAuthToRequest(requestItem, resolvedSecrets, headersAsObject, urlWithCollectionBase)
    const normalizedUrlResult = normalizeHttpRequestUrl(requestWithAuth.url)

    if (!normalizedUrlResult.ok) {
      setError(normalizedUrlResult.message)
      setStatus('URL non valida')
      return
    }

    requestWithAuth.url = normalizedUrlResult.url

    const selectedBodyMode = normalizeBodyMode(requestItem.bodyMode) ?? inferBodyModeFromLegacy(requestItem.body, requestItem.headers)
    let configuredContentType =
      interpolateTemplate(requestItem.bodyContentType ?? '', resolvedSecrets).trim() ||
      getHeaderCaseInsensitive(requestWithAuth.headers, 'content-type')
    const bodyMode =
      selectedBodyMode === 'auto'
        ? resolveAutoBodyMode(configuredContentType, requestItem.formFields ?? [], requestItem.body)
        : selectedBodyMode
    const isBodyAllowed = !['GET', 'HEAD'].includes(requestItem.method)
    let requestBody: RequestSendBody | undefined

    if (isBodyAllowed) {
      if (bodyMode === 'raw' || bodyMode === 'json') {
        const resolvedBody = interpolateTemplate(requestItem.body, resolvedSecrets)
        requestBody = resolvedBody.trim() ? { kind: 'text', value: resolvedBody } : undefined
      } else if (bodyMode === 'urlencoded') {
        requestBody = {
          kind: 'text',
          value: buildUrlEncodedBody(requestItem.formFields ?? [], resolvedSecrets),
        }
      } else if (bodyMode === 'form-data') {
        const multipart = buildMultipartBody(requestItem.formFields ?? [], resolvedSecrets)
        requestBody = { kind: 'text', value: multipart.body }
        removeHeaderCaseInsensitive(requestWithAuth.headers, 'content-type')
        requestWithAuth.headers['Content-Type'] = `multipart/form-data; boundary=${multipart.boundary}`
      } else if (bodyMode === 'file') {
        const bodyFile = requestBodyFilesByRequestId.value[requestItem.id]

        if (!bodyFile?.base64) {
          setError('Carica un file nel Body prima di inviare la richiesta.')
          setStatus('Body file mancante')
          return
        }

        requestBody = { kind: 'binary-base64', value: bodyFile.base64 }

        if (!configuredContentType) {
          configuredContentType = bodyFile.contentType || defaultContentTypeForBodyMode('file')
        }
      } else {
        requestBody = undefined
      }
    }

    if (isBodyAllowed && bodyMode !== 'none' && bodyMode !== 'form-data') {
      const finalContentType = configuredContentType || defaultContentTypeForBodyMode(bodyMode)

      if (finalContentType) {
        removeHeaderCaseInsensitive(requestWithAuth.headers, 'content-type')
        requestWithAuth.headers['Content-Type'] = finalContentType
      }
    }

    const canUseNative = canUseNativeTransport.value
    const transportMode = requestTransport.value
    const transportLabel =
      transportMode === 'browser' ? 'browser' : transportMode === 'electron' ? 'electron fetch' : 'curl nativo'

    try {
      setError(null)
      setStatus(`Invio richiesta (${transportLabel})...`)

      const requestPayload: ApiRequest = {
        ...requestItem,
        url: requestWithAuth.url,
      }

      const result =
        transportMode !== 'browser' && canUseNative
          ? await sendWithNative(transportMode, requestPayload, requestWithAuth.headers, requestBody)
          : await sendWithBrowser(requestPayload, requestWithAuth.headers, requestBody)

      responsesByRequestId.value = {
        ...responsesByRequestId.value,
        [requestItem.id]: result,
      }
      setStatus(`Risposta ricevuta in ${result.durationMs}ms tramite ${transportLabel}`)
    } catch (error) {
      const rawMessage = error instanceof Error ? error.message : 'Errore durante la chiamata HTTP.'
      const message = normalizeRequestExecutionErrorMessage(rawMessage)
      setError(message)
      setStatus('Richiesta fallita')
    }
  }

  async function createQuickRequest() {
    let collectionId: string | null | undefined = collectionsInWorkspace.value[0]?.id

    if (!collectionId) {
      collectionId = await createCollection('Default Collection')
    }

    if (!collectionId) {
      return
    }

    await createRequest({
      collectionId,
      method: 'GET',
      name: 'New Request',
      url: '',
      body: DEFAULT_REQUEST_BODY,
      bodyMode: 'json',
      bodyContentType: 'application/json',
      formFields: [],
      headers: [{ key: 'Content-Type', value: 'application/json' }],
    })
  }

  watch(
    () => canUseNativeTransport.value,
    (enabled) => {
      if (enabled) {
        if (requestTransport.value === 'browser') {
          requestTransport.value = 'electron'
        }
        return
      }

      requestTransport.value = 'browser'
    },
    { immediate: true },
  )

  watch(
    [() => isRemoteMode.value, () => activeWorkspaceTeamId.value],
    ([remoteMode, teamId]) => {
      if (!remoteMode) {
        if (teamSecretsUnsubscribe) {
          teamSecretsUnsubscribe()
          teamSecretsUnsubscribe = null
        }
        return
      }

      subscribeTeamSecrets(teamId)
    },
    { immediate: true },
  )

  watch(
    () => selectedWorkspaceId.value,
    (workspaceId) => {
      if (isRemoteMode.value && workspaceId) {
        const workspaceIsVisible = workspaces.value.some((workspaceItem) => workspaceItem.id === workspaceId)

        if (!workspaceIsVisible) {
          clearWorkspaceSubscriptions()
          collections.value = []
          collectionSecrets.value = []
          requests.value = []
          activeRequestId.value = null
          return
        }

        subscribeWorkspaceContent(workspaceId)
        return
      }

      if (isRemoteMode.value) {
        clearWorkspaceSubscriptions()
        collections.value = []
        collectionSecrets.value = []
        requests.value = []
        activeRequestId.value = null
        return
      }

      if (!isRemoteMode.value) {
        persistLocal()
      }
    },
    { immediate: true },
  )

  watch(
    () => isRemoteMode.value,
    (remoteEnabled) => {
      if (remoteEnabled) {
        return
      }

      stopRemoteSubscriptions()
      loadLocal()
    },
  )

  watch(
    [teams, teamSecrets, workspaces, collections, collectionSecrets, requests, selectedWorkspaceId],
    () => {
      if (!isRemoteMode.value) {
        persistLocal()
      }
    },
    { deep: true },
  )

  watch(
    () => requests.value.map((requestItem) => requestItem.id),
    (requestIds) => {
      const validIds = new Set(requestIds)
      const currentEntries = Object.entries(requestBodyFilesByRequestId.value)
      const nextEntries = currentEntries.filter(([requestId]) => validIds.has(requestId))

      if (nextEntries.length === currentEntries.length) {
        return
      }

      requestBodyFilesByRequestId.value = Object.fromEntries(nextEntries)
    },
    { immediate: true },
  )

  return {
    user,
    teams,
    teamInvites,
    pendingTeamInvites,
    teamSecrets,
    workspaces,
    collections,
    collectionSecrets,
    requests,
    selectedWorkspaceId,
    activeRequestId,
    activeWorkspace,
    activeWorkspaceTeamId,
    collectionsInWorkspace,
    teamSecretsInActiveTeam,
    collectionSecretsInWorkspace,
    requestsInWorkspace,
    activeRequest,
    activeRequestBodyFile,
    response,
    requestTransport,
    statusMessage,
    lastError,
    isLoading,
    isFirebaseReady,
    isRemoteMode,
    canUseNativeTransport,
    canManageRestrictedSecrets,
    initialize,
    setRequestTransport,
    loginWithGoogle,
    logout,
    deleteOwnAccount,
    createTeam,
    inviteToTeam,
    acceptTeamInvite,
    declineTeamInvite,
    createWorkspace,
    deleteWorkspace,
    createCollection,
    renameCollection,
    moveCollection,
    moveRequestToCollection,
    deleteCollection,
    createQuickRequest,
    createRequest,
    duplicateRequest,
    deleteRequest,
    selectRequest,
    saveRequest,
    upsertActiveRequestDraft,
    addHeaderToActiveRequest,
    removeHeaderFromActiveRequest,
    setActiveHeader,
    setActiveRequestBodyFile,
    clearActiveRequestBodyFile,
    importOpenApi,
    upsertTeamSecret,
    deleteTeamSecret,
    upsertCollectionSecret,
    deleteCollectionSecret,
    sendActiveRequest,
  }
})
