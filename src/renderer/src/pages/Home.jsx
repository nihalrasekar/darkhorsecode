import { useEffect, useState } from 'react'
import { ChevronDown, Smartphone, Monitor, Globe, LayoutTemplate, FolderOpen } from 'lucide-react'
import { trendingPrompts, buildTypes } from '../data/builder'
import { useToast } from '../components/Toast'

const typeIcons = {
  fullstack: Monitor,
  mobile: Smartphone,
  landing: LayoutTemplate,
  website: Globe
}

// Applied to every build type, regardless of which one is picked.
const universalHint =
  'Design it responsive: it must render correctly on computer, tablet, and mobile screen sizes. Use the preview tab to check all device sizes.'

// Folded into the prompt so the choice actually reaches the agent.
const typeHint = {
  fullstack:
    'Build it as a full-stack web app (UI plus a backend and persistent storage). Use the Supabase MCP for the backend (database, auth, storage). Never write a custom backend server in any other language or framework — Supabase is the only backend allowed.',
  mobile: 'Build it as a mobile app.',
  landing: 'Build it as a single marketing landing page.',
  website: 'Build it as a multi-page website.'
}

export default function Home({ onStartBuild, project }) {
  const toast = useToast()
  const [prompt, setPrompt] = useState('')
  const [type, setType] = useState('fullstack')
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [model, setModel] = useState('')
  const [models, setModels] = useState([])
  const [savingModel, setSavingModel] = useState(false)

  useEffect(() => {
    window.api.settings
      .get()
      .then(({ settings }) => setModel(settings?.model || ''))
      .catch(() => {})

    window.api.agent
      .providers()
      .then((data) => {
        // /provider lists every provider it knows about; only the connected ones are usable.
        const connected = new Set(data?.connected || [])
        const list = []
        for (const prov of data?.all || []) {
          if (connected.size && !connected.has(prov.id)) continue
          for (const [id, m] of Object.entries(prov.models || {})) {
            list.push({ id: `${prov.id}/${id}`, name: `${prov.id} · ${m.name || id}` })
          }
        }
        setModels(list)
      })
      .catch(() => setModels([]))
  }, [])

  const changeModel = async (value) => {
    setModel(value)
    setSavingModel(true)
    try {
      await window.api.settings.save({ model: value })
      toast('Model saved — agent restarting', 'success')
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      setSavingModel(false)
    }
  }

  const submit = () => {
    const text = prompt.trim()
    if (!text) {
      toast('Describe what you want built first.', 'error')
      return
    }
    onStartBuild(`${text}\n\n${typeHint[type]}\n\n${universalHint}`)
  }

  return (
    <div className="flex h-full flex-col items-center overflow-y-auto px-6 py-10">
      <div className="w-full max-w-2xl">
        <div className="text-center">
          <img src="/icon.png" alt="DarkHorseCode" className="mx-auto mb-3 h-28 w-28 rounded-2xl" />
          <h2 className="text-xl font-semibold tracking-tight text-zinc-100">
            Describe your idea, build a production-ready app
          </h2>
          <p className="mt-1 text-sm text-muted">
            Chat with AI agents that design, code, test and deploy — start to finish.
          </p>
          {project && (
            <div className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-line bg-panel-2 px-3 py-1 font-mono text-[11px] text-faint">
              <FolderOpen size={11} className="text-amber-ok" />
              <span className="truncate" title={project.path}>
                building in {project.name}
              </span>
            </div>
          )}
        </div>

        <div className="mt-7 overflow-hidden rounded-xl border border-line-2 bg-panel shadow-[0_0_40px_rgba(52,211,153,0.06)]">
          <div className="flex gap-1.5 border-b border-line bg-panel-2 px-3 py-2.5">
            {buildTypes.map((t) => {
              const Icon = typeIcons[t.id]
              return (
                <button
                  key={t.id}
                  onClick={() => setType(t.id)}
                  title={t.desc}
                  className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[11px] font-medium transition-colors ${
                    type === t.id
                      ? 'border-accent/40 bg-accent/10 text-accent'
                      : 'border-line text-muted hover:border-line-2 hover:text-zinc-200'
                  }`}
                >
                  <Icon size={12} />
                  {t.label}
                </button>
              )
            })}
          </div>

          <div className="p-4">
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  submit()
                }
              }}
              rows={3}
              placeholder="Build me a dashboard that tracks my team's revenue and shows a leaderboard…"
              className="w-full resize-none bg-transparent text-sm leading-relaxed text-zinc-100 outline-none placeholder:text-faint"
            />

            <div className="mt-3 flex items-center gap-2">
              <button
                onClick={() => setShowAdvanced((v) => !v)}
                className="flex items-center gap-1 rounded-md border border-line bg-panel-2 px-2 py-1 text-[11px] text-muted transition-colors hover:text-zinc-200"
              >
                Model
                <ChevronDown size={11} className={`transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
              </button>
              <button
                onClick={submit}
                disabled={!prompt.trim()}
                className="ml-auto rounded-md bg-accent px-4 py-2 text-sm font-semibold text-zinc-950 transition-colors hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Start building
              </button>
            </div>
          </div>

          {showAdvanced && (
            <div className="border-t border-line bg-panel-2 px-4 py-4">
              <label className="block max-w-sm">
                <span className="mb-1 block text-[11px] font-medium text-muted">
                  Model {savingModel && '· saving…'}
                </span>
                <select
                  value={model}
                  onChange={(e) => changeModel(e.target.value)}
                  className="w-full rounded-md border border-line-2 bg-panel px-2.5 h-8 text-xs text-zinc-100 outline-none focus:border-accent/50"
                >
                  <option value="">Provider default</option>
                  {models.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
                <span className="mt-1 block text-[11px] text-faint">
                  {models.length === 0
                    ? 'No models listed — connect a provider in Settings.'
                    : 'Saved to Settings and used by every agent run.'}
                </span>
              </label>
            </div>
          )}
        </div>

        <div className="mt-6">
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-faint">
            Trending prompts
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {trendingPrompts.map((p) => (
              <button
                key={p}
                onClick={() => setPrompt(p)}
                className="rounded-md border border-line bg-panel px-3 py-2.5 text-left text-xs text-muted transition-colors hover:border-accent/30 hover:text-zinc-200"
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
