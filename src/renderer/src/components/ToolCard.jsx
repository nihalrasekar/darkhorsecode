import { useState } from 'react'
import {
  ListChecks,
  FileCode2,
  FileText,
  FolderTree,
  GitCompareArrows,
  FlaskConical,
  Search,
  Terminal,
  Globe2,
  Bot,
  Wand2,
  CheckCircle2,
  XCircle,
  Loader2,
  ChevronRight
} from 'lucide-react'
import { diffStrings } from '../lib/diffText.mjs'

const lineStyles = {
  add: 'bg-emerald-500/10 text-emerald-200',
  del: 'bg-red-500/10 text-red-200',
  ctx: 'text-zinc-400'
}
const lineMark = { add: '+', del: '−', ctx: ' ' }

const MAX_DIFF_PREVIEW_LINES = 400

/** The edit tool's own before/after — no git needed, this is the agent's actual write. */
function EditDiff({ input }) {
  const oldStr = input.oldString ?? input.old_string ?? input.oldStr
  const newStr = input.newString ?? input.new_string ?? input.newStr
  if (oldStr === undefined && newStr === undefined) return null
  const diff = diffStrings(oldStr, newStr)
  return <DiffLines diff={diff} />
}

/** write tool replaces the whole file — shown as one block of additions. */
function WriteDiff({ input }) {
  const content = input.content
  if (typeof content !== 'string') return null
  const lines = content.split(/\r?\n/)
  return (
    <DiffLines
      diff={{
        hunks: [{ lines: lines.slice(0, MAX_DIFF_PREVIEW_LINES).map((text) => ({ type: 'add', text })) }],
        additions: lines.length,
        deletions: 0,
        truncated: lines.length > MAX_DIFF_PREVIEW_LINES
      }}
    />
  )
}

function DiffLines({ diff }) {
  const lines = diff.hunks.flatMap((h) => h.lines)
  const shown = lines.slice(0, MAX_DIFF_PREVIEW_LINES)
  return (
    <div className="mt-2 overflow-hidden rounded border border-line/60 bg-surface/60">
      <div className="max-h-72 overflow-y-auto overflow-x-auto font-mono text-[11px] leading-[1.6]">
        {shown.map((line, i) => (
          <div key={i} className={`flex px-2.5 ${lineStyles[line.type]}`} style={{ whiteSpace: 'pre' }}>
            <span className="w-4 shrink-0 select-none text-faint">{lineMark[line.type]}</span>
            <span>{line.text || ' '}</span>
          </div>
        ))}
      </div>
      {(diff.truncated || lines.length > MAX_DIFF_PREVIEW_LINES) && (
        <div className="border-t border-line/60 px-2.5 py-1 text-[10px] text-faint">
          showing first {shown.length} of {lines.length} lines
        </div>
      )}
    </div>
  )
}

export const toolMeta = (tool) => {
  const t = String(tool || '')
  if (t === 'plan') return { icon: ListChecks, label: 'Plan', color: 'text-violet-ok border-violet-500/25 bg-violet-500/10' }
  if (t === 'apply_patch' || t === 'edit' || t === 'write') return { icon: FileCode2, label: 'Edit', color: 'text-info border-sky-500/25 bg-sky-500/10' }
  if (t === 'diff') return { icon: GitCompareArrows, label: 'Diff', color: 'text-amber-ok border-amber-500/25 bg-amber-500/10' }
  if (t === 'bash' || t === 'shell') return { icon: Terminal, label: 'Terminal', color: 'text-zinc-200 border-line-2 bg-panel-2' }
  if (t === 'grep') return { icon: Search, label: 'Search', color: 'text-zinc-200 border-line-2 bg-panel-2' }
  if (t === 'glob' || t === 'list') return { icon: FolderTree, label: 'Files', color: 'text-zinc-200 border-line-2 bg-panel-2' }
  if (t === 'read') return { icon: FileText, label: 'Read', color: 'text-zinc-200 border-line-2 bg-panel-2' }
  if (t === 'todowrite' || t === 'todoread') return { icon: ListChecks, label: 'Todo', color: 'text-violet-ok border-violet-500/25 bg-violet-500/10' }
  if (t === 'task') return { icon: Bot, label: 'Agent', color: 'text-violet-ok border-violet-500/25 bg-violet-500/10' }
  if (t === 'webfetch' || t === 'fetch') return { icon: Globe2, label: 'Web', color: 'text-info border-sky-500/25 bg-sky-500/10' }
  if (t.includes('test')) return { icon: FlaskConical, label: 'Test', color: 'text-accent border-accent/25 bg-accent/10' }
  if (t.startsWith('github') || t.startsWith('supabase') || t.startsWith('vercel') || t.startsWith('playwright')) {
    return { icon: Wand2, label: t.split('_')[0], color: 'text-amber-ok border-amber-500/25 bg-amber-500/10' }
  }
  return { icon: Wand2, label: t, color: 'text-violet-ok border-violet-500/25 bg-violet-500/10' }
}

export default function ToolCard({ part }) {
  const meta = toolMeta(part.toolName)
  const Icon = meta.icon
  const state = part.state
  const input = part.input || {}
  const name = part.toolName
  const isEdit = name === 'edit' || name === 'apply_patch'
  const isWrite = name === 'write'
  const hasDiff = isEdit ? input.oldString !== undefined || input.old_string !== undefined : isWrite && typeof input.content === 'string'
  const [open, setOpen] = useState(false)

  return (
    <div className={`rounded-md border ${meta.color} px-3.5 py-2.5`}>
      <div
        className={`flex items-center gap-2 text-xs ${hasDiff ? 'cursor-pointer' : ''}`}
        onClick={hasDiff ? () => setOpen((v) => !v) : undefined}
      >
        {hasDiff && (
          <ChevronRight size={12} className={`shrink-0 transition-transform ${open ? 'rotate-90' : ''}`} />
        )}
        <Icon size={13} />
        <span className="shrink-0 font-semibold">{meta.label}</span>
        <span className="min-w-0 flex-1 truncate font-mono text-[11px] opacity-80">{part.title}</span>
        {state === 'running' && <Loader2 size={12} className="shrink-0 animate-spin text-accent" />}
        {state === 'success' && <CheckCircle2 size={12} className="shrink-0 text-accent" />}
        {state === 'error' && <XCircle size={12} className="shrink-0 text-danger" />}
      </div>
      {hasDiff && open && (isEdit ? <EditDiff input={input} /> : <WriteDiff input={input} />)}
    </div>
  )
}
