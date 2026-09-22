import { app, shell, ipcMain } from 'electron'
import { spawn } from 'child_process'
import fs from 'fs'
import os from 'os'
import path from 'path'
import crypto from 'crypto'
import { createModels } from '@earendil-works/pi-ai'
import { anthropicProvider } from '@earendil-works/pi-ai/providers/anthropic'
import { resolveBinary } from './opencodeRuntime'

export const OAUTH_PROVIDERS = {
  anthropic: {
    id: 'anthropic',
    name: 'Anthropic',
    oauthName: 'Claude Code',
    subscription: 'Claude Pro / Max',
    loginLabel: 'Sign in with Claude Code',
    runtime: { envKey: 'ANTHROPIC_API_KEY' }
  },
  // opencode has correct, built-in ChatGPT/Codex OAuth support (the exact protocol
  // its provider expects — right endpoint, headers, request shape). We drive that
  // directly via `opencode providers login` rather than re-implementing it, since a
  // hand-rolled bridge (the previous approach) got the wire protocol wrong.
  openai: {
    id: 'openai',
    name: 'OpenAI',
    oauthName: 'ChatGPT',
    subscription: 'ChatGPT Plus / Pro',
    loginLabel: 'Sign in with ChatGPT',
    codexLoginMethod: 'ChatGPT Pro/Plus (browser)'
  }
}

const OAUTH_IDS = Object.keys(OAUTH_PROVIDERS)

function opencodeAuthPath() {
  return path.join(os.homedir(), '.local', 'share', 'opencode', 'auth.json')
}

function readOpencodeAuth() {
  try {
    return JSON.parse(fs.readFileSync(opencodeAuthPath(), 'utf-8'))
  } catch {
    return {}
  }
}

const ANSI_RE = /\x1B\[[0-9;?]*[A-Za-z]/g

/**
 * Drive opencode's own `providers login` CLI for a provider id (currently just
 * 'openai'/ChatGPT) instead of talking to its OAuth HTTP endpoints directly —
 * those aren't documented and a guessed request body crashed the server outright.
 * `-p`/`-m` skip the interactive prompts, so the only output we need to parse is
 * the "Go to: <url>" line; everything else (PKCE, callback server, token storage
 * in opencode's own auth.json) opencode handles itself.
 */
function loginViaOpencodeCli(method, { signal, notify }) {
  return new Promise((resolve, reject) => {
    const child = spawn(resolveBinary(), ['providers', 'login', '-p', 'openai', '-m', method], {
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true
    })
    let buffer = ''
    let urlSent = false

    const onAbort = () => child.kill()
    signal?.addEventListener('abort', onAbort, { once: true })

    const onChunk = (d) => {
      buffer += String(d).replace(ANSI_RE, '')
      if (!urlSent) {
        const m = buffer.match(/Go to:\s*(\S+)/)
        if (m) {
          urlSent = true
          notify({ type: 'auth_url', url: m[1], instructions: 'Complete authorization in your browser.' })
          notify({ type: 'progress', message: 'Waiting for authorization…' })
        }
      }
    }
    child.stdout.on('data', onChunk)
    child.stderr.on('data', onChunk)

    child.on('error', (err) => {
      signal?.removeEventListener('abort', onAbort)
      reject(err)
    })
    child.on('exit', (code) => {
      signal?.removeEventListener('abort', onAbort)
      if (signal?.aborted) return reject(new Error('Sign-in cancelled'))
      if (code === 0) return resolve({ type: 'oauth' })
      reject(new Error(`Sign-in failed (opencode exited with code ${code})`))
    })
  })
}

function logoutViaOpencodeCli() {
  return new Promise((resolve, reject) => {
    const child = spawn(resolveBinary(), ['providers', 'logout', 'openai'], { stdio: 'ignore', windowsHide: true })
    child.on('error', reject)
    child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`Sign-out failed (exit ${code})`))))
  })
}

/** File-backed CredentialStore keyed by provider id, one credential per provider. */
class FileCredentialStore {
  constructor(dir) {
    this.dir = dir
    fs.mkdirSync(dir, { recursive: true })
    this.chains = new Map()
  }

  _file(providerId) {
    return path.join(this.dir, `${providerId}.json`)
  }

