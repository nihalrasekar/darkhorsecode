import { useEffect, useState } from 'react'
import { KeyRound, LogIn, Loader2, X, CheckCircle2 } from 'lucide-react'
import Button from './Button'

/**
 * Shown when a prompt was typed before any provider was signed in.
 * The prompt is held by useAgentSession and sends itself once login completes.
 */
export default function SignInGate({ pendingPrompt, onCancel, onOpenSettings }) {
  const [providers, setProviders] = useState([])
  const [busy, setBusy] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!pendingPrompt) return
    window.api.auth
      .status()
      .then((s) => setProviders(s?.providers || []))
      .catch(() => setProviders([]))
  }, [pendingPrompt])

  if (!pendingPrompt) return null

  const login = async (id) => {
    setBusy(id)
    setError(null)
    try {
      const res = await window.api.auth.login(id)
      // A cancelled flow is not an error — the modal just stays open.
      if (res && res.ok === false && !res.cancelled) setError(res.message || 'Sign-in failed')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/60 px-4">
      <div className="w-full max-w-md rounded-xl border border-line-2 bg-panel p-5 shadow-2xl animate-[modal-in_0.15s_ease-out]">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-accent/15 text-accent">
            <LogIn size={15} />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-zinc-100">Sign in to start building</h3>
            <p className="text-[11px] text-muted">The agent needs a provider before it can run.</p>
          </div>
          <button onClick={onCancel} className="ml-auto rounded p-1 text-faint hover:text-zinc-200" title="Cancel">
            <X size={14} />
          </button>
        </div>

        <div className="mt-4 rounded-md border border-line bg-panel-2 px-3.5 py-3">
          <div className="text-[10px] font-semibold uppercase tracking-widest text-faint">
            Your prompt is saved
          </div>
          <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-[12px] text-zinc-300">
            {pendingPrompt.text}
          </p>
          <p className="mt-2 text-[11px] text-faint">It sends itself as soon as you are signed in.</p>
        </div>

        <div className="mt-4 space-y-2">
          {providers.map((p) => (
            <button
              key={p.id}
              onClick={() => login(p.id)}
              disabled={Boolean(busy) || p.configured}
              className="flex w-full items-center gap-2.5 rounded-md border border-line-2 bg-panel-2 px-3.5 py-2.5 text-left transition-colors hover:border-accent/40 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {p.configured ? (
                <CheckCircle2 size={14} className="shrink-0 text-accent" />
              ) : busy === p.id ? (
                <Loader2 size={14} className="shrink-0 animate-spin text-accent" />
              ) : (
                <LogIn size={14} className="shrink-0 text-muted" />
              )}
              <div className="min-w-0">
                <div className="text-[13px] font-medium text-zinc-100">{p.loginLabel || p.name}</div>
                <div className="text-[11px] text-faint">
                  {p.configured ? p.source : `Uses your ${p.subscription} plan`}
                </div>
              </div>
            </button>
          ))}
          {providers.length === 0 && (
            <div className="rounded-md border border-line bg-panel-2 px-3.5 py-3 text-[12px] text-faint">
              No sign-in providers available.
            </div>
          )}
        </div>

        {error && (
          <div className="mt-3 rounded-md border border-danger/30 bg-danger/5 px-3 py-2 text-[11px] text-danger">
            {error}
          </div>
        )}

        <div className="mt-4 flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onOpenSettings}>
            <KeyRound size={12} /> Use an API key instead
          </Button>
          <Button variant="ghost" size="sm" className="ml-auto" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  )
}
