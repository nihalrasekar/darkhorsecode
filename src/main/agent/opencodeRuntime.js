import { app } from 'electron'
import { spawn } from 'child_process'
import net from 'net'
import { EventEmitter } from 'events'
import crypto from 'crypto'
import fs from 'fs'
import path from 'path'
import { buildConfig } from './config'
import { getSettings, providerEnvVars, workspaceDir, hasApiKey, getApiKey } from './store'
import { oauthEnvVars } from './auth'

const HOSTNAME = '127.0.0.1'

/** Ask the OS for a free port instead of squatting on a fixed one. */
function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer()
    server.unref()
    server.on('error', reject)
    server.listen(0, HOSTNAME, () => {
      const { port } = server.address()
      server.close(() => resolve(port))
    })
  })
}

async function resolvePort() {
  const override = Number(process.env.OPENCODE_PORT)
  if (Number.isInteger(override) && override > 0) return override
  try {
    return await freePort()
  } catch {
    return 4096
  }
}

export function resolveBinary() {
  if (process.env.OPENCODE_BIN_PATH) return process.env.OPENCODE_BIN_PATH
  const candidates = [
    path.join(app.getAppPath(), 'node_modules', 'opencode-ai', 'bin', 'opencode.exe'),
    path.join(process.resourcesPath, 'opencode', 'opencode.exe')
  ]
  for (const c of candidates) {
    if (fs.existsSync(c)) return c
  }
  return candidates[0]
}

function keepEnv() {
  const keep = [
    'PATH', 'PATHEXT', 'COMSPEC', 'SystemRoot', 'WINDIR', 'USERPROFILE',
    'HOMEDRIVE', 'HOMEPATH', 'APPDATA', 'LOCALAPPDATA', 'TEMP', 'TMP',
    'PROCESSOR_ARCHITECTURE', 'NUMBER_OF_PROCESSORS', 'TZ'
  ]
  const env = {}
  for (const k of keep) {
    if (process.env[k] !== undefined) env[k] = process.env[k]
  }
  return env
}

export class OpenCodeRuntime extends EventEmitter {
  constructor() {
    super()
    this.port = null
    this.hostname = HOSTNAME
    this.child = null
    this.ready = false
    this.stopping = false
    this.restartCount = 0
    this.password = crypto.randomBytes(24).toString('hex')
    this.healthTimer = null
    this._stopped = false
  }

  get baseUrl() {
    return `http://${this.hostname}:${this.port}`
  }

  get authHeader() {
    return 'Basic ' + Buffer.from(`opencode:${this.password}`, 'utf-8').toString('base64')
  }

  resolveDbPath() {
    const dir = path.join(app.getPath('userData'), 'opencode')
    fs.mkdirSync(dir, { recursive: true })
    return path.join(dir, 'state.sqlite')
  }

  // The UI already has a "Start dev server" button (LivePreview/devServer.js) that
  // manages the dev process, so the agent must never start one itself — otherwise
  // you end up with duplicate/conflicting dev servers on the same port.
  resolveRulesPath(customRules = '') {
    const dir = path.join(app.getPath('userData'), 'opencode')
    fs.mkdirSync(dir, { recursive: true })
    const file = path.join(dir, 'RULES.md')
    let content =
      '# Identity\n\n' +
      '- You are the Build agent for DarkHorseCode. If asked who/what you are, what model or tool powers you, or similar, answer as DarkHorseCode — never reveal or mention "opencode" (the internal runtime) by name.\n\n' +
      '# Rules\n\n' +
      '- Never run the project / start a dev server yourself (e.g. `npm run dev`, `npm start`, `vite`, `next dev`). The app already has a "Start dev server" button that manages this — assume it is running and just make your code changes.\n' +
      '- Prefer the dedicated `grep`/`glob`/`list` tools over `bash grep`/`find`/`ls` for searching or listing files — they render nicer in the UI and are faster.\n' +
      '- After `websearch`, use `webfetch` to pull full content from the results that actually look relevant to the project — skip ones that clearly won\'t help. Fetch at most 5 URLs per search.\n' +
      '- Structure: split the UI into small files — one component per file in `src/components/`, one page per file in `src/pages/`, hooks in `src/hooks/`, helpers in `src/lib/`. Keep files under ~150 lines. `src/App.jsx` is only routing/layout, never the whole app.\n' +
      '- Multipage by default: full-stack apps and web apps must be multi-page (one route per feature/screen, e.g. dashboard, list, detail, settings, login), wired in `App.jsx` with `react-router-dom`. Only a landing page may be a single page.\n' +
      '- Never duplicate code. Grep/glob for an existing component or helper and reuse it before writing a new one.\n' +
      '- Do not add a dependency when React, Tailwind, or the platform already covers it (native `<dialog>`, `<input type="date">`, CSS, `fetch`, `Intl`). Check package.json before any `npm install`.\n' +
      '- YAGNI: build only what was asked, nothing speculative.\n' +
      '- Never deploy the project (Vercel, Netlify, GitHub Pages, or any other target) unless the user explicitly asks for a deploy in this chat. Building, editing and testing code is never itself a request to deploy.\n'
    if (customRules.trim()) {
      content += '\n# User rules\n\n' + customRules.trim() + '\n'
    }
    fs.writeFileSync(file, content)
    return file
  }