  async _enqueue(providerId, task, signal) {
    signal?.throwIfAborted()
    const previous = this.chains.get(providerId) ?? Promise.resolve()
    const queued = (async () => {
      await previous.catch(() => {})
      signal?.throwIfAborted()
      return task()
    })()
    const tail = queued.catch(() => {})
    this.chains.set(providerId, tail)
    void tail.then(() => {
      if (this.chains.get(providerId) === tail) this.chains.delete(providerId)
    })
    return queued
  }

  async read(providerId, options) {
    options?.signal?.throwIfAborted()
    try {
      return JSON.parse(fs.readFileSync(this._file(providerId), 'utf-8'))
    } catch {
      return undefined
    }
  }

  async list(_options) {
    const out = []
    for (const f of fs.readdirSync(this.dir)) {
      if (!f.endsWith('.json')) continue
      const providerId = f.slice(0, -'.json'.length)
      const cred = await this.read(providerId)
      if (cred) out.push({ providerId, type: cred.type })
    }
    return out
  }

  async modify(providerId, fn, options) {
    return this._enqueue(
      providerId,
      async () => {
        const current = await this.read(providerId, options)
        const next = await fn(current)
        options?.signal?.throwIfAborted()
        if (next !== undefined) {
          fs.writeFileSync(this._file(providerId), JSON.stringify(next, null, 2))
          return next
        }
        return current
      },
      options?.signal
    )
  }

  async delete(providerId, options) {
    return this._enqueue(
      providerId,
      async () => {
        try {
          fs.unlinkSync(this._file(providerId))
        } catch {}
      },
      options?.signal
    )
  }
}

let modelsPromise = null
let store = null

function credentialDir() {
  return path.join(app.getPath('userData'), 'pi-credentials')
}

function getModels() {
  if (!modelsPromise) {
    modelsPromise = (async () => {
      store = new FileCredentialStore(credentialDir())
      const models = createModels({ credentials: store })
      models.setProvider(anthropicProvider())
      return models
    })()
  }
  return modelsPromise
}

/** Non-secret status for every OAuth-capable provider. */
export async function oauthStatus() {
  const models = await getModels()
  const stored = new Map((await store.list()).map((c) => [c.providerId, c.type]))
  const opencodeAuth = readOpencodeAuth()
  const out = []
  for (const id of OAUTH_IDS) {
    const meta = OAUTH_PROVIDERS[id]
    let configured = false
    let source = 'Not configured'
    let type = null
    let models_ = []

    if (id === 'openai') {
      // Credential lives in opencode's own auth.json, not our pi-ai store.
      if (opencodeAuth?.openai) {
        configured = true
        source = 'OAuth signed in'
        type = 'oauth'
      }
    } else {
      const credType = stored.get(id)
      if (credType === 'oauth') {
        configured = true
        source = 'OAuth signed in'
        type = 'oauth'
      } else {
        try {
          const check = await models.checkAuth(id)
          if (check) {
            configured = true
            source = check.source ?? (check.type === 'oauth' ? 'OAuth' : 'API key')
            type = check.type
          }
        } catch {
          // keep defaults
        }
      }
      models_ = models.getModels(id).map((m) => m.id)
    }

    out.push({ ...meta, configured, source, type, models: models_ })
  }
  return { providers: out }
}

/** Resolve the live OAuth access token for a provider (may refresh). */
async function oauthToken(providerId) {
  try {
    const models = await getModels()
    const auth = await models.getAuth(providerId)
    return { token: auth?.auth?.apiKey || null, headers: auth?.auth?.headers || null }
  } catch {
    return { token: null, headers: null }
  }
}

/**
 * Env vars injected into the agent runtime from OAuth credentials. Only for
 * providers we bridge manually (anthropic) — opencode's 'openai' provider reads
 * its own auth.json natively and needs nothing injected.
 */
export async function oauthEnvVars() {
  const env = {}
  const { token } = await oauthToken('anthropic')
  if (token) env[OAUTH_PROVIDERS.anthropic.runtime.envKey] = token
  return env
}

export function isOAuthConfiguredSync() {
  const found = {}
  try {
    const dir = credentialDir()
    for (const f of fs.readdirSync(dir)) {
      const id = f.endsWith('.json') ? f.slice(0, -5) : null
      if (id === 'anthropic') found.anthropic = true
    }
  } catch {
    // no pi-credentials dir yet
  }
  try {
    if (readOpencodeAuth()?.openai) found.openai = true
  } catch {
    // no opencode auth.json yet
  }
  return found
}

