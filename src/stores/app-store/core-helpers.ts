import { firebaseProjectId } from '@/lib/firebase'
import type {
  ApiRequest,
  HttpMethod,
  KeyValueItem,
  RequestAuth,
  RequestAuthApiKeyIn,
  RequestAuthType,
  RequestBodyMode,
  RequestCollection,
} from '@/types/domain'

export const DEFAULT_REQUEST_BODY = '{\n  \n}'
export const REQUEST_TIMEOUT_MS = 60000
export const TEMPLATE_TOKEN_REGEX = /{{\s*([A-Za-z0-9_.-]+)\s*}}/g
export const COLLECTION_BASE_URL_SECRET_KEYS = ['BASE_URL', 'BASE'] as const

export function getFirebaseErrorCode(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    return String((error as { code?: unknown }).code ?? '')
  }

  return ''
}

export function isFirestorePermissionDenied(error: unknown): boolean {
  const firebaseCode = getFirebaseErrorCode(error)
  return firebaseCode === 'permission-denied' || firebaseCode === 'firestore/permission-denied'
}

export function toStoreErrorMessage(error: unknown, fallbackMessage: string): string {
  if (isFirestorePermissionDenied(error)) {
    return `Permessi Firestore insufficienti su projectId "${firebaseProjectId}" (database "(default)"). Verifica Rules pubblicate.`
  }

  return error instanceof Error ? error.message : fallbackMessage
}

export function buildInviteEmailCandidates(email: string): string[] {
  const trimmed = email.trim()

  if (!trimmed) {
    return []
  }

  const normalized = trimmed.toLowerCase()
  return normalized === trimmed ? [trimmed] : [trimmed, normalized]
}

