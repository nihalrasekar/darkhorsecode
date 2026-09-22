import { useEffect, useState } from 'react'
import { Rocket, Cable } from 'lucide-react'
import Button from './Button'

const maskValue = (v) => {
  const s = String(v ?? '')
  if (s.length <= 4) return '••••'
  return `${s.slice(0, 2)}${'•'.repeat(Math.min(s.length - 4, 24))}${s.slice(-2)}`
}

function parseEnv(text) {
  return String(text || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#') && line.includes('='))
    .map((line) => {
      const i = line.indexOf('=')
      return { key: line.slice(0, i).trim(), value: line.slice(i + 1).trim() }
    })
}

/** Deploy runs through the agent and whatever MCP connectors are wired up. */
export default function DeployPanel({ directory, onDeploy, busy, onNavigate }) {
  const [mcp, setMcp] = useState({})
  const [env, setEnv] = useState([])
  const [envError, setEnvError] = useState(null)
  const [target, setTarget] = useState('vercel')

  useEffect(() => {
    window.api.agent
      .mcpStatus()
      .then((s) => setMcp(s || {}))
      .catch(() => setMcp({}))

    window.api.agent
      .readFile('.env', directory)
      .then((res) => {
        setEnv(parseEnv(typeof res === 'string' ? res : res?.content))
        setEnvError(null)
      })
      .catch(() => {
        setEnv([])
        setEnvError('No .env file in this project.')
      })
  }, [directory])

  const connectors = ['vercel', 'github', 'supabase']
  const statusOf = (name) => mcp[name]?.status || 'not added'
  const targetConnected = statusOf(target) === 'connected'

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-surface p-6">
      <div className="mx-auto w-full max-w-2xl space-y-5">
        <div className="rounded-xl border border-line bg-panel p-5">
          <h3 className="text-sm font-semibold text-zinc-100">Deploy this project</h3>
          <p className="mt-1 text-xs text-muted">
            The agent runs the deploy in your project directory using its connected tools. You will be asked
            to approve any command it wants to run.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <select
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              className="rounded-md border border-line-2 bg-panel-2 px-2.5 py-2 text-xs text-zinc-100 outline-none focus:border-accent/50"
            >
              <option value="vercel">Vercel</option>
              <option value="netlify">Netlify</option>
              <option value="github">GitHub Pages</option>
            </select>
            <Button size="md" onClick={() => onDeploy(target)} disabled={busy}>
              <Rocket size={14} /> {busy ? 'Agent working…' : 'Deploy now'}
            </Button>
            {!targetConnected && target !== 'netlify' && (
              <span className="text-[11px] text-amber-ok">
                {target} MCP is {statusOf(target)} — the agent will fall back to the CLI
              </span>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-line bg-panel p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold text-zinc-100">
              <Cable size={15} className="text-accent" /> Connectors
            </div>
            <Button variant="outline" size="sm" onClick={() => onNavigate('mcp')}>
              Manage
            </Button>
          </div>
          <div className="mt-3 divide-y divide-line rounded-lg border border-line">
            {connectors.map((name) => {
              const status = statusOf(name)
              return (
                <div key={name} className="flex items-center gap-3 px-3 py-2.5 text-xs">
                  <span className="w-32 font-medium text-zinc-200">{name}</span>
                  <span
                    className={`flex items-center gap-1.5 ${
                      status === 'connected' ? 'text-accent' : status === 'failed' ? 'text-danger' : 'text-faint'
                    }`}
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        status === 'connected' ? 'bg-accent' : status === 'failed' ? 'bg-danger' : 'bg-faint'
                      }`}
                    />
                    {status}
                  </span>
                  {mcp[name]?.error && (
                    <span className="ml-auto truncate font-mono text-[10px] text-danger">{mcp[name].error}</span>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        <div className="rounded-xl border border-line bg-panel p-5">
          <h3 className="text-sm font-semibold text-zinc-100">Environment variables</h3>
          <p className="mt-1 text-[11px] text-faint">Read from this project&apos;s .env — values are masked.</p>
          {envError && <div className="mt-3 text-xs text-faint">{envError}</div>}
          {env.length > 0 && (
            <div className="mt-3 divide-y divide-line rounded-lg border border-line">
              {env.map((v) => (
                <div key={v.key} className="flex items-center gap-3 px-3 py-2.5 text-xs">
                  <span className="w-56 truncate font-mono text-zinc-300">{v.key}</span>
                  <span className="flex-1 truncate font-mono text-faint">{maskValue(v.value)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