/**
 * OAuth login for a provider, bridging pi-ai's prompt/notify protocol to the
 * renderer over IPC. `broadcast` is a (channel, payload) => void function.
 */
export function registerAuthHandlers({ broadcast, onChange }) {
  let active = null
  const getActive = () => active

  ipcMain.handle('auth:status', async () => {
    const models = await getModels()
    const status = await oauthStatus()
    return {
      active: active
        ? {
            providerId: active.providerId,
            startedAt: active.startedAt,
            events: active.events,
            prompts: active.prompts
          }
        : null,
      ...status
    }
  })

  ipcMain.handle('auth:cancel', () => {
    active?.controller.abort()
    return { cancelled: true }
  })

  ipcMain.handle('auth:answer', (_e, { requestId, value }) => {
    const entry = active?.pending.get(requestId)
    if (entry) {
      active.pending.delete(requestId)
      entry.cleanup?.()
      entry.resolve(value)
    }
    return { accepted: Boolean(entry) }
  })

  ipcMain.handle('auth:login', async (_e, providerId) => {
    if (!OAUTH_PROVIDERS[providerId]) throw new Error(`Unknown OAuth provider: ${providerId}`)
    if (active) throw new Error('A sign-in flow is already in progress. Finish or cancel it first.')
    const controller = new AbortController()
    active = {
      providerId,
      controller,
      startedAt: Date.now(),
      events: [],
      prompts: [],
      pending: new Map()
    }
    const session = active
    const notify = (event) => {
      session.events.push({ event })
      if (event.type === 'auth_url') {
        shell.openExternal(event.url).catch(() => {})
      }
      broadcast('auth:event', { providerId, event })
    }
    try {
      const credential =
        providerId === 'openai'
          ? await loginViaOpencodeCli(OAUTH_PROVIDERS.openai.codexLoginMethod, { signal: controller.signal, notify })
          : await (await getModels()).login(providerId, 'oauth', {
              signal: controller.signal,
              notify,
              prompt: (prompt) =>
                new Promise((resolve, reject) => {
                  if (controller.signal.aborted) return reject(controller.signal.reason || new Error('Sign-in cancelled'))
                  const requestId = crypto.randomUUID()
                  const onGlobalAbort = () => reject(controller.signal.reason || new Error('Sign-in cancelled'))
                  controller.signal.addEventListener('abort', onGlobalAbort, { once: true })
                  const onPromptAbort = () => {
                    session.pending.delete(requestId)
                    broadcast('auth:prompt-closed', { requestId, reason: String(prompt.signal?.reason?.message || 'Prompt resolved elsewhere') })
                    reject(prompt.signal?.reason || new Error('Prompt resolved elsewhere'))
                  }
                  if (prompt.signal?.aborted) return onPromptAbort()
                  if (prompt.signal) prompt.signal.addEventListener('abort', onPromptAbort, { once: true })
                  session.pending.set(requestId, {
                    resolve,
                    reject,
                    cleanup: () => {
                      controller.signal.removeEventListener('abort', onGlobalAbort)
                      prompt.signal?.removeEventListener('abort', onPromptAbort)
                    }
                  })
                  session.prompts.push({ requestId, prompt: { type: prompt.type, message: prompt.message, placeholder: prompt.placeholder, options: prompt.options || null } })
                  broadcast('auth:prompt', { providerId, requestId, prompt: session.prompts[session.prompts.length - 1].prompt })
                })
            })
      broadcast('auth:done', { providerId, ok: true, source: 'OAuth', type: credential.type })
      if (typeof onChange === 'function') onChange(providerId)
      return { ok: true, providerId, type: credential.type }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      const cancelled = controller.signal.aborted || /cancel/i.test(message)
      broadcast('auth:done', { providerId, ok: false, cancelled, message })
      if (!cancelled) throw new Error(message)
      return { ok: false, cancelled, message }
    } finally {
      for (const [, entry] of session.pending) entry?.cleanup?.()
      session.pending.clear()
      active = null
    }
  })

  ipcMain.handle('auth:logout', async (_e, providerId) => {
    if (!OAUTH_PROVIDERS[providerId]) throw new Error(`Unknown OAuth provider: ${providerId}`)
    if (providerId === 'openai') await logoutViaOpencodeCli()
    else await (await getModels()).logout(providerId)
    if (typeof onChange === 'function') onChange(providerId)
    return { ok: true, providerId }
  })

  return { getActive }
}