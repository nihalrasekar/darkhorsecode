import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Network,
  ChevronRight,
  ChevronDown,
  RefreshCw,
  Loader2,
  FolderOpen,
  Layers,
  MessageSquare,
  Send,
  Square,
  ArrowRightCircle
} from 'lucide-react'
import PageHeader from '../components/PageHeader'
import Button from '../components/Button'
import { useToast } from '../components/Toast'
import ToolCard from '../components/ToolCard'
import SignInGate from '../components/SignInGate'
import { PermissionModal, QuestionModal } from '../components/AgentModals'

const SUMMARIZE_INSTRUCTION =
  'Summarize this discussion into a detailed, actionable design brief: what to build, which parts of the project it touches, concrete steps in order, and anything the Architect and Build agents need to know. Plain text, no JSON, no code.'

function DiscussChat({ chat, onSendToBuild, onOpenSettings }) {
  const [draft, setDraft] = useState('')
  const [summarizing, setSummarizing] = useState(false)
  const pendingRef = useRef(false)
  const listRef = useRef(null)

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight })
  }, [chat.items])

  // Wait for the summarize reply to finish streaming, then hand its text to Build.
  useEffect(() => {
    if (pendingRef.current && !chat.busy) {
      pendingRef.current = false
      setSummarizing(false)
      const last = [...chat.items].reverse().find((i) => i.kind !== 'tool' && i.role === 'assistant')
      if (!last?.text) return
      onSendToBuild(last.text)
    }
  }, [chat.busy, chat.items, onSendToBuild])

  const submit = () => {
    const text = draft.trim()
    if (!text || chat.busy) return
    chat.send(text, { title: 'Architecture discussion', agent: 'architect-chat' })
    setDraft('')
  }

  const summarizeForBuild = () => {
    if (chat.busy || !chat.items.length) return
    pendingRef.current = true
    setSummarizing(true)
    chat.send(SUMMARIZE_INSTRUCTION, { title: 'Architecture discussion', agent: 'architect-chat' })
  }

  return (
    <div className="mt-5 rounded-lg border border-line bg-panel">
      <div className="flex items-center gap-2.5 border-b border-line px-5 py-3.5">
        <MessageSquare size={15} className="text-accent" />
        <h3 className="text-sm font-semibold text-zinc-100">Discuss</h3>
        <p className="text-xs text-muted">Talk through the problem — read-only, can search the web and the project</p>
        <div className="ml-auto flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={summarizeForBuild} disabled={chat.busy || !chat.items.length}>
            {summarizing ? <Loader2 size={12} className="animate-spin" /> : <ArrowRightCircle size={12} />}
            {summarizing ? 'Summarizing…' : 'Send to Build'}
          </Button>
        </div>
      </div>

      <div ref={listRef} className="max-h-96 space-y-2 overflow-y-auto px-5 py-4">
        {chat.items.length === 0 ? (
          <p className="py-6 text-center text-[13px] text-muted">
            Describe the problem or feature you're thinking through. The architect reads the project as needed and
            discusses it with you before anything gets planned.
          </p>
        ) : (
          chat.items.map((item) =>
            item.kind === 'tool' ? (
              <ToolCard key={item.id} part={item} />
            ) : (
              <div
                key={item.id}
                className={`whitespace-pre-wrap rounded-lg px-3.5 py-2.5 text-[13px] leading-relaxed ${
                  item.role === 'user' ? 'bg-accent/15 text-zinc-100' : 'border border-line bg-panel-2 text-zinc-200'
                }`}
              >
                {item.text || '…'}
              </div>
            )
          )
        )}
        {chat.error && <div className="text-[11px] text-danger">{chat.error}</div>}
      </div>

      <div className="flex items-center gap-2 border-t border-line px-4 py-3">
        <input
          className="h-9 flex-1 rounded-md border border-line-2 bg-panel-2 px-3 text-[13px] text-zinc-100 outline-none focus:border-accent/50"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          placeholder="What are you trying to solve?"
          disabled={chat.busy}
        />
        {chat.busy ? (
          <Button size="sm" variant="outline" onClick={chat.stop} title="Stop the agent">
            <Square size={13} className="text-danger" />
          </Button>
        ) : (
          <Button size="sm" onClick={submit} disabled={!draft.trim()}>
            <Send size={13} />
          </Button>
        )}
      </div>

      <SignInGate pendingPrompt={chat.pendingPrompt} onCancel={chat.cancelPendingPrompt} onOpenSettings={onOpenSettings} />
      <PermissionModal
        permission={chat.permission}
        onReply={chat.replyPermission}
        onStop={() => {
          chat.replyPermission('reject')
          chat.stop()
        }}
      />
      <QuestionModal question={chat.question} onAnswer={chat.replyQuestion} onSkip={chat.skipQuestion} />
    </div>
  )
}

