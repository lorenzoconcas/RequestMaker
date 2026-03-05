import fs from 'node:fs'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'
import { spawn, spawnSync } from 'node:child_process'

const target = (process.argv[2] || '').trim().toLowerCase()
const expectedPlatform = target === 'win' ? 'win32' : target === 'linux' ? 'linux' : target === 'mac' ? 'darwin' : ''
const currentPlatform = process.platform

if (!expectedPlatform) {
  console.error('Target non valido. Usa: win | linux | mac')
  process.exit(1)
}

if (currentPlatform !== expectedPlatform) {
  console.error(`Script pensato per ${expectedPlatform}, ma stai eseguendo su ${currentPlatform}.`)
  process.exit(1)
}

const devPort = Number.parseInt(process.env.REQUESTMAKER_DEV_PORT || '5173', 10)
const appUrl = process.env.REQUESTMAKER_DEV_URL || `http://localhost:${devPort}`
const userDataDir = path.join(os.tmpdir(), 'requestmaker-chrome')

const devServerProcess = spawn('npm run dev:web', {
  env: process.env,
  shell: true,
  stdio: 'inherit',
})

let closing = false

function shutdown(signal = 'SIGTERM') {
  if (closing) {
    return
  }

  closing = true

  if (!devServerProcess.killed) {
    devServerProcess.kill(signal)
  }
}

process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))

devServerProcess.on('error', (error) => {
  console.error(`Errore avvio dev server: ${error.message}`)
  process.exit(1)
})

devServerProcess.on('close', (code) => {
  process.exit(code ?? 0)
})

function waitForPort(port, timeoutMs = 120000) {
  const startedAt = Date.now()
  const hosts = ['127.0.0.1', '::1']

  return new Promise((resolve, reject) => {
    const attempt = () => {
      let resolved = false
      let completed = 0

      const onHostResult = (isSuccess) => {
        if (resolved) {
          return
        }

        if (isSuccess) {
          resolved = true
          resolve()
          return
        }

        completed += 1
        if (completed < hosts.length) {
          return
        }

        if (Date.now() - startedAt >= timeoutMs) {
          reject(new Error(`Timeout in attesa di http://localhost:${port}`))
          return
        }

        setTimeout(attempt, 300)
      }

      for (const host of hosts) {
        const socket = new net.Socket()

        const handleFailure = () => {
          socket.destroy()
          onHostResult(false)
        }

        socket.setTimeout(1000)
        socket.once('connect', () => {
          socket.destroy()
          onHostResult(true)
        })
        socket.once('timeout', handleFailure)
        socket.once('error', handleFailure)
        socket.connect(port, host)
      }
    }

    attempt()
  })
}

function spawnDetached(command, args) {
  const child = spawn(command, args, {
    detached: true,
    stdio: 'ignore',
  })
  child.unref()
}

function launchChromeForWindows() {
  const candidates = [
    path.join(process.env.ProgramFiles || '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
    path.join(process.env['ProgramFiles(x86)'] || '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
  ].filter(Boolean)

  const chromePath = candidates.find((candidate) => fs.existsSync(candidate))
  const executable = chromePath || 'chrome.exe'
  const escapePs = (value) => value.replace(/'/g, "''")
  const script =
    `Start-Process -FilePath '${escapePs(executable)}' ` +
    `-ArgumentList '--disable-web-security','--user-data-dir=${escapePs(userDataDir)}','${escapePs(appUrl)}'`

  const powershellResult = spawnSync(
    'powershell.exe',
    ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script],
    {
      stdio: 'ignore',
      windowsHide: true,
    },
  )

  if (powershellResult.status === 0) {
    return
  }

  const cmdCommand =
    `start "" "${executable}" --disable-web-security ` +
    `--user-data-dir="${userDataDir}" "${appUrl}"`

  const cmdResult = spawnSync('cmd.exe', ['/d', '/s', '/c', cmdCommand], {
    stdio: 'ignore',
    windowsHide: true,
  })

  if (cmdResult.status !== 0) {
    throw new Error('Impossibile avviare Chrome su Windows (PowerShell e cmd falliti).')
  }
}

function launchChromeForLinux() {
  const executables = ['google-chrome', 'google-chrome-stable', 'chromium-browser', 'chromium']
  const args = [
    '--disable-web-security',
    `--user-data-dir=${userDataDir}`,
    appUrl,
  ]

  for (const executable of executables) {
    const probe = spawnSync(executable, ['--version'], { stdio: 'ignore' })
    if (probe.status === 0) {
      spawnDetached(executable, args)
      return
    }
  }

  throw new Error('Chrome/Chromium non trovato nel PATH.')
}

function launchChromeForMac() {
  const chromeArgs = [
    '--disable-web-security',
    `--user-data-dir=${userDataDir}`,
    appUrl,
  ]
  const openAttempts = [
    ['-n', '-b', 'com.google.Chrome', '--args', ...chromeArgs],
    ['-n', '-a', 'Google Chrome', '--args', ...chromeArgs],
  ]

  const appBundleCandidates = [
    '/Applications/Google Chrome.app',
    path.join(os.homedir(), 'Applications', 'Google Chrome.app'),
  ]

  for (const appBundlePath of appBundleCandidates) {
    if (fs.existsSync(appBundlePath)) {
      openAttempts.push(['-n', appBundlePath, '--args', ...chromeArgs])
    }
  }

  for (const openArgs of openAttempts) {
    const result = spawnSync('open', openArgs, { stdio: 'ignore' })
    if (result.status === 0) {
      return
    }
  }

  const binaryCandidates = [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    path.join(os.homedir(), 'Applications', 'Google Chrome.app', 'Contents', 'MacOS', 'Google Chrome'),
  ]

  for (const binaryPath of binaryCandidates) {
    if (!fs.existsSync(binaryPath)) {
      continue
    }

    spawnDetached(binaryPath, chromeArgs)
    return
  }

  throw new Error(
    'Google Chrome non trovato su macOS (provati bundle-id, nome app e path standard /Applications, ~/Applications).',
  )
}

async function main() {
  try {
    await waitForPort(devPort)

    if (expectedPlatform === 'win32') {
      launchChromeForWindows()
    } else if (expectedPlatform === 'linux') {
      launchChromeForLinux()
    } else {
      launchChromeForMac()
    }

    console.log(`Chrome avviato con bypass CORS su ${appUrl}`)
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Errore avvio Chrome con bypass CORS.')
    shutdown('SIGTERM')
  }
}

void main()
