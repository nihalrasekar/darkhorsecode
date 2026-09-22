import { useCallback, useEffect, useMemo, useState } from 'react'
import { Plus, Copy, Check, Sparkles, Play, Wrench, Trash2, Loader2 } from 'lucide-react'
import { agentTools } from '../data/builder'
import PageHeader from '../components/PageHeader'
import Button from '../components/Button'
import Toggle from '../components/Toggle'
import ToolCard from '../components/ToolCard'
import { PermissionModal, QuestionModal } from '../components/AgentModals'
import SignInGate from '../components/SignInGate'
import useAgentSession from '../hooks/useAgentSession'
import { slugify } from '../../../shared/agentSlug.mjs'

const inputCls =
  'w-full rounded-md border border-line-2 bg-panel-2 px-3 py-2 text-sm text-zinc-100 outline-none transition-colors focus:border-accent/50'

const blankAgent = () => ({
  id: `a-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  name: 'New agent',
  persona: '',
  systemPrompt: '',
  model: '',
  tools: ['read'],
  active: true
})

const BUILT_IN_AGENTS = [
  { name: 'Build', desc: 'The main agent — reads, writes and runs commands in your project.' },
  { name: 'Architect', desc: 'Read-only. Plans system architecture as a JSON tree.' },
  { name: 'Plan', desc: "Read-only. Explores the project and proposes an approach without changing anything (Builder's Plan mode)." }
]

function AgentList({ agents, selectedId, onSelect, onCreate }) {
  return (
    <aside className="w-72 shrink-0 overflow-y-auto border-r border-line bg-panel p-3">
      <Button size="sm" className="mb-3 w-full" onClick={onCreate}>
        <Plus size={13} /> New agent
      </Button>

      <div className="mb-3 px-1 text-[11px] font-medium uppercase tracking-widest text-faint">Built-in</div>
      <div className="mb-4 space-y-1.5">
        {BUILT_IN_AGENTS.map((a) => (
          <div key={a.name} className="rounded-lg border border-line bg-panel-2 px-3 py-2.5">
            <div className="text-[13px] font-semibold text-zinc-200">{a.name}</div>
            <div className="mt-0.5 text-[11px] leading-snug text-faint">{a.desc}</div>
          </div>
        ))}
      </div>

      <div className="mb-2 px-1 text-[11px] font-medium uppercase tracking-widest text-faint">Custom</div>
      <div className="space-y-1.5">
        {agents.length === 0 && (
          <div className="px-2 py-6 text-center text-[11px] text-faint">
            No custom agents yet. Create one to give the builder a specialist.
          </div>
        )}
        {agents.map((a) => (
          <button
            key={a.id}
            onClick={() => onSelect(a.id)}
            className={`w-full rounded-lg border px-3 py-3 text-left transition-colors ${
              selectedId === a.id ? 'border-accent/40 bg-accent/10' : 'border-line bg-panel-2 hover:border-line-2'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-violet-500/10 text-xs font-black text-violet-400">
                {(a.name || '?').slice(0, 2).toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-semibold text-zinc-100">{a.name}</div>
                <div className="truncate font-mono text-[10px] text-faint">
                  {slugify(a.name)}
                  {a.model ? ` · ${a.model.split('/').pop()}` : ''}
                </div>
              </div>
              <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${a.active ? 'bg-accent' : 'bg-faint'}`} />
            </div>
          </button>
        ))}
      </div>
    </aside>
  )
}

export default function AgentStudio({ onNavigate }) {
  const s = useAgentSession({ autoLoad: false })
  const [agents, setAgents] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [draft, setDraft] = useState(null)
  const [models, setModels] = useState([])
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [testing, setTesting] = useState(false)

  const load = useCallback(async () => {
    const { settings } = await window.api.settings.get()
    const list = Array.isArray(settings?.customAgents) ? settings.customAgents : []
    setAgents(list)
    setSelectedId((prev) => (list.some((a) => a.id === prev) ? prev : list[0]?.id || null))
  }, [])

  useEffect(() => {
    load().catch(() => {})
    window.api.agent
      .providers()
      .then((data) => {
        const connected = new Set(data?.connected || [])
        const out = []
        for (const prov of data?.all || []) {
          if (connected.size && !connected.has(prov.id)) continue
          for (const [id, m] of Object.entries(prov.models || {})) {
            out.push({ id: `${prov.id}/${id}`, name: `${prov.id} · ${m.name || id}` })
          }
        }
        setModels(out)
      })
      .catch(() => setModels([]))
  }, [load])

  // Re-sync the editor whenever a different agent is picked.
  useEffect(() => {
    setDraft(agents.find((a) => a.id === selectedId) || null)
  }, [selectedId, agents])

  const dirty = useMemo(() => {
    const original = agents.find((a) => a.id === selectedId)
    return draft && original && JSON.stringify(draft) !== JSON.stringify(original)
  }, [draft, agents, selectedId])

  const persist = async (list) => {
    setSaving(true)
    try {
      await window.api.settings.save({ customAgents: list })
      setAgents(list)
      setSaved(true)
      setTimeout(() => setSaved(false), 1600)
    } finally {
      setSaving(false)
    }
  }

  const create = async () => {
    const agent = blankAgent()
    await persist([...agents, agent])
    setSelectedId(agent.id)
  }

  const duplicate = async () => {
    if (!draft) return
    const copy = { ...draft, id: blankAgent().id, name: `${draft.name} copy` }
    await persist([...agents, copy])
    setSelectedId(copy.id)
  }

  const remove = async () => {
    if (!draft) return
    if (!window.confirm(`Delete the agent "${draft.name}"?`)) return
    const next = agents.filter((a) => a.id !== draft.id)
    await persist(next)
    setSelectedId(next[0]?.id || null)
  }

  const save = async () => {
    if (!draft) return
    await persist(agents.map((a) => (a.id === draft.id ? draft : a)))
  }

  const test = async () => {
    if (!draft) return
    setTesting(true)
    if (dirty) await save()
    s.newSession()
    await s.send('Introduce yourself in one sentence, then say what you would do first in this project.', {
      title: `Test: ${draft.name}`,
      agent: slugify(draft.name)
    })
    setTesting(false)
  }

  const toggleTool = (id) =>
    setDraft((d) => ({
      ...d,
      tools: d.tools.includes(id) ? d.tools.filter((t) => t !== id) : [...d.tools, id]
    }))

  return (
    <div className="flex h-full min-h-0">
      <AgentList agents={agents} selectedId={selectedId} onSelect={setSelectedId} onCreate={create} />

      <div className="min-w-0 flex-1 overflow-y-auto p-6">
        {!draft ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/15 text-accent">
              <Sparkles size={18} />
            </div>
            <p className="mt-3 max-w-sm text-[13px] text-muted">
              Custom agents are saved with your settings and handed to the agent runtime, so the builder can
              call them by name.
            </p>
            <Button size="sm" className="mt-4" onClick={create}>
              <Plus size={13} /> Create an agent
            </Button>
          </div>
        ) : (
          <div className="mx-auto max-w-2xl space-y-5">
            <PageHeader
              title={draft.name || 'Untitled agent'}
              description={`Runs as "${slugify(draft.name)}" — the builder can hand work to it by that name.`}
              actions={
                <>
                  <Button variant="ghost" size="sm" onClick={duplicate} title="Duplicate">
                    <Copy size={12} />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={remove} title="Delete">
                    <Trash2 size={12} className="text-danger" />
                  </Button>
                  <Button variant="outline" size="sm" onClick={test} disabled={testing || !draft.systemPrompt.trim()}>
                    {testing ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />} Test agent
                  </Button>
                  <Button size="sm" onClick={save} disabled={saving || !dirty}>
                    {saving ? 'Saving…' : saved && !dirty ? 'Saved' : 'Save agent'}
                  </Button>
                </>
              }
            />

            <section className="rounded-lg border border-line bg-panel">
              <div className="flex items-center gap-2.5 border-b border-line px-5 py-3.5">
                <Sparkles size={15} className="text-accent" />
                <h3 className="text-sm font-semibold text-zinc-100">Persona</h3>
                <p className="text-xs text-muted">Who this agent is</p>
              </div>
              <div className="space-y-4 px-5 py-4">
                <label className="block">
                  <span className="mb-1.5 block text-xs font-medium text-zinc-300">Name</span>
                  <input
                    className={inputCls}
                    value={draft.name}
                    onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-xs font-medium text-zinc-300">
                    Description <span className="text-faint">— tells the main agent when to use this one</span>
                  </span>
                  <textarea
                    rows={2}
                    className={`${inputCls} resize-none`}
                    value={draft.persona}
                    onChange={(e) => setDraft((d) => ({ ...d, persona: e.target.value }))}
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-xs font-medium text-zinc-300">System prompt</span>
                  <textarea
                    rows={5}
                    className={`${inputCls} resize-none font-mono text-[12px]`}
                    value={draft.systemPrompt}
                    onChange={(e) => setDraft((d) => ({ ...d, systemPrompt: e.target.value }))}
                    placeholder="You are a code reviewer. You never edit files; you report problems with file:line references."
                  />
                  {!draft.systemPrompt.trim() && (
                    <span className="mt-1 block text-[11px] text-amber-ok">
                      An agent with no system prompt is skipped by the runtime.
                    </span>
                  )}
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-xs font-medium text-zinc-300">Model</span>
                  <select
                    className={inputCls}
                    value={draft.model || ''}
                    onChange={(e) => setDraft((d) => ({ ...d, model: e.target.value }))}
                  >
                    <option value="">Same as the main agent</option>
                    {models.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </section>

            <section className="rounded-lg border border-line bg-panel">
              <div className="flex items-center gap-2.5 border-b border-line px-5 py-3.5">
                <Wrench size={15} className="text-accent" />
                <h3 className="text-sm font-semibold text-zinc-100">Tools</h3>
                <p className="text-xs text-muted">
                  {draft.tools.length ? `${draft.tools.length} selected` : 'all tools (nothing selected)'}
                </p>
              </div>
              <div className="grid gap-2 px-5 py-4 sm:grid-cols-2">
                {agentTools.map((t) => {
                  const on = draft.tools.includes(t.id)
                  return (
                    <button
                      key={t.id}
                      onClick={() => toggleTool(t.id)}
                      className={`flex items-start gap-2.5 rounded-md border px-3 py-2.5 text-left transition-colors ${
                        on ? 'border-accent/40 bg-accent/5' : 'border-line bg-panel-2 hover:border-line-2'
                      }`}
                    >
                      <span
                        className={`mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded border text-[10px] ${
                          on ? 'border-accent bg-accent text-zinc-950' : 'border-line-2 text-transparent'
                        }`}
                      >
                        <Check size={10} strokeWidth={3} />
                      </span>
                      <span>
                        <span className="block text-xs font-medium text-zinc-200">{t.label}</span>
                        <span className="block text-[10px] text-faint">{t.desc}</span>
                      </span>
                    </button>
                  )
                })}
              </div>
            </section>

            <section className="rounded-lg border border-line bg-panel px-5 py-4">
              <Toggle
                checked={draft.active !== false}
                onChange={(v) => setDraft((d) => ({ ...d, active: v }))}
                label="Available to the agent runtime"
                description="Inactive agents stay saved here but are left out of the runtime config."
              />
            </section>

            {s.items.length > 0 && (
              <section className="space-y-2 rounded-lg border border-line bg-panel p-4">
                <div className="text-[11px] font-semibold uppercase tracking-widest text-faint">
                  Test output
                </div>
                {s.items.map((item) =>
                  item.kind === 'tool' ? (
                    <ToolCard key={item.id} part={item} />
                  ) : (
                    <div
                      key={item.id}
                      className={`whitespace-pre-wrap rounded-lg px-3.5 py-2.5 text-[13px] leading-relaxed ${
                        item.role === 'user'
                          ? 'bg-accent/15 text-zinc-100'
                          : 'border border-line bg-panel-2 text-zinc-200'
                      }`}
                    >
                      {item.text || '…'}
                    </div>
                  )
                )}
              </section>
            )}

            {s.error && (
              <div className="rounded-md border border-danger/30 bg-danger/5 px-3 py-2 text-xs text-danger">
                {s.error}
              </div>
            )}

            <p className="text-[11px] text-faint">
              Saving restarts the agent runtime so the new configuration takes effect.
            </p>
          </div>
        )}
      </div>

      <SignInGate
        pendingPrompt={s.pendingPrompt}
        onCancel={s.cancelPendingPrompt}
        onOpenSettings={() => {
          s.cancelPendingPrompt()
          onNavigate?.('settings')
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
