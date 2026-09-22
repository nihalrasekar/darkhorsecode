import { useCallback, useEffect, useMemo, useState } from 'react'
import { Plus, FolderOpen, Play, Search, FolderSearch, Trash2, ExternalLink, AlertTriangle } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import Button from '../components/Button'
import EmptyState from '../components/EmptyState'
import { useToast } from '../components/Toast'

const relative = (iso) => {
  const then = new Date(iso).getTime()
  if (!then) return 'unknown'
  const mins = Math.round((Date.now() - then) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  if (days < 30) return `${days}d ago`
  return new Date(iso).toLocaleDateString()
}

export default function Projects({ onNavigate, onOpenProject, onProjectSelected, activeProject }) {
  const toast = useToast()
  const [query, setQuery] = useState('')
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const list = await window.api.project.listRecent()
      setProjects(Array.isArray(list) ? list : [])
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    load()
  }, [load])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return projects
    return projects.filter((p) => p.name.toLowerCase().includes(q) || p.path.toLowerCase().includes(q))
  }, [query, projects])

  const open = async (project) => {
    const res = await window.api.project.openRecent(project.path)
    if (res?.error === 'missing') {
      toast('That folder no longer exists.', 'error')
      load()
      return
    }
    onProjectSelected(res.project)
    onNavigate('builder')
  }

  const addExisting = async () => {
    const res = await window.api.project.openExisting()
    if (res?.canceled) return
    if (res?.error) {
      toast(res.error, 'error')
      return
    }
    onProjectSelected(res.project)
    load()
  }

  const forget = async (project) => {
    await window.api.project.removeRecent(project.path)
    toast(`Removed ${project.name} from recents`, 'success')
    load()
  }

  const reveal = async (project) => {
    const res = await window.api.project.reveal(project.path)
    if (res?.error) toast('Folder not found on disk.', 'error')
  }

  return (
    <div className="flex h-full flex-col gap-5 overflow-y-auto p-6">
      <PageHeader
        title="Projects"
        description="Folders you have opened with DarkHorseCode."
        actions={
          <>
            <Button size="sm" variant="outline" onClick={addExisting}>
              <FolderSearch size={14} /> Open folder
            </Button>
            <Button size="sm" onClick={() => onNavigate('home')}>
              <Plus size={14} /> New app
            </Button>
          </>
        }
      />

      <label className="flex h-8 w-full max-w-sm items-center gap-2 rounded-md border border-line bg-panel-2 px-2.5 text-xs text-faint focus-within:border-accent/50">
        <Search size={13} />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search projects…"
          className="w-full bg-transparent text-zinc-200 outline-none placeholder:text-faint"
        />
      </label>

      {loading && <div className="text-xs text-faint">Loading projects…</div>}

      {!loading && filtered.length === 0 && (
        <EmptyState
          icon={FolderOpen}
          title={query ? 'No projects match' : 'No projects yet'}
          description={
            query ? `Nothing found for "${query}".` : 'Open a folder to start building in it.'
          }
          action={
            query ? (
              <Button size="sm" variant="outline" onClick={() => setQuery('')}>
                Clear search
              </Button>
            ) : (
              <Button size="sm" onClick={addExisting}>
                <FolderSearch size={14} /> Open folder
              </Button>
            )
          }
        />
      )}

      {!loading && filtered.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((p) => {
            const active = activeProject?.path === p.path
            return (
              <div
                key={p.path}
                className={`group overflow-hidden rounded-lg border bg-panel transition-colors ${
                  active ? 'border-accent/40' : 'border-line hover:border-line-2'
                }`}
              >
                <div className="p-4">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onOpenProject(p.path)}
                      className="truncate text-sm font-semibold text-zinc-100 hover:text-accent"
                      title={p.path}
                    >
                      {p.name}
                    </button>
                    {active && (
                      <span className="ml-auto shrink-0 rounded-full border border-accent/30 bg-accent/10 px-2 py-0.5 text-[10px] text-accent">
                        open
                      </span>
                    )}
                    {!p.exists && (
                      <span className="ml-auto flex shrink-0 items-center gap-1 rounded-full border border-danger/30 bg-danger/10 px-2 py-0.5 text-[10px] text-danger">
                        <AlertTriangle size={9} /> missing
                      </span>
                    )}
                  </div>
                  <p className="mt-1 truncate font-mono text-[11px] text-faint" title={p.path}>
                    {p.path}
                  </p>
                  <div className="mt-2 text-[11px] text-faint">last opened {relative(p.lastOpenedAt)}</div>

                  <div className="mt-3 flex items-center gap-1.5">
                    <Button size="sm" onClick={() => open(p)} disabled={!p.exists}>
                      <Play size={11} /> Open
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => onOpenProject(p.path)}>
                      Details
                    </Button>
                    <button
                      onClick={() => reveal(p)}
                      title="Reveal in file explorer"
                      className="ml-auto rounded p-1 text-faint hover:text-zinc-300"
                    >
                      <ExternalLink size={14} />
                    </button>
                    <button
                      onClick={() => forget(p)}
                      title="Remove from recents"
                      className="rounded p-1 text-faint hover:text-danger"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