const KIND_META = {
  root: { dot: '#a1a1aa', label: 'App', chip: 'border-line bg-panel-2 text-muted' },
  client: { dot: '#34d399', label: 'Frontend', chip: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300' },
  server: { dot: '#38bdf8', label: 'Backend', chip: 'border-sky-400/30 bg-sky-400/10 text-sky-300' },
  database: { dot: '#fbbf24', label: 'Data', chip: 'border-amber-400/30 bg-amber-400/10 text-amber-300' },
  infra: { dot: '#a78bfa', label: 'Infra', chip: 'border-violet-400/30 bg-violet-400/10 text-violet-300' },
  shared: { dot: '#a1a1aa', label: 'Shared', chip: 'border-zinc-500/30 bg-zinc-500/10 text-zinc-300' }
}

function defaultExpanded(tree) {
  const set = new Set()
  if (tree?.applied) set.add(tree.id)
  for (const c of tree?.children || []) {
    if (c.applied) {
      set.add(c.id)
      set.add(c.id)
      for (const g of c.children || []) set.add(g.id)
    }
  }
  return set
}

function NodeRow({ node, depth, expanded, onToggle, onSelect, selected }) {
  const meta = KIND_META[node.kind] || KIND_META.shared
  const hasChildren = node.children.length > 0
  const canExpand = hasChildren
  const isOpen = expanded.has(node.id)
  const planned = node.applied === false

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        onClick={() => (canExpand ? onToggle(node.id) : onSelect(node.id))}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            canExpand ? onToggle(node.id) : onSelect(node.id)
          }
        }}
        className={`group flex w-full cursor-pointer items-center gap-1.5 rounded-md py-[5px] pr-2 text-[13px] transition-colors ${
          selected === node.id ? 'bg-accent/10' : 'hover:bg-line/50'
        } ${planned ? 'opacity-60' : ''}`}
        style={{ paddingLeft: 12 + depth * 22 }}
      >
        <span
          className={`flex h-4 w-4 shrink-0 items-center justify-center text-muted transition-colors ${
            canExpand ? 'group-hover:text-zinc-300' : ''
          }`}
        >
          {canExpand ? (
            isOpen ? (
              <ChevronDown size={13} />
            ) : (
              <ChevronRight size={13} />
            )
          ) : hasChildren ? (
            <span className="h-1 w-1 rounded-full bg-line-2" />
          ) : (
            <span className="h-px w-1.5 bg-line-2" />
          )}
        </span>
        <span
          className="h-2.5 w-2.5 shrink-0 rounded-[3px]"
          style={{ backgroundColor: planned ? 'transparent' : meta.dot, border: planned ? `1px dashed ${meta.dot}` : 'none' }}
        />
        <span className={`truncate font-medium ${planned ? 'text-muted' : 'text-zinc-100'}`}>{node.label}</span>
        <span className={`rounded border px-1.5 py-px font-mono text-[9px] uppercase tracking-wide ${meta.chip}`}>
          {meta.label}
        </span>
        {planned && (
          <span className="rounded border border-dashed border-zinc-600 px-1.5 py-px font-mono text-[9px] uppercase tracking-wide text-faint">
            planned
          </span>
        )}
        {canExpand && (
          <span className="ml-auto hidden shrink-0 text-[10px] text-faint group-hover:block">
            {isOpen ? 'collapse' : `${node.children.length} parts`}
          </span>
        )}
      </div>
      {isOpen && hasChildren && (
        <div className="border-l border-line/70" style={{ marginLeft: 20 + depth * 22, paddingLeft: 0 }}>
          {node.children.map((c) => (
            <NodeRow
              key={c.id}
              node={c}
              depth={depth + 1}
              expanded={expanded}
              onToggle={onToggle}
              onSelect={onSelect}
              selected={selected}
            />
          ))}
        </div>
      )}
    </>
  )
}

