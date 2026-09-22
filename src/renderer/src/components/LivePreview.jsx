import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Play,
  Square,
  RefreshCw,
  ExternalLink,
  Monitor,
  Tablet,
  Smartphone,
  Crosshair,
  Loader2,
  AlertTriangle,
  TerminalSquare
} from 'lucide-react'
import Button from './Button'
import pickerSource from '../lib/pickerInject.js?raw'

const deviceWidths = { desktop: '100%', tablet: 768, mobile: 390 }
const PICK_PREFIX = '__ENERGENT_PICK__'

/**
 * Runs the project's own dev server and renders it in a <webview>, with the
 * element picker injected into the guest page. The picker reports a pick by
 * logging `__ENERGENT_PICK__ <json>`, which we read off console-message —
 * no IPC inside the guest page needed.
 */
export default function LivePreview({ directory, onPick }) {
  const [dev, setDev] = useState({ state: 'stopped', url: null, message: null })
  const [logs, setLogs] = useState([])
  const [device, setDevice] = useState('desktop')
  const [picking, setPicking] = useState(false)
  const [showLogs, setShowLogs] = useState(false)
  const [starting, setStarting] = useState(false)
  const webviewRef = useRef(null)

  useEffect(() => {
    window.api.dev
      .status()
      .then((s) => {
        setDev(s)
        setLogs(s.logs || [])
      })
      .catch(() => {})

    const offState = window.api.dev.onState((s) => {
      setDev(s)
      if (s.state !== 'starting') setStarting(false)
      if (s.state === 'error') setShowLogs(true)
    })
    const offLog = window.api.dev.onLog(({ line }) => setLogs((prev) => [...prev.slice(-299), line]))
    return () => {
      offState()
      offLog()
    }
  }, [])

  const start = async () => {
    setStarting(true)
    setLogs([])
    setShowLogs(false)
    const res = await window.api.dev.start(directory)
    if (res?.error) {
      setStarting(false)
      setDev({
        state: 'error',
        url: null,
        message:
          res.error === 'no-dev-script'
            ? 'No "dev" or "start" script in this project\'s package.json.'
            : res.error
      })
    }
  }

  const stop = async () => {
    setPicking(false)
    await window.api.dev.stop()
  }

  // Install the picker on every navigation inside the guest page.
  const injectPicker = useCallback(() => {
    webviewRef.current?.executeJavaScript(pickerSource).catch(() => {})
  }, [])

  useEffect(() => {
    const view = webviewRef.current
    if (!view) return

    const onConsole = (e) => {
      const msg = String(e.message || '')
      if (!msg.startsWith(PICK_PREFIX)) return
      try {
        onPick?.(JSON.parse(msg.slice(PICK_PREFIX.length).trim()))
      } catch {
        // a malformed pick is not worth surfacing
      }
      setPicking(false)
    }

    view.addEventListener('dom-ready', injectPicker)
    view.addEventListener('console-message', onConsole)
    return () => {
      view.removeEventListener('dom-ready', injectPicker)
      view.removeEventListener('console-message', onConsole)
    }
  }, [dev.url, injectPicker, onPick])

  const togglePick = () => {
    const view = webviewRef.current
    if (!view) return
    const next = !picking
    setPicking(next)
    view.executeJavaScript(next ? '__energentPicker?.arm()' : '__energentPicker?.disarm()').catch(() => {})
  }

  const running = dev.state === 'running' && dev.url

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex h-10 shrink-0 items-center gap-2 border-b border-line bg-panel px-3">
        {running ? (
          <Button size="sm" variant="outline" onClick={stop}>
            <Square size={11} className="text-danger" /> Stop server
          </Button>
        ) : (
          <Button size="sm" onClick={start} disabled={starting || dev.state === 'starting' || !directory}>
            {starting || dev.state === 'starting' ? (
              <Loader2 size={11} className="animate-spin" />
            ) : (
              <Play size={11} />
            )}
            {starting || dev.state === 'starting' ? 'Starting…' : 'Start dev server'}
          </Button>
        )}

        {dev.url && <span className="font-mono text-[11px] text-faint">{dev.url}</span>}

        <div className="ml-auto flex items-center gap-1">
          <button
            onClick={() => setShowLogs((v) => !v)}
            title="Dev server log"
            className={`rounded p-1.5 transition-colors ${
              showLogs ? 'bg-line text-zinc-100' : 'text-faint hover:text-zinc-300'
            }`}
          >
            <TerminalSquare size={14} />
          </button>
          {running && (
            <>
              <button
                onClick={togglePick}
                className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs transition-colors ${
                  picking
                    ? 'border-accent/50 bg-accent/15 text-accent'
                    : 'border-line bg-panel-2 text-muted hover:text-zinc-200'
                }`}
                title="Pick an element in the running app to tell the agent what to change"
              >
                <Crosshair size={13} />
                {picking ? 'Click an element' : 'Pick element'}
              </button>
              <span className="mx-1 h-4 w-px bg-line" />
              {[
                { id: 'desktop', icon: Monitor },
                { id: 'tablet', icon: Tablet },
                { id: 'mobile', icon: Smartphone }
              ].map((d) => (
                <button
                  key={d.id}
                  onClick={() => setDevice(d.id)}
                  className={`rounded p-1.5 transition-colors ${
                    device === d.id ? 'bg-line text-zinc-100' : 'text-faint hover:text-zinc-300'
                  }`}
                  title={d.id}
                >
                  <d.icon size={14} />
                </button>
              ))}
              <button
                onClick={() => webviewRef.current?.reload()}
                className="rounded p-1.5 text-faint hover:text-zinc-300"
                title="Reload preview"
              >
                <RefreshCw size={14} />
              </button>
              <button
                onClick={() => window.open(dev.url)}
                className="rounded p-1.5 text-faint hover:text-zinc-300"
                title="Open in browser"
              >
                <ExternalLink size={14} />
              </button>
            </>
          )}
        </div>
      </div>

      {dev.state === 'error' && dev.message && (
        <div className="flex items-center gap-2 border-b border-danger/30 bg-danger/5 px-4 py-2 text-[11px] text-danger">
          <AlertTriangle size={12} />
          {dev.message}
        </div>
      )}

      <div className="flex min-h-0 flex-1">
        <div className="flex min-h-0 flex-1 justify-center bg-zinc-900/40 p-4">
          {running ? (
            <div
              className={`flex min-h-0 w-full flex-col overflow-hidden rounded-lg border bg-white shadow-2xl transition-all ${
                picking ? 'border-accent ring-2 ring-accent/40' : 'border-line-2'
              }`}
              style={{ width: deviceWidths[device], maxWidth: '100%' }}
            >
              <webview
                ref={webviewRef}
                src={dev.url}
                className="min-h-0 flex-1"
                style={{ display: 'flex', width: '100%', height: '100%' }}
              />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center text-center">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/15 text-accent">
                <Play size={18} />
              </div>
              <p className="mt-3 max-w-sm text-[13px] text-muted">
                {dev.state === 'starting'
                  ? 'Starting the project dev server…'
                  : 'Start this project’s dev server to preview it here and pick elements for the agent.'}
              </p>
            </div>
          )}
        </div>

        {showLogs && (
          <div className="flex w-96 shrink-0 flex-col border-l border-line bg-[#0b0b0e]">
            <div className="border-b border-line px-3 py-1.5 font-mono text-[11px] text-faint">
              dev server
            </div>
            <div className="flex-1 overflow-y-auto px-3 py-2 font-mono text-[11px] leading-[1.7] text-zinc-400">
              {logs.length === 0 && <div className="text-faint">No output yet.</div>}
              {logs.map((l, i) => (
                <div key={i} className="whitespace-pre-wrap">
                  {l}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
