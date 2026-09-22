export default function Toggle({ checked, onChange, label, description }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="group flex w-full items-center justify-between gap-6 py-3 text-left"
    >
      <span className="min-w-0">
        {label && <span className="block text-sm text-zinc-200">{label}</span>}
        {description && <span className="mt-0.5 block text-xs text-muted">{description}</span>}
      </span>
      <span
        className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border transition-colors ${
          checked
            ? 'border-accent bg-accent/90'
            : 'border-line-2 bg-panel-2 group-hover:border-zinc-500'
        }`}
      >
        <span
          className={`inline-block h-3.5 w-3.5 transform rounded-full bg-zinc-950 transition-transform ${
            checked ? 'translate-x-[18px]' : 'translate-x-[3px]'
          }`}
        />
      </span>
    </button>
  )
}
