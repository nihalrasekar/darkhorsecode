import { useCallback, useEffect, useState } from 'react'
import {
  Plug,
  Wrench,
  Activity,
  AlertTriangle,
  Terminal,
  Plus,
  Check,
  RefreshCw,
  Loader2,
  X
} from 'lucide-react'
import PageHeader from '../components/PageHeader'
import Button from '../components/Button'
import { useToast } from '../components/Toast'

const PRESETS = [
  {
    id: 'supabase',
    name: 'Supabase',
    description: 'Postgres, RLS, auth and edge functions',
    transport: 'remote',
    fields: [
      {
        key: 'token',
        label: 'Supabase Access Token (optional, use Authenticate instead)',
        placeholder: 'sbp_…',
        secret: true,
        required: false
      },
      {
        key: 'ref',
        label: 'Project ref (optional)',
        placeholder: 'abcdefghijkl',
        secret: false,
        required: false
      }
    ],
    build: (v) => {
      const params = new URLSearchParams()
      if (v.ref) params.set('project_ref', v.ref)
      const qs = params.toString()
      return {
        type: 'remote',
        url: `https://mcp.supabase.com/mcp${qs ? `?${qs}` : ''}`,
        headers: v.token ? { Authorization: `Bearer ${v.token}` } : {},
        enabled: true
      }
    }
  },
  {
    id: 'vercel',
    name: 'Vercel',
    description: 'Deployments, domains and env vars',
    transport: 'remote',
    fields: [
      {
        key: 'token',
        label: 'Vercel API Token (optional, use Authenticate instead)',
        placeholder: 'xxxx',
        secret: true,
        required: false
      }
    ],
    build: (v) => ({
      type: 'remote',
      url: 'https://mcp.vercel.com',
      headers: v.token ? { Authorization: `Bearer ${v.token}` } : {},
      enabled: true
    })
  },
  {
    id: 'playwright',
    name: 'Playwright',
    description: 'Drive a real browser for previews and E2E flows',
    transport: 'local',
    fields: [],
    build: () => ({ type: 'local', command: ['npx', '@playwright/mcp@latest'], enabled: true })
  }
]

const STATUS_META = {
  connected: { label: 'Connected', dot: 'bg-accent', chip: 'border-accent/30 bg-accent/10 text-accent' },
  failed: { label: 'Error', dot: 'bg-danger', chip: 'border-danger/30 bg-danger/10 text-danger' },
  disabled: { label: 'Disabled', dot: 'bg-faint', chip: 'border-line bg-panel-2 text-muted' },
  needs_auth: { label: 'Needs auth', dot: 'bg-amber-ok', chip: 'border-amber-500/30 bg-amber-500/10 text-amber-ok' }
}

