import { useEffect, useRef, useState } from 'react'
import { KeyRound, Bot, SlidersHorizontal, Folder, Eye, LogIn, LogOut, CheckCircle2, ScrollText } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import Button from '../components/Button'
import Toggle from '../components/Toggle'
import { useToast } from '../components/Toast'

// Only anthropic needs a static fallback (its OAuth-blocked reality means users
// often pick a model before ever seeing a live catalog). Everything else is
// populated from opencode's own live /provider catalog — see loadModels() below.
const FALLBACK_MODELS = {
  anthropic: [
    { id: 'claude-opus-5', name: 'Claude Opus 5' },
    { id: 'claude-sonnet-5', name: 'Claude Sonnet 5' },
    { id: 'claude-haiku-4-5-20251001', name: 'Claude Haiku 4.5' },
    { id: 'claude-fable-5-1', name: 'Claude Fable 5.1' }
  ]
}

// Codex model access is gated by ChatGPT plan tier, not by anything this app
// controls — confirmed by live-testing every catalog model against a real
// ChatGPT Go account. Go could only run these three; the rest of the GPT-5/6
// line (gpt-5.4 family, gpt-5.6-sol, ...) rejected with "not supported when
// using Codex with a ChatGPT account" and needs Plus/Pro.
const CHATGPT_GO_MODELS = new Set(['gpt-5.5', 'gpt-5.6-luna', 'gpt-5.6-terra'])

// Ollama has no live catalog (models are pulled locally by name), so curate
// known coding-focused, agentic-tool-use-capable models from Ollama's library —
// this app drives a coding agent, not general chat. Smallest-first — the big
// ones need real GPU VRAM (rough rule: ~1GB VRAM per 1B params at Q4).
const OLLAMA_AGENTIC_MODELS = [
  'qwen2.5-coder:7b', 'qwen2.5-coder:14b',
  'qwen3-coder:30b', 'devstral:24b', 'qwen2.5-coder:32b', 'deepseek-coder-v2:16b',
  'codestral:22b', 'gpt-oss:20b', 'gpt-oss:120b'
]

// OpenCode Zen (opencode.ai's OpenAI-compatible free/paid model gateway) — its
// current free tier, big-pickle first since it's Zen's flagship free coding model.
// Still needs a free API key (opencode.ai/auth, no billing) entered below.
const ZEN_BASE_URL = 'https://opencode.ai/zen/v1'
const ZEN_FREE_MODELS = [
  { id: 'big-pickle', name: 'Big Pickle' },
  { id: 'mimo-v2.5-free', name: 'MiMo-V2.5' },
  { id: 'ling-3.0-flash-fin-free', name: 'Ling 3.0 Flash Fin' },
  { id: 'nemotron-3-ultra-free', name: 'Nemotron 3 Ultra' },
  { id: 'nemotron-3.5-lightning-free', name: 'Nemotron 3.5 Lightning' },
  { id: 'muse-spark-1.3-contributor-free', name: 'Muse Spark 1.3 Contributor' }
]

// opencode's OWN built-in free gateway — distinct from the Zen wiring above (which is
// this app's manual OpenAI-compatible setup and always needs a Zen key). This one is
// requested as a fully-qualified "opencode/<id>" model id, so it bypasses this app's
// provider/baseUrl/apiKey plumbing entirely and opencode serves it from its own
// credential-free default — confirmed working with zero key in production logs.
const OPENCODE_FREE_MODEL = { id: 'opencode/big-pickle', name: 'Big Pickle — free, no key' }

// Every model here is agentic-coding + reasoning capable — surfaced first in the
// picker with a star. Matched by family/line rather than a fixed id list, since the
// live provider catalog (opencode's /provider) can add new model ids at any time.
function isAgenticModel(fullId) {
  const bare = fullId.includes('/') ? fullId.split('/')[1] : fullId
  // The whole GPT-5/6 line (via ChatGPT/Codex OAuth) is purpose-built for agentic coding.
  if (fullId.startsWith('openai/') || /^gpt-(5|6)/.test(bare)) return true
  // Claude 5 generation (Opus/Sonnet/Fable) and Haiku 4.5 all support agentic tool-use + reasoning.
  if (/^claude-(opus|sonnet|fable)-5/.test(bare)) return true
  if (/^claude-haiku-4-5/.test(bare)) return true
  return false
}

