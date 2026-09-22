/**
 * Parsers for the two git outputs the Diff page reads.
 * Pure — no React, no window — so `node --test` can cover them.
 */

const STATUS_KIND = {
  A: 'added',
  M: 'modified',
  D: 'deleted',
  R: 'renamed',
  C: 'added',
  U: 'modified',
  '?': 'added',
  '!': 'ignored'
}

/**
 * `git status --porcelain=v1 --untracked-files=all` ->
 * [{ path, status, staged, unstaged }]
 */
export function parseStatus(text) {
  const out = []
  for (const raw of String(text || '').split(/\r?\n/)) {
    if (raw.length < 4) continue
    const x = raw[0]
    const y = raw[1]
    let path = raw.slice(3).trim()
    // Renames are reported as "old -> new"; the new path is what we diff.
    const arrow = path.indexOf(' -> ')
    if (arrow !== -1) path = path.slice(arrow + 4)
    if (path.startsWith('"') && path.endsWith('"')) path = path.slice(1, -1)
    if (!path) continue
    const code = x !== ' ' && x !== '?' ? x : y
    out.push({
      path,
      status: STATUS_KIND[x === '?' ? '?' : code] || 'modified',
      staged: x !== ' ' && x !== '?',
      unstaged: y !== ' ',
      untracked: x === '?'
    })
  }
  return out
}

/**
 * A unified `git diff` -> { hunks, additions, deletions }.
 * Hunk shape matches what the Diff page already renders.
 */
export function parseDiff(text) {
  const hunks = []
  let current = null
  let additions = 0
  let deletions = 0

  for (const line of String(text || '').split(/\r?\n/)) {
    const header = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/.exec(line)
    if (header) {
      current = {
        oldStart: Number(header[1]),
        oldLines: header[2] === undefined ? 1 : Number(header[2]),
        newStart: Number(header[3]),
        newLines: header[4] === undefined ? 1 : Number(header[4]),
        lines: []
      }
      hunks.push(current)
      continue
    }
    if (!current) continue // file headers, index lines, ---/+++ preamble
    if (line.startsWith('\\')) continue // "\ No newline at end of file"

    const marker = line[0]
    const body = line.slice(1)
    if (marker === '+') {
      additions += 1
      current.lines.push({ type: 'add', text: body })
    } else if (marker === '-') {
      deletions += 1
      current.lines.push({ type: 'del', text: body })
    } else if (marker === ' ' || line === '') {
      current.lines.push({ type: 'ctx', text: body })
    }
  }

  return { hunks, additions, deletions }
}

/** Whole-file view for untracked files, which `git diff` reports as nothing. */
export function wholeFileAsDiff(content) {
  const lines = String(content || '').split(/\r?\n/)
  if (lines.length && lines[lines.length - 1] === '') lines.pop()
  return {
    hunks: [
      {
        oldStart: 0,
        oldLines: 0,
        newStart: 1,
        newLines: lines.length,
        lines: lines.map((text) => ({ type: 'add', text }))
      }
    ],
    additions: lines.length,
    deletions: 0
  }
}
