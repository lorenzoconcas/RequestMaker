const path = require('node:path')
const os = require('node:os')
const fsSync = require('node:fs')
const fs = require('node:fs/promises')
const http = require('node:http')
const { spawn } = require('node:child_process')
const { app, BrowserWindow, Menu, ipcMain } = require('electron')

const APP_NAME = 'RequestMaker'
const APP_ID = 'com.requestmaker.app'
const HTTP_PROTOCOLS = new Set(['http:', 'https:'])
const MIME_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.gif': 'image/gif',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
}

app.setName(APP_NAME)

function resolveAppIconPath() {
  const candidates = [
    path.join(__dirname, '..', 'build', 'icon.png'),
    path.join(process.cwd(), 'build', 'icon.png'),
  ]

  for (const candidate of candidates) {
    if (fsSync.existsSync(candidate)) {
      return candidate
    }
  }

  return null
}

function normalizeMethod(method) {
  if (typeof method !== 'string') {
    return 'GET'
  }

  return method.toUpperCase()
}

function ensureHttpUrl(rawUrl) {
  if (typeof rawUrl !== 'string' || !rawUrl.trim()) {
    throw new Error('URL richiesta non valida.')
  }

  let parsed

  try {
    parsed = new URL(rawUrl)
  } catch {
    throw new Error('URL richiesta non valida.')
  }

  if (!HTTP_PROTOCOLS.has(parsed.protocol)) {
    throw new Error('Solo protocolli HTTP/HTTPS sono supportati.')
  }

  return parsed.toString()
}

function normalizeHeaders(rawHeaders) {
  if (!rawHeaders || typeof rawHeaders !== 'object') {
    return {}
  }

  const entries = Object.entries(rawHeaders)
  const headers = {}

  for (const [key, value] of entries) {
    if (typeof key !== 'string') {
      continue
    }

    if (typeof value !== 'string') {
      continue
    }

    const normalizedKey = key.trim()
    if (!normalizedKey) {
      continue
    }

    headers[normalizedKey] = value
  }

  return headers
}

function normalizeTimeout(timeoutMs) {
  if (!Number.isFinite(timeoutMs)) {
    return 30000
  }

  return Math.max(1000, Math.min(120000, Math.floor(timeoutMs)))
}

function parseTextBody(body) {
  return typeof body === 'string' ? body : ''
}

function parseBinaryBody(bodyBase64) {
  if (typeof bodyBase64 !== 'string') {
    return null
  }

  const normalized = bodyBase64.trim()
  if (!normalized) {
    return Buffer.alloc(0)
  }

  return Buffer.from(normalized, 'base64')
}

function parseCurlHeaders(rawHeadersText) {
  if (typeof rawHeadersText !== 'string' || !rawHeadersText.trim()) {
    return []
  }

  const blocks = rawHeadersText
    .split(/\r?\n\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean)

  const candidateBlocks = blocks.filter((block) => /^HTTP\/\d(?:\.\d)?\s+\d{3}/i.test(block))
  const targetBlock = candidateBlocks.length > 0 ? candidateBlocks[candidateBlocks.length - 1] : blocks[blocks.length - 1]

  if (!targetBlock) {
    return []
  }

  const lines = targetBlock.split(/\r?\n/)
  const headers = []

  for (const line of lines.slice(1)) {
    const separatorIndex = line.indexOf(':')
    if (separatorIndex < 1) {
      continue
    }

    headers.push({
      key: line.slice(0, separatorIndex).trim(),
      value: line.slice(separatorIndex + 1).trim(),
    })
  }

  return headers
}

function getMimeType(filePath) {
  const extension = path.extname(filePath).toLowerCase()
  return MIME_TYPES[extension] || 'application/octet-stream'
}

function resolveStaticFilePath(distPath, pathname) {
  const normalizedPath = pathname === '/' ? '/index.html' : pathname
  const cleanPath = normalizedPath.replace(/^\/+/, '')
  const absolutePath = path.resolve(distPath, cleanPath)
  const relativePath = path.relative(distPath, absolutePath)

  if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    return null
  }

  return absolutePath
}

