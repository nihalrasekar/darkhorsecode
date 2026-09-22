import { runtime } from './opencodeRuntime'
import { logAgent } from './log'

export class AgentApiError extends Error {
  constructor(status, message) {
    super(message || `Agent server responded with ${status}`)
    this.status = status
  }
}

export class AgentUnavailableError extends Error {
  constructor(message = 'Agent server is not running') {
    super(message)
  }
}

function encodeDirectory(dir) {
  if (!dir) return ''
  return `?directory=${encodeURIComponent(dir)}`
}

export async function request(method, route, { directory, body, query } = {}) {
  if (!runtime.ready && !runtime.child) {
    logAgent('http_skipped', { method, route, reason: 'runtime not running' })
    throw new AgentUnavailableError()
  }
  const url = new URL(`${runtime.baseUrl}${route}`)
  if (directory) url.searchParams.set('directory', directory)
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null) url.searchParams.set(k, v)
    }
  }

  let res
  try {
    res = await fetch(url, {
      method,
      headers: {
        Authorization: runtime.authHeader,
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {})
      },
      body: body !== undefined ? JSON.stringify(body) : undefined
    })
  } catch (err) {
    logAgent('http_unreachable', { method, route, message: err?.message })
    throw new AgentUnavailableError()
  }

  if (res.status === 204) return null
  if (res.status >= 400) {
    let msg = ''
    try {
      msg = await res.text()
    } catch {}
    logAgent('http_error', { method, route, status: res.status, body: msg.slice(0, 800) })
    throw new AgentApiError(res.status, msg || `HTTP ${res.status}`)
  }
  try {
    return await res.json()
  } catch {
    return null
  }
}

export const api = {
  health: () => request('GET', '/global/health'),

  listSessions: (directory) => request('GET', '/session', { directory }),
  createSession: (directory, title) => request('POST', '/session', { directory, body: { title } }),
  getSession: (sessionID, directory) => request('GET', `/session/${sessionID}`, { directory }),
  setSessionTitle: (sessionID, title, directory) =>
    request('PATCH', `/session/${sessionID}`, { directory, body: { title } }),
  setSessionPermission: (sessionID, permission, directory) =>
    request('PATCH', `/session/${sessionID}`, { directory, body: { permission } }),
  deleteSession: (sessionID, directory) => request('DELETE', `/session/${sessionID}`, { directory }),

  getMessages: (sessionID, directory, limit = 200) =>
    request('GET', `/session/${sessionID}/message`, { directory, query: { limit } }),
  send: (sessionID, text, directory, extra = {}) =>
    request('POST', `/session/${sessionID}/prompt_async`, {
      directory,
      body: {
        parts: [{ type: 'text', text }],
        ...(extra.model ? { model: extra.model } : {}),
        ...(extra.agent ? { agent: extra.agent } : {})
      }
    }),
  abort: (sessionID, directory) => request('POST', `/session/${sessionID}/abort`, { directory }),
  executeCommand: (sessionID, command, directory) =>
    request('POST', `/session/${sessionID}/command`, { directory, body: { command, arguments: '' } }),

  listPermissions: (directory) => request('GET', '/permission', { directory }),
  replyPermission: (requestID, reply, directory) =>
    request('POST', `/permission/${requestID}/reply`, { directory, body: { reply } }),

  listQuestions: (directory) => request('GET', '/question', { directory }),
  answerQuestion: (requestID, reply, directory) =>
    request('POST', `/question/${requestID}/reply`, { directory, body: { reply } }),
  rejectQuestion: (requestID, directory) =>
    request('POST', `/question/${requestID}/reject`, { directory, body: {} }),

  providers: (directory) => request('GET', '/provider', { directory }),

  listFiles: (pathStr, directory) => request('GET', '/file', { directory, query: { path: pathStr } }),
  readFile: (pathStr, directory) => request('GET', '/file/content', { directory, query: { path: pathStr } }),
  fileStatus: (directory) => request('GET', '/file/status', { directory })
}

export function subscribeEvents({ directory, onEvent, onError, signal }) {
  const controller = new AbortController()
  let attempts = 0
  let stopped = false

  const abort = (aborted) => {
    if (!aborted && !controller.signal.aborted) controller.abort()
  }
  signal?.addEventListener('abort', () => {
    stopped = true
    controller.abort()
  })

  const connect = async () => {
    if (stopped || controller.signal.aborted) return
    const url = new URL(`${runtime.baseUrl}/event`)
    if (directory) url.searchParams.set('directory', directory)
    try {
      const res = await fetch(url, { headers: { Authorization: runtime.authHeader }, signal: controller.signal })
      if (!res.ok || !res.body) throw new Error(`event stream HTTP ${res.status}`)
      attempts = 0
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      const handle = ({ done, value }) => {
        if (done) return finish()
        buffer += decoder.decode(value, { stream: true })
        let idx
        while ((idx = buffer.indexOf('\n\n')) !== -1) {
          const frame = buffer.slice(0, idx)
          buffer = buffer.slice(idx + 2)
          parseFrame(frame, onEvent)
        }
        reader.read().then(handle).catch(finish)
      }
      reader.read().then(handle).catch(finish)
    } catch (err) {
      if (stopped || controller.signal.aborted) return
      attempts += 1
      onError?.(err, attempts)
      setTimeout(connect, Math.min(2000 * attempts, 8000))
    }
  }

  const finish = () => {
    if (stopped || controller.signal.aborted) return
    setTimeout(connect, 1500)
  }

  connect()
  return controller
}

function parseFrame(frame, onEvent) {
  let event = 'message'
  const dataLines = []
  for (const line of frame.split('\n')) {
    if (line.startsWith('event:')) event = line.slice(6).trim()
    else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim())
  }
  if (dataLines.length === 0) return
  const dataStr = dataLines.join('\n')
  if (dataStr.startsWith('[')) return
  if (!dataStr) return
  try {
    onEvent(JSON.parse(dataStr))
  } catch {}
}