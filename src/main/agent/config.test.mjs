import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildConfig } from './config.js'

const BASE = { provider: 'anthropic', requireApproval: true, ignorePatterns: [], customAgents: [] }

test('an anthropic model is dropped without an API key (Claude Pro/Max OAuth cannot run it)', () => {
  const config = buildConfig({ ...BASE, model: 'claude-sonnet-4-5' }, false)
  assert.equal(config.model, undefined)
})

test('an anthropic model is kept once a real API key is present', () => {
  const config = buildConfig({ ...BASE, model: 'claude-sonnet-4-5' }, true)
  assert.equal(config.model, 'anthropic/claude-sonnet-4-5')
})

test('a non-anthropic model is never blocked by the API-key check', () => {
  const config = buildConfig({ ...BASE, provider: 'openai', model: 'gpt-4.1' }, false)
  assert.equal(config.model, 'openai/gpt-4.1')
})
