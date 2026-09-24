import { app, BrowserWindow, ipcMain, shell } from 'electron'
import path from 'path'
import { runtime } from './opencodeRuntime'
import { api, subscribeEvents, request } from './api'
import {
  normalizeEvent,
  normalizeMessages,
  permissionSummary,
  questionSummary
} from './events'
import { getSettings, saveSettings, hasApiKey, getApiKey, recentProjects, workspaceDir } from './store'
import { getSystemSpecs } from './systemSpecs'
import { readArchitecture } from './architect'
import { registerAuthHandlers, isOAuthConfiguredSync } from './auth'
import { recordEvent, registerUsageHandlers } from '../usageStore'
import { logAgent } from './log'

let currentDirectory = null
let eventController = null

function broadcast(channel, payload) {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send(channel, payload)
  }
}

function resolveDirectory(explicit) {
  if (explicit && typeof explicit === 'string' && explicit.trim()) return explicit
  if (currentDirectory) return currentDirectory
  const recent = recentProjects()
  if (recent.length > 0) return recent[0].path
  return workspaceDir()
}

function ensureDirectory(directory) {
  return resolveDirectory(directory)
}

function attachEventStream(directory) {
  if (eventController) {
    eventController.abort()
    eventController = null
  }
  const controller = subscribeEvents({
    directory,
    onEvent: (raw) => {
      const evt = normalizeEvent(raw)
      if (evt) {
        logAgent('event', { kind: evt.kind, sessionID: evt.sessionID, id: evt.id })
        recordEvent(evt)
        broadcast('agent:event', evt)
      } else {
        logAgent('event_dropped', { type: raw?.type })
      }
    },
    onError: (err, attempt) => {
      logAgent('stream_error', { message: err?.message, attempt })
      broadcast('agent:event', { kind: 'stream_error', id: `stream-${Date.now()}`, message: err?.message, attempt })
    }
  })
  eventController = controller
}

function detachEventStream() {
  if (eventController) {
    eventController.abort()
    eventController = null
  }
}

runtime.on('state', (info) => {
  logAgent('runtime_state', info)
  broadcast('agent:state', info)
  if (info.state === 'ready') {
    attachEventStream(resolveDirectory(currentDirectory))
  } else if (info.state === 'stopped' || info.state === 'error' || info.state === 'crashed') {
    detachEventStream()
  }
})