export function generateId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export function toIsoDate(value: unknown): string {
  if (value && typeof value === 'object' && 'toDate' in value && typeof (value as { toDate: () => Date }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate().toISOString()
  }

  if (typeof value === 'string') {
    return value
  }

  return new Date().toISOString()
}

export function parseSortOrder(value: unknown): number | null {
  if (!Number.isFinite(value)) {
    return null
  }

  const parsed = Math.floor(Number(value))
  return parsed >= 0 ? parsed : 0
}

export function normalizeCollection(value: unknown, fallbackWorkspaceId?: string, fallbackSortOrder = 0): RequestCollection {
  const data = value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
  const now = new Date().toISOString()

  return {
    id: String(data.id ?? generateId()),
    workspaceId: String(data.workspaceId ?? fallbackWorkspaceId ?? ''),
    name: String(data.name ?? 'Collection'),
    sortOrder: parseSortOrder(data.sortOrder) ?? fallbackSortOrder,
    createdBy: String(data.createdBy ?? ''),
    createdAt: toIsoDate(data.createdAt ?? now),
    updatedAt: toIsoDate(data.updatedAt ?? now),
  }
}

export function compareCollectionsByOrder(a: RequestCollection, b: RequestCollection) {
  if (a.sortOrder !== b.sortOrder) {
    return a.sortOrder - b.sortOrder
  }

  if (a.createdAt !== b.createdAt) {
    return a.createdAt.localeCompare(b.createdAt)
  }

  return a.name.localeCompare(b.name)
}

export function getNextCollectionSortOrder(collectionItems: RequestCollection[], workspaceId: string) {
  const workspaceCollections = collectionItems.filter((collectionItem) => collectionItem.workspaceId === workspaceId)

  if (workspaceCollections.length === 0) {
    return 0
  }

  return Math.max(...workspaceCollections.map((collectionItem) => collectionItem.sortOrder)) + 1
}

export function normalizeHeaders(value: unknown): KeyValueItem[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .filter((item) => typeof item === 'object' && item !== null)
    .map((item) => ({
      key: String((item as Record<string, unknown>).key ?? ''),
      value: String((item as Record<string, unknown>).value ?? ''),
    }))
}

export function normalizeRequestMethod(value: unknown): HttpMethod {
  const normalized = String(value ?? 'GET').toUpperCase()
  const allowedMethods: HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD']

  if (allowedMethods.includes(normalized as HttpMethod)) {
    return normalized as HttpMethod
  }

  return 'GET'
}

export function normalizeBodyMode(value: unknown): RequestBodyMode | null {
  const normalized = String(value ?? '').trim()

  if (
    normalized === 'auto' ||
    normalized === 'none' ||
    normalized === 'raw' ||
    normalized === 'json' ||
    normalized === 'urlencoded' ||
    normalized === 'form-data' ||
    normalized === 'file'
  ) {
    return normalized
  }

  return null
}

export function normalizeFormFields(value: unknown): KeyValueItem[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .filter((item) => typeof item === 'object' && item !== null)
    .map((item) => ({
      key: String((item as Record<string, unknown>).key ?? ''),
      value: String((item as Record<string, unknown>).value ?? ''),
    }))
}

export function getHeaderValue(headers: KeyValueItem[], key: string): string {
  const lowerKey = key.toLowerCase()
  const matched = headers.find((header) => header.key.toLowerCase() === lowerKey)

  return matched?.value ?? ''
}

export function normalizeContentTypeValue(value: string): string {
  return value.split(';')[0]?.trim().toLowerCase() ?? ''
}

export function resolveAutoBodyMode(contentType: string, formFields: KeyValueItem[], bodyText: string): RequestBodyMode {
  const normalizedContentType = normalizeContentTypeValue(contentType)

  if (normalizedContentType === 'application/x-www-form-urlencoded') {
    return 'urlencoded'
  }

  if (normalizedContentType === 'multipart/form-data' || normalizedContentType.startsWith('multipart/')) {
    return 'form-data'
  }

  if (normalizedContentType.includes('json')) {
    return 'json'
  }

  if (formFields.some((field) => field.key.trim() || field.value.trim())) {
    return 'urlencoded'
  }

  if (bodyText.trim()) {
    return 'raw'
  }

  return 'none'
}

export function parseUrlEncodedBodyToFields(bodyText: string): KeyValueItem[] {
  if (!bodyText.trim()) {
    return []
  }

  const params = new URLSearchParams(bodyText)
  return Array.from(params.entries()).map(([key, value]) => ({ key, value }))
}

export function inferBodyModeFromLegacy(bodyText: string, headers: KeyValueItem[]): RequestBodyMode {
  if (!bodyText.trim()) {
    return 'none'
  }

  const contentType = normalizeContentTypeValue(getHeaderValue(headers, 'content-type'))

  if (contentType === 'application/x-www-form-urlencoded') {
    return 'urlencoded'
  }

  if (contentType === 'multipart/form-data' || contentType.startsWith('multipart/')) {
    return 'form-data'
  }

  if (contentType.includes('json')) {
    return 'json'
  }

  return 'raw'
}

export function defaultContentTypeForBodyMode(mode: RequestBodyMode): string {
  if (mode === 'auto') {
    return ''
  }

  if (mode === 'json') {
    return 'application/json'
  }

  if (mode === 'urlencoded') {
    return 'application/x-www-form-urlencoded'
  }

  if (mode === 'form-data') {
    return 'multipart/form-data'
  }

  if (mode === 'raw') {
    return 'text/plain'
  }

  if (mode === 'file') {
    return 'application/octet-stream'
  }

  return ''
}

export function createDefaultAuth(): RequestAuth {
  return {
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
}

export function normalizeRequestAuthType(value: unknown): RequestAuthType {
  const authType = String(value ?? 'none')

  if (
    authType === 'inherit' ||
    authType === 'none' ||
    authType === 'basic' ||
    authType === 'digest' ||
    authType === 'bearer' ||
    authType === 'oauth2' ||
    authType === 'apiKey' ||
    authType === 'awsSignature' ||
    authType === 'hawk' ||
    authType === 'jwt'
  ) {
    return authType
  }

  return 'none'
}

export function normalizeRequestAuth(value: unknown): RequestAuth {
  const base = createDefaultAuth()

  if (!value || typeof value !== 'object') {
    return base
  }

  const data = value as Record<string, unknown>
  const apiKeyIn = String(data.apiKeyIn ?? 'header')
  const normalizedType = normalizeRequestAuthType(data.type)
  const normalizedApiKeyIn: RequestAuthApiKeyIn = apiKeyIn === 'query' ? 'query' : 'header'

  return {
    type: normalizedType,
    bearerToken: String(data.bearerToken ?? ''),
    oauth2AccessToken: String(data.oauth2AccessToken ?? ''),
    jwtToken: String(data.jwtToken ?? ''),
    basicUsername: String(data.basicUsername ?? ''),
    basicPassword: String(data.basicPassword ?? ''),
    apiKeyName: String(data.apiKeyName ?? ''),
    apiKeyValue: String(data.apiKeyValue ?? ''),
    apiKeyIn: normalizedApiKeyIn,
    awsAccessKeyId: String(data.awsAccessKeyId ?? ''),
    awsSecretAccessKey: String(data.awsSecretAccessKey ?? ''),
    awsSessionToken: String(data.awsSessionToken ?? ''),
    awsRegion: String(data.awsRegion ?? ''),
    awsService: String(data.awsService ?? ''),
    hawkId: String(data.hawkId ?? ''),
    hawkKey: String(data.hawkKey ?? ''),
    hawkAlgorithm: String(data.hawkAlgorithm ?? 'sha256'),
  }
}

export function normalizeRequest(value: unknown, fallbackWorkspaceId?: string): ApiRequest {
  const data = value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
  const now = new Date().toISOString()
  const headers = normalizeHeaders(data.headers)
  const body = typeof data.body === 'string' ? data.body : ''
  const explicitBodyMode = normalizeBodyMode(data.bodyMode)
  const bodyMode = explicitBodyMode ?? inferBodyModeFromLegacy(body, headers)
  const rawBodyContentType = typeof data.bodyContentType === 'string' ? data.bodyContentType.trim() : ''
  const headerContentType = getHeaderValue(headers, 'content-type').trim()
  const bodyContentType = bodyMode === 'none'
    ? ''
    : rawBodyContentType || headerContentType || defaultContentTypeForBodyMode(bodyMode)
  const rawFormFields = normalizeFormFields(data.formFields)
  const formFields =
    rawFormFields.length > 0
      ? rawFormFields
      : bodyMode === 'urlencoded'
        ? parseUrlEncodedBodyToFields(body)
        : []
  const bodyFileName = typeof data.bodyFileName === 'string' ? data.bodyFileName : ''
  const bodyFileContentType = typeof data.bodyFileContentType === 'string' ? data.bodyFileContentType : ''
  const bodyFileSize =
    Number.isFinite(data.bodyFileSize) && Number(data.bodyFileSize) >= 0 ? Math.floor(Number(data.bodyFileSize)) : 0

  return {
    id: String(data.id ?? generateId()),
    workspaceId: String(data.workspaceId ?? fallbackWorkspaceId ?? ''),
    collectionId: String(data.collectionId ?? ''),
    name: String(data.name ?? 'New Request'),
    method: normalizeRequestMethod(data.method),
    url: String(data.url ?? ''),
    headers,
    body,
    bodyMode,
    bodyContentType,
    formFields,
    bodyFileName,
    bodyFileContentType,
    bodyFileSize,
    auth: normalizeRequestAuth(data.auth),
    description: typeof data.description === 'string' ? data.description : '',
    createdAt: toIsoDate(data.createdAt ?? now),
    updatedAt: toIsoDate(data.updatedAt ?? now),
  }
}

export function extractTemplateKeys(rawText: string): string[] {
  if (!rawText) {
    return []
  }

  const keys = new Set<string>()
  for (const match of rawText.matchAll(TEMPLATE_TOKEN_REGEX)) {
    if (match[1]) {
      keys.add(match[1])
    }
  }

  return Array.from(keys)
}

export function interpolateTemplate(rawText: string, valuesByKey: Record<string, string>) {
  return rawText.replace(TEMPLATE_TOKEN_REGEX, (_match, key: string) =>
    Object.prototype.hasOwnProperty.call(valuesByKey, key) ? valuesByKey[key] : `{{${key}}}`,
  )
}

export function escapeFormDataName(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

export function bytesToBase64(bytes: Uint8Array): string {
  if (typeof btoa !== 'function') {
    throw new Error('Conversione base64 non supportata in questo runtime.')
  }

  let binary = ''
  const chunkSize = 0x8000

  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize)
    binary += String.fromCharCode(...chunk)
  }

  return btoa(binary)
}

export function base64ToBytes(base64: string): Uint8Array {
  if (typeof atob !== 'function') {
    throw new Error('Decodifica base64 non supportata in questo runtime.')
  }

  const decoded = atob(base64)
  const bytes = new Uint8Array(decoded.length)

  for (let index = 0; index < decoded.length; index += 1) {
    bytes[index] = decoded.charCodeAt(index)
  }

  return bytes
}
