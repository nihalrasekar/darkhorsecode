import { test } from 'node:test'
import assert from 'node:assert/strict'
import { applyAgentEvent, applyUsage, normalizeHistoryItems, toolTitle } from './applyAgentEvent.mjs'

const feed = (events, start = []) => events.reduce(applyAgentEvent, start)

test('interleaved text streams accumulate per partID', () => {
  const items = feed([
    { kind: 'text_start', partID: 'a' },
    { kind: 'text_start', partID: 'b' },
    { kind: 'text_delta', partID: 'a', text: 'hello ' },
    { kind: 'text_delta', partID: 'b', text: 'other' },
    { kind: 'text_delta', partID: 'a', text: 'world' },
    { kind: 'text_end', partID: 'a' }
  ])
  assert.equal(items.length, 2)
  assert.deepEqual(
    items.map((i) => [i.id, i.text, i.streaming]),
    [
      ['a', 'hello world', false],
      ['b', 'other', true]
    ]
  )
})

test('duplicate text_start does not add a second item', () => {
  const items = feed([{ kind: 'text_start', partID: 'a' }, { kind: 'text_start', partID: 'a' }])
  assert.equal(items.length, 1)
})

test('tool_end error flips only the matching card and shows the error', () => {
  const items = feed([
    { kind: 'tool_start', partID: 't1', tool: { name: 'bash', input: { command: 'npm test' } } },
    { kind: 'tool_start', partID: 't2', tool: { name: 'edit', input: { filePath: 'a.js' } } },
    { kind: 'tool_end', partID: 't2', status: 'error', error: 'permission denied' },
    { kind: 'tool_end', partID: 't1', status: 'success' }
  ])
  assert.deepEqual(
    items.map((i) => [i.title, i.state]),
    [
      ['npm test', 'success'],
      ['permission denied', 'error']
    ]
  )
})

test('events for an unknown partID are a no-op', () => {
  const start = feed([{ kind: 'text_start', partID: 'a' }])
  for (const evt of [
    { kind: 'text_delta', partID: 'zzz', text: 'x' },
    { kind: 'text_end', partID: 'zzz' },
    { kind: 'tool_end', partID: 'zzz', status: 'success' },
    { kind: 'shell_end', partID: 'zzz' },
    { kind: 'session_idle' },
    null
  ]) {
    assert.equal(applyAgentEvent(start, evt), start, `expected no-op for ${JSON.stringify(evt)}`)
  }
})

test('shell events render as tool cards', () => {
  const items = feed([
    { kind: 'shell_start', partID: 's1', cmd: 'npm run build' },
    { kind: 'shell_end', partID: 's1' }
  ])
  assert.deepEqual(items, [
    { kind: 'tool', id: 's1', role: 'assistant', toolName: 'shell', title: 'npm run build', state: 'success' }
  ])
})

test('history parts flatten into the live shape', () => {
  const out = normalizeHistoryItems([
    { kind: 'text', id: '1', role: 'user', text: 'hi' },
    { kind: 'tool', id: '2', role: 'assistant', tool: { name: 'edit', input: { filePath: 'x.ts' } }, state: { status: 'completed' } },
    { kind: 'tool', id: '3', role: 'assistant', tool: 'bash', state: { status: 'error' } },
    { kind: 'file', id: '4', role: 'assistant' },
    { kind: 'step', id: '5', role: 'assistant' }
  ])
  assert.deepEqual(
    out.map((i) => [i.kind, i.id, i.title ?? i.text, i.state ?? null]),
    [
      ['text', '1', 'hi', null],
      ['tool', '2', 'x.ts', 'success'],
      ['tool', '3', 'bash', 'error']
    ]
  )
})

test('usage sums tokens across step_end events and ignores the rest', () => {
  let usage = { tokens: 0, cost: 0 }
  usage = applyUsage(usage, { kind: 'step_end', tokens: { input: 10, output: 5, cache: { read: 2, write: 1 } }, cost: 0.01 })
  usage = applyUsage(usage, { kind: 'text_delta', text: 'x' })
  usage = applyUsage(usage, { kind: 'step_end', tokens: { input: 4 }, cost: 0.02 })
  assert.equal(usage.tokens, 22)
  assert.ok(Math.abs(usage.cost - 0.03) < 1e-9)
})

test('text_part upserts a streaming bubble and finalizes it', () => {
  const items = feed([
    { kind: 'text_part', partID: 'p1', text: 'Hel' },
    { kind: 'text_part', partID: 'p1', text: 'Hello there', done: true }
  ])
  assert.equal(items.length, 1)
  assert.equal(items[0].text, 'Hello there')
  assert.equal(items[0].streaming, false)
})

test('deltas land inside the bubble text_part opened', () => {
  const items = feed([
    { kind: 'text_part', partID: 'p2', text: '' },
    { kind: 'text_delta', partID: 'p2', text: 'Hello there' },
    { kind: 'text_delta', partID: 'p2', text: '!' }
  ])
  assert.equal(items[0].text, 'Hello there!')
})

test('search tools title by what they searched for', () => {
  assert.equal(toolTitle({ tool: { name: 'grep', input: { pattern: 'START_TIMEOUT' } } }), 'START_TIMEOUT')
  assert.equal(toolTitle({ tool: { name: 'glob', input: { pattern: 'src/**/*.js' } } }), 'src/**/*.js')
  assert.equal(toolTitle({ tool: { name: 'read', input: { filePath: 'src/App.jsx' } } }), 'src/App.jsx')
})

test('a failed request becomes a visible error bubble instead of nothing', () => {
  const items = feed([{ kind: 'message_error', messageID: 'm1', message: 'API key is invalid.' }])
  assert.deepEqual(items, [{ kind: 'error', id: 'err-m1', role: 'assistant', text: 'API key is invalid.' }])
})
