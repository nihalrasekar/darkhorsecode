import { useEffect, useRef, useState } from 'react'
import {
  Send,
  Sparkles,
  Eye,
  Code2,
  TerminalSquare,
  X,
  FileCode2,
  ChevronDown,
  Square,
  AlertTriangle,
  Braces,
  Crosshair,
  Loader2,
  Plus,
  Hammer,
  ClipboardList
} from 'lucide-react'
import Button from '../components/Button'
import ToolCard from '../components/ToolCard'
import FileTree from '../components/FileTree'
import LivePreview from '../components/LivePreview'
import { PermissionModal, QuestionModal } from '../components/AgentModals'
import SignInGate from '../components/SignInGate'

// The picker (running inside the preview page) returns a filtered fingerprint:
// { element: { tag, text, className, styles, rect }, selectors: [{kind, selector}], code }
const bestSelector = (pick) =>
  pick?.selectors?.find((s) => s.kind === 'react-source' || s.kind === 'data-testid')?.selector ||
  pick?.selectors?.[0]?.selector ||
  pick?.element?.tag ||
  'element'

function pickLabel(pick) {
  const el = pick?.element || {}
  const text = (el.text || '').trim()
  return text ? `${el.tag || 'element'} — “${text.slice(0, 40)}”` : el.tag || 'element'
}

function pickSummary(pick) {
  const code = pick?.code
  if (code?.file) return `${code.file}:${code.line}:${code.column} · ${code.component}`
  return bestSelector(pick)
}

/** Everything the agent needs to find the element the user clicked. */
function describePick(pick) {
  const el = pick?.element || {}
  const lines = [`[target element] ${bestSelector(pick)}`]
  if (el.tag) lines.push(`tag: <${el.tag}>`)
  if (el.text) lines.push(`text: "${el.text}"`)
  if (el.className?.length) lines.push(`classes: ${el.className.join(' ')}`)
  if (pick?.code?.file) lines.push(`source: ${pick.code.file}:${pick.code.line}:${pick.code.column}`)
  const others = (pick?.selectors || []).map((s) => `${s.kind}=${s.selector}`).join(' | ')
  if (others) lines.push(`selectors: ${others}`)
  return lines.join('\n')
}

