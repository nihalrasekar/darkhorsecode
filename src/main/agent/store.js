import { app, safeStorage } from 'electron'
import fs from 'fs'
import path from 'path'

export const DEFAULT_SETTINGS = {
  provider: 'anthropic',
  apiKey: '',
  baseUrl: '',
  model: '',
  temperature: 0.4,
  maxTokens: 8192,
  requireApproval: true,
  autoInstall: true,
  ignorePatterns: ['node_modules', 'dist', 'build', 'out', '*.lock', '.env'],
  soundOnComplete: true,
  customAgents: [],
  customRules: ''
}

function settingsPath() {
  return path.join(app.getPath('userData'), 'settings.json')
}

function readRaw() {
  try {
    const raw = fs.readFileSync(settingsPath(), 'utf-8')
    return JSON.parse(raw)
  } catch {
    return {}
  }
}

function writeRaw(obj) {
  fs.writeFileSync(settingsPath(), JSON.stringify(obj, null, 2))
}

function decryptKey(enc) {
  if (!enc) return ''
  try {
    const buf = Buffer.from(enc, 'base64')
    return safeStorage.decryptString(buf)
  } catch {
    return ''
  }
}

export function getSettings() {
  const raw = readRaw()
  return { ...DEFAULT_SETTINGS, ...raw, apiKey: '' }
}

export function saveSettings(partial) {
  const prev = readRaw()
  const next = { ...prev }

  if (partial.clearApiKey) {
    delete partial.clearApiKey
    delete next.apiKeyEnc
    delete next.apiKey
  }

  if (Object.prototype.hasOwnProperty.call(partial, 'apiKey')) {
    const key = (partial.apiKey || '').trim()
    delete partial.apiKey
    if (key) {
      if (safeStorage.isEncryptionAvailable()) {
        next.apiKeyEnc = safeStorage.encryptString(key).toString('base64')
        next.apiKey = undefined
      } else {
        next.apiKey = key
      }
    }
    // empty string means "kept in place" — the UI never echoes real keys back
  }

  for (const [k, v] of Object.entries(partial)) {
    if (k === 'apiKey' || k === 'apiKeyEnc') continue
    if (v === undefined) continue
    next[k] = v
  }

  writeRaw(next)
  return getSettings()
}

export function getApiKey() {
  const raw = readRaw()
  if (raw.apiKeyEnc) return decryptKey(raw.apiKeyEnc)
  return raw.apiKey || ''
}

export function hasApiKey() {
  return Boolean(getApiKey())
}

export function providerEnvVars() {
  const s = getSettings()
  const key = getApiKey()
  const env = {}
  // ollama and custom get their apiKey inline in config.js's provider.options,
  // not via env — they use their own provider ids, not 'openai', so an
  // OPENAI_API_KEY here would do nothing (or worse, leak into the real
  // ChatGPT/Codex 'openai' provider — see auth.js — and fight its OAuth session).
  if (!key) return env
  if (s.provider === 'anthropic') {
    env.ANTHROPIC_API_KEY = key
  }
  return env
}

export function workspaceDir() {
  const dir = path.join(app.getPath('userData'), 'workspace')
  fs.mkdirSync(dir, { recursive: true })
  return dir
}

export function recentProjects() {
  try {
    const raw = fs.readFileSync(path.join(app.getPath('userData'), 'projects.json'), 'utf-8')
    const data = JSON.parse(raw)
    return Array.isArray(data.recentProjects) ? data.recentProjects : []
  } catch {
    return []
  }
}