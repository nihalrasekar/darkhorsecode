import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseDiff, parseStatus, wholeFileAsDiff } from './parseGit.mjs'

test('porcelain status maps codes, staging and renames', () => {
  const out = parseStatus(
    [
      ' M src/app.js',
      'A  src/new.js',
      'MM src/both.js',
      ' D src/gone.js',
      'R  old/name.js -> new/name.js',
      '?? scratch.txt',
      ''
    ].join('\n')
  )
  assert.deepEqual(
    out.map((f) => [f.path, f.status, f.staged, f.unstaged, f.untracked]),
    [
      ['src/app.js', 'modified', false, true, false],
      ['src/new.js', 'added', true, false, false],
      ['src/both.js', 'modified', true, true, false],
      ['src/gone.js', 'deleted', false, true, false],
      ['new/name.js', 'renamed', true, false, false],
      ['scratch.txt', 'added', false, true, true]
    ]
  )
})

test('unified diff parses hunk headers, counts and line kinds', () => {
  const patch = [
    'diff --git a/src/app.js b/src/app.js',
    'index 83db48f..bf269f4 100644',
    '--- a/src/app.js',
    '+++ b/src/app.js',
    '@@ -10,6 +10,7 @@ function boot() {',
    ' const a = 1',
    '-const b = 2',
    '+const b = 3',
    '+const c = 4',
    ' return a',
    '\\ No newline at end of file',
    '@@ -40 +41,2 @@',
    '-old',
    '+new',
    '+newer'
  ].join('\n')

  const { hunks, additions, deletions } = parseDiff(patch)
  assert.equal(hunks.length, 2)
  assert.equal(additions, 4)
  assert.equal(deletions, 2)
  assert.deepEqual(
    [hunks[0].oldStart, hunks[0].oldLines, hunks[0].newStart, hunks[0].newLines],
    [10, 6, 10, 7]
  )
  // A header without a comma means a single line.
  assert.deepEqual([hunks[1].oldStart, hunks[1].oldLines, hunks[1].newLines], [40, 1, 2])
  assert.deepEqual(
    hunks[0].lines.map((l) => [l.type, l.text]),
    [
      ['ctx', 'const a = 1'],
      ['del', 'const b = 2'],
      ['add', 'const b = 3'],
      ['add', 'const c = 4'],
      ['ctx', 'return a']
    ]
  )
})

test('preamble without any hunk yields nothing, not a crash', () => {
  assert.deepEqual(parseDiff('diff --git a/x b/x\nindex 1..2\n'), {
    hunks: [],
    additions: 0,
    deletions: 0
  })
  assert.deepEqual(parseDiff(''), { hunks: [], additions: 0, deletions: 0 })
})

test('untracked files render as an all-add hunk', () => {
  const d = wholeFileAsDiff('one\ntwo\n')
  assert.equal(d.additions, 2)
  assert.deepEqual(d.hunks[0].lines, [
    { type: 'add', text: 'one' },
    { type: 'add', text: 'two' }
  ])
})
