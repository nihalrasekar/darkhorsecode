/**
 * Line diff for a tool call's own oldString/newString (or write-tool content) —
 * no git involved. Same {hunks, additions, deletions} shape parseGit.mjs produces,
 * so the Diff page's and ToolCard's renderer can share styling.
 */

const MAX_DIFF_LINES = 4000 // ponytail: O(n*m) LCS: cap combined lines, else skip diffing

export function diffStrings(oldStr, newStr) {
  const splitLines = (s) => (s ? String(s).split(/\r?\n/) : [])
  const a = splitLines(oldStr)
  const b = splitLines(newStr)

  if (a.length * b.length > MAX_DIFF_LINES * MAX_DIFF_LINES || a.length + b.length > MAX_DIFF_LINES * 2) {
    return {
      hunks: [{ oldStart: 1, oldLines: a.length, newStart: 1, newLines: b.length, lines: b.map((text) => ({ type: 'add', text })) }],
      additions: b.length,
      deletions: a.length,
      truncated: true
    }
  }

  // Longest common subsequence table, then walk it back into add/del/ctx lines.
  const n = a.length
  const m = b.length
  const lcs = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1))
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1])
    }
  }

  const lines = []
  let additions = 0
  let deletions = 0
  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      lines.push({ type: 'ctx', text: a[i] })
      i++
      j++
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      lines.push({ type: 'del', text: a[i] })
      deletions++
      i++
    } else {
      lines.push({ type: 'add', text: b[j] })
      additions++
      j++
    }
  }
  while (i < n) {
    lines.push({ type: 'del', text: a[i] })
    deletions++
    i++
  }
  while (j < m) {
    lines.push({ type: 'add', text: b[j] })
    additions++
    j++
  }

  return {
    hunks: [{ oldStart: 1, oldLines: n, newStart: 1, newLines: m, lines }],
    additions,
    deletions
  }
}
