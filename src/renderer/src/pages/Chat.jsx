import { Plus, FolderOpen } from 'lucide-react'
import Button from '../components/Button'
import useAgentSession from '../hooks/useAgentSession'

export default function Chat({ onOpenSession }) {
  const s = useAgentSession()

  return (
    <div className="flex h-full flex-col bg-panel">
      <div className="flex items-center justify-between px-4 pt-4">
        <span className="text-[11px] font-semibold uppercase tracking-widest text-faint">Sessions</span>
        <Button size="sm" variant="ghost" title="New session" onClick={() => onOpenSession(null)}>
          <Plus size={14} /> New
        </Button>
      </div>
      <div className="truncate px-4 pb-3 font-mono text-[10px] text-faint" title={s.directory}>
        in {s.projectName || 'workspace'}
      </div>
      <div className="flex-1 space-y-1 overflow-y-auto px-3 pb-4">
        {s.loadingSessions && <div className="px-3 py-2 text-[11px] text-faint">Loading…</div>}
        {!s.loadingSessions && s.sessions.length === 0 && (
          <div className="px-3 py-2 text-[11px] text-faint">No sessions yet. Start one from the Builder.</div>
        )}
        {s.sessions.map((session) => (
          <button
            key={session.id}
            onClick={() => onOpenSession(session.id)}
            className="w-full rounded-md border border-transparent px-3 py-2.5 text-left transition-colors hover:bg-line/60"
          >
            <div className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-faint" />
              <span className="truncate text-[13px] font-medium text-zinc-100">{session.title}</span>
            </div>
            <div className="mt-1 font-mono text-[10px] text-faint">
              {new Date(session.time?.created || Date.now()).toLocaleTimeString()}
            </div>
          </button>
        ))}
      </div>
      <div className="border-t border-line px-4 py-3">
        <div className="flex items-center gap-2 text-[11px]">
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              s.agent.ready ? 'bg-accent' : s.agent.running ? 'bg-amber-ok animate-pulse' : 'bg-danger'
            }`}
          />
          <span className="text-muted">
            {s.agent.ready ? 'Agent ready' : s.agent.running ? 'Starting agent…' : 'Agent offline'}
          </span>
        </div>
        {s.projectName && (
          <div className="mt-1.5 flex items-center gap-1.5 font-mono text-[10px] text-faint">
            <FolderOpen size={10} />
            <span className="truncate">{s.projectName}</span>
          </div>
        )}
      </div>
    </div>
  )
}
