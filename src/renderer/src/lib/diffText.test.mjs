import { test } from 'node:test'
import assert from 'node:assert/strict'
import { diffStrings } from './diffText.mjs'

test('diffStrings marks changed lines and keeps shared context', () => {
  const diff = diffStrings('a\nb\nc', 'a\nx\nc')
  assert.equal(diff.additions, 1)
  assert.equal(diff.deletions, 1)
  assert.deepEqual(
    diff.hunks[0].lines.map((l) => [l.type, l.text]),
    [
      ['ctx', 'a'],
      ['del', 'b'],
      ['add', 'x'],
      ['ctx', 'c']
    ]
  )
})

test('diffStrings treats undefined old as a pure addition', () => {
  const diff = diffStrings(undefined, 'one\ntwo')
  assert.equal(diff.additions, 2)
  assert.equal(diff.deletions, 0)
})
