import { useEffect, useState } from 'react'
import { AlertTriangle, Sparkles } from 'lucide-react'
import Button from './Button'

function Shell({ children }) {
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 px-4">
      <div className="w-full max-w-md rounded-xl border border-line-2 bg-panel p-5 shadow-2xl animate-[modal-in_0.15s_ease-out]">
        {children}
      </div>
    </div>
  )
}

export function PermissionModal({ permission, onReply, onStop }) {
  if (!permission) return null
  return (
    <Shell>
      <div className="flex items-center gap-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-amber-500/10 text-amber-ok">
          <AlertTriangle size={15} />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-zinc-100">Agent wants permission</h3>
          <p className="text-[11px] text-muted">Review before allowing this action</p>
        </div>
      </div>
      <div className="mt-4 rounded-md border border-line bg-panel-2 px-3.5 py-3">
        <div className="font-mono text-[11px] text-faint">
          tool · {permission.permission?.tool || 'unknown'}
        </div>
        <div className="mt-1 break-words font-mono text-[12px] text-zinc-200">
          {permission.description ||
            (permission.permission?.patterns || []).join(', ') ||
            permission.permission?.metadata?.description ||
            'Unrecognised request'}
        </div>
      </div>
      <div className="mt-4 flex gap-2">
        <Button variant="danger" size="sm" className="flex-1" onClick={() => onReply('reject')}>
          Reject
        </Button>
        <Button variant="outline" size="sm" className="flex-1" onClick={() => onReply('always')}>
          Always allow
        </Button>
        <Button variant="primary" size="sm" className="flex-1" onClick={() => onReply('allow')}>
          Allow once
        </Button>
      </div>
      {onStop && (
        <button
          onClick={onStop}
          className="mt-2.5 w-full text-center text-[11px] text-faint hover:text-danger"
        >
          Stop the agent instead
        </button>
      )}
    </Shell>
  )
}

export function QuestionModal({ question, onAnswer, onSkip }) {
  const [answer, setAnswer] = useState('')

  useEffect(() => {
    setAnswer('')
  }, [question?.questionID])

  if (!question) return null
  return (
    <Shell>
      <div className="flex items-center gap-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-info/10 text-info">
          <Sparkles size={15} />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-zinc-100">The agent needs an answer</h3>
          <p className="text-[11px] text-muted">Help it finish your task</p>
        </div>
      </div>
      <p className="mt-4 text-[13px] leading-relaxed text-zinc-200">
        {question.question?.prompt || question.question?.title || 'Question from the agent'}
      </p>
      <textarea
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
        rows={3}
        placeholder="Type your answer…"
        className="mt-3 w-full resize-none rounded-md border border-line-2 bg-panel-2 px-3 py-2.5 text-[13px] text-zinc-100 outline-none placeholder:text-faint focus:border-accent/50"
      />
      <div className="mt-4 flex gap-2">
        <Button variant="ghost" size="sm" onClick={onSkip} disabled={!question.question?.canSkip}>
          Skip
        </Button>
        <Button
          variant="primary"
          size="sm"
          className="ml-auto"
          onClick={() => onAnswer(answer)}
          disabled={!answer.trim()}
        >
          Send answer
        </Button>
      </div>
    </Shell>
  )
}
