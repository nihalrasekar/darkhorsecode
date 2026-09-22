import { useEffect, useState } from 'react'
import { Terminal, FolderOpen, FolderPlus, Clock, ArrowRight, Sparkles } from 'lucide-react'
import Button from '../components/Button'
import EmptyState from '../components/EmptyState'
import { useToast } from '../components/Toast'

function relativeTime(iso) {
  const diffMs = Date.now() - new Date(iso).getTime()
  const mins = Math.round(diffMs / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.round(hours / 24)}d ago`
}

export default function ProjectGate({ onProjectSelected, onStartWithPrompt }) {
  const toast = useToast()
  const [recent, setRecent] = useState([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [newProjectName, setNewProjectName] = useState('')
  const [createError, setCreateError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [idea, setIdea] = useState('')

  const loadRecent = () => {
    setLoading(true)
    window.api.project
      .listRecent()
      .then((res) => setRecent(Array.isArray(res) ? res : []))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadRecent()
  }, [])

  // No name prompt, no folder picker: the project name comes from the idea itself,
  // and the same text seeds the builder chat once the scaffold is ready.
  const handleStartFromIdea = async () => {
    const text = idea.trim()
    if (!text) return
    setBusy(true)
    try {
      const res = await window.api.project.createFromPrompt(text)
      if (res.canceled) return
      if (res.error) return toast(res.error, 'error')
      onStartWithPrompt(res.project, text)
    } finally {
      setBusy(false)
    }
  }

  const handleOpenExisting = async () => {
    setBusy(true)
    try {
      const res = await window.api.project.openExisting()
      if (res.canceled) return
      if (res.error) return toast(res.error, 'error')
      onProjectSelected(res.project)
    } finally {
      setBusy(false)
    }
  }

  const handleCreateNew = async () => {
    const name = newProjectName.trim()
    if (!name) return setCreateError('Enter a project name')

    setBusy(true)
    setCreateError(null)
    try {
      const res = await window.api.project.createNew(name)
      if (res.canceled) return
      if (res.error === 'exists') return setCreateError(`A folder named "${name}" already exists there`)
      if (res.error) return toast(res.error, 'error')
      onProjectSelected(res.project)
    } finally {
      setBusy(false)
    }
  }

  const handleOpenRecent = async (entry) => {
    if (!entry.exists) return
    setBusy(true)
    try {
      const res = await window.api.project.openRecent(entry.path)
      if (res.error === 'missing') {
        toast('That project folder is missing', 'error')
        loadRecent()
        return
      }
      if (res.error) return toast(res.error, 'error')
      onProjectSelected(res.project)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex h-full items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-accent/15 text-accent">
            <Terminal size={20} strokeWidth={2.2} />
          </div>
          <div className="font-mono text-base font-semibold tracking-tight text-zinc-100">DarkHorseCode</div>
          <p className="mt-1 text-xs text-faint">Describe an idea, or open a project to continue</p>
        </div>

        <div className="mb-4 overflow-hidden rounded-xl border border-line-2 bg-panel shadow-[0_0_40px_rgba(52,211,153,0.06)]">
          <div className="p-4">
            <label className="mb-2 flex items-center gap-1.5 text-xs font-medium text-zinc-300">
              <Sparkles size={13} className="text-accent" /> Describe what to build
            </label>
            <textarea
              autoFocus
              rows={3}
              value={idea}
              onChange={(e) => setIdea(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleStartFromIdea()
                }
              }}
              placeholder="A pomodoro timer with a task list…"
              className="w-full resize-none rounded-md border border-line-2 bg-panel-2 p-3 text-[13px] text-zinc-100 outline-none transition-colors placeholder:text-faint focus:border-accent/50"
            />
            <Button
              variant="primary"
              size="sm"
              className="mt-2.5 w-full"
              disabled={busy || !idea.trim()}
              onClick={handleStartFromIdea}
            >
              Build it <ArrowRight size={13} />
            </Button>
            <p className="mt-2 text-[11px] text-faint">
              Creates a new project named from your idea and starts building right away.
            </p>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-line-2 bg-panel shadow-[0_0_40px_rgba(52,211,153,0.06)]">
          <div className="space-y-2.5 p-5">
            <Button variant="outline" size="lg" className="w-full" disabled={busy} onClick={handleOpenExisting}>
              <FolderOpen size={15} /> Open existing project
            </Button>

            {!creating ? (
              <Button
                variant="outline"
                size="lg"
                className="w-full"
                disabled={busy}
                onClick={() => setCreating(true)}
              >
                <FolderPlus size={15} /> Create new project
              </Button>
            ) : (
              <div className="space-y-2 rounded-md border border-line-2 bg-panel-2 p-3">
                <label className="flex items-center gap-2 rounded-md border border-line-2 bg-panel px-3 h-9 focus-within:border-accent/50">
                  <FolderPlus size={13} className="text-faint" />
                  <input
                    autoFocus
                    type="text"
                    value={newProjectName}
                    onChange={(e) => {
                      setNewProjectName(e.target.value)
                      setCreateError(null)
                    }}
                    onKeyDown={(e) => e.key === 'Enter' && handleCreateNew()}
                    placeholder="my-project"
                    className="flex-1 bg-transparent text-[13px] text-zinc-100 outline-none placeholder:text-faint"
                  />
                </label>
                {createError && <p className="text-[11px] text-danger">{createError}</p>}
                <div className="flex gap-2">
                  <Button
                    variant="primary"
                    size="sm"
                    className="flex-1"
                    disabled={busy}
                    onClick={handleCreateNew}
                  >
                    Choose location & create <ArrowRight size={13} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={busy}
                    onClick={() => {
                      setCreating(false)
                      setCreateError(null)
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>

          <div className="border-t border-line px-5 py-4">
            <p className="mb-2 text-[10px] font-medium uppercase tracking-widest text-faint">Recent projects</p>
            {!loading && recent.length === 0 && (
              <EmptyState
                icon={Clock}
                title="No recent projects"
                description="Open or create a project to see it here"
              />
            )}
            {recent.length > 0 && (
              <div className="space-y-1">
                {recent.map((entry) => (
                  <button
                    key={entry.path}
                    disabled={!entry.exists || busy}
                    onClick={() => handleOpenRecent(entry)}
                    className="flex w-full items-center justify-between gap-3 rounded-md px-2.5 py-2 text-left transition-colors hover:bg-panel-2 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-[13px] font-medium text-zinc-200">{entry.name}</span>
                      <span className="block truncate text-[11px] text-faint">
                        {entry.exists ? entry.path : 'Folder not found'}
                      </span>
                    </span>
                    <span className="shrink-0 text-[10px] text-faint">{relativeTime(entry.lastOpenedAt)}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