export function registerAgent() {
  registerUsageHandlers()

  registerAuthHandlers({
    broadcast,
    onChange: () => {
      setTimeout(() => {
        runtime.stop().then(() => runtime.start()).catch(() => {})
      }, 0)
    }
  })

  ipcMain.handle('agent:status', () => {
    const oauth = isOAuthConfiguredSync()
    const apiKey = hasApiKey()
    // opencode's built-in Big Pickle is the only model that runs with no key.
    const keyless = getSettings().model === 'opencode/big-pickle'
    return {
      running: Boolean(runtime.child),
      ready: runtime.ready,
      port: runtime.port,
      hasApiKey: apiKey,
      // A provider is usable via a manual API key OR an OAuth sign-in.
      hasCredentials: apiKey || keyless || Object.keys(oauth).length > 0,
      credentials: { apiKey, oauth }
    }
  })

  ipcMain.handle('agent:start', async () => {
    await runtime.ensureStarted()
    return { ready: runtime.ready }
  })

  ipcMain.handle('agent:stop', async () => {
    await runtime.stop()
    return { running: false }
  })

  ipcMain.handle('agent:set-directory', (_e, directory) => {
    currentDirectory = directory
    if (eventController && runtime.ready) attachEventStream(resolveDirectory(directory))
    return { directory }
  })

  ipcMain.handle('agent:get-directory', () => resolveDirectory(currentDirectory))

  ipcMain.handle('architecture:get', (_e, { directory } = {}) => {
    return readArchitecture(ensureDirectory(directory))
  })

  ipcMain.handle('agent:providers', async () => {
    await runtime.ensureStarted()
    const data = await api.providers(null)
    return data
  })

  ipcMain.handle('agent:list-sessions', async (_e, directory) => {
    await runtime.ensureStarted()
    return api.listSessions(ensureDirectory(directory))
  })

  ipcMain.handle('agent:create-session', async (_e, { title, directory }) => {
    await runtime.ensureStarted()
    const session = await api.createSession(ensureDirectory(directory), title || 'New session')
    logAgent('create_session', { sessionID: session?.id, directory: ensureDirectory(directory) })
    return session
  })

  ipcMain.handle('agent:get-messages', async (_e, { sessionID, limit, directory }) => {
    await runtime.ensureStarted()
    const entries = await api.getMessages(sessionID, ensureDirectory(directory), limit)
    return normalizeMessages(entries)
  })

  ipcMain.handle('agent:send', async (_e, { sessionID, text, directory, agent, model }) => {
    await runtime.ensureStarted()
    logAgent('send', { sessionID, agent: agent || null, model: model || null, chars: (text || '').length })
    try {
      await api.send(sessionID, text, ensureDirectory(directory), {
        ...(agent ? { agent } : {}),
        ...(model ? { model } : {})
      })
    } catch (err) {
      logAgent('send_failed', { sessionID, status: err?.status, message: err?.message })
      throw err
    }
    return { ok: true }
  })

  ipcMain.handle('agent:abort', async (_e, { sessionID, directory }) => {
    await runtime.ensureStarted()
    await api.abort(sessionID, ensureDirectory(directory))
    return { ok: true }
  })

  ipcMain.handle('agent:delete-session', async (_e, { sessionID, directory }) => {
    await runtime.ensureStarted()
    await api.deleteSession(sessionID, ensureDirectory(directory))
    return { ok: true }
  })

  ipcMain.handle('agent:list-permissions', async (_e, { directory }) => {
    await runtime.ensureStarted()
    return api.listPermissions(ensureDirectory(directory))
  })

  ipcMain.handle('agent:reply-permission', async (_e, { requestID, reply, directory }) => {
    await runtime.ensureStarted()
    await api.replyPermission(requestID, reply, ensureDirectory(directory))
    return { ok: true }
  })

  ipcMain.handle('agent:list-questions', async (_e, { directory }) => {
    await runtime.ensureStarted()
    return api.listQuestions(ensureDirectory(directory))
  })

  ipcMain.handle('agent:reply-question', async (_e, { requestID, reply, directory }) => {
    await runtime.ensureStarted()
    await api.answerQuestion(requestID, reply, ensureDirectory(directory))
    return { ok: true }
  })

  ipcMain.handle('agent:reject-question', async (_e, { requestID, directory }) => {
    await runtime.ensureStarted()
    await api.rejectQuestion(requestID, ensureDirectory(directory))
    return { ok: true }
  })

  // MCP connectors are presented as one global list (Mcp.jsx has no per-project
  // switcher), but opencode scopes /mcp config by directory. Anchor every MCP call
  // to the stable app workspace dir instead of ensureDirectory()'s currentDirectory
  // (which changes when the user opens a different project) — otherwise servers
  // added while one project is open silently vanish from the list after switching.
  ipcMain.handle('agent:mcp-status', async () => {
    await runtime.ensureStarted()
    return request('GET', '/mcp', { directory: workspaceDir() })
  })

  ipcMain.handle('agent:mcp-add', async (_e, { name, config }) => {
    await runtime.ensureStarted()
    await request('POST', '/mcp', { directory: workspaceDir(), body: { name, config } })
    return { ok: true }
  })

  ipcMain.handle('agent:mcp-connect', async (_e, { name }) => {
    await runtime.ensureStarted()
    await request('POST', `/mcp/${name}/connect`, { directory: workspaceDir() })
    return { ok: true }
  })

  ipcMain.handle('agent:mcp-disconnect', async (_e, { name }) => {
    await runtime.ensureStarted()
    await request('POST', `/mcp/${name}/disconnect`, { directory: workspaceDir() })
    return { ok: true }
  })

  ipcMain.handle('agent:mcp-remove', async (_e, { name }) => {
    await runtime.ensureStarted()
    await request('DELETE', `/mcp/${name}`, { directory: workspaceDir() })
    return { ok: true }
  })

  ipcMain.handle('agent:mcp-authenticate', async (_e, { name }) => {
    await runtime.ensureStarted()
    const result = await request('POST', `/mcp/${name}/auth/authenticate`, { directory: workspaceDir() })
    if (result?.authUrl) shell.openExternal(result.authUrl)
    return result
  })

  ipcMain.handle('agent:list-files', async (_e, { filePath, directory }) => {
    await runtime.ensureStarted()
    return api.listFiles(filePath || '/', ensureDirectory(directory))
  })

  ipcMain.handle('agent:read-file', async (_e, { filePath, directory }) => {
    await runtime.ensureStarted()
    return api.readFile(filePath, ensureDirectory(directory))
  })

  ipcMain.handle('system:specs', () => getSystemSpecs())

  // Ollama's OpenAI-compat baseURL is .../v1 — its own /api/tags (installed
  // models) lives at the root, so strip the suffix before hitting it.
  ipcMain.handle('system:ollama-models', async (_e, baseUrl) => {
    const root = (baseUrl || 'http://localhost:11434').replace(/\/v1\/?$/, '')
    try {
      const res = await fetch(`${root}/api/tags`, { signal: AbortSignal.timeout(2500) })
      if (!res.ok) return { ok: false, models: [] }
      const data = await res.json()
      return { ok: true, models: (data.models || []).map((m) => m.name) }
    } catch {
      return { ok: false, models: [] }
    }
  })

  ipcMain.handle('settings:get', () => {
    const s = getSettings()
    return { settings: s, apiKeySet: hasApiKey() }
  })

  // Only on an explicit eye-click — settings:get never sends the decrypted key.
  ipcMain.handle('settings:reveal-key', () => getApiKey())

  ipcMain.handle('settings:save', async (_e, partial) => {
    const result = saveSettings(partial)
    setTimeout(() => {
      runtime.stop().then(() => runtime.start()).catch(() => {})
    }, 0)
    return { settings: result, apiKeySet: hasApiKey(), restarting: true }
  })
}

export function defaultWorkspace() {
  return path.join(app.getPath('userData'), 'workspace')
}

export { permissionSummary, questionSummary }