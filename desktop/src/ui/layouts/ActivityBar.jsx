import {
  FolderOpen,
  CheckSquare,
  Zap,
  Users,
  Clock,
  Github,
  Terminal,
  Settings,
  Puzzle,
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
  { id: 'tasks', icon: CheckSquare, label: 'Tasks' },
  { id: 'skills', icon: Zap, label: 'Skills' },
  { id: 'teams', icon: Users, label: 'Teams' },
  { id: 'history', icon: Clock, label: 'History' },
  { id: 'github', icon: Github, label: 'GitHub' },
]

const bottomItems = [
  { id: 'extensions', icon: Puzzle, label: 'Extensions' },
  { id: 'settings', icon: Settings, label: 'Settings' },
]

function SkillboxLogo() {
  return (
    <svg viewBox="0 0 24 24" width={20} height={20} fill="none">
      <rect width={24} height={24} rx={6} fill="#7c3aed" />
      <rect x={4} y={4} width={6.5} height={6.5} rx={1.5} fill="#fff" />
      <rect x={13.5} y={4} width={6.5} height={6.5} rx={1.5} fill="#fff" opacity={0.6} />
      <rect x={4} y={13.5} width={6.5} height={6.5} rx={1.5} fill="#fff" opacity={0.6} />
      <rect x={13.5} y={13.5} width={6.5} height={6.5} rx={1.5} fill="#fff" opacity={0.3} />
    </svg>
  )
}

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
  const { activeView, setActiveView, terminalPanelOpen, setTerminalPanelOpen } = useStore()

  return (
    <aside className="flex h-full w-12 shrink-0 flex-col items-center bg-[#111113] border-r border-border">
      {/* Logo */}
      <div className="flex h-12 w-full items-center justify-center">
        <SkillboxLogo />
      </div>

      {/* Main nav */}
      <nav className="flex w-full flex-1 flex-col gap-0.5 py-1">
        {navItems.map((item) => (
          <ActivityBarButton
            key={item.id}
            icon={item.icon}
            label={item.label}
            isActive={activeView === item.id}
            onClick={() => setActiveView(item.id)}
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
            onClick={() => setActiveView(item.id)}
          />
        ))}
      </div>
    </aside>
  )
}
