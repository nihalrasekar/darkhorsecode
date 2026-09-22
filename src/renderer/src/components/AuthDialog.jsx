import { useEffect, useRef, useState } from 'react'
import { X, Loader2, ExternalLink, ChevronRight, CheckCircle2, XCircle } from 'lucide-react'
import Button from './Button'

const PROVIDER_META = {
  anthropic: { name: 'Claude Code', accent: 'text-amber-400' },
  openai: { name: 'ChatGPT', accent: 'text-emerald-400' }
}

function digest(event) {
  switch (event?.type) {
    case 'auth_url':
      return { title: 'Waiting for browser…', body: event.instructions || 'Complete sign-in in your browser.', icon: ExternalLink, tint: 'text-sky-400' }
    case 'device_code':
      return { title: 'Enter this code', code: event.userCode, uri: event.verificationUri, body: `at ${event.verificationUri}`, icon: null, tint: 'text-accent' }
    case 'progress':
      return { title: event.message, body: null, icon: Loader2, tint: 'text-muted' }
    case 'info':
      return { title: event.message, body: null, icon: null, tint: 'text-muted' }
    default:
      return { title: event?.message || '…', body: null, icon: null, tint: 'text-muted' }
  }
}

export default function AuthDialog() {
  const [flow, setFlow] = useState(null)
  const [inputs, setInputs] = useState({})
  const [done, setDone] = useState(null)
  const bodyRef = useRef(null)

  const accept = (requestId, value) => {
    window.api.auth.answer(requestId, value)
  }

  const close = () => {
    if (!done?.closed) {
      if (flow?.providerId) window.api.auth.cancel(flow.providerId)
      setFlow(null)
      setDone({ ...done, closed: true } || { closed: true })
    }
  }

  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight
  }, [flow?.events?.length, flow?.prompts?.length])

  useEffect(() => {
    let mounted = true
    window.api.auth.status().then((s) => {
      if (!mounted) return
      if (s.active) {
        setFlow({
          providerId: s.active.providerId,
          // main stores these wrapped as { event }; live broadcasts arrive raw
          events: (s.active.events || []).map((e) => e?.event ?? e),
          prompts: s.active.prompts || []
        })
      }
    })
    const offEvent = window.api.auth.onEvent(({ providerId, event }) => {
      setFlow((f) => {
        if (!f) {
          setDone(null)
          return { providerId, events: [event], prompts: [] }
        }
        return { ...f, providerId, events: [...f.events, event] }
      })
    })
    const offPrompt = window.api.auth.onPrompt(({ providerId, requestId, prompt }) => {
      setDone(null)
      setFlow((f) => {
        const base = f || { providerId, events: [], prompts: [] }
        if (base.prompts.some((p) => p.requestId === requestId)) return base
        return { ...base, providerId, prompts: [...base.prompts, { requestId, prompt }] }
      })
    })
    const offClosed = window.api.auth.onPromptClosed(({ requestId }) => {
      setFlow((f) => (f ? { ...f, prompts: f.prompts.filter((p) => p.requestId !== requestId) } : f))
    })
    const offDone = window.api.auth.onDone((payload) => {
      setDone(payload)
      setFlow(null)
    })
    return () => {
      mounted = false
      offEvent()
      offPrompt()
      offClosed()
      offDone()
    }
  }, [])

  const visible = Boolean(flow) || Boolean(done && !done.closed)
  if (!visible) return null

  const meta = PROVIDER_META[flow?.providerId] || { name: flow?.providerId || 'Provider', accent: 'text-muted' }

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/60 px-4">
      <div className="w-full max-w-md overflow-hidden rounded-xl border border-line-2 bg-panel shadow-2xl animate-[modal-in_0.15s_ease-out]">
        <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
          <div className="flex items-center gap-2">
            <span className={`text-sm font-semibold ${meta.accent}`}>{meta.name}</span>
            <span className="text-xs text-faint">— sign in</span>
          </div>
          <button onClick={close} className="text-faint transition-colors hover:text-zinc-300">
            <X size={15} />
          </button>
        </div>

        <div ref={bodyRef} className="max-h-[55vh] space-y-3 overflow-y-auto px-5 py-4">
          {done ? (
            <div className="flex flex-col items-center gap-2 py-6 text-center">
              {done.ok ? (
                <>
                  <CheckCircle2 size={26} className="text-accent" />
                  <p className="text-sm font-medium text-zinc-100">Signed in with {meta.name}</p>
                  <p className="text-xs text-faint">Restarting the agent to pick up your credentials…</p>
                </>
              ) : (
                <>
                  <XCircle size={26} className="text-danger" />
                  <p className="text-sm font-medium text-zinc-100">
                    {done.cancelled ? 'Sign-in cancelled' : 'Sign-in failed'}
                  </p>
                  {done.message && <p className="break-words text-xs text-faint">{done.message}</p>}
                </>
              )}
            </div>
          ) : (
            <>
              {flow?.events.map((event, i) => {
                const d = digest(event)
                const Icon = d.icon
                return (
                  <div key={`e${i}`} className="rounded-lg border border-line bg-panel-2 px-3.5 py-3">
                    <div className={`flex items-start gap-2 text-[13px] ${d.tint}`}>
                      {Icon && <Icon size={15} className="mt-0.5 shrink-0 animate-[spin_1.2s_linear_infinite]" />}
                      <div className="min-w-0">
                        <p className="font-medium">{d.title}</p>
                        {d.body && <p className="mt-0.5 text-xs text-zinc-300">{d.body}</p>}
                        {d.code && (
                          <p className="mt-1.5 flex items-center gap-2">
                            <code className="rounded bg-black/40 px-2 py-1 font-mono text-sm tracking-widest text-accent">{d.code}</code>
                            {d.uri && (
                              <Button size="sm" variant="ghost" onClick={() => window.open(d.uri, '_blank')}>
                                Open <ExternalLink size={12} />
                              </Button>
                            )}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}

              {flow?.prompts.map(({ requestId, prompt }) => (
                <div key={requestId} className="rounded-lg border border-line bg-panel-2 px-3.5 py-3">
                  <p className="mb-2 text-[13px] text-zinc-200">{prompt.message}</p>
                  {prompt.type === 'select' && prompt.options?.length ? (
                    <div className="flex flex-col gap-2">
                      {prompt.options.map((opt) => (
                        <button
                          key={opt.id}
                          onClick={() => accept(requestId, opt.id)}
                          className="flex items-center justify-between rounded-md border border-line-2 bg-panel px-3 py-2 text-left text-[13px] text-zinc-200 transition-colors hover:border-accent/50 hover:text-accent"
                        >
                          <span>
                            {opt.label}
                            {opt.description && <span className="block text-[11px] text-faint">{opt.description}</span>}
                          </span>
                          <ChevronRight size={14} className="text-faint" />
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <input
                        type={prompt.type === 'secret' ? 'password' : 'text'}
                        className="h-8 flex-1 rounded-md border border-line-2 bg-panel px-2.5 text-[13px] text-zinc-100 outline-none focus:border-accent/50"
                        placeholder={prompt.placeholder || 'Paste code…'}
                        value={inputs[requestId] || ''}
                        onChange={(e) => setInputs((i) => ({ ...i, [requestId]: e.target.value }))}
                        onKeyDown={(e) => e.key === 'Enter' && accept(requestId, inputs[requestId] || '')}
                      />
                      <Button size="sm" onClick={() => accept(requestId, inputs[requestId] || '')}>
                        OK
                      </Button>
                    </div>
                  )}
                </div>
              ))}

              {flow?.prompts.length === 0 && (
                <div className="flex items-center gap-2 rounded-lg border border-line bg-panel-2 px-3.5 py-3 text-xs text-muted">
                  <Loader2 size={14} className="shrink-0 animate-[spin_1s_linear_infinite]" />
                  Waiting for sign-in…
                </div>
              )}
            </>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-line px-5 py-3">
          <span className="text-[11px] text-faint">A browser window may have opened.</span>
          <Button size="sm" variant="ghost" onClick={close}>
            {done ? 'Done' : 'Cancel'}
          </Button>
        </div>
      </div>
    </div>
  )
}