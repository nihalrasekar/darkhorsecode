import { test } from 'node:test'
import assert from 'node:assert/strict'
import { findDevUrl, parseDevUrl } from './parseDevUrl.mjs'

test('vite local line, with ANSI colour', () => {
  assert.equal(parseDevUrl('  [32m➜[39m  [1mLocal[22m:   [36mhttp://localhost:[1m5173[22m/[39m'), 'http://localhost:5173')
  assert.equal(parseDevUrl('  ➜  Local:   http://localhost:5173/'), 'http://localhost:5173')
})

test('next and CRA styles', () => {
  assert.equal(parseDevUrl('- Local:        http://localhost:3000'), 'http://localhost:3000')
  assert.equal(parseDevUrl('You can now view app in the browser.  http://127.0.0.1:3000/'), 'http://127.0.0.1:3000')
})

test('0.0.0.0 is rewritten to loopback', () => {
  assert.equal(parseDevUrl('Server listening on http://0.0.0.0:8080'), 'http://localhost:8080')
})

test('non-local addresses are ignored', () => {
  assert.equal(parseDevUrl('  ➜  Network: http://192.168.1.24:5173/'), null)
  assert.equal(parseDevUrl('docs at https://vitejs.dev/guide/'), null)
})

test('lines without a usable URL yield null', () => {
  assert.equal(parseDevUrl('VITE v6.4.3  ready in 412 ms'), null)
  assert.equal(parseDevUrl('http://localhost/no-port'), null)
  assert.equal(parseDevUrl(''), null)
  assert.equal(parseDevUrl(null), null)
})

test('network line before local line still resolves to local', () => {
  const chunk = ['  ➜  Network: http://192.168.1.24:5173/', '  ➜  Local:   http://localhost:5173/'].join('\n')
  assert.equal(findDevUrl(chunk), 'http://localhost:5173')
})

test('findDevUrl returns null for output with no URL', () => {
  assert.equal(findDevUrl('installing dependencies...\nbuilding...'), null)
})
