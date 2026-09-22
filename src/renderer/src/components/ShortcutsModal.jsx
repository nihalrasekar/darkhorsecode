import { X } from 'lucide-react'

const groups = [
  {
    label: 'Navigation',
    items: [
      ['Cmd/Ctrl + K', 'Open command palette'],
      ['Cmd/Ctrl + B', 'Toggle sidebar'],
      ['?', 'Show shortcuts']
    ]
  },
  {
    label: 'Chat & Builder',
    items: [
      ['Enter', 'Send message'],
      ['Shift + Enter', 'New line']
    ]
  },
  {
    label: 'Element picker (Builder preview)',
    items: [
      ['↑ / ↓', 'Select parent / child element'],
      ['Esc', 'Cancel picking']
    ]
  },
  {
    label: 'General',
    items: [['Esc', 'Close dialog']]
  }
]

export default function ShortcutsModal({ open, onClose }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-zinc-950/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-md overflow-hidden rounded-xl border border-line-2 bg-panel shadow-2xl animate-[modal-in_0.15s_ease-out]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <h3 className="text-sm font-semibold text-zinc-100">Keyboard shortcuts</h3>
          <button onClick={onClose} className="rounded p-1 text-faint hover:text-zinc-300">
            <X size={15} />
          </button>
        </div>
        <div className="space-y-4 p-4">
          {groups.map((g) => (
            <div key={g.label}>
              <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-faint">
                {g.label}
              </div>
              <div className="space-y-1">
                {g.items.map(([keys, desc]) => (
                  <div key={desc} className="flex items-center justify-between text-[13px]">
                    <span className="text-muted">{desc}</span>
                    <kbd className="rounded border border-line bg-panel-2 px-1.5 py-0.5 font-mono text-[10px] text-zinc-300">
                      {keys}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
