import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { electronAPI } from '../lib/electronAPI';
import { applyTheme } from '../lib/utils';

const StoreContext = createContext(null);

export function StoreProvider({ children }) {
  const [projects, setProjects] = useState([]);
  const [teams, setTeams] = useState([]);
  const [registry, setRegistry] = useState({ skills: [] });
  const [history, setHistory] = useState([]);
  const [activeView, setActiveView] = useState('projects');
  const [activeProjectPath, setActiveProjectPath] = useState(null);
  const [projectSidebarOpen, setProjectSidebarOpen] = useState(true);
  const [rightPanelOpen, setRightPanelOpen] = useState(true);
  const [activeRightTab, setActiveRightTab] = useState('context');
  const [terminalPanelOpen, setTerminalPanelOpen] = useState(false);
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);

  // ── Git state (synced in background) ──
  const [gitInfo, setGitInfo] = useState(null);
  const [gitStatus, setGitStatus] = useState(null);
  const gitIntervalRef = useRef(null);

  // ── MCP state ──
  const [mcpServerStatus, setMcpServerStatus] = useState({ running: false, port: null, hasAuth: false });
  const [mcpConnections, setMcpConnections] = useState([]);
  const [mcpApprovals, setMcpApprovals] = useState([]);

  // ── MCP tool invocations ──
  const [mcpToolEvents, setMcpToolEvents] = useState([]);

  // ── Platform logs ──
  const [logs, setLogs] = useState([]);
  const logIdRef = useRef(0);
  const addLog = useCallback((level, source, message, detail) => {
    const id = ++logIdRef.current;
    const entry = { id, level, source, message, detail: detail || null, timestamp: new Date().toISOString() };
    setLogs(prev => [entry, ...prev].slice(0, 500));
    return entry;
  }, []);
  const clearLogs = useCallback(() => setLogs([]), []);

  const activeProject = projects.find(p => p.path === activeProjectPath) || null;

  const refresh = useCallback(async () => {
    try {
      const results = await Promise.allSettled([
        electronAPI.getRegistry(),
        electronAPI.getProjects(),
        electronAPI.getTeams(),
        electronAPI.getHistory(),
        electronAPI.getSettings(),
      ]);
      const val = (i) => results[i].status === 'fulfilled' ? results[i].value : null;
      const reg = val(0), projs = val(1), tms = val(2), hist = val(3), stngs = val(4);
      if (reg) setRegistry(reg);
      if (Array.isArray(projs)) setProjects(projs);
      if (Array.isArray(tms)) setTeams(tms);
      if (Array.isArray(hist)) setHistory(hist);
      if (stngs && typeof stngs === 'object') {
        setSettings(stngs);
        applyTheme(stngs);
      }
    } catch (e) {
      console.error('Failed to load data:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const refreshProjects = useCallback(async () => {
    const projs = await electronAPI.getProjects();
    if (Array.isArray(projs)) setProjects(projs);
  }, []);

  const refreshTeams = useCallback(async () => {
    const tms = await electronAPI.getTeams();
    if (tms) setTeams(tms);
  }, []);

  const refreshHistory = useCallback(async () => {
    const hist = await electronAPI.getHistory();
    if (hist) setHistory(hist);
  }, []);

  // ── Git background sync ──
  const refreshGit = useCallback(async () => {
    if (!activeProjectPath) {
      setGitInfo(null);
      setGitStatus(null);
      return;
    }
    try {
      const [info, status] = await Promise.allSettled([
        electronAPI.getGitInfo(activeProjectPath),
        electronAPI.getGitStatusDetailed(activeProjectPath),
      ]);
      if (info.status === 'fulfilled' && info.value && !info.value.error) setGitInfo(info.value);
      else setGitInfo(null);
      if (status.status === 'fulfilled' && status.value && !status.value.error) setGitStatus(status.value);
      else setGitStatus(null);
    } catch {
      setGitInfo(null);
      setGitStatus(null);
    }
  }, [activeProjectPath]);

  // ── MCP background sync ──
  const refreshMcpStatus = useCallback(async () => {
    try {
      const [status, connections, approvals] = await Promise.allSettled([
        electronAPI.mcpServerStatus(),
        electronAPI.mcpClientList(),
        electronAPI.mcpGetPendingApprovals(),
      ]);
      if (status.status === 'fulfilled' && status.value) setMcpServerStatus(status.value);
      if (connections.status === 'fulfilled' && Array.isArray(connections.value)) setMcpConnections(connections.value);
      if (approvals.status === 'fulfilled' && Array.isArray(approvals.value)) setMcpApprovals(approvals.value);
    } catch { /* ignore */ }
  }, []);

  // Listen for MCP events from main process
  useEffect(() => {
    refreshMcpStatus();
    const unsub1 = electronAPI.onMcpServerStatus?.((status) => {
      setMcpServerStatus(status);
    });
    const unsub2 = electronAPI.onMcpConnectionsChanged?.((connections) => {
      setMcpConnections(connections);
    });
    const unsub3 = electronAPI.onMcpApprovalRequest?.((req) => {
      setMcpApprovals(prev => [...prev, req]);
    });
    const unsub4 = electronAPI.onMcpToolInvoked?.((info) => {
      setMcpToolEvents(prev => [{ ...info, id: Date.now() }, ...prev].slice(0, 200));
    });
    return () => { unsub1?.(); unsub2?.(); unsub3?.(); unsub4?.(); };
  }, [refreshMcpStatus]);

  // Sync git on project change + interval (every 5s)
  useEffect(() => {
    refreshGit();
    if (gitIntervalRef.current) clearInterval(gitIntervalRef.current);
    if (activeProjectPath) {
      gitIntervalRef.current = setInterval(refreshGit, 5000);
    }
    return () => { if (gitIntervalRef.current) clearInterval(gitIntervalRef.current); };
  }, [activeProjectPath, refreshGit]);

  const value = {
    projects, setProjects, refreshProjects,
    teams, setTeams, refreshTeams,
    registry, setRegistry,
    history, setHistory, refreshHistory,
    activeView, setActiveView,
    activeProjectPath, setActiveProjectPath,
    activeProject,
    projectSidebarOpen, setProjectSidebarOpen,
    rightPanelOpen, setRightPanelOpen,
    activeRightTab, setActiveRightTab,
    terminalPanelOpen, setTerminalPanelOpen,
    settings, setSettings,
    loading,
    refresh,
    gitInfo, gitStatus, refreshGit,
    mcpServerStatus, mcpConnections, mcpApprovals, setMcpApprovals, refreshMcpStatus, mcpToolEvents, setMcpToolEvents,
    logs, addLog, clearLogs,
  };

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used within StoreProvider');
  return ctx;
}