function Field({ label, hint, children }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-zinc-300">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-faint">{hint}</span>}
    </label>
  )
}

const PROVIDER_LABELS = {
  anthropic: 'Anthropic (Claude Code)',
  openai: 'ChatGPT (Codex)',
  custom: 'OpenCode',
  ollama: 'Ollama (local)'
}

const inputCls =
  'w-full rounded-md border border-line-2 bg-panel-2 px-3 h-9 text-sm text-zinc-100 outline-none transition-colors focus:border-accent/50'

function Section({ icon: Icon, title, description, children }) {
  return (
    <section className="rounded-lg border border-line bg-panel">
      <div className="flex items-center gap-2.5 border-b border-line px-5 py-3.5">
        <Icon size={15} className="text-accent" />
        <h3 className="text-sm font-semibold text-zinc-100">{title}</h3>
        <p className="text-xs text-muted">{description}</p>
      </div>
      <div className="px-5 py-4">{children}</div>
    </section>
  )
}

export default function Settings() {
  const toast = useToast()
  const [s, setS] = useState(null)
  const [apiKeySet, setApiKeySet] = useState(false)
  const [apiKeyDraft, setApiKeyDraft] = useState('')
  const [catalog, setCatalog] = useState({})
  const [providersMeta, setProvidersMeta] = useState({ all: [], connected: [] })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [showKey, setShowKey] = useState(false)
  const [ignoreText, setIgnoreText] = useState('')
  const [oauth, setOauth] = useState({ providers: [] })
  const [authBusy, setAuthBusy] = useState({})
  const [specs, setSpecs] = useState(null)
  const [ollamaModels, setOllamaModels] = useState({ ok: false, models: [] })
  const apiKeyInputRef = useRef(null)

  const loadOAuth = async () => {
    try {
      const s = await window.api.auth.status()
      setOauth(s)
    } catch {
      setOauth({ providers: [] })
    }
  }

  const load = async () => {
    try {
      const { settings, apiKeySet: set } = await window.api.settings.get()
      setS(settings)
      setApiKeySet(set)
      setIgnoreText((settings.ignorePatterns || []).join(', '))
    } catch (err) {
      toast(err.message, 'error')
    }
  }

  const loadModels = async () => {
    try {
      const data = await window.api.agent.providers()
      const cat = {}
      for (const prov of data.all || []) {
        cat[prov.id] = Object.entries(prov.models || {}).map(([id, m]) => ({
          id,
          name: m.name || id
        }))
      }
      setCatalog(cat)
      setProvidersMeta(data)
    } catch {
      setCatalog({})
    }
  }

  useEffect(() => {
    load()
    loadModels()
    loadOAuth()
    window.api.system
      .specs()
      .then(setSpecs)
      .catch(() => setSpecs(null))
  }, [])

  // Ollama model names end in ":<size>b" (e.g. "qwen2.5-coder:32b") — parse it
  // to compare against the detected hardware's max recommended params.
  const modelSizeB = (id) => {
    const m = id.match(/:(\d+(?:\.\d+)?)b$/i)
    return m ? Number(m[1]) : null
  }

  useEffect(() => {
    if (s?.provider !== 'ollama') return
    window.api.system
      .ollamaModels(s.baseUrl)
      .then(setOllamaModels)
      .catch(() => setOllamaModels({ ok: false, models: [] }))
  }, [s?.provider, s?.baseUrl])

  // Seed OpenCode Zen's flagship free model the first time this provider is picked —
  // but ONLY when a real API key is already saved. Without a Zen key the runtime sends
  // a placeholder key and Zen replies "invalid key"; leaving the field blank keeps
  // opencode on its own default model, which works without any key.
  useEffect(() => {
    if (s?.provider === 'custom' && apiKeySet && !s.model) {
      set('model', ZEN_FREE_MODELS[0].id)
      if (!s.baseUrl) set('baseUrl', ZEN_BASE_URL)
    }
  }, [s?.provider, apiKeySet])

  const set = (key, value) => setS((p) => ({ ...p, [key]: value }))

  const modelOptions = () => {
    const providerId = s.provider
    const list = catalog[providerId]
    const liveIds = (list || []).map((m) => `${providerId}/${m.id}`)
    const fallbackIds = (FALLBACK_MODELS[providerId] || []).map((m) => `${providerId}/${m.id}`)
    // opencode's live /provider catalog is sometimes only partially populated before a
    // provider is connected (e.g. a single placeholder model), so union with the curated
    // fallback rather than picking one or the other — dedup keeps the live copy on a clash.
    const byBare = new Map()
    for (const id of [...fallbackIds, ...liveIds]) byBare.set(id.split('/')[1] || id, id)
    const ids = [...byBare.values()]
    // Live catalogs carry every model a provider ever shipped — embeddings, whisper,
    // o-series, deprecated Claude 2/3 lines, etc. Codex only ever drives GPT-5/6 and
    // Anthropic only ever drives Claude, so keep just those families.
    const filtered =
      providerId === 'openai'
        ? ids.filter((id) => /^gpt-/i.test(id.split('/')[1] || id))
        : providerId === 'anthropic'
          ? ids.filter((id) => /^claude-/i.test(id.split('/')[1] || id))
          : ids
    return (filtered.length ? filtered : ids).slice().sort((a, b) => Number(isAgenticModel(b)) - Number(isAgenticModel(a)))
  }

  const save = async () => {
    if (!s) return
    setSaving(true)
    try {
      const payload = {
        ...s,
        apiKey: apiKeyDraft.trim() ? apiKeyDraft.trim() : undefined,
        ignorePatterns: ignoreText
          .split(',')
          .map((p) => p.trim())
          .filter(Boolean)
      }
      await window.api.settings.save(payload)
      setApiKeyDraft('')
      setApiKeySet((prev) => prev || Boolean(apiKeyDraft.trim()))
      setSaved(true)
      toast('Settings saved — agent restarted', 'success')
      setTimeout(() => setSaved(false), 1600)
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  const removeApiKey = async () => {
    setSaving(true)
    try {
      await window.api.settings.save({ clearApiKey: true })
      setApiKeyDraft('')
      setApiKeySet(false)
      toast('API key removed — agent restarted', 'success')
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  // The saved key isn't in the draft (settings:get never sends it), so fetch it on first reveal.
  const toggleShowKey = async () => {
    if (!showKey && apiKeySet && !apiKeyDraft) {
      try {
        setApiKeyDraft(await window.api.settings.revealKey())
      } catch (err) {
        toast(err.message, 'error')
      }
    }
    setShowKey((v) => !v)
  }

  const signIn = async (provider) => {
    setAuthBusy((b) => ({ ...b, [provider]: true }))
    try {
      const res = await window.api.auth.login(provider)
      if (res?.ok) toast(`Signed in. Agent restarting with your ChatGPT subscription…`, 'success')
    } catch (err) {
      toast(err.message || 'Sign-in failed', 'error')
    } finally {
      setAuthBusy((b) => ({ ...b, [provider]: false }))
      await loadOAuth()
    }
  }

  const signOut = async (provider) => {
    setAuthBusy((b) => ({ ...b, [provider]: true }))
    try {
      await window.api.auth.logout(provider)
      toast('Signed out', 'success')
    } catch (err) {
      toast(err.message || 'Sign-out failed', 'error')
    } finally {
      setAuthBusy((b) => ({ ...b, [provider]: false }))
      await loadOAuth()
    }
  }

  if (!s) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-xs text-faint">Loading settings…</p>
      </div>
    )
  }

  const shownProvider = s.provider === 'custom' ? 'openai' : s.provider
  // Claude Pro/Max sign-in authenticates the app, but Anthropic's API rejects that
  // subscription token when it's used as a completions key from a third-party tool —
  // it only works from the official Claude Code client. A real API key is required
  // to actually run an anthropic model here.
  const anthropicNeedsKey = s.provider === 'anthropic' && !apiKeySet

  const providerOptions = (() => {
    const base = ['anthropic', 'custom', 'ollama']
    return oauth.providers.find((p) => p.id === 'openai')?.configured
      ? [...base.slice(0, 1), 'openai', ...base.slice(1)]
      : base
  })()

  const oauthProv = (id) => oauth.providers.find((p) => p.id === id)

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mx-auto max-w-2xl space-y-5">
        <PageHeader
          title="Settings"
          description="Model, API and behaviour preferences for your agents."
          actions={
            <Button size="sm" onClick={save} disabled={saving}>
              {saved ? 'Saved' : saving ? 'Saving…' : 'Save changes'}
            </Button>
          }
        />

        <Section icon={Bot} title="Model" description="Which model drives new agents">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Provider">
              <div className="flex items-center gap-0.5 rounded-md border border-line bg-panel-2 p-0.5">
                {providerOptions.map((p) => (
                  <button
                    key={p}
                    onClick={() => {
                      if (s.provider === p) return
                      setS((prev) => ({ ...prev, provider: p, model: '', baseUrl: '' }))
                    }}
                    className={`flex-1 rounded px-3 py-1.5 text-xs transition-colors ${
                      s.provider === p ? 'bg-accent/10 text-accent' : 'text-muted hover:text-zinc-200'
                    }`}
                  >
                    {PROVIDER_LABELS[p] || p}
                  </button>
                ))}
              </div>
            </Field>
            <Field
              label="Model"
              hint={
                s.provider === 'ollama'
                  ? 'Model name as shown by `ollama list`, e.g. qwen2.5-coder:7b. Suggested below are coding-focused agentic models, smallest first — bigger ones need more GPU VRAM (roughly 1GB per 1B params).'
                  : s.provider === 'custom'
                    ? 'Model id as your endpoint expects it — opencode sends it through as-is, whatever the provider names it. "Big Pickle — free, no key" uses opencode\'s own built-in gateway, no signup needed. The other Zen chips route through opencode.ai/zen instead and need a free API key from opencode.ai/auth entered below.'
                    : undefined
              }
            >
              {s.provider === 'custom' ? (
                <>
                  <input
                    className={inputCls}
                    value={s.model || ''}
                    onChange={(e) => set('model', e.target.value)}
                    placeholder="e.g. llama-3.3-70b-instruct"
                  />
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        if (s.model === OPENCODE_FREE_MODEL.id) {
                          set('model', '')
                        } else {
                          set('model', OPENCODE_FREE_MODEL.id)
                          if (s.baseUrl === ZEN_BASE_URL) set('baseUrl', '')
                        }
                      }}
                      title="opencode's own free gateway — no API key needed. Click again to deselect."
                      className={`rounded-full border px-2 py-0.5 text-[11px] transition-colors ${
                        s.model === OPENCODE_FREE_MODEL.id
                          ? 'border-emerald-400/60 bg-emerald-400/10 text-emerald-300'
                          : 'border-emerald-400/30 text-zinc-200 hover:border-emerald-400/50'
                      }`}
                    >
                      {OPENCODE_FREE_MODEL.name}
                    </button>
                    {ZEN_FREE_MODELS.map(({ id, name }) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => {
                          if (s.model === id) {
                            set('model', '')
                            if (s.baseUrl === ZEN_BASE_URL) set('baseUrl', '')
                          } else {
                            set('model', id)
                            if (!s.baseUrl) set('baseUrl', ZEN_BASE_URL)
                            if (!apiKeySet) {
                              apiKeyInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                              apiKeyInputRef.current?.focus()
                            }
                          }
                        }}
                        title="Free via OpenCode Zen — click again to deselect"
                        className={`rounded-full border px-2 py-0.5 text-[11px] transition-colors ${
                          s.model === id
                            ? 'border-accent/50 bg-accent/10 text-accent'
                            : 'border-accent/30 text-zinc-200 hover:border-accent/50'
                        }`}
                      >
                        {name}
                      </button>
                    ))}
                  </div>
                  {ZEN_FREE_MODELS.some((m) => m.id === s.model) && !apiKeySet && (
                    <p className="mt-1.5 text-[11px] text-amber-ok">
                      {ZEN_FREE_MODELS.find((m) => m.id === s.model)?.name} is free, but Zen still needs a key to use
                      it — paste a free key from opencode.ai/auth (no billing) in the API section below.
                    </p>
                  )}
                </>
              ) : s.provider === 'ollama' ? (
                <>
                  <input
                    className={inputCls}
                    value={s.model || ''}
                    onChange={(e) => set('model', e.target.value)}
                    placeholder="qwen2.5-coder:7b"
                  />
                  {specs && (
                    <p className="mt-1.5 text-[11px] text-faint">
                      {specs.gpu
                        ? `Detected ${specs.gpu.name} (~${specs.gpu.vramGB}GB VRAM) — models up to ~${specs.maxModelB}B should fit comfortably.`
                        : `No dedicated GPU detected, ${specs.ramGB}GB RAM — CPU inference works up to ~${specs.maxModelB}B (slower).`}
                    </p>
                  )}
                  {ollamaModels.ok && (
                    <p className="mt-1.5 text-[11px] text-faint">
                      {ollamaModels.models.length > 0
                        ? `Installed (from \`ollama list\`): ${ollamaModels.models.length} model${ollamaModels.models.length === 1 ? '' : 's'}.`
                        : "No models installed yet — pull one with `ollama pull <name>`, or pick a suggestion below to see the command."}
                    </p>
                  )}
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {ollamaModels.models.map((m) => {
                      const sizeB = modelSizeB(m)
                      const overCapacity = specs && sizeB && sizeB > specs.maxModelB
                      return (
                        <button
                          key={`installed-${m}`}
                          type="button"
                          onClick={() => set('model', s.model === m ? '' : m)}
                          title={overCapacity ? `~${sizeB}B likely exceeds your detected capacity (~${specs.maxModelB}B) — click again to deselect` : `Installed — click again to deselect`}
                          className={`rounded-full border px-2 py-0.5 text-[11px] transition-colors ${
                            s.model === m
                              ? 'border-accent/50 bg-accent/10 text-accent'
                              : overCapacity
                                ? 'border-line-2 text-faint opacity-60 hover:opacity-90'
                                : 'border-accent/30 text-zinc-200 hover:border-accent/50'
                          }`}
                        >
                          ✓ {m}
                          {overCapacity ? ' ⚠' : ''}
                        </button>
                      )
                    })}
                    {OLLAMA_AGENTIC_MODELS.filter((m) => !ollamaModels.models.includes(m)).map((m) => {
                      const sizeB = modelSizeB(m)
                      const overCapacity = specs && sizeB && sizeB > specs.maxModelB
                      return (
                        <button
                          key={`suggested-${m}`}
                          type="button"
                          onClick={() => set('model', s.model === m ? '' : m)}
                          title={
                            overCapacity
                              ? `~${sizeB}B likely exceeds your detected capacity (~${specs.maxModelB}B)`
                              : `Not installed — run "ollama pull ${m}" first`
                          }
                          className={`rounded-full border border-dashed px-2 py-0.5 text-[11px] transition-colors ${
                            s.model === m
                              ? 'border-accent/50 bg-accent/10 text-accent'
                              : overCapacity
                                ? 'border-line-2 text-faint opacity-40 hover:opacity-70'
                                : 'border-line-2 text-faint hover:border-accent/40 hover:text-muted'
                          }`}
                        >
                          {m}
                          {overCapacity ? ' ⚠' : ''}
                        </button>
                      )
                    })}
                  </div>
                </>
              ) : (
                <select
                  className={inputCls}
                  value={s.model || (s.provider === 'anthropic' ? modelOptions()[0] || '' : '')}
                  onChange={(e) => set('model', e.target.value)}
                >
                  {s.provider !== 'anthropic' && <option value="">Auto (opencode default)</option>}
                  {modelOptions().map((m) => {
                    const bare = m.includes('/') ? m.split('/')[1] : m
                    const label = isAgenticModel(m) ? `★ ${m} — agentic & reasoning` : m
                    const tier =
                      s.provider === 'openai' ? (CHATGPT_GO_MODELS.has(bare) ? ' (Go & Plus/Pro)' : ' (Plus/Pro only)') : ''
                    return (
                      <option key={m} value={m}>
                        {label + tier}
                      </option>
                    )
                  })}
                </select>
              )}
              {s.provider === 'openai' && (
                <p className="mt-1.5 text-[11px] text-faint">
                  ChatGPT Go can only run gpt-5.5, gpt-5.6-luna and gpt-5.6-terra for Codex — the rest need Plus or
                  Pro. Doesn't apply to Anthropic or Custom.
                </p>
              )}
            </Field>
            <Field label="Max tokens" hint="Hard cap per agent response">
              <input
                type="number"
                className={inputCls}
                value={s.maxTokens}
                onChange={(e) => set('maxTokens', Number(e.target.value))}
              />
            </Field>
            <Field label={`Temperature — ${s.temperature.toFixed(1)}`}>
              <input
                type="range"
                min={0}
                max={1}
                step={0.1}
                value={s.temperature}
                onChange={(e) => set('temperature', Number(e.target.value))}
                className="w-full accent-emerald-400"
              />
            </Field>
          </div>
          {anthropicNeedsKey ? (
            <p className="mt-3 text-[11px] text-amber-ok">
              Anthropic requires a real API key to run a Claude model — Claude Pro/Max subscriptions can't be used
              here. Add one in the API section below. Until then, agents run on opencode's own default model.
            </p>
          ) : (
            s.provider !== 'ollama' &&
            !providersMeta.connected?.includes(shownProvider) &&
            !s.model && (
              <p className="mt-3 text-[11px] text-amber-ok">
                No credentials detected for {shownProvider}. Enter your API key below to connect.
              </p>
            )
          )}
        </Section>

        <Section icon={LogIn} title="Subscription sign-in" description="OAuth — no API keys needed">
          <div className="divide-y divide-line">
            {[
              // Claude Code OAuth intentionally not offered here — Anthropic rejects that
              // subscription token for third-party API calls, so it never actually works
              // for running agents. Use a real API key below instead.
              { id: 'openai', tag: 'ChatGPT', sub: 'ChatGPT Plus / Pro plan' }
            ].map((row) => {
              const prov = oauthProv(row.id)
              const configured = prov?.configured
              const busy = authBusy[row.id]
              return (
                <div key={row.id} className="flex items-center justify-between py-3.5">
                  <div className="min-w-0 pr-4">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-zinc-100">{row.tag}</p>
                      {configured && <CheckCircle2 size={14} className="shrink-0 text-accent" />}
                    </div>
                    <p className="mt-0.5 text-xs text-faint">{configured ? prov.source || row.sub : row.sub}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {configured ? (
                      <>
                        {prov?.models?.length > 0 && (
                          <span className="hidden text-[11px] text-faint sm:inline">{prov.models.length} models</span>
                        )}
                        <Button size="sm" variant="outline" onClick={() => signOut(row.id)} disabled={busy}>
                          <LogOut size={13} /> {busy ? '…' : 'Sign out'}
                        </Button>
                      </>
                    ) : (
                      <Button size="sm" variant="primary" onClick={() => signIn(row.id)} disabled={busy}>
                        <LogIn size={13} /> {busy ? 'Opening browser…' : 'Sign in'}
                      </Button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
          <p className="mt-2 text-[11px] text-faint">
            Subscriptions power the agents without API keys. Token refresh and sign-out are automatic.
          </p>
        </Section>

        <Section icon={KeyRound} title="API" description="Provider credentials">
          {s.provider === 'openai' ? (
            <p className="text-xs text-faint">
              ChatGPT (Codex) uses OAuth sign-in above, not an API key — see the Subscription sign-in section.
            </p>
          ) : s.provider === 'ollama' ? (
            <Field label="Base URL" hint="Your local Ollama server. Defaults to http://localhost:11434/v1 if left blank.">
              <input
                className={inputCls}
                value={s.baseUrl}
                onChange={(e) => set('baseUrl', e.target.value)}
                placeholder="http://localhost:11434/v1"
              />
            </Field>
          ) : (
            <div className="space-y-4">
              <Field
                label={`${PROVIDER_LABELS[s.provider] || s.provider} API key`}
                hint={apiKeySet ? 'A key is saved. Type a new one to replace it.' : 'Stored encrypted on this device.'}
              >
                <div className="flex items-center gap-2">
                  <input
                    ref={apiKeyInputRef}
                    type={showKey ? 'text' : 'password'}
                    className={inputCls}
                    value={apiKeyDraft}
                    onChange={(e) => setApiKeyDraft(e.target.value)}
                    placeholder={apiKeySet ? 'sk-••••••••••••••••' : 'sk-…'}
                  />
                  <Button variant="outline" size="sm" onClick={toggleShowKey} className="h-9 shrink-0">
                    <Eye size={13} />
                  </Button>
                  {apiKeySet && (
                    <Button variant="outline" size="sm" onClick={removeApiKey} disabled={saving} className="h-9 shrink-0">
                      Remove
                    </Button>
                  )}
                </div>
              </Field>
              {s.provider === 'custom' && (
                <Field label="Base URL" hint="Your OpenAI-compatible endpoint, e.g. a local server or proxy.">
                  <input className={inputCls} value={s.baseUrl} onChange={(e) => set('baseUrl', e.target.value)} />
                </Field>
              )}
            </div>
          )}
        </Section>

        <Section icon={SlidersHorizontal} title="Behaviour" description="How agents act in your repo">
          <div className="divide-y divide-line">
            <Toggle
              checked={s.requireApproval}
              onChange={(v) => set('requireApproval', v)}
              label="Ask before editing files"
              description="Agents propose edits and wait for your approval."
            />
            <Toggle
              checked={s.autoInstall}
              onChange={(v) => set('autoInstall', v)}
              label="Auto-install dependencies"
              description="Run npm/pip install when a plan introduces new deps."
            />
            <Toggle
              checked={s.soundOnComplete}
              onChange={(v) => set('soundOnComplete', v)}
              label="Sound when an agent completes"
            />
          </div>
        </Section>

        <Section icon={Folder} title="Workspace" description="Scope the agents work to">
          <Field label="Ignore patterns" hint="Comma-separated globs excluded from agent edits.">
            <input className={inputCls} value={ignoreText} onChange={(e) => setIgnoreText(e.target.value)} />
          </Field>
        </Section>

        <Section icon={ScrollText} title="Rules" description="Custom instructions appended to every agent's RULES.md">
          <p className="mb-3 text-xs text-muted">
            One instruction per line, written as a plain imperative statement — what to always or never do. Be
            specific (name the file, pattern, or command) rather than vague ("write good code"). Examples:
          </p>
          <ul className="mb-4 list-disc space-y-1 pl-4 text-[11px] text-faint">
            <li>Always write a test for new API routes under src/routes/.</li>
            <li>Never install a new npm dependency without asking first.</li>
            <li>Prefer function components over classes.</li>
            <li>Use Tailwind utility classes, not inline styles.</li>
          </ul>
          <Field label="Your rules" hint="Free-form markdown/text. Appended under a &quot;User rules&quot; heading, sent to every agent alongside the built-in rules.">
            <textarea
              className={`${inputCls} h-32 resize-y py-2 leading-relaxed`}
              value={s.customRules || ''}
              onChange={(e) => set('customRules', e.target.value)}
              placeholder="e.g. Always write tests for new API routes. Prefer function components over classes."
            />
          </Field>
        </Section>
      </div>
    </div>
  )
}