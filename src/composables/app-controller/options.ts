export const DND_KIND_MIME = 'application/x-requestmaker-dnd-kind'
export const DND_COLLECTION_ID_MIME = 'application/x-requestmaker-collection-id'
export const DND_REQUEST_ID_MIME = 'application/x-requestmaker-request-id'
export const DND_REQUEST_SOURCE_COLLECTION_ID_MIME = 'application/x-requestmaker-request-source-collection-id'

export const METHOD_OPTIONS = [
  { label: 'GET', value: 'GET' },
  { label: 'POST', value: 'POST' },
  { label: 'PUT', value: 'PUT' },
  { label: 'PATCH', value: 'PATCH' },
  { label: 'DELETE', value: 'DELETE' },
  { label: 'OPTIONS', value: 'OPTIONS' },
  { label: 'HEAD', value: 'HEAD' },
]

export const THEME_OPTIONS = [
  { label: 'Sistema', value: 'system' },
  { label: 'Chiaro', value: 'light' },
  { label: 'Scuro', value: 'dark' },
]

export const DARK_THEME_OPTIONS = [
  { label: 'Slate', value: 'slate' },
  { label: 'Midnight', value: 'midnight' },
  { label: 'Graphite', value: 'graphite' },
  { label: 'Forest', value: 'forest' },
]

export const LIGHT_THEME_OPTIONS = [
  { label: 'Clean', value: 'clean' },
  { label: 'Paper', value: 'paper' },
  { label: 'Sand', value: 'sand' },
  { label: 'Mint', value: 'mint' },
]

export const ACCENT_COLOR_OPTIONS = [
  { label: 'Blu', value: 'blue' },
  { label: 'Ciano', value: 'cyan' },
  { label: 'Smeraldo', value: 'emerald' },
  { label: 'Ambra', value: 'amber' },
  { label: 'Rosa', value: 'rose' },
  { label: 'Viola', value: 'violet' },
]

export const EDITOR_TABS = [
  { label: 'Headers', value: 'headers' },
  { label: 'Body', value: 'body' },
  { label: 'Autorizzazione', value: 'authorization' },
  { label: 'Descrizione', value: 'description' },
]

export const AUTH_TYPE_OPTIONS = [
  { label: 'Inherit', value: 'inherit' },
  { label: 'None', value: 'none' },
  { label: 'Basic Auth', value: 'basic' },
  { label: 'Digest Auth', value: 'digest' },
  { label: 'Bearer', value: 'bearer' },
  { label: 'OAuth 2.0', value: 'oauth2' },
  { label: 'API Key', value: 'apiKey' },
  { label: 'AWS Signature', value: 'awsSignature' },
  { label: 'HAWK', value: 'hawk' },
  { label: 'JWT', value: 'jwt' },
]

export const AUTH_API_KEY_IN_OPTIONS = [
  { label: 'Header', value: 'header' },
  { label: 'Query Param', value: 'query' },
]

export const BODY_MODE_OPTIONS = [
  { label: 'Auto', value: 'auto' },
  { label: 'None', value: 'none' },
  { label: 'Raw', value: 'raw' },
  { label: 'JSON', value: 'json' },
  { label: 'x-www-form-urlencoded', value: 'urlencoded' },
  { label: 'form-data', value: 'form-data' },
  { label: 'File (binary)', value: 'file' },
]

export const BODY_CONTENT_TYPE_OPTIONS = [
  {
    label: 'JSON',
    options: [
      { label: 'application/json', value: 'application/json' },
      { label: 'application/ld+json', value: 'application/ld+json' },
      { label: 'application/problem+json', value: 'application/problem+json' },
      { label: 'application/merge-patch+json', value: 'application/merge-patch+json' },
      { label: 'application/vnd.api+json', value: 'application/vnd.api+json' },
      { label: 'application/x-ndjson', value: 'application/x-ndjson' },
      { label: 'application/graphql+json', value: 'application/graphql+json' },
    ],
  },
  {
    label: 'XML / SOAP',
    options: [
      { label: 'application/xml', value: 'application/xml' },
      { label: 'text/xml', value: 'text/xml' },
      { label: 'application/soap+xml', value: 'application/soap+xml' },
    ],
  },
  {
    label: 'Testo e scripting',
    options: [
      { label: 'text/plain', value: 'text/plain' },
      { label: 'text/html', value: 'text/html' },
      { label: 'text/markdown', value: 'text/markdown' },
      { label: 'text/csv', value: 'text/csv' },
      { label: 'application/javascript', value: 'application/javascript' },
      { label: 'application/sql', value: 'application/sql' },
      { label: 'application/x-yaml', value: 'application/x-yaml' },
    ],
  },
  {
    label: 'Form',
    options: [{ label: 'application/x-www-form-urlencoded', value: 'application/x-www-form-urlencoded' }],
  },
  {
    label: 'Multipart',
    options: [
      { label: 'multipart/form-data', value: 'multipart/form-data' },
      { label: 'multipart/mixed', value: 'multipart/mixed' },
      { label: 'multipart/related', value: 'multipart/related' },
    ],
  },
  {
    label: 'Binari',
    options: [
      { label: 'application/octet-stream', value: 'application/octet-stream' },
      { label: 'application/pdf', value: 'application/pdf' },
      { label: 'application/zip', value: 'application/zip' },
    ],
  },
]

export const USER_TABS = [
  { label: 'Profilo', value: 'profile' },
  { label: 'Team', value: 'team' },
]

export const SETTINGS_TABS = [
  { label: 'Generale', value: 'general' },
  { label: 'Workspace', value: 'workspace' },
  { label: 'Segreti', value: 'secrets' },
]

export const COLLECTION_TABS = [
  { label: 'Overview', value: 'overview' },
  { label: 'Requests', value: 'requests' },
  { label: 'Segreti', value: 'secrets' },
]

export const RESPONSE_VIEWER_TABS = [
  { label: 'Raw', value: 'raw' },
  { label: 'HTML', value: 'html' },
  { label: 'JSON', value: 'json' },
]

export const RESPONSE_SECTION_TABS = [
  { label: 'Risposta', value: 'response' },
  { label: 'Intestazioni', value: 'headers' },
  { label: 'Raw', value: 'raw' },
]
