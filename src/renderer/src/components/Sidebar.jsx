import {
  Home,
  Hammer,
  FolderKanban,
  Rocket,
  Users,
  MessagesSquare,
  Cable,
  Coins,
  Settings,
  BookOpen,
  PanelLeftClose,
  PanelLeftOpen,
  Network
} from 'lucide-react'

const sections = [
  {
    label: 'Build',
    items: [
      { id: 'home', label: 'New App', icon: Home },
      { id: 'builder', label: 'Builder', icon: Hammer },
      { id: 'architecture', label: 'Architecture', icon: Network },
      { id: 'projects', label: 'Projects', icon: FolderKanban },
      { id: 'deployments', label: 'Deploy', icon: Rocket }
    ]
  },
  {
    label: 'Agents',
    items: [
      { id: 'studio', label: 'Agent Studio', icon: Users },
      { id: 'chat', label: 'Sessions', icon: MessagesSquare }
    ]
  },
  {
    label: 'System',
    items: [
      { id: 'mcp', label: 'MCP Connectors', icon: Cable },
      { id: 'usage', label: 'Usage', icon: Coins },
      { id: 'settings', label: 'Settings', icon: Settings },
      { id: 'docs', label: 'Docs', icon: BookOpen }
    ]
  }
]

export default function Sidebar({ route, onNavigate, collapsed, onToggleCollapsed, project, agentState }) {
  const ready = agentState?.ready
  const running = agentState?.running
  const statusLabel = ready ? 'Agent ready' : running ? 'Starting agent…' : 'Agent offline'

  return (
    <aside
      className={`flex h-full shrink-0 flex-col border-r border-line bg-panel transition-[width] duration-150 ${
        collapsed ? 'w-14' : 'w-56'
      }`}
    >
      <div className="flex h-14 items-center gap-2.5 border-b border-line px-4">
        <img src="./icon.png" alt="DarkHorseCode" className="h-7 w-7 shrink-0 rounded-md" />
        {!collapsed && (
          <div className="min-w-0 leading-tight">
            <div className="truncate font-mono text-sm font-semibold tracking-tight text-zinc-100">
              DarkHorseCode
            </div>
            <div className="truncate text-[10px] text-faint">build apps with AI</div>
          </div>
        )}
      </div>

      <nav className="flex-1 space-y-5 overflow-y-auto overflow-x-hidden px-2.5 py-4">
        {sections.map((section) => (
          <div key={section.label}>
            {!collapsed && (
              <div className="px-2 pb-1.5 text-[10px] font-semibold uppercase tracking-widest text-faint">
                {section.label}
              </div>
            )}
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const Icon = item.icon
                const active = route === item.id
                return (
                  <button
                    key={item.id}
                    onClick={() => onNavigate(item.id)}
                    title={collapsed ? item.label : undefined}
                    className={`flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-[13px] transition-colors ${
                      active
                        ? 'bg-accent/10 text-accent'
                        : 'text-muted hover:bg-line/60 hover:text-zinc-100'
                    } ${collapsed ? 'justify-center' : ''}`}
                  >
                    <Icon size={15} strokeWidth={2} className={active ? 'text-accent' : ''} />
                    {!collapsed && item.label}
                    {!collapsed && active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-accent" />}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-line px-2.5 py-3">
        {!collapsed && (
          <div className="mb-2 flex items-center gap-2 rounded-md border border-line bg-panel-2 px-2.5 py-2">
            <span
              className={`h-2 w-2 shrink-0 rounded-full ${
                ready ? 'bg-accent' : running ? 'animate-pulse bg-amber-ok' : 'bg-danger'
              }`}
            />
            <div className="min-w-0 leading-tight">
              <div className="text-[11px] font-medium text-zinc-200">{statusLabel}</div>
              <div className="truncate font-mono text-[10px] text-faint" title={project?.path}>
                {project?.name || 'no project open'}
              </div>
            </div>
          </div>
        )}
        <button
          onClick={onToggleCollapsed}
          className="flex w-full items-center justify-center gap-2 rounded-md px-2 py-1.5 text-muted transition-colors hover:bg-line/60 hover:text-zinc-100"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <PanelLeftOpen size={15} /> : <PanelLeftClose size={15} />}
        </button>
      </div>
    </aside>
  )
}