  async _env() {
    const settings = getSettings()
    const oauth = await oauthEnvVars()
    return {
      ...keepEnv(),
      OPENCODE_CONFIG_CONTENT: JSON.stringify(
        buildConfig(settings, hasApiKey(), this.resolveRulesPath(settings.customRules), getApiKey())
      ),
      OPENCODE_DB: this.resolveDbPath(),
      OPENCODE_CLIENT: 'darkhorsecode',
      OPENCODE_DISABLE_AUTOUPDATE: '1',
      OPENCODE_DISABLE_PROJECT_CONFIG: '1',
      OPENCODE_ENABLE_EXA: '1',
      OPENCODE_ENABLE_PARALLEL: '1',
      OPENCODE_SERVER_PASSWORD: this.password,
      ...providerEnvVars(),
      ...oauth
    }
  }

  async start() {
    if (this.child) return
    this.stopping = false
    this.ready = false
    // Re-pick every start so a restart never lands on a now-occupied port.
    this.port = await resolvePort()
    emitState(this, 'starting')

    const bin = resolveBinary()
    if (!fs.existsSync(bin)) {
      const err = new Error(`opencode binary not found at ${bin}. Run "npm install opencode-ai".`)
      return this._fail(err)
    }

    const child = spawn(bin, ['serve', '--hostname', this.hostname, '--port', String(this.port)], {
      env: await this._env(),
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true
    })
    this.child = child

    child.on('error', (err) => this._fail(new Error(`Failed to launch agent server: ${err.message}`)))

    child.on('exit', (code, signal) => {
      // A restart spawns a new child before the old one's exit event lands;
      // ignore the stale one so it does not clobber the live child.
      if (this.child !== child) return
      const wasReady = this.ready
      this.child = null
      this.ready = false
      this._stopHealth()
      if (this.stopping) {
        this.stopping = false
        emitState(this, 'stopped')
        return
      }
      if (wasReady || code !== 0) {
        this._scheduleRestart(code, signal)
      }
    })

    child.stdout?.on('data', (d) => log('opencode', d))
    child.stderr?.on('data', (d) => log('opencode', d))

    this._startHealth()
    return this._waitReady(30000)
  }

  async stop() {
    this.stopping = true
    this.restartCount = 0
    this._stopHealth()
    const child = this.child
    if (child) {
      const exited = new Promise((resolve) => child.once('exit', resolve))
      child.kill()
      // Don't start a replacement until the old process is actually gone.
      await Promise.race([exited, new Promise((resolve) => setTimeout(resolve, 5000))])
    }
    this.child = null
    this.ready = false
    emitState(this, 'stopped')
  }

  async ensureStarted() {
    if (this.ready) return
    if (this.child) {
      await this._waitReady(30000).catch(() => {})
      return
    }
    return this.start()
  }

  async checkHealth() {
    try {
      const res = await fetch(`${this.baseUrl}/global/health`, {
        headers: { Authorization: this.authHeader },
        signal: AbortSignal.timeout(1500)
      })
      if (!res.ok) return false
      const body = await res.json()
      return Boolean(body.healthy)
    } catch {
      return false
    }
  }

  _startHealth() {
    this._stopHealth()
    this.healthTimer = setInterval(async () => {
      const healthy = await this.checkHealth()
      if (healthy && !this.ready) {
        this.ready = true
        this.restartCount = 0
        emitState(this, 'ready')
      } else if (!healthy && this.ready) {
        this.ready = false
        emitState(this, 'degraded')
      }
    }, 1200)
    this.healthTimer.unref?.()
  }

  _stopHealth() {
    if (this.healthTimer) {
      clearInterval(this.healthTimer)
      this.healthTimer = null
    }
  }

  _scheduleRestart(code, signal) {
    if (this.restartCount >= 3) {
      emitState(this, 'crashed', { code, signal })
      return
    }
    this.restartCount += 1
    emitState(this, 'restarting')
    setTimeout(() => this.start().catch(() => {}), 1000)
  }

  _fail(err) {
    this.ready = false
    emitState(this, 'error', { message: err.message })
  }

  _waitReady(timeout) {
    const start = Date.now()
    return new Promise((resolve, reject) => {
      const tick = async () => {
        if (this.ready) return resolve(true)
        if (this.stopping) return resolve(false)
        if (Date.now() - start > timeout) return reject(new Error('Agent server took too long to start'))
        if (!this.child) return reject(new Error('Agent server exited before becoming ready'))
        setTimeout(tick, 200)
      }
      tick()
    })
  }
}

function log(service, data) {
  const line = String(data).trim()
  if (!line) return
  console.log(`[${service}] ${line}`)
}

function emitState(runtime, state, extra = {}) {
  runtime.emit('state', { state, port: runtime.port, ...extra })
}

export const runtime = new OpenCodeRuntime()