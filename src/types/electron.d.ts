import type { KeyValueItem } from '@/types/domain'

export type NativeTransport = 'electron-fetch' | 'curl'
export type MenuActionId =
  | 'new-request'
  | 'new-quick-request'
  | 'new-request-in-selected-collection'
  | 'new-collection'
  | 'new-workspace'
  | 'import-openapi'
  | 'save-request'
  | 'send-request'
  | 'duplicate-request'
  | 'delete-request'
  | 'rename-selected-collection'
  | 'delete-selected-collection'
  | 'open-workspace-page'
  | 'open-user-page'
  | 'open-settings-page'
  | 'toggle-sidebar'
  | 'set-theme-system'
  | 'set-theme-light'
  | 'set-theme-dark'
  | 'toggle-auth'

export interface NativeHttpRequestPayload {
  transport: NativeTransport
  method: string
  url: string
  headers: Record<string, string>
  body?: string
  bodyBase64?: string
  timeoutMs?: number
}

export interface NativeHttpResponse {
  status: number
  statusText: string
  durationMs: number
  headers: KeyValueItem[]
  body: string
}

declare global {
  interface Window {
    requestmakerElectron?: {
      isElectron: boolean
      sendHttpRequest(payload: NativeHttpRequestPayload): Promise<NativeHttpResponse>
      onMenuAction(handler: (actionId: MenuActionId) => void): () => void
    }
  }
}

export {}
