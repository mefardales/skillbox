import { useEffect, useState, useRef, useCallback } from 'react';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useStore } from './hooks/useStore';
import { electronAPI } from './lib/electronAPI';
import { ActivityBar } from './layouts/ActivityBar';
import ProjectSidebar from './panels/ProjectSidebar';
import RightPanel from './panels/RightPanel';
import TerminalPanel from './panels/TerminalPanel';
import DashboardView from './views/DashboardView';
import { TasksView } from './views/TasksView';
import SkillsView from './views/SkillsView';
import { TeamsView } from './views/TeamsView';
import { SettingsView } from './views/SettingsView';
import { ExtensionsView } from './views/ExtensionsView';
import HistoryView from './views/HistoryView';
import GitHubView from './views/GitHubView';

function MainContent() {
  const { activeView } = useStore();

  const views = {
    projects: DashboardView,
    dashboard: DashboardView,
    tasks: TasksView,
    skills: SkillsView,
    teams: TeamsView,
    settings: SettingsView,
    extensions: ExtensionsView,
    history: HistoryView,
    github: GitHubView,
  };

  const View = views[activeView] || DashboardView;
  return <View />;
}

// ── Resize Handle ──────────────────────────────
function ResizeHandle({ direction = 'vertical', onDrag }) {
  const handleMouseDown = useCallback((e) => {
    e.preventDefault();
    const el = e.currentTarget;
    el.classList.add('active');
    const startPos = direction === 'vertical' ? e.clientX : e.clientY;

    const handleMouseMove = (e) => {
      const delta = (direction === 'vertical' ? e.clientX : e.clientY) - startPos;
      onDrag(delta);
    };

    const handleMouseUp = () => {
      el.classList.remove('active');
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.body.style.cursor = direction === 'vertical' ? 'col-resize' : 'row-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [direction, onDrag]);

  return (
    <div
      className={`resize-handle resize-handle-${direction}`}
      onMouseDown={handleMouseDown}
    />
  );
}

export function App() {
  const { projectSidebarOpen, rightPanelOpen, terminalPanelOpen, loading } = useStore();
  const [sidebarWidth, setSidebarWidth] = useState(220);
  const [rightWidth, setRightWidth] = useState(280);
  const [terminalHeight, setTerminalHeight] = useState(250);

  const sidebarBase = useRef(220);
  const rightBase = useRef(280);
  const terminalBase = useRef(250);

  useEffect(() => {
    if (electronAPI.platform !== 'unknown') {
      document.body.classList.add(`platform-${electronAPI.platform}`);
    }
    electronAPI.onFullscreenChange?.((isFullscreen) => {
      document.body.classList.toggle('fullscreen', isFullscreen);
    });
  }, []);

  // Sidebar resize: drag right edge
  const onSidebarDrag = useCallback((dx) => {
    setSidebarWidth(Math.max(160, Math.min(400, sidebarBase.current + dx)));
  }, []);
  // Commit base on mouseup via effect
  useEffect(() => { sidebarBase.current = sidebarWidth; }, [sidebarWidth]);

  // Right panel resize: drag left edge (negative dx = wider)
  const onRightDrag = useCallback((dx) => {
    setRightWidth(Math.max(200, Math.min(500, rightBase.current - dx)));
  }, []);
  useEffect(() => { rightBase.current = rightWidth; }, [rightWidth]);

  // Terminal resize: drag top edge (negative dy = taller)
  const onTerminalDrag = useCallback((dy) => {
    setTerminalHeight(Math.max(100, Math.min(600, terminalBase.current - dy)));
  }, []);
  useEffect(() => { terminalBase.current = terminalHeight; }, [terminalHeight]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={200}>
      <div className="app-shell flex h-screen w-screen overflow-hidden bg-background">
        <ActivityBar />
        {projectSidebarOpen && (
          <>
            <div style={{ width: sidebarWidth, minWidth: sidebarWidth }} className="shrink-0 h-full overflow-hidden">
              <ProjectSidebar />
            </div>
            <ResizeHandle direction="vertical" onDrag={onSidebarDrag} />
          </>
        )}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <div className="flex-1 overflow-auto">
            <MainContent />
          </div>
          {terminalPanelOpen && (
            <>
              <ResizeHandle direction="horizontal" onDrag={onTerminalDrag} />
              <div style={{ height: terminalHeight, minHeight: terminalHeight }} className="shrink-0 overflow-hidden">
                <TerminalPanel />
              </div>
            </>
          )}
        </div>
        {rightPanelOpen && (
          <>
            <ResizeHandle direction="vertical" onDrag={onRightDrag} />
            <div style={{ width: rightWidth, minWidth: rightWidth }} className="shrink-0 h-full overflow-hidden">
              <RightPanel />
            </div>
          </>
        )}
      </div>
    </TooltipProvider>
  );
}
