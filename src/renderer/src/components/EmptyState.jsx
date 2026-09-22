export default function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 py-16 text-center">
      {Icon && (
        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-panel-2 text-faint">
          <Icon size={22} />
        </div>
      )}
      <div>
        <h3 className="text-sm font-semibold text-zinc-100">{title}</h3>
        {description && <p className="mt-1 max-w-sm text-xs text-muted">{description}</p>}
      </div>
      {action}
    </div>
  )
}
