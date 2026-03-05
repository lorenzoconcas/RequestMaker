import type { ApiRequest, KeyValueItem, RequestAuthType } from '@/types/domain'
import { escapeFormDataName, interpolateTemplate, normalizeRequestAuth } from '@/stores/app-store/core-helpers'

export function prettifyResponseBody(bodyText: string) {
  try {
    const parsedBody = JSON.parse(bodyText)
    return JSON.stringify(parsedBody, null, 2)
  } catch {
    return bodyText
  }
}

export function encodeBase64(value: string) {
  if (typeof btoa === 'function') {
    try {
      return btoa(unescape(encodeURIComponent(value)))
    } catch {
      return btoa(value)
    }
  }

  return value
}

export function withQueryParam(rawUrl: string, key: string, value: string) {
  if (!key.trim()) {
    return rawUrl
  }

  const [baseAndQuery, hashSuffix] = rawUrl.split('#', 2)
  const [basePath, queryString] = baseAndQuery.split('?', 2)
  const params = new URLSearchParams(queryString ?? '')

  params.set(key, value)

  const nextQuery = params.toString()
  return `${basePath}${nextQuery ? `?${nextQuery}` : ''}${hashSuffix ? `#${hashSuffix}` : ''}`
}

export function normalizeHttpRequestUrl(rawUrl: string): { ok: true; url: string } | { ok: false; message: string } {
  const trimmed = rawUrl.trim()

  if (!trimmed) {
    return {
      ok: false,
      message: 'URL non valida. Inserisci un URL HTTP/HTTPS, ad esempio https://api.example.com.',
    }
  }

  let candidate = trimmed

  if (candidate.startsWith('//')) {
    candidate = `https:${candidate}`
  } else if (!/^[A-Za-z][A-Za-z0-9+.-]*:/.test(candidate)) {
    candidate = `https://${candidate}`
  }

  let parsed: URL

  try {
    parsed = new URL(candidate)
  } catch {
    return {
      ok: false,
      message: 'URL non valida. Formato non riconosciuto.',
    }
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    return {
      ok: false,
      message: 'Solo URL con protocollo HTTP/HTTPS sono supportate.',
    }
  }

  return {
    ok: true,
    url: parsed.toString(),
  }
}

export function normalizeRequestExecutionErrorMessage(rawMessage: string): string {
  const normalized = rawMessage.trim()
  const lower = normalized.toLowerCase()

  if (
    lower.includes("error invoking remote method 'requestmaker:http-request'") &&
    lower.includes('fetch failed')
  ) {
    return 'Richiesta nativa non riuscita. Controlla URL e variabile base (es. {{BASE}}) con valore completo: https://api.example.com'
  }

  if (lower.includes('enotfound')) {
    return 'Host non trovato (ENOTFOUND). Verifica dominio e valore della variabile base URL.'
  }

  if (lower.includes('certificate') || lower.includes('self signed')) {
    return 'Errore TLS/certificato. Verifica certificato server o usa un endpoint con certificato valido.'
  }

  if (lower === 'url richiesta non valida.') {
    return 'URL non valida. Inserisci un URL HTTP/HTTPS, ad esempio https://api.example.com.'
  }

  return normalized
}

export function removeHeaderCaseInsensitive(headers: Record<string, string>, key: string) {
  const target = key.toLowerCase()

  for (const currentKey of Object.keys(headers)) {
    if (currentKey.toLowerCase() === target) {
      delete headers[currentKey]
    }
  }
}

export function getHeaderCaseInsensitive(headers: Record<string, string>, key: string): string {
  const target = key.toLowerCase()

  for (const [headerKey, headerValue] of Object.entries(headers)) {
    if (headerKey.toLowerCase() === target) {
      return headerValue
    }
  }

  return ''
}

export function buildUrlEncodedBody(fields: KeyValueItem[], resolvedSecrets: Record<string, string>) {
  const params = new URLSearchParams()

  for (const field of fields) {
    const key = interpolateTemplate(field.key, resolvedSecrets).trim()
    if (!key) {
      continue
    }

    const value = interpolateTemplate(field.value, resolvedSecrets)
    params.append(key, value)
  }

  return params.toString()
}

export function buildMultipartBody(fields: KeyValueItem[], resolvedSecrets: Record<string, string>) {
  const boundary = `----RequestMakerBoundary${Date.now().toString(16)}${Math.random().toString(16).slice(2)}`
  let body = ''

  for (const field of fields) {
    const key = interpolateTemplate(field.key, resolvedSecrets).trim()
    if (!key) {
      continue
    }

    const value = interpolateTemplate(field.value, resolvedSecrets)
    body += `--${boundary}\r\n`
    body += `Content-Disposition: form-data; name="${escapeFormDataName(key)}"\r\n\r\n`
    body += `${value}\r\n`
  }

  body += `--${boundary}--\r\n`

  return {
    boundary,
    body,
  }
}

export function getUnsupportedAuthMessage(authType: RequestAuthType) {
  if (authType === 'digest') {
    return 'Digest Auth richiede challenge/response ed è disponibile solo come modalità configurazione.'
  }

  if (authType === 'awsSignature') {
    return 'AWS Signature non è ancora supportata nel motore di invio.'
  }

  if (authType === 'hawk') {
    return 'HAWK non è ancora supportata nel motore di invio.'
  }

  return null
}

export function applyAuthToRequest(
  requestItem: ApiRequest,
  resolvedSecrets: Record<string, string>,
  baseHeaders: Record<string, string>,
  baseUrl: string,
) {
  const auth = normalizeRequestAuth(requestItem.auth)
  const headers = { ...baseHeaders }
  let url = baseUrl

  if (auth.type === 'bearer' || auth.type === 'oauth2' || auth.type === 'jwt') {
    const rawToken =
      auth.type === 'oauth2'
        ? auth.oauth2AccessToken
        : auth.type === 'jwt'
          ? auth.jwtToken
          : auth.bearerToken
    const token = interpolateTemplate(rawToken, resolvedSecrets).trim()

    if (token) {
      headers.Authorization = `Bearer ${token}`
    }
  }

  if (auth.type === 'basic') {
    const username = interpolateTemplate(auth.basicUsername, resolvedSecrets)
    const password = interpolateTemplate(auth.basicPassword, resolvedSecrets)
    const encoded = encodeBase64(`${username}:${password}`)

    headers.Authorization = `Basic ${encoded}`
  }

  if (auth.type === 'apiKey') {
    const key = interpolateTemplate(auth.apiKeyName, resolvedSecrets).trim()
    const value = interpolateTemplate(auth.apiKeyValue, resolvedSecrets)

    if (key) {
      if (auth.apiKeyIn === 'query') {
        url = withQueryParam(url, key, value)
      } else {
        headers[key] = value
      }
    }
  }

  return { headers, url }
}
