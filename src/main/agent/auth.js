import { shell, ipcMain } from 'electron'
import { spawn } from 'child_process'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { resolveBinary } from './opencodeRuntime'

// Claude Pro/Max sign-in is intentionally absent — Anthropic rejects that subscription
// token for third-party API calls, so Claude runs only with a real API key.
export const OAUTH_PROVIDERS = {
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

/** Non-secret status for every OAuth-capable provider. */
export function oauthStatus() {
  const configured = Boolean(readOpencodeAuth()?.openai)
  return {
    providers: [
      {
        ...OAUTH_PROVIDERS.openai,
        configured,
        source: configured ? 'OAuth signed in' : 'Not configured',
        type: configured ? 'oauth' : null,
        models: []
      }
    ]
  }
}

export function isOAuthConfiguredSync() {
  return readOpencodeAuth()?.openai ? { openai: true } : {}
}

/**
 * OAuth login for a provider, relaying opencode's sign-in progress to the
 * renderer over IPC. `broadcast` is a (channel, payload) => void function.
 */
export function registerAuthHandlers({ broadcast, onChange }) {
  let active = null
  const getActive = () => active

  ipcMain.handle('auth:status', () => ({
    active: active ? { providerId: active.providerId, startedAt: active.startedAt, events: active.events } : null,
    ...oauthStatus()
  }))

  ipcMain.handle('auth:cancel', () => {
    active?.controller.abort()
    return { cancelled: true }
  })

  ipcMain.handle('auth:login', async (_e, providerId) => {
    if (!OAUTH_PROVIDERS[providerId]) throw new Error(`Unknown OAuth provider: ${providerId}`)
    if (active) throw new Error('A sign-in flow is already in progress. Finish or cancel it first.')
    const controller = new AbortController()
    active = { providerId, controller, startedAt: Date.now(), events: [] }
    const session = active
    const notify = (event) => {
      session.events.push({ event })
      if (event.type === 'auth_url') {
        shell.openExternal(event.url).catch(() => {})
      }
      broadcast('auth:event', { providerId, event })
    }
    try {
      const credential = await loginViaOpencodeCli(OAUTH_PROVIDERS[providerId].codexLoginMethod, {
        signal: controller.signal,
        notify
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
      active = null
    }
  })

  ipcMain.handle('auth:logout', async (_e, providerId) => {
    if (!OAUTH_PROVIDERS[providerId]) throw new Error(`Unknown OAuth provider: ${providerId}`)
    await logoutViaOpencodeCli()
    if (typeof onChange === 'function') onChange(providerId)
    return { ok: true, providerId }
  })

  return { getActive }
}
