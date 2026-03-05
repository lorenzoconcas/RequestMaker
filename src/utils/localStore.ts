import type { ApiRequest, CollectionSecret, RequestCollection, Team, TeamSecret, Workspace } from '@/types/domain'

export interface LocalSnapshot {
  teams: Team[]
  teamSecrets: TeamSecret[]
  workspaces: Workspace[]
  collections: RequestCollection[]
  collectionSecrets: CollectionSecret[]
  requests: ApiRequest[]
  selectedWorkspaceId: string | null
}

const STORAGE_KEY = 'requestmaker-local-v1'

const defaultSnapshot: LocalSnapshot = {
  teams: [],
  teamSecrets: [],
  workspaces: [],
  collections: [],
  collectionSecrets: [],
  requests: [],
  selectedWorkspaceId: null,
}

export function loadLocalSnapshot(): LocalSnapshot {
  if (typeof window === 'undefined') {
    return defaultSnapshot
  }

  try {
    const rawValue = window.localStorage.getItem(STORAGE_KEY)
    if (!rawValue) {
      return defaultSnapshot
    }

    const parsed = JSON.parse(rawValue) as Partial<LocalSnapshot>

    return {
      teams: Array.isArray(parsed.teams) ? parsed.teams : [],
      teamSecrets: Array.isArray(parsed.teamSecrets) ? parsed.teamSecrets : [],
      workspaces: Array.isArray(parsed.workspaces) ? parsed.workspaces : [],
      collections: Array.isArray(parsed.collections) ? parsed.collections : [],
      collectionSecrets: Array.isArray(parsed.collectionSecrets) ? parsed.collectionSecrets : [],
      requests: Array.isArray(parsed.requests) ? parsed.requests : [],
      selectedWorkspaceId: parsed.selectedWorkspaceId ?? null,
    }
  } catch {
    return defaultSnapshot
  }
}

export function saveLocalSnapshot(snapshot: LocalSnapshot) {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot))
}
