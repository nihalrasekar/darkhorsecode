import { useEffect, useRef, useState } from 'react'
import { Search, CircleHelp, Bell, CheckCircle2, XCircle, Activity, FolderKanban } from 'lucide-react'

const stamp = () => Date.now()

const relative = (ms) => {
  const mins = Math.round((Date.now() - ms) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  return `${Math.round(mins / 60)}h ago`
}

export default function TopBar({ title, subtitle, crumbs = [], project, onOpenProjects, onOpenShortcuts, onOpenPalette }) {
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState([])
  const [unread, setUnread] = useState(0)
  const ref = useRef(null)

  useEffect(() => {
    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  // Real notifications: things that finished, broke, or changed the runtime.
  useEffect(() => {
    const push = (tone, text) => {
      setNotifications((prev) => [{ id: `${stamp()}-${Math.random()}`, tone, text, at: stamp() }, ...prev].slice(0, 30))
      setUnread((n) => n + 1)
    }

    const offEvent = window.api.agent.onEvent((evt) => {
      if (evt.kind === 'tool_end' && evt.status === 'error') {
        push('error', `${evt.tool?.name || 'tool'} failed — ${evt.error || 'unknown error'}`)
      } else if (evt.kind === 'session_idle') {
        push('ok', 'Agent finished a run')
      } else if (evt.kind === 'stream_error') {
        push('error', `Event stream lost — ${evt.message || 'reconnecting'}`)
      }
    })

    const offState = window.api.agent.onState((s) => {
      if (s.state === 'crashed') push('error', `Agent runtime crashed (code ${s.code ?? '?'})`)
      else if (s.state === 'error') push('error', `Agent runtime error — ${s.message || 'unknown'}`)
      else if (s.state === 'ready') push('info', 'Agent runtime ready')
    })

    return () => {
      offEvent()
      offState()
    }
  }, [])

  const toneIcon = { ok: CheckCircle2, error: XCircle, info: Activity }
  const toneColor = { ok: 'text-accent', error: 'text-danger', info: 'text-info' }

  return (
    <header className="flex h-14 shrink-0 items-center gap-4 border-b border-line bg-panel px-4">
      <div className="min-w-0">
        <div className="flex items-center gap-1.5 text-[11px] text-faint">
          {crumbs.map((c, i) => (
            <span key={i} className="flex items-center gap-1.5">
              <span className={i === crumbs.length - 1 ? 'text-muted' : ''}>{c}</span>
              {i < crumbs.length - 1 && <span className="text-faint">/</span>}
            </span>
          ))}
        </div>
        <h1 className="truncate text-sm font-semibold text-zinc-100">{title}</h1>
        {subtitle && <div className="truncate text-[11px] text-faint">{subtitle}</div>}
      </div>

      <div className="ml-auto flex items-center gap-2.5">
        {project && (
          <button
            onClick={onOpenProjects}
            title={project.path}
            className="flex h-8 items-center gap-1.5 rounded-md border border-line bg-panel-2 px-2.5 text-xs text-muted transition-colors hover:border-zinc-500 hover:text-zinc-200"
          >
            <FolderKanban size={13} className="text-amber-ok" />
            <span className="max-w-[10rem] truncate font-mono">{project.name}</span>
          </button>
        )}
        <button
          onClick={onOpenPalette}
          className="hidden h-8 items-center gap-2 rounded-md border border-line bg-panel-2 px-2.5 text-xs text-faint transition-colors hover:border-zinc-500 hover:text-zinc-300 md:flex"
        >
          <Search size={13} />
          <span className="w-52 text-left">Jump to a page…</span>
          <kbd className="rounded border border-line px-1 py-0.5 text-[9px] text-faint">⌘K</kbd>
        </button>

        <div className="relative" ref={ref}>
          <button
            onClick={() => {
              setOpen((v) => !v)
              setUnread(0)
            }}
            className="relative flex h-8 w-8 items-center justify-center rounded-md border border-line bg-panel-2 text-muted transition-colors hover:border-zinc-500 hover:text-zinc-200"
            title="Agent notifications"
          >
            <Bell size={14} />
            {unread > 0 && <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-accent" />}
          </button>
          {open && (
            <div className="absolute right-0 top-10 z-50 w-72 overflow-hidden rounded-lg border border-line-2 bg-panel shadow-xl animate-[modal-in_0.12s_ease-out]">
              <div className="flex items-center border-b border-line px-3 py-2 text-[11px] font-semibold uppercase tracking-widest text-faint">
                Notifications
                {notifications.length > 0 && (
                  <button
                    onClick={() => setNotifications([])}
                    className="ml-auto text-[10px] normal-case tracking-normal hover:text-zinc-300"
                  >
                    clear
                  </button>
                )}
              </div>
              <div className="max-h-72 overflow-y-auto">
                {notifications.length === 0 && (
                  <div className="px-3 py-6 text-center text-[11px] text-faint">Nothing yet.</div>
                )}
                {notifications.map((n) => {
                  const Icon = toneIcon[n.tone] || Activity
                  return (
                    <div
                      key={n.id}
                      className="flex items-start gap-2.5 border-b border-line/60 px-3 py-2.5 last:border-0 hover:bg-line/40"
                    >
                      <Icon size={14} className={`mt-0.5 shrink-0 ${toneColor[n.tone]}`} />
                      <div className="min-w-0">
                        <div className="text-[12px] text-zinc-200">{n.text}</div>
                        <div className="mt-0.5 text-[10px] text-faint">{relative(n.at)}</div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        <button
          onClick={onOpenShortcuts}
          className="flex h-8 w-8 items-center justify-center rounded-md border border-line bg-panel-2 text-muted transition-colors hover:border-zinc-500 hover:text-zinc-200"
          title="Keyboard shortcuts"
        >
          <CircleHelp size={14} />
        </button>
      </div>
    </header>
  )
}
