/**
 * Pull the local URL out of a dev-server log line.
 *
 * Every dev server announces itself with one ("Local: http://localhost:5173/"),
 * so scanning output beats guessing per-framework port flags. Non-local addresses
 * (vite's "Network:" line) are ignored — the webview must hit the loopback host.
 */

// eslint-disable-next-line no-control-regex
const ANSI = /\[[0-9;]*[A-Za-z]/g

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '0.0.0.0', '[::]', '[::1]'])

const URL_RE = /https?:\/\/(\[[0-9a-f:]+\]|[a-z0-9.-]+)(?::(\d{2,5}))?(\/[^\s'"]*)?/gi

export function parseDevUrl(line) {
  const text = String(line || '').replace(ANSI, '')
  URL_RE.lastIndex = 0
  let match
  while ((match = URL_RE.exec(text)) !== null) {
    const host = match[1].toLowerCase()
    if (!LOCAL_HOSTS.has(host)) continue
    const port = match[2]
    if (!port) continue
    // 0.0.0.0 means "all interfaces" — the browser still has to ask for loopback.
    const hostname = host === '0.0.0.0' || host === '[::]' ? 'localhost' : host
    return `http://${hostname}:${port}`
  }
  return null
}

/** Scan a whole chunk of output, returning the first local URL found. */
export function findDevUrl(chunk) {
  for (const line of String(chunk || '').split(/\r?\n/)) {
    const url = parseDevUrl(line)
    if (url) return url
  }
  return null
}
