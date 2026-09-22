import { useCallback, useEffect, useState } from 'react'
import { ChevronDown, ChevronRight, FileCode2, FolderOpen, Loader2 } from 'lucide-react'

// opencode's GET /file returns [{ name, path, absolute, type: 'file'|'directory', ignored }]
// with directory paths carrying a trailing separator. Root is '.', not '/'.
const ROOT = '.'

const languageColor = {
  tsx: 'text-sky-300',
  jsx: 'text-sky-300',
  ts: 'text-sky-300',
  js: 'text-amber-200',
  mjs: 'text-amber-200',
  py: 'text-amber-300',
  json: 'text-amber-200',
  css: 'text-violet-300',
  md: 'text-zinc-300'
}

const extOf = (name) => name.split('.').pop()?.toLowerCase()
const sortEntries = (entries) =>
  entries.slice().sort((a, b) => {
    if ((a.type === 'directory') !== (b.type === 'directory')) return a.type === 'directory' ? -1 : 1
    return a.name.localeCompare(b.name)
  })

function Row({ node, depth, expanded, loading, selected, onToggle, onSelect }) {
  const isDir = node.type === 'directory'
  return (
    <button
      onClick={() => (isDir ? onToggle(node.path) : onSelect(node.path))}
      className={`flex w-full items-center gap-1.5 rounded px-2 py-[3px] text-left text-xs transition-colors ${
        selected ? 'bg-accent/10 text-accent' : 'text-muted hover:bg-line/60 hover:text-zinc-200'
      }`}
      style={{ paddingLeft: `${depth * 14 + 8}px` }}
      title={node.path}
    >
      {isDir ? (
        loading ? (
          <Loader2 size={11} className="animate-spin" />
        ) : expanded ? (
          <ChevronDown size={11} />
        ) : (
          <ChevronRight size={11} />
        )
      ) : (
        <span className="w-[11px]" />
      )}
      {isDir ? (
        <FolderOpen size={12} className="text-amber-ok" />
      ) : (
        <FileCode2 size={12} className={languageColor[extOf(node.name)] || 'text-faint'} />
      )}
      <span className={isDir ? 'truncate' : 'truncate font-mono text-[11px]'}>{node.name}</span>
    </button>
  )
}

/**
 * Lazily-loaded project file tree backed by window.api.agent.listFiles.
 * `directory` is optional — main falls back to the active project.
 */
export default function FileTree({ directory, selected, onSelect, className = '' }) {
  const [children, setChildren] = useState({})
  const [expanded, setExpanded] = useState({})
  const [loading, setLoading] = useState({})
  const [error, setError] = useState(null)

  const load = useCallback(
    async (dirPath) => {
      setLoading((l) => ({ ...l, [dirPath]: true }))
      try {
        const entries = await window.api.agent.listFiles(dirPath, directory)
        setChildren((c) => ({ ...c, [dirPath]: sortEntries(entries || []).filter((e) => !e.ignored) }))
        setError(null)
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading((l) => ({ ...l, [dirPath]: false }))
      }
    },
    [directory]
  )

  useEffect(() => {
    setChildren({})
    setExpanded({})
    load(ROOT)
  }, [load])

  const toggle = (dirPath) => {
    const isOpen = expanded[dirPath]
    setExpanded((e) => ({ ...e, [dirPath]: !isOpen }))
    if (!isOpen && !children[dirPath]) load(dirPath)
  }

  const render = (dirPath, depth) =>
    (children[dirPath] || []).map((node) => (
      <div key={node.path}>
        <Row
          node={node}
          depth={depth}
          expanded={expanded[node.path]}
          loading={loading[node.path]}
          selected={selected === node.path}
          onToggle={toggle}
          onSelect={onSelect}
        />
        {node.type === 'directory' && expanded[node.path] && render(node.path, depth + 1)}
      </div>
    ))

  return (
    <div className={className}>
      {error && <div className="px-3 py-2 text-[11px] text-danger">{error}</div>}
      {!error && !children[ROOT] && <div className="px-3 py-2 text-[11px] text-faint">Loading files…</div>}
      {render(ROOT, 0)}
    </div>
  )
}
