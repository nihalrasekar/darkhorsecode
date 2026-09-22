import { useCallback, useEffect, useState } from 'react'
import { ArrowLeft, Rocket, Settings2, ExternalLink, Trash2, GitBranch, FolderOpen } from 'lucide-react'
import Button from '../components/Button'
import FileTree from '../components/FileTree'
import { parseStatus } from '../lib/parseGit.mjs'
import { useToast } from '../components/Toast'

const tabs = [
  { id: 'overview', label: 'Overview' },
  { id: 'files', label: 'Files' },
  { id: 'settings', label: 'Settings' }
]

export default function ProjectDetail({ projectPath, onNavigate, onProjectSelected }) {
  const toast = useToast()
  const [tab, setTab] = useState('overview')
  const [project, setProject] = useState(null)
  const [changes, setChanges] = useState(null)
  const [preview, setPreview] = useState({ path: null, content: '' })

  const load = useCallback(async () => {
    const list = await window.api.project.listRecent()
    const found = Array.isArray(list) ? list.find((p) => p.path === projectPath) : null
    setProject(found || null)
  }, [projectPath])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (!projectPath) return
    window.api.project
      .git(projectPath, 'status')
      .then((res) => setChanges(res?.error ? null : parseStatus(res.stdout)))
      .catch(() => setChanges(null))
  }, [projectPath])

  const openInBuilder = async () => {
    const res = await window.api.project.openRecent(projectPath)
    if (res?.error) {
      toast('That folder no longer exists.', 'error')
      return
    }
    onProjectSelected(res.project)
    onNavigate('builder')
  }

  const openFile = async (path) => {
    try {
      const res = await window.api.agent.readFile(path, projectPath)
      setPreview({ path, content: typeof res === 'string' ? res : res?.content || '' })
    } catch (err) {
      toast(err.message, 'error')
    }
  }

  if (!project) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-sm text-faint">
        This project is no longer in your recents.
        <Button size="sm" variant="outline" onClick={() => onNavigate('projects')}>
          Back to projects
        </Button>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex items-center gap-3 border-b border-line bg-panel px-6 py-4">
        <button
          onClick={() => onNavigate('projects')}
          className="flex h-7 w-7 items-center justify-center rounded-md border border-line text-faint hover:text-zinc-200"
        >
          <ArrowLeft size={14} />
        </button>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-zinc-100">{project.name}</h2>
            {!project.exists && (
              <span className="rounded-full border border-danger/30 bg-danger/10 px-2 py-0.5 text-[10px] text-danger">
                missing on disk
              </span>
            )}
          </div>
          <p className="truncate font-mono text-xs text-muted" title={project.path}>
            {project.path}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => window.api.project.reveal(project.path)}>
            <ExternalLink size={12} /> Reveal
          </Button>
          <Button size="sm" onClick={openInBuilder} disabled={!project.exists}>
            <Rocket size={12} /> Open builder
          </Button>
        </div>
      </div>

      <div className="flex gap-1 border-b border-line bg-panel px-6">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`border-b-2 px-3 py-2.5 text-[13px] font-medium transition-colors ${
              tab === t.id ? 'border-accent text-accent' : 'border-transparent text-muted hover:text-zinc-200'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-hidden">
        {tab === 'overview' && (
          <div className="grid gap-4 p-6 sm:grid-cols-3">
            <div className="rounded-lg border border-line bg-panel p-4">
              <div className="text-[11px] text-faint">Last opened</div>
              <div className="mt-1.5 text-sm font-semibold text-zinc-100">
                {project.lastOpenedAt ? new Date(project.lastOpenedAt).toLocaleString() : 'unknown'}
              </div>
            </div>
            <div className="rounded-lg border border-line bg-panel p-4">
              <div className="flex items-center gap-1.5 text-[11px] text-faint">
                <GitBranch size={11} /> Uncommitted changes
              </div>
              <div className="mt-1.5 text-lg font-semibold text-zinc-100">
                {changes === null ? 'not a git repo' : changes.length}
              </div>
            </div>
            <div className="rounded-lg border border-line bg-panel p-4">
              <div className="flex items-center gap-1.5 text-[11px] text-faint">
                <FolderOpen size={11} /> Location
              </div>
              <div className="mt-1.5 break-all font-mono text-[11px] text-zinc-300">{project.path}</div>
            </div>
          </div>
        )}

        {tab === 'files' && (
          <div className="flex h-full min-h-0">
            <FileTree
              directory={project.path}
              selected={preview.path}
              onSelect={openFile}
              className="w-64 shrink-0 overflow-y-auto border-r border-line bg-panel py-2"
            />
            <div className="min-w-0 flex-1 overflow-auto bg-surface">
              <div className="sticky top-0 border-b border-line bg-panel px-4 py-2 font-mono text-xs text-zinc-300">
                {preview.path || 'select a file'}
              </div>
              <pre className="px-4 py-4 font-mono text-[12px] leading-[1.7] text-zinc-300">
                {preview.content}
              </pre>
            </div>
          </div>
        )}

        {tab === 'settings' && (
          <div className="max-w-md p-6">
            <div className="rounded-lg border border-line bg-panel p-4">
              <div className="flex items-center gap-2 text-[13px] font-medium text-zinc-100">
                <Settings2 size={14} className="text-faint" /> Project settings
              </div>
              <p className="mt-2 text-xs text-muted">
                DarkHorseCode only tracks which folders you have opened — nothing about this project is stored
                outside the folder itself.
              </p>
              <div className="mt-4 flex gap-2">
                <Button size="sm" variant="outline" onClick={() => window.api.project.reveal(project.path)}>
                  <ExternalLink size={12} /> Reveal in explorer
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  onClick={async () => {
                    await window.api.project.removeRecent(project.path)
                    toast(`Removed ${project.name} from recents`, 'success')
                    onNavigate('projects')
                  }}
                >
                  <Trash2 size={12} /> Remove from recents
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
