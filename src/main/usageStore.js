import { app, ipcMain } from 'electron'
import fs from 'fs'
import path from 'path'

// Token/cost accounting fed straight from the agent SSE stream (step_end events).
// ponytail: whole file rewritten on every step_end; fine at one write per agent step.

const EMPTY = () => ({ input: 0, output: 0, reasoning: 0, cache: 0, cost: 0, steps: 0 })

function storePath() {
  return path.join(app.getPath('userData'), 'usage.json')
}

function read() {
  try {
    const data = JSON.parse(fs.readFileSync(storePath(), 'utf-8'))
    return {
      total: { ...EMPTY(), ...(data.total || {}) },
      days: data.days && typeof data.days === 'object' ? data.days : {},
      sessions: data.sessions && typeof data.sessions === 'object' ? data.sessions : {}
    }
  } catch {
    return { total: EMPTY(), days: {}, sessions: {} }
  }
}

function write(data) {
  try {
    fs.writeFileSync(storePath(), JSON.stringify(data, null, 2))
  } catch {}
}

// opencode reports tokens as { input, output, reasoning, cache: { read, write } }
function flatten(tokens) {
  const t = tokens || {}
  const cache = t.cache || {}
  return {
    input: Number(t.input) || 0,
    output: Number(t.output) || 0,
    reasoning: Number(t.reasoning) || 0,
    cache: (Number(cache.read) || 0) + (Number(cache.write) || 0)
  }
}

function add(bucket, delta, cost) {
  bucket.input += delta.input
  bucket.output += delta.output
  bucket.reasoning += delta.reasoning
  bucket.cache += delta.cache
  bucket.cost += cost
  bucket.steps += 1
  return bucket
}

/** Call with a normalized agent event. Ignores everything but step_end. */
export function recordEvent(evt) {
  if (!evt || evt.kind !== 'step_end') return
  const delta = flatten(evt.tokens)
  const cost = Number(evt.cost) || 0
  if (!delta.input && !delta.output && !delta.reasoning && !delta.cache && !cost) return

  const data = read()
  const day = new Date().toISOString().slice(0, 10)
  data.days[day] = add({ ...EMPTY(), ...(data.days[day] || {}) }, delta, cost)
  if (evt.sessionID) {
    data.sessions[evt.sessionID] = add(
      { ...EMPTY(), ...(data.sessions[evt.sessionID] || {}) },
      delta,
      cost
    )
  }
  add(data.total, delta, cost)
  write(data)
}

export function getUsage() {
  return read()
}

export function registerUsageHandlers() {
  ipcMain.handle('usage:get', () => read())
  ipcMain.handle('usage:reset', () => {
    write({ total: EMPTY(), days: {}, sessions: {} })
    return read()
  })
}