function MetaCard({ summary, fingerprint }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="w-full overflow-hidden rounded-md border border-accent/25 bg-accent/5">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-1.5 px-2.5 py-1.5 text-left"
      >
        <FileCode2 size={11} className="shrink-0 text-accent" />
        <span className="min-w-0 truncate font-mono text-[10px] text-accent">{summary}</span>
        <ChevronDown
          size={12}
          className={`ml-auto shrink-0 text-accent transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && fingerprint && (
        <pre className="max-h-60 overflow-auto border-t border-accent/20 px-2.5 py-2 font-mono text-[10px] leading-relaxed text-zinc-300">
          {JSON.stringify(fingerprint, null, 2)}
        </pre>
      )}
    </div>
  )
}

function CodePane({ directory }) {
  const [file, setFile] = useState(null)
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const open = async (path) => {
    setFile(path)
    setLoading(true)
    setError(null)
    try {
      const res = await window.api.agent.readFile(path, directory)
      setContent(typeof res === 'string' ? res : res?.content || '')
    } catch (err) {
      setError(err.message)
      setContent('')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex h-full min-h-0">
      <FileTree
        directory={directory}
        selected={file}
        onSelect={open}
        className="w-64 shrink-0 overflow-y-auto border-r border-line bg-panel py-2"
      />
      <div className="min-w-0 flex-1 overflow-auto bg-surface">
        <div className="sticky top-0 flex items-center gap-2 border-b border-line bg-panel px-4 py-2">
          <FileCode2 size={13} className="text-muted" />
          <span className="font-mono text-xs text-zinc-300">{file || 'select a file'}</span>
          {loading && <Loader2 size={12} className="animate-spin text-accent" />}
        </div>
        {error && <div className="px-4 py-3 text-xs text-danger">{error}</div>}
        <pre className="selectable-text min-w-full px-4 py-4 font-mono text-[12px] leading-[1.7] text-zinc-300">
          {content}
        </pre>
      </div>
    </div>
  )
}

const stamp = () => new Date().toLocaleTimeString([], { hour12: false })

/** Live agent activity as a terminal log — shell commands, tools, runtime state. */
function LogsPane() {
  const [lines, setLines] = useState([])
  const endRef = useRef(null)

  useEffect(() => {
    const push = (level, text) =>
      setLines((prev) => [...prev.slice(-499), { time: stamp(), level, text }])

    const offEvent = window.api.agent.onEvent((evt) => {
      if (evt.kind === 'shell_start') push('cmd', `$ ${evt.cmd}`)
      else if (evt.kind === 'tool_start') {
        const tool = evt.tool?.name || evt.tool?.tool || 'tool'
        const input = evt.tool?.input || {}
        const detail = input.command || input.filePath || input.file_path || input.url || input.description || ''
        push(tool === 'bash' ? 'cmd' : 'info', tool === 'bash' ? `$ ${detail}` : `${tool} ${detail}`.trim())
      } else if (evt.kind === 'tool_end') {
        const tool = evt.tool?.name || evt.tool?.tool || 'tool'
        if (evt.status === 'error') push('err', `${tool} failed — ${evt.error || 'unknown error'}`)
        else push('ok', `${tool} ok${evt.title ? ` — ${evt.title}` : ''}`)
      } else if (evt.kind === 'step_end') {
        const t = evt.tokens || {}
        const total = (Number(t.input) || 0) + (Number(t.output) || 0)
        if (total) push('info', `step finished · ${total.toLocaleString()} tokens`)
      } else if (evt.kind === 'session_idle') push('ok', 'agent idle')
      else if (evt.kind === 'stream_error') push('err', `event stream lost — ${evt.message || 'reconnecting'}`)
    })

    const offState = window.api.agent.onState((s) =>
      push(s.state === 'crashed' || s.state === 'error' ? 'err' : 'warn', `agent runtime ${s.state}`)
    )

    return () => {
      offEvent()
      offState()
    }
  }, [])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [lines])

  const levelStyle = {
    info: 'text-zinc-400',
    cmd: 'text-zinc-200',
    warn: 'text-amber-ok',
    ok: 'text-accent',
    err: 'text-danger'
  }

  return (
    <div className="flex h-full flex-col bg-[#0b0b0e]">
      <div className="flex items-center gap-2 border-b border-line px-4 py-2 text-[11px] text-faint">
        <span className="h-2 w-2 rounded-full bg-danger/70" />
        <span className="h-2 w-2 rounded-full bg-amber-ok/70" />
        <span className="h-2 w-2 rounded-full bg-accent/70" />
        <span className="ml-2 font-mono">agent activity</span>
        {lines.length > 0 && (
          <button onClick={() => setLines([])} className="ml-auto hover:text-zinc-300">
            clear
          </button>
        )}
      </div>
      <div className="selectable-text flex-1 overflow-y-auto px-4 py-3 font-mono text-[12px] leading-[1.8]">
        {lines.length === 0 && (
          <div className="text-faint">Waiting for agent activity — send a message to start.</div>
        )}
        {lines.map((l, i) => (
          <div key={i} className="flex gap-3">
            <span className="shrink-0 text-faint">{l.time}</span>
            <span className={`whitespace-pre-wrap ${levelStyle[l.level]}`}>{l.text}</span>
          </div>
        ))}
        <div ref={endRef} />
      </div>
    </div>
  )
}

export default function Builder({ seedPrompt, onSeedConsumed, project, onNavigate, session: s, draft, onDraftChange: setDraft }) {
  const [tab, setTab] = useState('preview')
  const [model, setModel] = useState('')
  // 'action' runs normally; 'plan' sends to the read-only agent (config.js) so it can
  // only explore and propose, never edit files or run commands.
  const [mode, setMode] = useState('action')
  // Element fingerprint returned by the picker running inside the preview page.
  const [picked, setPicked] = useState(null)
  const endRef = useRef(null)
  const seededRef = useRef(false)

  useEffect(() => {
    window.api.settings
      .get()
      .then((res) => setModel(res?.settings?.model || ''))
      .catch(() => {})
  }, [])

  // Re-read Settings fresh on every send rather than trusting the `model` state
  // above (only loaded once on mount) — so a model switch while this chat is
  // still open applies to the very next message instead of needing a new session.
  const currentModelOverride = async () => {
    try {
      const res = await window.api.settings.get()
      const st = res?.settings
      if (!st?.model) return undefined
      const slash = st.model.indexOf('/')
      return slash === -1
        ? { providerID: st.provider, modelID: st.model }
        : { providerID: st.model.slice(0, slash), modelID: st.model.slice(slash + 1) }
    } catch {
      return undefined
    }
  }

  // A prompt handed over from Home/Templates starts a real build once the agent is up.
  useEffect(() => {
    if (!seedPrompt || seededRef.current || !s.agent.ready) return
    seededRef.current = true
    currentModelOverride().then((model) => s.send(seedPrompt, model ? { model } : {}))
    onSeedConsumed?.()
  }, [seedPrompt, s.agent.ready, s.send, onSeedConsumed])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [s.items])

  const send = async (e) => {
    e?.preventDefault()
    const text = draft.trim()
    if (!text || s.busy) return
    // The element reference only helps if it reaches the agent, so put it in the prompt.
    const prompt = picked ? `${text}\n\n${describePick(picked)}` : text
    setDraft('')
    setPicked(null)
    const model = await currentModelOverride()
    s.send(prompt, { ...(mode === 'plan' ? { agent: 'plan' } : {}), ...(model ? { model } : {}) })
  }

  const targetLabel = picked ? pickLabel(picked) : ''

  const statusLabel = s.busy ? 'building' : s.agent.ready ? 'ready' : s.agent.running ? 'starting' : 'offline'

  return (
    <div className="flex h-full min-h-0">
      <div className="flex w-[380px] shrink-0 flex-col border-r border-line bg-panel">
        <div className="flex items-center gap-2 border-b border-line px-4 py-3">
          <div className="flex h-6 w-6 items-center justify-center rounded bg-accent/15 text-accent">
            <Sparkles size={12} />
          </div>
          <div className="min-w-0 leading-tight">
            <div className="truncate text-xs font-semibold text-zinc-100">
              {project?.name || s.projectName || 'no project'}
            </div>
            <div className="truncate font-mono text-[10px] text-faint">{model || 'default model'}</div>
          </div>
          <span
            className={`ml-auto flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-medium ${
              s.busy
                ? 'border-accent/30 bg-accent/10 text-accent'
                : s.agent.ready
                  ? 'border-line-2 bg-panel-2 text-muted'
                  : 'border-danger/30 bg-danger/10 text-danger'
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                s.busy ? 'animate-pulse bg-accent' : s.agent.ready ? 'bg-muted' : 'bg-danger'
              }`}
            />
            {statusLabel}
          </span>
          <button
            onClick={s.newSession}
            title="New session"
            className="flex items-center gap-1 rounded-md border border-line bg-panel-2 px-2 py-1 text-[10px] text-muted transition-colors hover:text-zinc-200"
          >
            <Plus size={11} /> New
          </button>
        </div>

        {s.usage.tokens > 0 && (
          <div className="flex items-center gap-2 border-b border-line bg-panel-2 px-4 py-2">
            <Braces size={11} className="text-faint" />
            <div className="h-1 flex-1 overflow-hidden rounded-full bg-line">
              <div
                className="h-full rounded-full bg-gradient-to-r from-info to-accent transition-all duration-700"
                style={{ width: `${Math.min(100, (s.usage.tokens / 200000) * 100)}%` }}
              />
            </div>
            <span className="font-mono text-[10px] text-faint">
              {s.usage.tokens.toLocaleString()} tokens
              {s.usage.cost > 0 ? ` · $${s.usage.cost.toFixed(3)}` : ''}
            </span>
          </div>
        )}

        <div className="selectable-text min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
          {s.items.length === 0 && (
            <div className="pt-10 text-center text-[12px] text-faint">
              Describe a change and the agent will make it in{' '}
              <span className="font-mono">{project?.name || 'this project'}</span>.
            </div>
          )}
          {s.items.map((item) => {
            if (item.kind === 'tool') return <ToolCard key={item.id} part={item} />
            if (item.kind === 'error')
              return (
                <div
                  key={item.id}
                  className="flex items-start gap-2 rounded-lg border border-danger/30 bg-danger/5 px-3.5 py-2 text-[13px] leading-relaxed text-danger"
                >
                  <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                  <span className="whitespace-pre-wrap">{item.text || 'The agent request failed.'}</span>
                </div>
              )
            const mine = item.role === 'user'
            return (
              <div key={item.id} className={mine ? 'flex justify-end' : ''}>
                {mine ? (
                  <div className="max-w-[85%] whitespace-pre-wrap rounded-lg rounded-tr-sm bg-accent/15 px-3.5 py-2 text-[13px] leading-relaxed text-zinc-100">
                    {item.text}
                  </div>
                ) : (
                  <div className="flex gap-2.5">
                    <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-accent/15 text-accent">
                      <Sparkles size={12} />
                    </div>
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="whitespace-pre-wrap rounded-lg rounded-tl-sm border border-line bg-panel-2 px-3.5 py-2.5 text-[13px] leading-relaxed text-zinc-200">
                        {item.text || '…'}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
          <div ref={endRef} />
        </div>

        {s.error && (
          <div className="mx-3 mb-1 flex items-center gap-2 rounded-md border border-danger/30 bg-danger/5 px-3 py-2 text-xs text-danger">
            <AlertTriangle size={12} />
            <span className="flex-1">{s.error}</span>
            <button onClick={() => s.setError(null)}>
              <X size={12} />
            </button>
          </div>
        )}

        <form onSubmit={send} className="border-t border-line p-3">
          {picked && (
            <div className="mb-2 rounded-lg border border-accent/30 bg-accent/5 p-1.5">
              <div className="flex items-center gap-1.5 px-1 py-0.5">
                <Crosshair size={12} className="shrink-0 text-accent" />
                <span className="truncate text-[11.5px] font-medium text-zinc-100">{targetLabel}</span>
                <button
                  type="button"
                  onClick={() => setPicked(null)}
                  className="ml-auto shrink-0 rounded p-0.5 text-faint hover:bg-line hover:text-zinc-200"
                  title="Remove reference"
                >
                  <X size={12} />
                </button>
              </div>
              <MetaCard summary={pickSummary(picked)} fingerprint={picked} />
            </div>
          )}
          <div className="mb-2 flex items-center gap-2">
            <div className="flex items-center gap-0.5 rounded-md border border-line-2 bg-panel-2 p-0.5">
              <button
                type="button"
                onClick={() => setMode('plan')}
                title="Read-only: explores and proposes an approach, makes no changes"
                className={`flex items-center gap-1.5 rounded px-2 py-1 text-[11px] font-medium transition-colors ${
                  mode === 'plan' ? 'bg-accent/15 text-accent' : 'text-muted hover:text-zinc-200'
                }`}
              >
                <ClipboardList size={12} /> Plan
              </button>
              <button
                type="button"
                onClick={() => setMode('action')}
                title="Edits files and runs commands"
                className={`flex items-center gap-1.5 rounded px-2 py-1 text-[11px] font-medium transition-colors ${
                  mode === 'action' ? 'bg-accent/15 text-accent' : 'text-muted hover:text-zinc-200'
                }`}
              >
                <Hammer size={12} /> Action
              </button>
            </div>
            {mode === 'plan' && (
              <span className="text-[10.5px] text-faint">Read-only — no files will be changed</span>
            )}
          </div>
          <div className="flex items-end gap-2 rounded-lg border border-line-2 bg-panel-2 p-2 focus-within:border-accent/50">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  send(e)
                }
              }}
              rows={1}
              placeholder={
                picked
                  ? 'Describe the change for the selected element…'
                  : mode === 'plan'
                    ? 'Ask the agent to propose a plan…'
                    : 'Ask the agent to change the app…'
              }
              className="max-h-28 min-h-[36px] flex-1 resize-none bg-transparent px-1 py-2 text-[13px] text-zinc-100 outline-none placeholder:text-faint"
            />
            {s.busy ? (
              <Button type="button" variant="outline" onClick={s.stop} title="Stop the agent">
                <Square size={13} className="text-danger" />
              </Button>
            ) : (
              <Button type="submit" disabled={!draft.trim() || !s.agent.ready}>
                <Send size={13} />
              </Button>
            )}
          </div>
        </form>
      </div>

      <div className="flex min-w-0 flex-1 flex-col bg-surface">
        <div className="flex h-11 shrink-0 items-center gap-1 border-b border-line bg-panel px-3">
          {[
            { id: 'code', label: 'Code', icon: Code2 },
            { id: 'logs', label: 'Logs', icon: TerminalSquare },
            { id: 'preview', label: 'Preview', icon: Eye }
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs transition-colors ${
                tab === t.id ? 'bg-accent/10 text-accent' : 'text-muted hover:bg-line/60 hover:text-zinc-200'
              }`}
            >
              <t.icon size={13} />
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'preview' && <LivePreview directory={project?.path} onPick={setPicked} />}
        {tab === 'code' && <CodePane directory={project?.path} />}
        {tab === 'logs' && <LogsPane />}
      </div>

      <SignInGate
        pendingPrompt={s.pendingPrompt}
        onCancel={s.cancelPendingPrompt}
        onOpenSettings={() => {
          s.cancelPendingPrompt()
          onNavigate('settings')
        }}
      />
      <PermissionModal
        permission={s.permission}
        onReply={s.replyPermission}
        onStop={() => {
          s.replyPermission('reject')
          s.stop()
        }}
      />
      <QuestionModal question={s.question} onAnswer={s.replyQuestion} onSkip={s.skipQuestion} />
    </div>
  )
}
