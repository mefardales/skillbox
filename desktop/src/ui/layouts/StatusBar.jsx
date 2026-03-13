import { useState, useEffect, useCallback } from 'react';
import {
  Cpu,
  MemoryStick,
  GitBranch,
  Terminal,
  Wifi,
  WifiOff,
  Github,
  Clock,
  MonitorDot,
  HardDrive,
  Layers,
  Zap,
  Network,
} from 'lucide-react';
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '@/components/ui/tooltip';
import { useStore } from '@/hooks/useStore';
import { electronAPI } from '@/lib/electronAPI';

function formatBytes(bytes) {
  if (bytes >= 1073741824) return (bytes / 1073741824).toFixed(1) + ' GB';
  if (bytes >= 1048576) return (bytes / 1048576).toFixed(0) + ' MB';
  return (bytes / 1024).toFixed(0) + ' KB';
}

function formatUptime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function StatusItem({ icon: Icon, label, value, onClick, accent, className = '' }) {
  const content = (
    <button
      className={`flex items-center gap-1 px-1.5 h-full text-[11px] transition-colors whitespace-nowrap shrink-0 ${
        onClick ? 'hover:bg-primary/15 cursor-pointer' : 'cursor-default'
      } ${accent ? 'text-foreground' : 'text-muted-foreground'} ${className}`}
      onClick={onClick}
      tabIndex={onClick ? 0 : -1}
    >
      {Icon && <Icon className="w-3 h-3 shrink-0" />}
      <span>{value}</span>
    </button>
  );

  if (!label) return content;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{content}</TooltipTrigger>
      <TooltipContent side="top" sideOffset={4}>
        <span className="text-[11px]">{label}</span>
      </TooltipContent>
    </Tooltip>
  );
}

function Separator() {
  return <div className="w-px h-3 bg-border/50 mx-0.5 shrink-0" />;
}

export default function StatusBar() {
  const {
    projects,
    activeProject,
    activeView,
    settings,
    terminalPanelOpen,
    setTerminalPanelOpen,
    setActiveView,
    gitInfo,
    mcpServerStatus,
  } = useStore();

  const [stats, setStats] = useState(null);
  const [ghStatus, setGhStatus] = useState(null);
  const [dbStats, setDbStats] = useState(null);
  const [time, setTime] = useState(new Date());

  // Poll system stats every 3s
  const fetchStats = useCallback(async () => {
    const s = await electronAPI.getSystemStats();
    if (s) setStats(s);
  }, []);

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 3000);
    return () => clearInterval(interval);
  }, [fetchStats]);

  // Fetch GitHub status and DB stats on mount + every 30s
  useEffect(() => {
    const fetch = async () => {
      const [gh, db] = await Promise.allSettled([
        electronAPI.githubGetStatus(),
        electronAPI.getDbStats(),
      ]);
      if (gh.status === 'fulfilled' && gh.value) setGhStatus(gh.value);
      if (db.status === 'fulfilled' && db.value) setDbStats(db.value);
    };
    fetch();
    const interval = setInterval(fetch, 30000);
    return () => clearInterval(interval);
  }, []);

  // Clock every 30s
  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 30000);
    return () => clearInterval(interval);
  }, []);

  const cpuPercent = stats?.cpuUsage ?? '—';
  const memUsed = stats ? formatBytes(stats.memUsed) : '—';
  const memTotal = stats ? formatBytes(stats.memTotal) : '—';
  const gitBranch = gitInfo?.branch || stats?.gitBranch;
  const activeTerminals = stats?.activeTerminals ?? 0;
  const uptime = stats ? formatUptime(stats.uptime) : '—';
  const ghConnected = ghStatus?.connected;
  const ghUser = ghStatus?.username;
  const projectCount = projects?.length ?? 0;
  const taskCount = dbStats?.projects ?? 0;
  const skillCount = dbStats?.customSkills ?? 0;

  const platformLabel = stats
    ? `${stats.platform === 'win32' ? 'Windows' : stats.platform === 'darwin' ? 'macOS' : 'Linux'} ${stats.arch}`
    : '—';

  const timeStr = time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <footer className="flex items-center h-[22px] shrink-0 border-t border-border bg-background select-none overflow-hidden">
      {/* Left section */}
      <div className="flex items-center h-full min-w-0">
        {/* Git branch */}
        {gitBranch && (
          <StatusItem
            icon={GitBranch}
            value={gitBranch}
            label={`Branch: ${gitBranch}`}
            accent
          />
        )}

        {/* Active project */}
        {activeProject && (
          <>
            <Separator />
            <StatusItem
              icon={Layers}
              value={activeProject.name}
              label={`Project: ${activeProject.path}`}
            />
          </>
        )}

        <Separator />

        {/* CPU */}
        <StatusItem
          icon={Cpu}
          value={`${cpuPercent}%`}
          label={`CPU Usage: ${cpuPercent}%`}
        />

        <Separator />

        {/* Memory */}
        <StatusItem
          icon={MemoryStick}
          value={`${memUsed} / ${memTotal}`}
          label={`Memory: ${memUsed} used of ${memTotal}`}
        />

        <Separator />

        {/* DB size */}
        {dbStats && (
          <>
            <StatusItem
              icon={HardDrive}
              value={formatBytes(dbStats.dbSizeBytes)}
              label={`Database: ${formatBytes(dbStats.dbSizeBytes)} — ${dbStats.projects} projects, ${dbStats.customSkills} skills`}
            />
            <Separator />
          </>
        )}
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Right section */}
      <div className="flex items-center h-full min-w-0">
        {/* MCP server status */}
        {mcpServerStatus.running && (
          <>
            <StatusItem
              icon={Network}
              value={`MCP :${mcpServerStatus.port}`}
              label={`MCP Server active on port ${mcpServerStatus.port}`}
              onClick={() => setActiveView('mcp')}
              accent
            />
            <Separator />
          </>
        )}

        {/* Skills count */}
        <StatusItem
          icon={Zap}
          value={`${skillCount} skills`}
          label="Custom skills in registry"
          onClick={() => setActiveView('skills')}
        />

        <Separator />

        {/* Terminals */}
        <StatusItem
          icon={Terminal}
          value={`${activeTerminals}`}
          label={`${activeTerminals} active terminal${activeTerminals !== 1 ? 's' : ''}`}
          onClick={() => setTerminalPanelOpen(!terminalPanelOpen)}
          accent={terminalPanelOpen}
        />

        <Separator />

        {/* GitHub status */}
        <StatusItem
          icon={ghConnected ? Github : WifiOff}
          value={ghConnected ? ghUser || 'Connected' : 'Disconnected'}
          label={ghConnected ? `GitHub: ${ghUser}` : 'GitHub: Not connected'}
          onClick={() => setActiveView('github')}
          accent={ghConnected}
        />

        <Separator />

        {/* Platform */}
        <StatusItem
          icon={MonitorDot}
          value={platformLabel}
          label={`${platformLabel} — Node ${stats?.nodeVersion || '?'} — Electron ${stats?.electronVersion || '?'}`}
        />

        <Separator />

        {/* Uptime */}
        <StatusItem
          icon={Clock}
          value={uptime}
          label={`App uptime: ${uptime}`}
        />

        <Separator />

        {/* Clock */}
        <StatusItem
          value={timeStr}
          label={time.toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        />
      </div>
    </footer>
  );
}