async function serveStaticRendererFile(distPath, req, res) {
  const requestUrl = new URL(req.url || '/', 'http://localhost')
  const requestedFilePath = resolveStaticFilePath(distPath, requestUrl.pathname)

  if (!requestedFilePath) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' })
    res.end('Forbidden')
    return
  }

  let targetPath = requestedFilePath
  let targetStat = await fs.stat(targetPath).catch(() => null)

  if (targetStat?.isDirectory()) {
    targetPath = path.join(targetPath, 'index.html')
    targetStat = await fs.stat(targetPath).catch(() => null)
  }

  if (!targetStat || !targetStat.isFile()) {
    targetPath = path.join(distPath, 'index.html')
    targetStat = await fs.stat(targetPath).catch(() => null)
  }

  if (!targetStat || !targetStat.isFile()) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
    res.end('Build non trovata. Esegui la build prima di avviare Electron.')
    return
  }

  const payload = await fs.readFile(targetPath)
  const isHtmlDocument = path.extname(targetPath).toLowerCase() === '.html'

  res.writeHead(200, {
    'Content-Type': getMimeType(targetPath),
    'Cache-Control': isHtmlDocument ? 'no-store' : 'public, max-age=31536000, immutable',
  })
  res.end(payload)
}

async function sendWithElectronFetch(payload) {
  const method = normalizeMethod(payload.method)
  const url = ensureHttpUrl(payload.url)
  const headers = normalizeHeaders(payload.headers)
  const textBody = parseTextBody(payload.body)
  const binaryBody = parseBinaryBody(payload.bodyBase64)
  const timeoutMs = normalizeTimeout(payload.timeoutMs)

  const abortController = new AbortController()
  const timeoutHandle = setTimeout(() => abortController.abort(), timeoutMs)
  const start = Date.now()

  try {
    const init = {
      method,
      headers,
      signal: abortController.signal,
    }

    if (!['GET', 'HEAD'].includes(method)) {
      if (binaryBody !== null) {
        init.body = binaryBody
      } else if (textBody) {
        init.body = textBody
      }
    }

    const response = await fetch(url, init)
    const responseBody = await response.text()

    return {
      status: response.status,
      statusText: response.statusText,
      durationMs: Date.now() - start,
      headers: Array.from(response.headers.entries()).map(([key, value]) => ({ key, value })),
      body: responseBody,
    }
  } finally {
    clearTimeout(timeoutHandle)
  }
}

async function sendWithCurl(payload) {
  const method = normalizeMethod(payload.method)
  const url = ensureHttpUrl(payload.url)
  const headers = normalizeHeaders(payload.headers)
  const textBody = parseTextBody(payload.body)
  const binaryBody = parseBinaryBody(payload.bodyBase64)
  const timeoutMs = normalizeTimeout(payload.timeoutMs)

  const headerFile = path.join(os.tmpdir(), `requestmaker-${Date.now()}-${Math.random().toString(16).slice(2)}.headers`)
  const bodyFile = path.join(os.tmpdir(), `requestmaker-${Date.now()}-${Math.random().toString(16).slice(2)}.body`)
  const requestBodyFile = binaryBody !== null
    ? path.join(os.tmpdir(), `requestmaker-${Date.now()}-${Math.random().toString(16).slice(2)}.request-body`)
    : null

  const args = [
    '--silent',
    '--show-error',
    '--location',
    '--request',
    method,
    url,
    '--dump-header',
    headerFile,
    '--output',
    bodyFile,
    '--max-time',
    String(Math.max(1, Math.ceil(timeoutMs / 1000))),
    '--write-out',
    '%{http_code}|%{time_total}|%{errormsg}',
  ]

  for (const [key, value] of Object.entries(headers)) {
    args.push('--header', `${key}: ${value}`)
  }

  if (!['GET', 'HEAD'].includes(method)) {
    if (requestBodyFile) {
      await fs.writeFile(requestBodyFile, binaryBody)
      args.push('--data-binary', `@${requestBodyFile}`)
    } else if (textBody) {
      args.push('--data-raw', textBody)
    }
  }

  const start = Date.now()

  let stdout = ''
  let stderr = ''

  const exitCode = await new Promise((resolve, reject) => {
    const child = spawn('curl', args, {
      windowsHide: true,
    })

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString()
    })

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString()
    })

    child.on('error', (error) => {
      reject(error)
    })

    child.on('close', (code) => {
      resolve(code ?? 1)
    })
  })

  const meta = stdout.trim().split('|')
  const status = Number.parseInt(meta[0] || '0', 10) || 0
  const curlDurationMs = Math.round((Number.parseFloat(meta[1] || '0') || 0) * 1000)

  let responseHeadersText = ''
  let responseBody = ''

  try {
    const [headersFileData, bodyFileData] = await Promise.all([
      fs.readFile(headerFile, 'utf8').catch(() => ''),
      fs.readFile(bodyFile, 'utf8').catch(() => ''),
    ])

    responseHeadersText = headersFileData
    responseBody = bodyFileData
  } finally {
    await Promise.all([
      fs.rm(headerFile, { force: true }).catch(() => undefined),
      fs.rm(bodyFile, { force: true }).catch(() => undefined),
      requestBodyFile ? fs.rm(requestBodyFile, { force: true }).catch(() => undefined) : Promise.resolve(),
    ])
  }

  if (exitCode !== 0 && status === 0) {
    throw new Error(stderr.trim() || meta[2] || 'Errore durante esecuzione curl.')
  }

  return {
    status,
    statusText: status ? `HTTP ${status}` : '',
    durationMs: curlDurationMs || Date.now() - start,
    headers: parseCurlHeaders(responseHeadersText),
    body: responseBody,
  }
}

