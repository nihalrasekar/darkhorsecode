import { useCallback, useEffect, useState } from 'react'
import { CircleDollarSign, Braces, Layers, RefreshCw, Trash2 } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import Button from '../components/Button'
import { useToast } from '../components/Toast'

const EMPTY = { total: { input: 0, output: 0, reasoning: 0, cache: 0, cost: 0, steps: 0 }, days: {}, sessions: {} }

const num = (n) => (Number(n) || 0).toLocaleString()
const money = (n) => `$${(Number(n) || 0).toFixed(3)}`

export default function Usage() {
  const toast = useToast()
  const [usage, setUsage] = useState(EMPTY)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setUsage((await window.api.usage.get()) || EMPTY)
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    load()
  }, [load])

  // Keep the page live while an agent is running.
  useEffect(() => {
    return window.api.agent.onEvent((evt) => {
      if (evt.kind === 'step_end') load()
    })
  }, [load])

  const total = usage.total || EMPTY.total
  const days = Object.entries(usage.days || {}).sort((a, b) => b[0].localeCompare(a[0]))

  const cards = [
    { label: 'Total tokens', value: num(total.input + total.output + total.reasoning + total.cache), icon: Braces, tone: 'text-accent' },
    { label: 'Input / output', value: `${num(total.input)} / ${num(total.output)}`, icon: Layers, tone: 'text-info' },
    { label: 'Cost', value: money(total.cost), icon: CircleDollarSign, tone: 'text-violet-ok' },
    { label: 'Agent steps', value: num(total.steps), icon: RefreshCw, tone: 'text-amber-ok' }
  ]

  return (
    <div className="flex h-full flex-col gap-5 overflow-y-auto p-6">
      <PageHeader
        title="Usage"
        description="Tokens and cost reported by the agent for every run on this machine."
        actions={
          <>
            <Button size="sm" variant="outline" onClick={load} disabled={loading}>
              <RefreshCw size={13} /> Refresh
            </Button>
            <Button
              size="sm"
              variant="danger"
              onClick={async () => {
                if (!window.confirm('Clear all recorded usage history?')) return
                setUsage((await window.api.usage.reset()) || EMPTY)
              }}
            >
              <Trash2 size={13} /> Reset
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-lg border border-line bg-panel p-4">
            <div className="flex items-center gap-2 text-[11px] text-faint">
              <c.icon size={13} className={c.tone} />
              {c.label}
            </div>
            <div className="mt-1.5 text-lg font-semibold text-zinc-100">{c.value}</div>
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-lg border border-line bg-panel">
        <div className="border-b border-line px-4 py-3 text-[13px] font-semibold text-zinc-100">By day</div>
        {days.length === 0 ? (
          <div className="px-4 py-10 text-center text-xs text-faint">
            Nothing recorded yet — usage appears here after the agent completes a step.
          </div>
        ) : (
          <div className="divide-y divide-line">
            <div className="flex items-center gap-3 px-4 py-2 text-[10px] uppercase tracking-widest text-faint">
              <span className="w-28">Day</span>
              <span className="w-24 text-right">Input</span>
              <span className="w-24 text-right">Output</span>
              <span className="w-24 text-right">Cache</span>
              <span className="w-20 text-right">Steps</span>
              <span className="ml-auto w-20 text-right">Cost</span>
            </div>
            {days.map(([day, d]) => (
              <div key={day} className="flex items-center gap-3 px-4 py-2.5 text-xs text-zinc-300">
                <span className="w-28 font-mono">{day}</span>
                <span className="w-24 text-right font-mono">{num(d.input)}</span>
                <span className="w-24 text-right font-mono">{num(d.output)}</span>
                <span className="w-24 text-right font-mono text-faint">{num(d.cache)}</span>
                <span className="w-20 text-right font-mono text-faint">{num(d.steps)}</span>
                <span className="ml-auto w-20 text-right font-mono text-accent">{money(d.cost)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <p className="text-[11px] text-faint">
        Numbers come straight from the agent runtime&apos;s own step reports — there is no billing account
        behind this page.
      </p>
    </div>
  )
}