export default function Architecture({ onNavigate, chat, buildSession }) {
  const toast = useToast()
  const [tree, setTree] = useState(null)
  const [directory, setDirectory] = useState('')
  const [loading, setLoading] = useState(true)
  const [selectedID, setSelectedID] = useState(null)
  const [expanded, setExpanded] = useState(new Set())

  const sendToBuild = useCallback(
    (summary) => {
      buildSession.send(summary, { title: 'From Architecture discussion' })
      toast('Sent to Build', 'success')
      onNavigate('builder')
    },
    [buildSession, toast, onNavigate]
  )

  const selected = useMemo(() => {
    if (!tree) return null
    const find = (n) => (n.id === selectedID ? n : n.children.map(find).find(Boolean))
    return find(tree)
  }, [tree, selectedID])

  const load = useCallback(
    async (dir) => {
      setLoading(true)
      try {
        const t = await window.api.architecture.get(dir)
        setTree(t)
        setSelectedID(t?.id || null)
        setExpanded(defaultExpanded(t))
      } catch (err) {
        toast(err.message, 'error')
      } finally {
        setLoading(false)
      }
    },
    [toast]
  )

  useEffect(() => {
    ;(async () => {
      const dir = await window.api.agent.getDirectory()
      if (!dir) {
        setLoading(false)
        return
      }
      setDirectory(dir)
      await load(dir)
    })()
  }, [load])

  const toggle = (id) =>
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const counting = (n) => ({
    applied: 1,
    planned: n.applied ? 0 : 1,
    children: (n.children || []).reduce((acc, c) => acc + counting(c).applied + counting(c).children, 0)
  })
  const counts = tree ? counting(tree) : { applied: 0, planned: 0 }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-muted">
        <Loader2 size={18} className="mr-2 animate-spin" /> Loading architecture…
      </div>
    )
  }

  if (!directory || !tree) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <div className="max-w-sm rounded-xl border border-line bg-panel p-8 text-center">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-lg bg-accent/15 text-accent">
            <FolderOpen size={18} />
          </div>
          <h3 className="mt-4 text-sm font-semibold text-zinc-100">No project selected yet</h3>
          <p className="mt-1.5 text-[13px] text-muted">
            The architect maps your app into a logic tree. Pick a project folder first.
          </p>
          <Button size="sm" className="mt-4" onClick={() => onNavigate('home')}>
            <FolderOpen size={13} /> Open a project
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mx-auto max-w-5xl">
        <PageHeader
          title="Architecture"
          description="The app’s system as a tree — logic only, never code. Applied nodes expand; planned ones wait."
          actions={
            <Button size="sm" variant="ghost" onClick={() => load(directory)}>
              <RefreshCw size={13} /> Refresh
            </Button>
          }
        />

        <div className="mt-3 flex items-center gap-2 font-mono text-[11px] text-faint">
          <Network size={12} /> {directory}
        </div>

        <div className="mt-5 grid grid-cols-3 gap-3">
          {[
            { label: 'Applied components', value: counts.applied, tone: 'text-accent' },
            { label: 'Still planned', value: counts.planned, tone: 'text-amber-300' },
            { label: 'Depth levels', value: tree ? maxDepth(tree) : 0, tone: 'text-zinc-100' }
          ].map((s) => (
            <div key={s.label} className="rounded-lg border border-line bg-panel p-3.5">
              <div className="flex items-center gap-1.5 text-[11px] text-muted">
                <Layers size={12} className={s.tone} />
                {s.label}
              </div>
              <div className={`mt-1.5 font-mono text-lg font-semibold ${s.tone}`}>{s.value}</div>
            </div>
          ))}
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[10px] text-faint">
          <span className="font-medium uppercase tracking-widest">Legend</span>
          {Object.entries(KIND_META).map(([k, m]) => (
            <span key={k} className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-[3px]" style={{ backgroundColor: m.dot }} />
              {m.label}
            </span>
          ))}
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-[3px] border border-dashed border-zinc-500" />
            planned
          </span>
        </div>

        <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-[1fr_340px]">
          <div className="rounded-lg border border-line bg-panel p-2">
            {tree ? (
              <NodeRow
                node={tree}
                depth={0}
                expanded={expanded}
                onToggle={toggle}
                onSelect={setSelectedID}
                selected={selectedID}
              />
            ) : (
              <div className="px-3 py-8 text-center text-[13px] text-muted">No architecture yet — discuss it below, then press “Design Architecture”.</div>
            )}
          </div>

          <div className="rounded-lg border border-line bg-panel p-4">
            {selected ? (
              <>
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-[3px]" style={{ backgroundColor: KIND_META[selected.kind]?.dot }} />
                  <h3 className="text-sm font-semibold text-zinc-100">{selected.label}</h3>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <span className={`rounded border px-2 py-0.5 font-mono text-[9px] uppercase ${KIND_META[selected.kind]?.chip || KIND_META.shared.chip}`}>
                    {KIND_META[selected.kind]?.label || 'Shared'}
                  </span>
                  <span
                    className={`rounded border px-2 py-0.5 font-mono text-[9px] uppercase ${
                      selected.applied
                        ? 'border-accent/30 bg-accent/10 text-accent'
                        : 'border-dashed border-zinc-600 px-2 py-0.5 text-faint'
                    }`}
                  >
                    {selected.applied ? 'applied' : 'planned'}
                  </span>
                </div>
                <p className="mt-3 text-[13px] leading-relaxed text-muted">{selected.description || '—'}</p>
                {selected.children.length > 0 && (
                  <p className="mt-3 text-[11px] text-faint">
                    {selected.children.length} part{selected.children.length === 1 ? '' : 's'} inside
                    {!selected.applied && ' · proposed, not built yet'}
                  </p>
                )}
              </>
            ) : (
              <div className="py-8 text-center text-[13px] text-muted">Select a node to see what it does.</div>
            )}
          </div>
        </div>

        <DiscussChat chat={chat} onSendToBuild={sendToBuild} onOpenSettings={() => onNavigate('settings')} />
      </div>
    </div>
  )
}

function maxDepth(n) {
  return n.children.length ? 1 + Math.max(...n.children.map(maxDepth)) : 1
}