import {
  FolderOpen,
  Zap,
  Bot,
  GitBranch,
  Terminal,
  Settings,
  Puzzle,
  Network,
  MessageSquare,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useStore } from '@/hooks/useStore'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'

const navItems = [
  { id: 'projects', icon: FolderOpen, label: 'Projects' },
  { id: 'skills', icon: Zap, label: 'Skills' },
  { id: 'teams', icon: Bot, label: 'Agents' },
  { id: 'git', icon: GitBranch, label: 'Source Control' },
  { id: 'mcp', icon: Network, label: 'MCP' },
  { id: 'chat', icon: MessageSquare, label: 'Chat' },
]

const bottomItems = [
  { id: 'extensions', icon: Puzzle, label: 'Extensions' },
  { id: 'settings', icon: Settings, label: 'Settings' },
]


function ActivityBarButton({ icon: Icon, label, isActive, onClick }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={onClick}
          className={cn(
            'relative flex h-10 w-full items-center justify-center text-muted-foreground transition-colors hover:text-foreground',
            isActive && 'text-foreground'
          )}
        >
          {isActive && (
            <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r bg-primary" />
          )}
          <Icon size={20} />
        </button>
      </TooltipTrigger>
      <TooltipContent side="right" sideOffset={8}>
        {label}
      </TooltipContent>
    </Tooltip>
  )
}

export function ActivityBar() {
  const {
    activeView, setActiveView,
    projectSidebarOpen, setProjectSidebarOpen,
    terminalPanelOpen, setTerminalPanelOpen,
  } = useStore()

  const handleNavClick = (id) => {
    if (activeView === id) {
      // Toggle sidebar when clicking the already-active view
      setProjectSidebarOpen(!projectSidebarOpen)
    } else {
      setActiveView(id)
      // Ensure sidebar is open when switching views
      if (!projectSidebarOpen) setProjectSidebarOpen(true)
    }
  }

  return (
    <aside className="flex h-full w-12 shrink-0 flex-col items-center bg-sidebar border-r border-border">
      {/* Main nav */}
      <nav className="flex w-full flex-1 flex-col gap-0.5 py-1">
        {navItems.map((item) => (
          <ActivityBarButton
            key={item.id}
            icon={item.icon}
            label={item.label}
            isActive={activeView === item.id}
            onClick={() => handleNavClick(item.id)}
          />
        ))}
      </nav>

      {/* Bottom section */}
      <div className="flex w-full flex-col gap-0.5 pb-2">
        <ActivityBarButton
          icon={Terminal}
          label="Terminal"
          isActive={terminalPanelOpen}
          onClick={() => setTerminalPanelOpen(!terminalPanelOpen)}
        />
        {bottomItems.map((item) => (
          <ActivityBarButton
            key={item.id}
            icon={item.icon}
            label={item.label}
            isActive={activeView === item.id}
            onClick={() => handleNavClick(item.id)}
          />
        ))}
      </div>
    </aside>
  )
}
