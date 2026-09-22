import { useMemo } from 'react'
import PageHeader from '../components/PageHeader'
import DeployPanel from '../components/DeployPanel'
import { PermissionModal, QuestionModal } from '../components/AgentModals'
import SignInGate from '../components/SignInGate'
import ToolCard from '../components/ToolCard'
import Button from '../components/Button'
import { Square, Rocket } from 'lucide-react'

const URL_RE = /https?:\/\/[^\s)*]+/i

// Reuses the Builder's shared agent session (passed down from App.jsx) instead of
// its own — a local session here would get torn down whenever the tab switches
// away, silently orphaning any in-progress deploy on the backend.
export default function Deployments({ project, onNavigate, session: s }) {
  const deploy = (target) => {
    s.send(
      `Deploy this project to ${target}. Check the build passes first, then run the deployment and report the live URL.`
    )
  }

  // No backend deploy record exists — this is the only signal available, so read
  // it straight off the agent's own reported URL in its last reply.
  const lastLiveUrl = useMemo(() => {
    for (let i = s.items.length - 1; i >= 0; i--) {
      const item = s.items[i]
      if (item.kind === 'tool' || item.role !== 'assistant' || !item.text) continue
      const m = item.text.match(URL_RE)
      if (m) return m[0].replace(/[).,*]+$/, '')
    }
    return null
  }, [s.items])

  if (!project) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-faint">
        Open a project to deploy it.
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-line bg-panel px-6 py-4">
        <PageHeader
          title="Deploy"
          description={`Ship ${project.name} using the agent and your connected tools.`}
          actions={
            s.busy ? (
              <Button size="sm" variant="outline" onClick={s.stop}>
                <Square size={12} className="text-danger" /> Stop
              </Button>
            ) : null
          }
        />
      </div>

      {lastLiveUrl && !s.busy && (
        <div className="mx-auto mt-4 flex w-full max-w-2xl items-center gap-2 rounded-lg border border-accent/30 bg-accent/10 px-3.5 py-2.5 text-xs text-accent">
          <Rocket size={13} />
          Last reported live at{' '}
          <a href={lastLiveUrl} target="_blank" rel="noreferrer" className="truncate underline">
            {lastLiveUrl}
          </a>
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto">
        <DeployPanel directory={project.path} onDeploy={deploy} busy={s.busy} onNavigate={onNavigate} />

        {s.items.length > 0 && (
          <div className="mx-auto w-full max-w-2xl space-y-3 px-6 pb-8">
            <div className="text-[11px] font-semibold uppercase tracking-widest text-faint">Agent output</div>
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
          </div>
        )}
      </div>

      <SignInGate
        pendingPrompt={s.pendingPrompt}
        onCancel={s.cancelPendingPrompt}
        onOpenSettings={() => {
          s.cancelPendingPrompt()
          onNavigate('settings')
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
