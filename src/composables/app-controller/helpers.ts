import type { RequestBodyMode } from '@/types/domain'

export function defaultContentTypeForBodyMode(mode: RequestBodyMode): string {
  if (mode === 'auto') return ''
  if (mode === 'json') return 'application/json'
  if (mode === 'urlencoded') return 'application/x-www-form-urlencoded'
  if (mode === 'form-data') return 'multipart/form-data'
  if (mode === 'raw') return 'text/plain'
  if (mode === 'file') return 'application/octet-stream'
  return ''
}

export function normalizeContentTypeValue(value: string): string {
  return value.split(';')[0]?.trim().toLowerCase() ?? ''
}

export function resolveAutoBodyMode(
  contentType: string,
  formFields: Array<{ key: string; value: string }>,
  rawBody: string,
): RequestBodyMode {
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

  if (rawBody.trim()) {
    return 'raw'
  }

  return 'none'
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} B`
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`
  }

  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

export function sanitizeFileNamePart(value: string) {
  const normalized = value.trim().replace(/[<>:"/\\|?*\x00-\x1F]/g, '-').replace(/\s+/g, '-')
  return normalized || 'response'
}

export function inferResponseExtension(contentType: string) {
  const normalized = contentType.toLowerCase()

  if (normalized.includes('json')) return 'json'
  if (normalized.includes('html')) return 'html'
  if (normalized.includes('xml')) return 'xml'
  if (normalized.includes('csv')) return 'csv'
  if (normalized.includes('yaml') || normalized.includes('yml')) return 'yaml'
  if (normalized.includes('pdf')) return 'pdf'
  if (normalized.includes('zip')) return 'zip'
  if (normalized.includes('javascript')) return 'js'

  return 'txt'
}

export function methodTagClass(method: string) {
  const tag = method.toUpperCase()

  if (tag === 'GET') return 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300'
  if (tag === 'POST') return 'bg-sky-500/15 text-sky-600 dark:text-sky-300'
  if (tag === 'PUT' || tag === 'PATCH') return 'bg-amber-500/15 text-amber-600 dark:text-amber-300'
  if (tag === 'DELETE') return 'bg-rose-500/15 text-rose-600 dark:text-rose-300'

  return 'bg-muted text-muted-foreground'
}
