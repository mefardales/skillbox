import { useEffect, useState, useRef, useCallback } from 'react';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useStore } from './hooks/useStore';
import { useToast } from './hooks/useToast';
import { electronAPI } from './lib/electronAPI';
import { ActivityBar } from './layouts/ActivityBar';
import ProjectSidebar from './panels/ProjectSidebar';
import RightPanel from './panels/RightPanel';
import TerminalPanel from './panels/TerminalPanel';
import DashboardView from './views/DashboardView';
import ProjectDetailView from './views/ProjectDetailView';
import SkillsView from './views/SkillsView';
import { TeamsView } from './views/TeamsView';
import { SettingsView } from './views/SettingsView';
import { ExtensionsView } from './views/ExtensionsView';
import GitView from './views/GitView';
import McpView from './views/McpView';
import ChatView from './views/ChatView';
import TitleBar from './layouts/TitleBar';
import StatusBar from './layouts/StatusBar';
import CommandPalette from './components/CommandPalette';

function MainContent() {
  const { activeView, activeProjectPath } = useStore();

  // Show project detail when a project is selected and view is 'projects'
  if ((activeView === 'projects' || activeView === 'dashboard') && activeProjectPath) {
    return <ProjectDetailView />;
  }

  const views = {
    projects: DashboardView,
    dashboard: DashboardView,
    skills: SkillsView,
    teams: TeamsView,
    settings: SettingsView,
    extensions: ExtensionsView,
    git: GitView,
    mcp: McpView,
    chat: ChatView,
  };

  const View = views[activeView] || DashboardView;
  return <View />;
}