export default function Mcp() {
  const toast = useToast()
  const [status, setStatus] = useState({})
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(null)
  const [form, setForm] = useState({})
  const [busy, setBusy] = useState('')

  const refresh = useCallback(async () => {
    try {
      const s = await window.api.agent.mcpStatus()
      setStatus(s || {})
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    refresh()
  }, [refresh])

  const namedServers = Object.keys(status)

  const connected = namedServers.filter((n) => status[n].status === 'connected').length
  const failed = namedServers.filter((n) => status[n].status === 'failed').length

  const startAdd = (p) => {
    setAdding(p)
    setForm({})
  }

  const addServer = async (preset) => {
    if (preset.fields.some((f) => f.required !== false && !form[f.key])) {
      toast('Fill in the credential field(s) to continue', 'error')
      return
    }
    setBusy(preset.id)
    try {
      await window.api.agent.mcpAdd(preset.id, preset.build(form))
      toast(`${preset.name} added`, 'success')
      await refresh()
      setAdding(null)
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      setBusy('')
    }
  }

  const toggle = async (name, connect) => {
    setBusy(name)
    try {
      if (connect) await window.api.agent.mcpConnect(name)
      else await window.api.agent.mcpDisconnect(name)
      await refresh()
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      setBusy('')
    }
  }

  const authenticate = async (name) => {
    setBusy(name)
    try {
      await window.api.agent.mcpAuthenticate(name)
      toast('Finish sign-in in your browser', 'success')
      // ponytail: fixed poll window, add backoff/cancel if this gets noisy
      for (let i = 0; i < 30; i++) {
        await new Promise((r) => setTimeout(r, 2000))
        const s = await window.api.agent.mcpStatus()
        setStatus(s || {})
        if (s?.[name]?.status !== 'needs_auth') break
      }
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      setBusy('')
    }
  }

  const inputCls =
    'w-full rounded-md border border-line-2 bg-panel-2 px-3 h-9 text-[13px] text-zinc-100 outline-none placeholder:text-faint focus:border-accent/50'

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mx-auto max-w-4xl">
        <PageHeader
          title="MCP Connectors"
          description="Model Context Protocol servers that give your agents extra tools and data."
          actions={
            <Button size="sm" variant="ghost" onClick={refresh}>
              <RefreshCw size={14} /> Refresh
            </Button>
          }
        />

        <div className="mt-5 grid grid-cols-3 gap-3">
          {[
            { label: 'Connected servers', value: connected, icon: Plug, tone: 'text-accent' },
            { label: 'With errors', value: failed, icon: Activity, tone: failed ? 'text-danger' : 'text-muted' },
            { label: 'Configured', value: namedServers.length, icon: Wrench, tone: 'text-zinc-100' }
          ].map((s) => (
            <div key={s.label} className="rounded-lg border border-line bg-panel p-3.5">
              <div className="flex items-center gap-1.5 text-[11px] text-muted">
                <s.icon size={12} className={s.tone} />
                {s.label}
              </div>
              <div className={`mt-1.5 font-mono text-lg font-semibold ${s.tone}`}>
                {loading ? '…' : s.value}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-5 space-y-2 px-2 text-[11px] font-medium uppercase tracking-widest text-faint">
          Available connectors
        </div>
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          {PRESETS.map((p) => {
            const configured = status[p.id]
            const meta = configured ? STATUS_META[configured.status] || STATUS_META.disabled : null
            return (
              <div key={p.id} className="rounded-lg border border-line bg-panel p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-accent/10 text-accent">
                    <Terminal size={15} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-zinc-100">{p.name}</h3>
                      <span className="rounded border border-line px-1.5 py-px font-mono text-[10px] uppercase text-faint">
                        {p.transport}
                      </span>
                      {meta && (
                        <span className={`ml-auto flex items-center gap-1.5 rounded border px-2 py-0.5 text-[10px] ${meta.chip}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
                          {meta.label}
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-[11px] text-muted">{p.description}</p>
                    {configured?.status === 'failed' && (
                      <p className="mt-1.5 flex items-center gap-1 text-[11px] text-danger">
                        <AlertTriangle size={11} /> {configured.error || 'Connection failed'}
                      </p>
                    )}
                  </div>
                </div>

                {adding?.id === p.id ? (
                  <div className="mt-3 space-y-2 border-t border-line pt-3">
                    {p.fields.map((f) => (
                      <input
                        key={f.key}
                        type={f.secret ? 'password' : 'text'}
                        className={inputCls}
                        placeholder={f.placeholder}
                        value={form[f.key] || ''}
                        onChange={(e) => setForm((prev) => ({ ...prev, [f.key]: e.target.value }))}
                      />
                    ))}
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="primary"
                        className="flex-1"
                        disabled={busy === p.id}
                        onClick={() => addServer(p)}
                      >
                        {busy === p.id ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />} Add
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setAdding(null)}>
                        <X size={12} /> Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 flex gap-2 border-t border-line pt-3">
                    {configured ? (
                      <>
                        {configured.status === 'needs_auth' ? (
                          <Button
                            size="sm"
                            variant="primary"
                            className="flex-1"
                            disabled={busy === p.id}
                            onClick={() => authenticate(p.id)}
                          >
                            {busy === p.id ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                            Authenticate
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant={configured.status === 'connected' ? 'outline' : 'primary'}
                            className="flex-1"
                            disabled={busy === p.id}
                            onClick={() => toggle(p.id, configured.status !== 'connected')}
                          >
                            {busy === p.id ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                            {configured.status === 'connected' ? 'Disconnect' : 'Connect'}
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" onClick={() => startAdd(p)}>
                          <RefreshCw size={12} /> Reconfigure
                        </Button>
                      </>
                    ) : (
                      <Button size="sm" variant="primary" className="flex-1" onClick={() => startAdd(p)}>
                        <Plus size={12} /> Add {p.name}
                      </Button>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {!loading && namedServers.length > 0 && (
          <>
            <div className="mt-6 px-2 text-[11px] font-medium uppercase tracking-widest text-faint">
              Configured servers
            </div>
            <div className="mt-2 space-y-2">
              {namedServers.map((name) => {
                const st = status[name]
                const meta = STATUS_META[st.status] || STATUS_META.disabled
                return (
                  <div key={name} className="flex items-center gap-3 rounded-lg border border-line bg-panel px-4 py-3">
                    <span className={`h-2 w-2 shrink-0 rounded-full ${meta.dot}`} />
                    <span className="font-mono text-[13px] text-zinc-200">{name}</span>
                    <span className={`rounded border px-2 py-0.5 text-[10px] ${meta.chip}`}>{meta.label}</span>
                    {st.status === 'failed' && (
                      <span className="truncate font-mono text-[11px] text-danger">— {st.error}</span>
                    )}
                    <div className="ml-auto flex gap-1.5">
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={busy === name}
                        onClick={() =>
                          st.status === 'needs_auth'
                            ? authenticate(name)
                            : toggle(name, st.status !== 'connected')
                        }
                      >
                        {st.status === 'needs_auth'
                          ? 'Authenticate'
                          : st.status === 'connected'
                            ? 'Disconnect'
                            : 'Connect'}
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>
    </div>
  )
}