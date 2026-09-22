const sizes = {
  sm: 'h-7 px-2.5 text-xs gap-1',
  md: 'h-9 px-3.5 text-sm gap-1.5',
  lg: 'h-10 px-4 text-sm gap-2'
}

const variants = {
  primary:
    'bg-accent text-zinc-950 hover:bg-emerald-300 font-medium shadow-[0_0_18px_rgba(52,211,153,0.25)]',
  ghost: 'bg-transparent text-muted hover:bg-line hover:text-zinc-100',
  outline: 'border border-line-2 bg-panel text-zinc-200 hover:border-zinc-500 hover:bg-panel-2',
  danger: 'bg-red-500/10 text-danger border border-red-500/20 hover:bg-red-500/20'
}

export default function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  children,
  ...rest
}) {
  return (
    <button
      className={`inline-flex items-center justify-center rounded-md transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${sizes[size]} ${variants[variant]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  )
}