// ── Resize Handle ──────────────────────────────
// Supports open/closed panels. When closed (isOpen=false), dragging reopens.
function ResizeHandle({
  direction = 'vertical', value, onResize, min = 0, max = Infinity,
  invert = false, collapseThreshold = 0, onCollapse, isOpen = true, onExpand,
}) {
  // Use refs for all callbacks/values so the drag closure always sees current state
  const refs = useRef({ value, onResize, onCollapse, onExpand, isOpen, min, max });
  refs.current = { value, onResize, onCollapse, onExpand, isOpen, min, max };

  const handleMouseDown = useCallback((e) => {
    e.preventDefault();
    const el = e.currentTarget;
    el.classList.add('active');
    const startPos = direction === 'vertical' ? e.clientX : e.clientY;
    const wasOpen = refs.current.isOpen;
    const startValue = wasOpen ? refs.current.value : 0;
    let collapsed = false;
    let expanded = false;

    const cleanup = () => {
      el.classList.remove('active');
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    const handleMouseMove = (e) => {
      if (collapsed) return;
      const { onResize: resize, onCollapse: collapse, onExpand: expand, min: lo, max: hi } = refs.current;
      const delta = (direction === 'vertical' ? e.clientX : e.clientY) - startPos;
      const raw = startValue + (invert ? -delta : delta);

      // Panel was closed — expand if dragged past threshold
      if (!wasOpen && !expanded) {
        if (raw > 30) {
          expanded = true;
          expand?.();
          resize(Math.max(lo, Math.min(hi, raw)));
        }
        return;
      }

      // Once expanded, keep resizing
      if (expanded || wasOpen) {
        // Only allow collapse if panel was already open (not just expanded from closed)
        if (wasOpen && collapseThreshold > 0 && raw < collapseThreshold) {
          collapsed = true;
          collapse?.();
          cleanup();
          return;
        }
        resize(Math.max(lo, Math.min(hi, raw)));
      }
    };

    const handleMouseUp = () => cleanup();

    document.body.style.cursor = direction === 'vertical' ? 'col-resize' : 'row-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [direction, invert, collapseThreshold]);

  return (
    <div
      className={`resize-handle resize-handle-${direction}`}
      onMouseDown={handleMouseDown}
    />
  );
}

// Global MCP tool invocation toast watcher
function McpToolWatcher() {
  const { mcpToolEvents } = useStore();
  const { toast } = useToast();
  const lastCount = useRef(mcpToolEvents.length);

  useEffect(() => {
    if (mcpToolEvents.length > lastCount.current) {
      const newEvents = mcpToolEvents.slice(0, mcpToolEvents.length - lastCount.current);
      for (const evt of newEvents) {
        const status = evt.success ? 'success' : 'fail';
        const ip = evt.clientIp || '?';
        const ms = evt.elapsed != null ? ` (${evt.elapsed}ms)` : '';
        toast(`MCP tool invoked: ${evt.toolName} from ${ip} — ${status}${ms}`, evt.success ? 'info' : 'warning');
      }
    }
    lastCount.current = mcpToolEvents.length;
  }, [mcpToolEvents, toast]);

  return null;
}

export function App() {
  const {
    projectSidebarOpen, setProjectSidebarOpen,
    rightPanelOpen, setRightPanelOpen,
    terminalPanelOpen, setTerminalPanelOpen,
    loading,
  } = useStore();
  const [sidebarWidth, setSidebarWidth] = useState(220);
  const [rightWidth, setRightWidth] = useState(280);
  const [terminalHeight, setTerminalHeight] = useState(250);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);

  const collapseSidebar = useCallback(() => setProjectSidebarOpen(false), [setProjectSidebarOpen]);
  const expandSidebar = useCallback(() => setProjectSidebarOpen(true), [setProjectSidebarOpen]);
  const collapseRight = useCallback(() => setRightPanelOpen(false), [setRightPanelOpen]);
  const expandRight = useCallback(() => setRightPanelOpen(true), [setRightPanelOpen]);
  const collapseTerminal = useCallback(() => setTerminalPanelOpen(false), [setTerminalPanelOpen]);
  const expandTerminal = useCallback(() => setTerminalPanelOpen(true), [setTerminalPanelOpen]);

  useEffect(() => {
    if (electronAPI.platform !== 'unknown') {
      document.body.classList.add(`platform-${electronAPI.platform}`);
    }
    electronAPI.onFullscreenChange?.((isFullscreen) => {
      document.body.classList.toggle('fullscreen', isFullscreen);
    });
  }, []);

  // Ctrl+P command palette
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
        e.preventDefault();
        setCommandPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={200}>
      <div className="app-shell flex flex-col h-screen w-screen overflow-hidden bg-background">
        <TitleBar onSearchClick={() => setCommandPaletteOpen(true)} />
        <div className="flex flex-1 min-h-0 overflow-hidden">
          <ActivityBar />
          {projectSidebarOpen && (
            <div style={{ width: sidebarWidth, minWidth: sidebarWidth }} className="shrink-0 h-full overflow-hidden">
              <ProjectSidebar />
            </div>
          )}
          <ResizeHandle direction="vertical" value={sidebarWidth} onResize={setSidebarWidth} min={120} max={500} collapseThreshold={80} onCollapse={collapseSidebar} isOpen={projectSidebarOpen} onExpand={expandSidebar} />
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
            <div className="flex-1 overflow-auto">
              <MainContent />
            </div>
            <ResizeHandle direction="horizontal" value={terminalHeight} onResize={setTerminalHeight} min={80} max={5000} invert collapseThreshold={50} onCollapse={collapseTerminal} isOpen={terminalPanelOpen} onExpand={expandTerminal} />
            {terminalPanelOpen && (
              <div style={{ height: terminalHeight, minHeight: terminalHeight }} className="shrink-0 overflow-hidden">
                <TerminalPanel />
              </div>
            )}
          </div>
          <ResizeHandle direction="vertical" value={rightWidth} onResize={setRightWidth} min={140} max={600} invert collapseThreshold={80} onCollapse={collapseRight} isOpen={rightPanelOpen} onExpand={expandRight} />
          {rightPanelOpen && (
            <div style={{ width: rightWidth, minWidth: rightWidth }} className="shrink-0 h-full overflow-hidden">
              <RightPanel />
            </div>
          )}
        </div>
        <StatusBar />
      </div>
      <CommandPalette open={commandPaletteOpen} onClose={() => setCommandPaletteOpen(false)} />
      <McpToolWatcher />
    </TooltipProvider>
  );
}
