import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { electronAPI } from '../lib/electronAPI';

const StoreContext = createContext(null);

export function StoreProvider({ children }) {
  const [projects, setProjects] = useState([]);
  const [teams, setTeams] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [registry, setRegistry] = useState({ skills: [] });
  const [history, setHistory] = useState([]);
  const [activeView, setActiveView] = useState('projects');
  const [activeProjectPath, setActiveProjectPath] = useState(null);
  const [projectSidebarOpen, setProjectSidebarOpen] = useState(true);
  const [rightPanelOpen, setRightPanelOpen] = useState(true);
  const [activeRightTab, setActiveRightTab] = useState('tasks');
  const [terminalPanelOpen, setTerminalPanelOpen] = useState(false);
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);

  const activeProject = projects.find(p => p.path === activeProjectPath) || null;

  const refresh = useCallback(async () => {
    try {
      const results = await Promise.allSettled([
        electronAPI.getRegistry(),
        electronAPI.getProjects(),
        electronAPI.getTeams(),
        electronAPI.getHistory(),
        electronAPI.getTasks(),
        electronAPI.getSettings(),
      ]);
      const val = (i) => results[i].status === 'fulfilled' ? results[i].value : null;
      const reg = val(0), projs = val(1), tms = val(2), hist = val(3), tks = val(4), stngs = val(5);
      if (reg) setRegistry(reg);
      if (Array.isArray(projs)) setProjects(projs);
      if (Array.isArray(tms)) setTeams(tms);
      if (Array.isArray(hist)) setHistory(hist);
      if (Array.isArray(tks)) setTasks(tks);
      if (stngs && typeof stngs === 'object') setSettings(stngs);
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

  const refreshTasks = useCallback(async (projectPath) => {
    const tks = await electronAPI.getTasks(projectPath);
    if (Array.isArray(tks)) setTasks(tks);
  }, []);

  const refreshTeams = useCallback(async () => {
    const tms = await electronAPI.getTeams();
    if (tms) setTeams(tms);
  }, []);

  const refreshHistory = useCallback(async () => {
    const hist = await electronAPI.getHistory();
    if (hist) setHistory(hist);
  }, []);

  const value = {
    projects, setProjects, refreshProjects,
    teams, setTeams, refreshTeams,
    tasks, setTasks, refreshTasks,
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
  };

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used within StoreProvider');
  return ctx;
}
