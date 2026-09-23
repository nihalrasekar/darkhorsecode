import { createContext, useCallback, useContext, useRef, useState } from 'react'
import { CheckCircle2, XCircle, Info, X } from 'lucide-react'

const ToastContext = createContext(null)

const toneMeta = {
  success: { icon: CheckCircle2, color: 'text-accent border-accent/25 bg-accent/10' },
  error: { icon: XCircle, color: 'text-danger border-red-500/25 bg-red-500/10' },
  info: { icon: Info, color: 'text-info border-sky-500/25 bg-sky-500/10' }
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const idRef = useRef(0)

  const dismiss = useCallback((id) => {
    setToasts((t) => t.filter((x) => x.id !== id))
  }, [])

  const toast = useCallback(
    (message, tone = 'info', duration = 3200) => {
      const id = ++idRef.current
      setToasts((t) => [...t, { id, message, tone }])
      if (tone !== 'error') setTimeout(() => dismiss(id), duration)
      return id
    },
    [dismiss]
  )

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-80 flex-col gap-2">
        {toasts.map((t) => {
          const meta = toneMeta[t.tone] ?? toneMeta.info
          const Icon = meta.icon
          return (
            <div
              key={t.id}
              className={`pointer-events-auto flex items-start gap-2.5 rounded-lg border px-3.5 py-2.5 text-[13px] shadow-lg backdrop-blur-sm animate-[toast-in_0.18s_ease-out] ${meta.color} bg-panel/95`}
            >
              <Icon size={15} className="mt-0.5 shrink-0" />
              <span className="selectable-text flex-1 break-words text-zinc-100">{t.message}</span>
              <button
                onClick={() => dismiss(t.id)}
                className="shrink-0 text-faint hover:text-zinc-300"
              >
                <X size={13} />
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}
