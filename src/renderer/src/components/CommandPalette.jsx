import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Search,
  Home,
  Hammer,
  FolderKanban,
  Rocket,
  Users,
  MessagesSquare,
  Cable,
  Network,
  Coins,
  Settings,
  BookOpen,
  CornerDownLeft
} from 'lucide-react'

const commands = [
  { id: 'home', label: 'New App', hint: 'Build', icon: Home },
  { id: 'builder', label: 'Builder', hint: 'Build', icon: Hammer },
  { id: 'projects', label: 'Projects', hint: 'Build', icon: FolderKanban },
  { id: 'architecture', label: 'Architecture', hint: 'Build', icon: Network },
  { id: 'deployments', label: 'Deploy', hint: 'Build', icon: Rocket },
  { id: 'studio', label: 'Agent Studio', hint: 'Agents', icon: Users },
  { id: 'chat', label: 'Sessions', hint: 'Agents', icon: MessagesSquare },
  { id: 'mcp', label: 'MCP Connectors', hint: 'System', icon: Cable },
  { id: 'usage', label: 'Usage', hint: 'System', icon: Coins },
  { id: 'settings', label: 'Settings', hint: 'System', icon: Settings },
  { id: 'docs', label: 'Docs', hint: 'System', icon: BookOpen }
]

export default function CommandPalette({ open, onClose, onNavigate }) {
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const inputRef = useRef(null)

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return commands
    return commands.filter((c) => c.label.toLowerCase().includes(q) || c.hint.toLowerCase().includes(q))
  }, [query])

  useEffect(() => {
    if (open) {
      setQuery('')
      setActive(0)
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [open])

  useEffect(() => {
    setActive(0)
  }, [query])

  const go = (id) => {
    onNavigate(id)
    onClose()
  }

  const onKeyDown = (e) => {
    if (e.key === 'Escape') onClose()
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((a) => Math.min(a + 1, results.length - 1))
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((a) => Math.max(a - 1, 0))
    }
    if (e.key === 'Enter' && results[active]) {
      e.preventDefault()
      go(results[active].id)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[90] flex items-start justify-center bg-zinc-950/60 pt-[14vh] backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-lg overflow-hidden rounded-xl border border-line-2 bg-panel shadow-2xl animate-[modal-in_0.15s_ease-out]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2.5 border-b border-line px-4 py-3">
          <Search size={15} className="text-faint" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Jump to…"
            className="flex-1 bg-transparent text-sm text-zinc-100 outline-none placeholder:text-faint"
          />
          <kbd className="rounded border border-line px-1.5 py-0.5 text-[10px] text-faint">esc</kbd>
        </div>
        <div className="max-h-80 overflow-y-auto p-1.5">
          {results.length === 0 && (
            <div className="px-3 py-6 text-center text-xs text-faint">No matches</div>
          )}
          {results.map((c, i) => {
            const Icon = c.icon
            return (
              <button
                key={c.id}
                onMouseEnter={() => setActive(i)}
                onClick={() => go(c.id)}
                className={`flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-[13px] transition-colors ${
                  active === i ? 'bg-accent/10 text-accent' : 'text-zinc-200 hover:bg-line/60'
                }`}
              >
                <Icon size={14} className={active === i ? 'text-accent' : 'text-faint'} />
                {c.label}
                <span className="ml-auto text-[10px] text-faint">{c.hint}</span>
                {active === i && <CornerDownLeft size={12} className="text-accent" />}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
