export type HttpMethod =
  | 'GET'
  | 'POST'
  | 'PUT'
  | 'PATCH'
  | 'DELETE'
  | 'OPTIONS'
  | 'HEAD'

export type RequestTransportMode = 'browser' | 'electron' | 'curl'
export type RequestAuthType =
  | 'inherit'
  | 'none'
  | 'basic'
  | 'digest'
  | 'bearer'
  | 'oauth2'
  | 'apiKey'
  | 'awsSignature'
  | 'hawk'
  | 'jwt'
export type RequestAuthApiKeyIn = 'header' | 'query'
export type RequestBodyMode = 'auto' | 'none' | 'raw' | 'json' | 'urlencoded' | 'form-data' | 'file'

export interface KeyValueItem {
  key: string
  value: string
}

export interface RequestAuth {
  type: RequestAuthType
  bearerToken: string
  oauth2AccessToken: string
  jwtToken: string
  basicUsername: string
  basicPassword: string
  apiKeyName: string
  apiKeyValue: string
  apiKeyIn: RequestAuthApiKeyIn
  awsAccessKeyId: string
  awsSecretAccessKey: string
  awsSessionToken: string
  awsRegion: string
  awsService: string
  hawkId: string
  hawkKey: string
  hawkAlgorithm: string
}

export interface ApiRequest {
  id: string
  workspaceId: string
  collectionId: string
  name: string
  method: HttpMethod
  url: string
  headers: KeyValueItem[]
  body: string
  bodyMode: RequestBodyMode
  bodyContentType: string
  formFields: KeyValueItem[]
  bodyFileName?: string
  bodyFileContentType?: string
  bodyFileSize?: number
  auth: RequestAuth
  description?: string
  createdAt: string
  updatedAt: string
}

export interface RequestCollection {
  id: string
  workspaceId: string
  name: string
  sortOrder: number
  createdBy: string
  createdAt: string
  updatedAt: string
}

export interface Team {
  id: string
  name: string
  ownerId: string
  memberIds: string[]
  pendingInviteEmails?: string[]
  createdAt: string
  updatedAt: string
}

export type TeamInviteStatus = 'pending' | 'accepted' | 'declined' | 'expired' | 'revoked'

export interface TeamInvite {
  id: string
  teamId: string
  teamName: string
  invitedEmail: string
  invitedEmailNormalized: string
  invitedByUid: string
  invitedByEmail: string
  status: TeamInviteStatus
  expiresAt: string
  createdAt: string
  updatedAt: string
  acceptedAt?: string
  declinedAt?: string
}

export interface Workspace {
  id: string
  name: string
  ownerId: string
  teamId: string | null
  memberIds: string[]
  createdAt: string
  updatedAt: string
}

export interface TeamSecret {
  id: string
  teamId: string
  key: string
  value: string
  visibility: 'team' | 'admin'
  createdBy: string
  createdAt: string
  updatedAt: string
}

export interface CollectionSecret {
  id: string
  workspaceId: string
  collectionId: string
  key: string
  value: string
  visibility: 'team' | 'admin'
  createdBy: string
  createdAt: string
  updatedAt: string
}

export interface HttpResponse {
  status: number
  statusText: string
  durationMs: number
  headers: KeyValueItem[]
  body: string
}
