import { ipcMain } from 'electron'
import { spawn } from 'child_process'
import fs from 'fs'
import net from 'net'
import path from 'path'
import { findDevUrl } from '../shared/parseDevUrl.mjs'
import { getSettings } from './agent/store'

const START_TIMEOUT = 90000
const MAX_LOG_LINES = 300

// Only ever one preview server at a time — it belongs to the open project.
let current = null
let broadcast = () => {}

function emit(patch = {}) {
  if (!current) {
    broadcast('dev:state', { state: 'stopped', url: null, directory: null })
    return
  }
  Object.assign(current, patch)
  broadcast('dev:state', {
    state: current.state,
    url: current.url,
    directory: current.directory,
    script: current.script,
    message: current.message || null
  })
}

function pushLog(line) {
  if (!current) return
  const text = String(line).replace(/\r/g, '').trimEnd()
  if (!text) return
  current.logs.push(text)
  if (current.logs.length > MAX_LOG_LINES) current.logs.shift()
  broadcast('dev:log', { line: text })
}

function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer()
    server.unref()
    server.on('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address()
      server.close(() => resolve(port))
    })
  })
}

function pickScript(directory) {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(directory, 'package.json'), 'utf-8'))
    const scripts = pkg.scripts || {}
    if (scripts.dev) return 'dev'
    if (scripts.start) return 'start'
    return null
  } catch {
    return null
  }
}

function killTree(child) {
  if (!child || child.killed) return
  if (process.platform === 'win32') {
    // npm spawns the real server as a grandchild; killing npm alone orphans it.
    spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { windowsHide: true })
  } else {
    try {
      process.kill(-child.pid, 'SIGTERM')
    } catch {
      child.kill('SIGTERM')
    }
  }
}

export function stopDevServer() {
  if (!current) return { state: 'stopped' }
  clearTimeout(current.timer)
  const child = current.child
  current.state = 'stopped'
  current.url = null
  emit()
  current = null
  killTree(child)
  broadcast('dev:state', { state: 'stopped', url: null, directory: null })
  return { state: 'stopped' }
}

// `args` never contain user input (the script is always the literal 'dev' or 'start'),
// so the shell needed to resolve npm.cmd on Windows introduces nothing injectable.
function spawnNpm(session, args) {
  const child = spawn('npm', args, {
    cwd: session.directory,
    env: { ...process.env, PORT: String(session.port), BROWSER: 'none', FORCE_COLOR: '0' },
    shell: true,
    windowsHide: true
  })
  session.child = child
  pushLog(`$ npm ${args.join(' ')}`)
  return child
}

function runScript(session) {
  if (session !== current) return
  emit({ message: null })
  const child = spawnNpm(session, ['run', session.script])

  const scan = (data) => {
    const text = String(data)
    for (const line of text.split(/\r?\n/)) pushLog(line)
    if (session !== current || current.url) return
    const url = findDevUrl(text)
    if (url) {
      clearTimeout(current.timer)
      emit({ url, state: 'running' })
    }
  }

  child.stdout?.on('data', scan)
  child.stderr?.on('data', scan)

  child.on('error', (err) => {
    if (session !== current) return
    emit({ state: 'error', message: `Failed to start dev server: ${err.message}` })
  })

  child.on('exit', (code) => {
    if (session !== current) return
    clearTimeout(current.timer)
    if (current.state === 'stopped') return
    emit({
      state: 'error',
      url: null,
      message: `Dev server exited with code ${code}. Check the log below.`
    })
  })

  // Only the dev script is timed — an install ahead of it can legitimately take minutes.
  current.timer = setTimeout(() => {
    if (session !== current || current.url) return
    emit({
      state: 'error',
      message: 'No local URL appeared within 90s. Does this script start a web server?'
    })
  }, START_TIMEOUT)
  current.timer.unref?.()
}

function install(session) {
  emit({ message: 'Installing dependencies...' })
  const child = spawnNpm(session, ['install'])

  const scan = (data) => {
    for (const line of String(data).split(/\r?\n/)) pushLog(line)
  }
  child.stdout?.on('data', scan)
  child.stderr?.on('data', scan)

  child.on('error', (err) => {
    if (session !== current) return
    emit({ state: 'error', message: `Failed to run npm install: ${err.message}` })
  })

  child.on('exit', (code) => {
    if (session !== current || current.state === 'stopped') return
    if (code !== 0) {
      emit({ state: 'error', message: `npm install exited with code ${code}. Check the log below.` })
      return
    }
    runScript(session)
  })
}

export async function startDevServer(directory) {
  if (!directory || !fs.existsSync(directory)) return { error: 'missing-directory' }
  if (current && current.directory === directory && current.state !== 'error') {
    return { state: current.state, url: current.url }
  }
  if (current) stopDevServer()

  const script = pickScript(directory)
  if (!script) return { error: 'no-dev-script' }

  const port = await freePort().catch(() => 0)

  current = {
    child: null,
    directory,
    script,
    port,
    url: null,
    state: 'starting',
    message: null,
    logs: [],
    timer: null
  }
  const session = current
  emit()

  // A freshly scaffolded project has no node_modules, so the dev script would die
  // before it ever printed a URL.
  const needsInstall =
    fs.existsSync(path.join(directory, 'package.json')) && !fs.existsSync(path.join(directory, 'node_modules'))

  if (needsInstall && getSettings().autoInstall !== false) install(session)
  else runScript(session)

  return { state: 'starting', script }
}

export function devStatus() {
  if (!current) return { state: 'stopped', url: null, directory: null, logs: [] }
  return {
    state: current.state,
    url: current.url,
    directory: current.directory,
    script: current.script,
    message: current.message || null,
    logs: current.logs.slice(-MAX_LOG_LINES)
  }
}

export function registerDevServerHandlers({ broadcast: send }) {
  broadcast = send
  ipcMain.handle('dev:start', (_e, { directory } = {}) => startDevServer(directory))
  ipcMain.handle('dev:stop', () => stopDevServer())
  ipcMain.handle('dev:status', () => devStatus())
}
