import type { ApiRequest, HttpMethod, RequestAuth } from '@/types/domain'

interface ParsedOpenApi {
  workspaceName: string
  collectionName: string
  sharedSecrets: Array<{
    key: string
    value: string
  }>
  requests: Array<Omit<ApiRequest, 'id' | 'workspaceId' | 'collectionId' | 'createdAt' | 'updatedAt'>>
}

type OpenApiDocument = {
  openapi?: string
  swagger?: string
  info?: {
    title?: string
  }
  servers?: Array<{
    url?: string
    variables?: Record<
      string,
      {
        default?: string
        enum?: string[]
      }
    >
  }>
  schemes?: string[]
  host?: string
  basePath?: string
  paths?: Record<string, Record<string, Record<string, any>>>
}

const METHOD_KEYS = new Set(['get', 'post', 'put', 'patch', 'delete', 'options', 'head'])

function createDefaultAuth(): RequestAuth {
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

function normalizeMethod(method: string): HttpMethod | null {
  const upper = method.toUpperCase()
  const methods: HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD']
  return methods.includes(upper as HttpMethod) ? (upper as HttpMethod) : null
}

function ensureJsonObject(content: unknown): Record<string, any> {
  if (typeof content !== 'object' || content === null) {
    throw new Error('Il file OpenAPI non è un oggetto JSON valido.')
  }

  return content as Record<string, any>
}

function buildBaseUrl(document: OpenApiDocument): string {
  if (Array.isArray(document.servers) && document.servers.length > 0) {
    const firstServer = document.servers[0]
    const rawUrl = firstServer?.url ?? ''

    if (!rawUrl) {
      return ''
    }

    const variables = firstServer?.variables ?? {}
    return rawUrl.replace(/\{([^}]+)\}/g, (_placeholder, variableNameRaw: string) => {
      const variableName = String(variableNameRaw ?? '').trim()
      const variableConfig = variables[variableName]

      if (!variableConfig || typeof variableConfig !== 'object') {
        return ''
      }

      if (typeof variableConfig.default === 'string' && variableConfig.default.trim()) {
        return variableConfig.default
      }

      if (Array.isArray(variableConfig.enum) && typeof variableConfig.enum[0] === 'string') {
        return variableConfig.enum[0]
      }

      return ''
    })
  }

  const scheme = document.schemes?.[0] ?? 'https'
  const host = document.host ?? ''
  const basePath = document.basePath ?? ''

  if (!host) {
    return ''
  }

  return `${scheme}://${host}${basePath}`
}

function normalizeUrl(baseUrl: string, path: string): string {
  if (!baseUrl) {
    return path
  }

  const normalizedBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return `${normalizedBase}${normalizedPath}`
}

function inferExampleFromSchema(schema: Record<string, any> | undefined): unknown {
  if (!schema) {
    return undefined
  }

  if (schema.example !== undefined) {
    return schema.example
  }

  if (schema.default !== undefined) {
    return schema.default
  }

  if (schema.type === 'object' || schema.properties) {
    const properties = schema.properties as Record<string, Record<string, any>> | undefined
    if (!properties) {
      return {}
    }

    const objectResult: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(properties)) {
      objectResult[key] = inferExampleFromSchema(value)
    }
    return objectResult
  }

  if (schema.type === 'array') {
    return [inferExampleFromSchema(schema.items)]
  }

  if (schema.type === 'integer' || schema.type === 'number') {
    return 0
  }

  if (schema.type === 'boolean') {
    return false
  }

  return ''
}

