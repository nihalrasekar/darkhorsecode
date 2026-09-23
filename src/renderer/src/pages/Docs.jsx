import {
  Home,
  Hammer,
  Network,
  FolderKanban,
  Rocket,
  Users,
  MessagesSquare,
  Cable,
  Coins,
  Settings,
  Sparkles,
  KeyRound,
  Gift,
  Server,
  LogIn,
  ArrowRight,
  FileText,
  FilePen,
  TerminalSquare,
  Camera,
  Database,
  UploadCloud
} from 'lucide-react'
import PageHeader from '../components/PageHeader'

const sections = [
  {
    label: 'Build',
    items: [
      {
        icon: Home,
        title: 'New App',
        badge: 'start here',
        badgeTone: 'border-accent/40 text-accent',
        body: 'Describe what you want built, in plain English. This always starts a brand-new project — it never reuses whatever project is currently open.',
        steps: [
          'Type your idea into the prompt box (or click a trending prompt to prefill it)',
          'Pick a build type: Full-stack, Mobile, Landing page or Website — this is folded into the prompt so the agent actually follows it',
          'Full-stack picks are forced onto the Supabase MCP for backend/database/auth — no custom backend server gets written in another stack',
          'Every build is told to be responsive (desktop/tablet/mobile) — check sizes with the Builder\'s preview',
          'Hit build → lands you straight in the Builder to watch it get made'
        ]
      },
      {
        icon: Hammer,
        title: 'Builder',
        body: 'Main workspace. Chat with the coding agent, watch each tool call (read/write/run) as a card, and see a live preview update as the app changes.',
        steps: [
          'Send follow-up instructions in the composer — your draft is kept even if you switch tabs and come back',
          'Tool cards show exactly what the agent read, edited or ran, in order',
          'Stop a run mid-way if it goes somewhere you don\'t want'
        ]
      },
      {
        icon: Network,
        title: 'Architecture',
        body: 'A system-tree view of the project\'s logic and structure — not raw code. Runs its own discussion chat, independent of the Builder conversation, so you can talk through design without disturbing the live build.',
        steps: [
          'Discuss changes or new features with the architecture agent — read-only, nothing gets edited here',
          'When you\'re happy, hand it off: it summarizes the whole discussion into a concrete implementation plan',
          'That plan gets sent straight to the Build agent in Builder to execute'
        ]
      },
      {
        icon: FolderKanban,
        title: 'Projects',
        body: 'Every app you\'ve built, most recent first — search by name or path, reopen one, or remove it from the list.',
        steps: ['Search narrows by project name or file path', 'Open switches the active project and jumps to its detail page', 'Delete removes it from this list (does not touch files unless you ask the agent to)']
      },
      {
        icon: Rocket,
        title: 'Deploy',
        badge: 'needs a project open',
        badgeTone: 'border-line-2 text-faint',
        body: 'Ship the currently open project through whichever deployment tool you\'ve connected (see MCP Connectors — Vercel etc).',
        steps: ['Pick a deploy target — the agent checks the build passes first, then runs the deployment', 'Watch tool output live as it runs', 'Reports back the live URL when done']
      }
    ]
  },
  {
    label: 'Agents',
    items: [
      {
        icon: Users,
        title: 'Agent Studio',
        body: 'Three built-in agents power the app — Build (reads/writes/runs commands), Architect (read-only, plans as a tree), Plan (read-only, proposes an approach without changing anything). You can also add your own.',
        steps: [
          'New agent → give it a name, persona and system prompt',
          'Pick which model it runs on and which tools it\'s allowed to use (read/write/run/etc)',
          'Toggle it active/inactive without deleting it']
      },
      {
        icon: MessagesSquare,
        title: 'Sessions',
        body: 'Every past conversation with your coding agents for the current project, newest first — separate from the main Builder thread.',
        steps: ['Click a session to resume exactly where it left off', 'New starts a fresh session without leaving this tab']
      }
    ]
  },
  {
    label: 'System',
    items: [
      {
        icon: Cable,
        title: 'MCP Connectors',
        body: 'Model Context Protocol servers give the agent extra tools — e.g. Supabase (Postgres/auth/storage), Vercel (deploys/domains/env vars), Playwright (drives a real browser for previews and E2E checks).',
        steps: ['Click a preset (Supabase / Vercel / Playwright / …) — some need a token, some run with no setup', 'Fill in any required credential field, then add it', 'Status per server shows Connected, Needs auth, Error or Disabled']
      },
      {
        icon: Coins,
        title: 'Usage',
        body: 'Tracks tokens and cost across every agent run — total tokens, input/output split, cost, and agent steps — with a per-day breakdown. Updates live while an agent is running.'
      },
      {
        icon: Settings,
        title: 'Settings',
        badge: 'no project needed',
        badgeTone: 'border-line-2 text-faint',
        body: 'Pick your model provider, sign in, and set agent behaviour. Reachable without a project open, since it\'s also where you log in — see the model deep-dive below.'
      }
    ]
  }
]

