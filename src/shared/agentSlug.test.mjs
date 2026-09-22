import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildAgentMap, mapTools, slugify, toOpenCodeAgent, uniqueSlug } from './agentSlug.mjs'

test('slugify normalises names', () => {
  assert.equal(slugify('Code Reviewer'), 'code-reviewer')
  assert.equal(slugify('  QA / Test  Bot!! '), 'qa-test-bot')
  assert.equal(slugify(''), 'agent')
  assert.equal(slugify(null), 'agent')
})

test('reserved names never get shadowed', () => {
  assert.equal(uniqueSlug('Architect'), 'architect-custom')
  assert.equal(uniqueSlug('build'), 'build-custom')
})

test('collisions get suffixed', () => {
  const taken = new Set(['reviewer'])
  assert.equal(uniqueSlug('Reviewer', taken), 'reviewer-2')
  taken.add('reviewer-2')
  assert.equal(uniqueSlug('Reviewer', taken), 'reviewer-3')
})

test('unknown tool ids are dropped, aliases collapse', () => {
  assert.deepEqual(mapTools(['read', 'shell', 'bash', 'nonsense', 'web']), {
    read: true,
    bash: true,
    webfetch: true
  })
  assert.deepEqual(mapTools([]), {})
  assert.deepEqual(mapTools(undefined), {})
})

test('an agent with no prompt or marked inactive contributes nothing', () => {
  assert.equal(toOpenCodeAgent({ name: 'x', systemPrompt: '   ' }), null)
  assert.equal(toOpenCodeAgent({ name: 'x', systemPrompt: 'hi', active: false }), null)
  assert.equal(toOpenCodeAgent(null), null)
})

test('a valid agent maps to an opencode entry', () => {
  assert.deepEqual(
    toOpenCodeAgent({
      name: 'Reviewer',
      persona: 'Reviews diffs',
      systemPrompt: 'You review code.',
      model: 'anthropic/claude-sonnet-5',
      tools: ['read', 'search'],
      active: true
    }),
    {
      description: 'Reviews diffs',
      prompt: 'You review code.',
      model: 'anthropic/claude-sonnet-5',
      tools: { read: true, grep: true }
    }
  )
})

test('buildAgentMap skips invalid ones and avoids the built-in architect', () => {
  const map = buildAgentMap(
    [
      { name: 'Architect', systemPrompt: 'plan things', active: true },
      { name: 'Reviewer', systemPrompt: 'review', active: true },
      { name: 'Reviewer', systemPrompt: 'review again', active: true },
      { name: 'Empty', systemPrompt: '', active: true },
      { name: 'Off', systemPrompt: 'x', active: false }
    ],
    ['architect']
  )
  assert.deepEqual(Object.keys(map), ['architect-custom', 'reviewer', 'reviewer-2'])
})