function buildRequestBody(operation: Record<string, any>, documentType: 'openapi3' | 'swagger2'): string {
  if (documentType === 'openapi3') {
    const requestBody = operation.requestBody as Record<string, any> | undefined
    const content = requestBody?.content as Record<string, Record<string, any>> | undefined

    if (!content) {
      return ''
    }

    const jsonBody = content['application/json']
    const firstContentEntry = Object.values(content)[0]
    const selected = jsonBody ?? firstContentEntry

    if (!selected) {
      return ''
    }

    if (selected.example !== undefined) {
      return JSON.stringify(selected.example, null, 2)
    }

    const inferred = inferExampleFromSchema(selected.schema)
    if (inferred === undefined) {
      return ''
    }

    return JSON.stringify(inferred, null, 2)
  }

  const bodyParameter = (operation.parameters as any[] | undefined)?.find((parameter) => parameter.in === 'body')
  if (!bodyParameter) {
    return ''
  }

  const inferred = inferExampleFromSchema(bodyParameter.schema)
  if (inferred === undefined) {
    return ''
  }

  return JSON.stringify(inferred, null, 2)
}

function buildDefaultHeaders(operation: Record<string, any>, documentType: 'openapi3' | 'swagger2') {
  if (documentType === 'openapi3') {
    const requestBody = operation.requestBody as Record<string, any> | undefined
    const content = requestBody?.content as Record<string, any> | undefined
    const contentTypes = content ? Object.keys(content) : []

    if (contentTypes.length > 0) {
      return [{ key: 'Content-Type', value: contentTypes[0] }]
    }

    return []
  }

  const consumes = operation.consumes as string[] | undefined
  if (consumes && consumes.length > 0) {
    return [{ key: 'Content-Type', value: consumes[0] }]
  }

  return []
}

export function parseOpenApiJson(rawText: string): ParsedOpenApi {
  let parsedJson: unknown

  try {
    parsedJson = JSON.parse(rawText)
  } catch {
    throw new Error('Il file non contiene JSON valido.')
  }

  const document = ensureJsonObject(parsedJson) as OpenApiDocument
  const paths = document.paths

  if (!paths || typeof paths !== 'object') {
    throw new Error('Spec OpenAPI non valida: campo "paths" mancante.')
  }

  const isOpenApi3 = Boolean(document.openapi)
  const documentType: 'openapi3' | 'swagger2' = isOpenApi3 ? 'openapi3' : 'swagger2'
  const baseUrl = buildBaseUrl(document).trim()
  const normalizedBaseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl
  const sharedSecrets: ParsedOpenApi['sharedSecrets'] = normalizedBaseUrl
    ? [{ key: 'BASE_URL', value: normalizedBaseUrl }]
    : []
  const requestBaseUrl = ''
  const title = document.info?.title?.trim() || 'Imported API'

  const requests: ParsedOpenApi['requests'] = []

  for (const [path, operations] of Object.entries(paths)) {
    if (!operations || typeof operations !== 'object') {
      continue
    }

    for (const [methodKey, operationRaw] of Object.entries(operations)) {
      if (!METHOD_KEYS.has(methodKey.toLowerCase())) {
        continue
      }

      const method = normalizeMethod(methodKey)
      if (!method) {
        continue
      }

      const operation = ensureJsonObject(operationRaw)
      const requestName =
        (typeof operation.summary === 'string' && operation.summary.trim()) ||
        (typeof operation.operationId === 'string' && operation.operationId.trim()) ||
        `${method} ${path}`

      const requestBody = buildRequestBody(operation, documentType)
      const requestHeaders = buildDefaultHeaders(operation, documentType)

      requests.push({
        name: requestName,
        method,
        url: normalizeUrl(requestBaseUrl, path),
        headers: requestHeaders,
        body: requestBody,
        bodyMode: requestBody ? 'json' : 'none',
        bodyContentType: requestHeaders.find((header) => header.key.toLowerCase() === 'content-type')?.value ?? '',
        formFields: [],
        auth: createDefaultAuth(),
        description: typeof operation.description === 'string' ? operation.description : '',
      })
    }
  }

  if (requests.length === 0) {
    throw new Error('Non sono stati trovati endpoint importabili nella spec OpenAPI.')
  }

  return {
    workspaceName: title,
    collectionName: `${title} Collection`,
    sharedSecrets,
    requests,
  }
}