const providers = [
  {
    id: 'anthropic',
    icon: KeyRound,
    tone: 'text-accent border-accent/30 bg-accent/5',
    name: 'Anthropic — Claude Code',
    badge: 'API key required',
    badgeTone: 'border-amber-ok/40 text-amber-ok',
    blurb: 'Runs Claude models (Opus 5, Sonnet 5, Fable 5.1, Haiku 4.5). A Claude Pro/Max subscription cannot be used here — Anthropic blocks that login token from third-party API calls — so you need a real API key from console.anthropic.com.',
    steps: ['Settings → Model → provider row → click "Anthropic (Claude Code)"', 'Scroll to API → paste your key from console.anthropic.com', 'Pick a model from the dropdown — starred (★) ones are agentic/reasoning-capable, picked first', 'Save changes']
  },
  {
    id: 'openai',
    icon: LogIn,
    tone: 'text-info border-info/30 bg-info/5',
    name: 'ChatGPT — Codex',
    badge: 'OAuth sign-in',
    badgeTone: 'border-info/40 text-info',
    blurb: 'No API key — you sign in with your ChatGPT account and it runs on your existing subscription. Model access depends on plan tier: ChatGPT Go can only drive 3 models (gpt-5.5, gpt-5.6-luna, gpt-5.6-terra); the rest of the GPT-5/6 line needs Plus or Pro.',
    steps: ['Settings → "Subscription sign-in" section → Sign in next to ChatGPT', 'Log in through the browser window that opens — no key to copy', 'Back in Settings, set provider to "ChatGPT (Codex)" and pick a model', 'Each model in the list shows "(Go & Plus/Pro)" or "(Plus/Pro only)" so you know if your plan covers it']
  },
  {
    id: 'custom',
    icon: Gift,
    tone: 'text-violet-ok border-violet-ok/30 bg-violet-ok/5',
    name: 'OpenCode',
    badge: 'Free tier available',
    badgeTone: 'border-violet-ok/40 text-violet-ok',
    blurb: 'Point this at any OpenAI-compatible endpoint — or use OpenCode Zen, opencode.ai\'s own gateway, which offers several free coding models. Zen still needs a free API key (no billing, no card) from opencode.ai/auth.',
    steps: [
      'Settings → Model → provider row → click "OpenCode"',
      'Under Model, click a free chip — e.g. "Big Pickle" (Zen\'s flagship free coding model). This auto-fills the Zen base URL for you',
      'Get a free key at opencode.ai/auth and paste it into the API section below',
      'Save changes — no cost, no card on file'
    ],
    freeModels: ['Big Pickle', 'MiMo-V2.5', 'Ling 3.0 Flash Fin', 'Nemotron 3 Ultra', 'Nemotron 3.5 Lightning', 'Muse Spark 1.3 Contributor']
  },
  {
    id: 'ollama',
    icon: Server,
    tone: 'text-zinc-300 border-line-2 bg-panel-2',
    name: 'Ollama — local',
    badge: 'Free, runs on your machine',
    badgeTone: 'border-line-2 text-faint',
    blurb: 'No key, no cloud, no cost — models run on your own GPU/CPU. The page detects your hardware and flags suggested models that fit its VRAM/RAM, smallest-first (qwen2.5-coder:7b up to gpt-oss:120b).',
    steps: ['Install Ollama and pull a model, e.g. `ollama pull qwen2.5-coder:7b`', 'Settings → Model → provider row → click "Ollama (local)"', 'Type the model name, or click one of the suggested chips (✓ marks already-installed models)', 'Save changes — leave Base URL blank to use the default localhost:11434']
  }
]

