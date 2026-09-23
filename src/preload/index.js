import { contextBridge, ipcRenderer } from 'electron'

const on = (channel) => (cb) => {
  const listener = (_event, payload) => cb(payload)
  ipcRenderer.on(channel, listener)
  return () => ipcRenderer.removeListener(channel, listener)
}

const api = {
  version: '0.1.0',
  project: {
    listRecent: () => ipcRenderer.invoke('project:list-recent'),
    openExisting: () => ipcRenderer.invoke('project:open-existing'),
    createNew: (name) => ipcRenderer.invoke('project:create-new', { name }),
    createFromPrompt: (prompt) => ipcRenderer.invoke('project:create-from-prompt', { prompt }),
    openRecent: (path) => ipcRenderer.invoke('project:open-recent', { path }),
    removeRecent: (path) => ipcRenderer.invoke('project:remove-recent', { path }),
    reveal: (path) => ipcRenderer.invoke('project:reveal', { path }),
    git: (directory, op, file) => ipcRenderer.invoke('project:git', { directory, op, file })
  },
  agent: {
    status: () => ipcRenderer.invoke('agent:status'),
    start: () => ipcRenderer.invoke('agent:start'),
    stop: () => ipcRenderer.invoke('agent:stop'),
    setDirectory: (directory) => ipcRenderer.invoke('agent:set-directory', directory),
    getDirectory: () => ipcRenderer.invoke('agent:get-directory'),
    providers: () => ipcRenderer.invoke('agent:providers'),
    listSessions: (directory) => ipcRenderer.invoke('agent:list-sessions', directory),
    createSession: (title, directory) => ipcRenderer.invoke('agent:create-session', { title, directory }),
    getMessages: (sessionID, directory, limit) =>
      ipcRenderer.invoke('agent:get-messages', { sessionID, directory, limit }),
    send: (sessionID, text, directory, agent, model) =>
      ipcRenderer.invoke('agent:send', { sessionID, text, directory, agent, model }),
    abort: (sessionID, directory) => ipcRenderer.invoke('agent:abort', { sessionID, directory }),
    deleteSession: (sessionID, directory) =>
      ipcRenderer.invoke('agent:delete-session', { sessionID, directory }),
    listPermissions: (directory) => ipcRenderer.invoke('agent:list-permissions', { directory }),
    replyPermission: (requestID, reply, directory) =>
      ipcRenderer.invoke('agent:reply-permission', { requestID, reply, directory }),
    listQuestions: (directory) => ipcRenderer.invoke('agent:list-questions', { directory }),
    replyQuestion: (requestID, reply, directory) =>
      ipcRenderer.invoke('agent:reply-question', { requestID, reply, directory }),
    rejectQuestion: (requestID, directory) =>
      ipcRenderer.invoke('agent:reject-question', { requestID, directory }),
    mcpStatus: () => ipcRenderer.invoke('agent:mcp-status', {}),
    mcpAdd: (name, config) => ipcRenderer.invoke('agent:mcp-add', { name, config }),
    mcpConnect: (name) => ipcRenderer.invoke('agent:mcp-connect', { name }),
    mcpDisconnect: (name) => ipcRenderer.invoke('agent:mcp-disconnect', { name }),
    mcpRemove: (name) => ipcRenderer.invoke('agent:mcp-remove', { name }),
    mcpAuthenticate: (name) => ipcRenderer.invoke('agent:mcp-authenticate', { name }),
    listFiles: (filePath, directory) => ipcRenderer.invoke('agent:list-files', { filePath, directory }),
    readFile: (filePath, directory) => ipcRenderer.invoke('agent:read-file', { filePath, directory }),
    onEvent: on('agent:event'),
    onState: on('agent:state')
  },
  dev: {
    start: (directory) => ipcRenderer.invoke('dev:start', { directory }),
    stop: () => ipcRenderer.invoke('dev:stop'),
    status: () => ipcRenderer.invoke('dev:status'),
    onState: on('dev:state'),
    onLog: on('dev:log')
  },
  usage: {
    get: () => ipcRenderer.invoke('usage:get'),
    reset: () => ipcRenderer.invoke('usage:reset')
  },
  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    save: (partial) => ipcRenderer.invoke('settings:save', partial)
  },
  system: {
    specs: () => ipcRenderer.invoke('system:specs'),
    ollamaModels: (baseUrl) => ipcRenderer.invoke('system:ollama-models', baseUrl)
  },
  auth: {
    status: () => ipcRenderer.invoke('auth:status'),
    login: (provider) => ipcRenderer.invoke('auth:login', provider),
    logout: (provider) => ipcRenderer.invoke('auth:logout', provider),
    cancel: (provider) => ipcRenderer.invoke('auth:cancel', provider),
    onEvent: on('auth:event'),
    onDone: on('auth:done')
  },
  architecture: {
    get: (directory) => ipcRenderer.invoke('architecture:get', { directory })
  }
}

if (process.contextIsolated) {
  contextBridge.exposeInMainWorld('api', api)
} else {
  window.api = api
}