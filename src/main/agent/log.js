import { app } from 'electron'
import fs from 'fs'
import path from 'path'

let stream = null

function sink() {
  if (stream) return stream
  const file = path.join(app.getPath('userData'), 'agent.log')
  // ponytail: append-only, never rotated. Add rotation if it ever gets big.
  stream = fs.createWriteStream(file, { flags: 'a' })
  return stream
}

/** Append one JSON line per agent action so a session can be replayed from disk. */
export function logAgent(tag, data = {}) {
  const line = JSON.stringify({ t: new Date().toISOString(), tag, ...data })
  try {
    sink().write(line + '\n')
  } catch {}
  console.log('[agent]', line)
}

export function agentLogPath() {
  return path.join(app.getPath('userData'), 'agent.log')
}