async function handleNativeHttpRequest(_event, payload) {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Payload richiesta non valido.')
  }

  if (payload.transport === 'curl') {
    return sendWithCurl(payload)
  }

  return sendWithElectronFetch(payload)
}

let mainWindow = null
let appIconPath = null
let rendererStaticServer = null
let rendererStaticServerUrl = null

function applyAppIdentity() {
  app.setName(APP_NAME)
  app.setAppUserModelId(APP_ID)
  appIconPath = resolveAppIconPath()

  if (process.platform === 'darwin' && app.dock && appIconPath) {
    app.dock.setIcon(appIconPath)
  }
}

function dispatchMenuAction(actionId) {
  const targetWindow = BrowserWindow.getFocusedWindow() || mainWindow

  if (!targetWindow || targetWindow.isDestroyed()) {
    return
  }

  targetWindow.webContents.send('requestmaker:menu-action', actionId)
}

function buildAppMenuTemplate() {
  const isMac = process.platform === 'darwin'
  const fileCloseOrQuit = isMac ? { role: 'close' } : { role: 'quit' }
  const settingsAccelerator = isMac ? undefined : 'CmdOrCtrl+,'

  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Nuova richiesta',
          accelerator: 'CmdOrCtrl+N',
          click: () => dispatchMenuAction('new-request'),
        },
        {
          label: 'Nuova richiesta rapida',
          accelerator: 'Shift+CmdOrCtrl+N',
          click: () => dispatchMenuAction('new-quick-request'),
        },
        {
          label: 'Nuova request nella collection selezionata',
          accelerator: 'Shift+CmdOrCtrl+R',
          click: () => dispatchMenuAction('new-request-in-selected-collection'),
        },
        {
          label: 'Nuova collection',
          accelerator: 'Shift+CmdOrCtrl+C',
          click: () => dispatchMenuAction('new-collection'),
        },
        {
          label: 'Nuovo workspace',
          accelerator: 'Shift+CmdOrCtrl+W',
          click: () => dispatchMenuAction('new-workspace'),
        },
        { type: 'separator' },
        {
          label: 'Importa OpenAPI JSON...',
          accelerator: 'CmdOrCtrl+O',
          click: () => dispatchMenuAction('import-openapi'),
        },
        { type: 'separator' },
        {
          label: 'Salva richiesta',
          accelerator: 'CmdOrCtrl+S',
          click: () => dispatchMenuAction('save-request'),
        },
        {
          label: 'Invia richiesta',
          accelerator: 'CmdOrCtrl+Enter',
          click: () => dispatchMenuAction('send-request'),
        },
        {
          label: 'Duplica richiesta',
          accelerator: 'CmdOrCtrl+D',
          click: () => dispatchMenuAction('duplicate-request'),
        },
        {
          label: 'Elimina richiesta',
          accelerator: 'Shift+Delete',
          click: () => dispatchMenuAction('delete-request'),
        },
        { type: 'separator' },
        fileCloseOrQuit,
      ],
    },
    {
      label: 'Modifica',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    {
      label: 'Collection',
      submenu: [
        {
          label: 'Rinomina collection selezionata',
          click: () => dispatchMenuAction('rename-selected-collection'),
        },
        {
          label: 'Elimina collection selezionata',
          click: () => dispatchMenuAction('delete-selected-collection'),
        },
      ],
    },
    {
      label: 'Vai',
      submenu: [
        {
          label: 'Workspace',
          accelerator: 'CmdOrCtrl+1',
          click: () => dispatchMenuAction('open-workspace-page'),
        },
        {
          label: 'Utente',
          accelerator: 'CmdOrCtrl+2',
          click: () => dispatchMenuAction('open-user-page'),
        },
        {
          label: 'Impostazioni',
          accelerator: settingsAccelerator,
          click: () => dispatchMenuAction('open-settings-page'),
        },
      ],
    },
    {
      label: 'Vista',
      submenu: [
        {
          label: 'Mostra/Nascondi sidebar',
          accelerator: 'CmdOrCtrl+B',
          click: () => dispatchMenuAction('toggle-sidebar'),
        },
        { type: 'separator' },
        {
          label: 'Tema Sistema',
          click: () => dispatchMenuAction('set-theme-system'),
        },
        {
          label: 'Tema Chiaro',
          click: () => dispatchMenuAction('set-theme-light'),
        },
        {
          label: 'Tema Scuro',
          click: () => dispatchMenuAction('set-theme-dark'),
        },
        { type: 'separator' },
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    {
      label: 'Account',
      submenu: [
        {
          label: 'Accedi/Esci',
          click: () => dispatchMenuAction('toggle-auth'),
        },
      ],
    },
    {
      role: 'help',
      submenu: [
        {
          label: 'Apri pagina impostazioni',
          click: () => dispatchMenuAction('open-settings-page'),
        },
      ],
    },
  ]

  if (isMac) {
    template.unshift({
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        {
          label: 'Impostazioni...',
          accelerator: 'CmdOrCtrl+,',
          click: () => dispatchMenuAction('open-settings-page'),
        },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' },
      ],
    })
  }

  return template
}