const agentTools = [
  { icon: FileText, title: 'Read files', body: 'Open & inspect any project file.' },
  { icon: FilePen, title: 'Write files', body: 'Create & edit source code.' },
  { icon: TerminalSquare, title: 'Run shell commands', body: 'npm, git, tests, scripts.' },
  { icon: Camera, title: 'Browser & screenshots', body: 'Interact with the preview, capture screenshots.' },
  { icon: Database, title: 'Database access', body: 'Query Postgres / MongoDB.' },
  { icon: UploadCloud, title: 'Deploy', body: 'Push previews & production.' }
]

function Badge({ tone, children }) {
  return (
    <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium ${tone}`}>{children}</span>
  )
}

export default function Docs() {
  return (
    <div className="flex h-full flex-col gap-6 overflow-y-auto p-6">
      <PageHeader title="Docs" description="How to use DarkHorseCode — what each tab does, and how to pick a model in Settings." />

      <div className="rounded-lg border border-line bg-panel px-4 py-3.5">
        <div className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-faint">About the name</div>
        <p className="text-[13px] leading-relaxed text-muted">
          <span className="font-medium text-zinc-200">Dark</span> comes from China's "dark factories" — fully
          automated production lines that run lights-off, no humans on the floor. That's the speed this app chases:
          agents that build end-to-end with nobody standing over them. A few names were tried chasing that idea
          before <span className="font-medium text-zinc-200">DarkHorse</span> stuck — a dark horse being the
          unexpected one that comes from nowhere and wins. <span className="font-medium text-zinc-200">Code</span> is
          just what it does.
        </p>
      </div>

      <div className="rounded-lg border border-line bg-panel px-4 py-3.5">
        <div className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-faint">What's under the hood</div>
        <p className="text-[13px] leading-relaxed text-muted">
          DarkHorseCode is built on the <span className="font-medium text-zinc-200">opencode</span> engine: every
          agent runs on a local opencode server. ChatGPT sign-in uses opencode's own login (
          <code className="text-[11px] text-faint">opencode providers login</code>), not an OAuth flow of our own, and the
          token is saved in opencode's auth.json. Claude has no sign-in here: Anthropic rejects a Claude Pro/Max login
          token when a third-party app uses it, so Claude needs an API key.
        </p>
      </div>

      <div className="rounded-lg border border-accent/30 bg-accent/5 px-4 py-3 text-[13px] text-zinc-200">
        <span className="font-medium text-accent">New here?</span> Go to <span className="font-medium">New App</span>, describe what to build, then pick a model below — <span className="font-medium">OpenCode → Big Pickle</span> is the fastest free path to a working agent, no card required.
      </div>

      <div>
        <div className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-faint">Tabs, at a glance</div>
        <div className="flex flex-col gap-6">
          {sections.map((section) => (
            <div key={section.label}>
              <div className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-faint">{section.label}</div>
              <div className="grid gap-2 sm:grid-cols-2">
                {section.items.map((item) => {
                  const Icon = item.icon
                  return (
                    <div key={item.title} className="flex flex-col gap-2 rounded-md border border-line bg-panel px-4 py-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Icon size={16} strokeWidth={2} className="shrink-0 text-accent" />
                          <span className="text-[13px] font-medium text-zinc-100">{item.title}</span>
                        </div>
                        {item.badge && <Badge tone={item.badgeTone}>{item.badge}</Badge>}
                      </div>
                      <p className="text-[13px] leading-relaxed text-muted">{item.body}</p>
                      {item.steps && (
                        <ol className="mt-1 flex flex-col gap-1">
                          {item.steps.map((step, i) => (
                            <li key={i} className="flex items-start gap-2 text-[12px] text-zinc-300">
                              <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-panel-2 text-[10px] text-faint">
                                {i + 1}
                              </span>
                              {step}
                            </li>
                          ))}
                        </ol>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <div className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-faint">Tools agents can use</div>
        <p className="mb-3 text-[13px] text-muted">
          What every agent (Build, Architect, Plan, and any custom agent you make in Agent Studio) can reach for while it works. Toggle which of these a custom agent gets in Agent Studio's tool list — plus whatever MCP Connectors you add on top (Supabase, Vercel, Playwright, …).
        </p>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {agentTools.map((t) => {
            const Icon = t.icon
            return (
              <div key={t.title} className="flex items-start gap-2.5 rounded-md border border-line bg-panel px-3.5 py-3">
                <Icon size={15} strokeWidth={2} className="mt-0.5 shrink-0 text-accent" />
                <div>
                  <div className="text-[12.5px] font-medium text-zinc-100">{t.title}</div>
                  <p className="mt-0.5 text-[12px] leading-snug text-muted">{t.body}</p>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div>
        <div className="mb-1 flex items-center gap-2">
          <Sparkles size={13} className="text-accent" />
          <span className="text-[10px] font-semibold uppercase tracking-widest text-faint">Choosing a model in Settings</span>
        </div>
        <p className="mb-3 text-[13px] text-muted">
          Settings → Model has one provider switcher and the model list changes with it. Four ways to drive your agents:
        </p>

        <div className="grid gap-3 sm:grid-cols-2">
          {providers.map((p) => {
            const Icon = p.icon
            return (
              <div key={p.id} className={`flex flex-col gap-3 rounded-lg border bg-panel p-4 ${p.tone.split(' ').find((c) => c.startsWith('border'))}`}>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Icon size={16} className={p.tone.split(' ')[0]} />
                    <span className="text-[13px] font-semibold text-zinc-100">{p.name}</span>
                  </div>
                  <Badge tone={p.badgeTone}>{p.badge}</Badge>
                </div>
                <p className="text-[12px] leading-relaxed text-muted">{p.blurb}</p>

                {p.freeModels && (
                  <div className="flex flex-wrap gap-1.5">
                    {p.freeModels.map((m) => (
                      <span key={m} className="rounded-full border border-violet-ok/30 px-2 py-0.5 text-[10px] text-violet-ok">
                        {m}
                      </span>
                    ))}
                  </div>
                )}

                <ol className="flex flex-col gap-1.5">
                  {p.steps.map((step, i) => (
                    <li key={i} className="flex items-start gap-2 text-[12px] text-zinc-300">
                      <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-panel-2 text-[10px] text-faint">
                        {i + 1}
                      </span>
                      {step}
                    </li>
                  ))}
                </ol>
              </div>
            )
          })}
        </div>
      </div>

      <div className="rounded-md border border-line bg-panel-2 px-4 py-3 text-[13px] text-muted">
        <div className="flex items-center gap-2">
          <ArrowRight size={13} className="text-accent" />
          <span className="font-medium text-zinc-200">Worked example — ChatGPT (Codex)</span>
        </div>
        <p className="mt-1.5">
          You sign in with ChatGPT Go. In the model dropdown you'll see the whole GPT-5/6 line, but only 3 entries are tagged <span className="rounded border border-line px-1 text-[11px] text-faint">(Go & Plus/Pro)</span> — <em>gpt-5.5</em>, <em>gpt-5.6-luna</em>, <em>gpt-5.6-terra</em>. Everything else shows <span className="rounded border border-line px-1 text-[11px] text-faint">(Plus/Pro only)</span> and will fail on a Go plan — pick one of the three, or upgrade your ChatGPT plan.
        </p>
      </div>

      <div className="rounded-md border border-line bg-panel-2 px-4 py-3 text-[13px] text-muted">
        Tip: press <kbd className="rounded border border-line px-1.5 py-0.5 text-[10px] text-faint">⌘K</kbd> / <kbd className="rounded border border-line px-1.5 py-0.5 text-[10px] text-faint">Ctrl K</kbd> anytime to jump straight to any tab.
      </div>

      <div className="rounded-md border border-line bg-panel-2 px-4 py-3 text-[13px] text-muted">
        <span className="font-medium text-zinc-200">Tip:</span> combine{' '}
        <span className="font-medium text-zinc-200">Plan</span> +{' '}
        <span className="font-medium text-zinc-200">Build</span> for better results — talk it through and let the
        agent propose an approach first, then switch to Build to actually make the change. Don't let one session run
        too long, it burns tokens fast; when you're starting a new feature, create a new session instead of piling
        onto an old one.
      </div>
    </div>
  )
}
