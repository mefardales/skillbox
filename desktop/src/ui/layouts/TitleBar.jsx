import { Search } from 'lucide-react';
import { useStore } from '@/hooks/useStore';
import { electronAPI } from '@/lib/electronAPI';

function SkillboxLogo() {
  return (
    <svg viewBox="0 0 24 24" width={24} height={24} fill="none">
      <rect width={24} height={24} rx={6} fill="#7c3aed" />
      <rect x={4} y={4} width={6.5} height={6.5} rx={1.5} fill="#fff" />
      <rect x={13.5} y={4} width={6.5} height={6.5} rx={1.5} fill="#fff" opacity={0.6} />
      <rect x={4} y={13.5} width={6.5} height={6.5} rx={1.5} fill="#fff" opacity={0.6} />
      <rect x={13.5} y={13.5} width={6.5} height={6.5} rx={1.5} fill="#fff" opacity={0.3} />
    </svg>
  );
}

export default function TitleBar({ onSearchClick }) {
  const { activeView, activeProject } = useStore();
  const isWin = electronAPI.platform === 'win32';

  const viewLabels = {
    projects: 'Dashboard',
    dashboard: 'Dashboard',
    skills: 'Skills',
    teams: 'Agents',
    history: 'History',
    git: 'Source Control',
    mcp: 'MCP',
    chat: 'Chat',
    extensions: 'Extensions',
    settings: 'Settings',
  };

  const viewLabel = viewLabels[activeView] || 'Dashboard';

  return (
    <header
      className="titlebar-custom titlebar-drag flex items-center h-[38px] shrink-0 border-b border-border bg-background select-none"
    >
      {/* Left: logo + breadcrumb */}
      <div className="titlebar-no-drag flex items-center gap-2.5 pl-3 min-w-0">
        <SkillboxLogo />
        <span className="text-[11px] text-muted-foreground truncate">
          {activeProject ? activeProject.name : 'Skillbox'}
        </span>
        <span className="text-[11px] text-muted-foreground/40">/</span>
        <span className="text-[11px] text-foreground/80 truncate">{viewLabel}</span>
      </div>

      {/* Center: search trigger */}
      <div className="titlebar-no-drag flex-1 flex justify-center px-4">
        <button
          onClick={onSearchClick}
          className="flex items-center gap-2 h-[26px] w-full max-w-[320px] px-2.5 rounded-md border border-border/60 bg-background/40 hover:bg-background/60 hover:border-border transition-colors text-muted-foreground text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary focus-visible:border-primary/50"
        >
          <Search className="w-3.5 h-3.5 shrink-0" />
          <span className="flex-1 text-left truncate">Search...</span>
          <kbd className="hidden sm:inline-flex h-[18px] items-center rounded border border-border/60 bg-muted/50 px-1 text-[10px] font-medium text-muted-foreground/70">
            Ctrl+P
          </kbd>
        </button>
      </div>

      {/* Right: spacer for Windows overlay controls */}
      {isWin && <div className="w-[138px] shrink-0" />}
    </header>
  );
}