function installAppMenu() {
  const menu = Menu.buildFromTemplate(buildAppMenuTemplate())
  Menu.setApplicationMenu(menu)
}

async function startRendererStaticServer() {
  if (rendererStaticServerUrl) {
    return rendererStaticServerUrl
  }

  const distPath = path.resolve(__dirname, '..', 'dist')
  const indexPath = path.join(distPath, 'index.html')

  if (!fsSync.existsSync(indexPath)) {
    throw new Error('Build frontend non trovata. Esegui "npm run build" prima di avviare Electron.')
  }

  rendererStaticServer = http.createServer((req, res) => {
    serveStaticRendererFile(distPath, req, res).catch(() => {
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' })
      }

      if (!res.writableEnded) {
        res.end('Errore interno del server locale.')
      }
    })
  })

  rendererStaticServerUrl = await new Promise((resolve, reject) => {
    rendererStaticServer.once('error', reject)
    rendererStaticServer.listen(0, 'localhost', () => {
      const address = rendererStaticServer.address()
      if (!address || typeof address === 'string') {
        reject(new Error('Impossibile avviare il server locale del renderer.'))
        return
      }

      resolve(`http://localhost:${address.port}`)
    })
  })

  return rendererStaticServerUrl
}

async function stopRendererStaticServer() {
  if (!rendererStaticServer) {
    return
  }

  const server = rendererStaticServer
  rendererStaticServer = null
  rendererStaticServerUrl = null

  await new Promise((resolve) => {
    server.close(() => resolve())
  })
}

async function createWindow() {
  const iconOption = appIconPath && process.platform !== 'darwin' ? { icon: appIconPath } : {}

  mainWindow = new BrowserWindow({
    width: 1500,
    height: 950,
    minWidth: 1100,
    minHeight: 700,
    title: APP_NAME,
    backgroundColor: '#ffffff',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.cjs'),
    },
    ...iconOption,
  })

  const rendererUrl = process.env.ELECTRON_RENDERER_URL

  if (rendererUrl) {
    await mainWindow.loadURL(rendererUrl)
  } else {
    const localRendererUrl = await startRendererStaticServer()
    await mainWindow.loadURL(localRendererUrl)
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

app.whenReady().then(async () => {
  applyAppIdentity()
  ipcMain.handle('requestmaker:http-request', handleNativeHttpRequest)
  installAppMenu()
  await createWindow()

  app.on('activate', async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('will-quit', () => {
  stopRendererStaticServer().catch(() => undefined)
})
