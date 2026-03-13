import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import {
  ChevronRight, ChevronDown, FolderOpen, GitBranch, GitCommit,
  Play, RefreshCw, Plus, Check, X, Pencil, Trash2,
  Activity, FileText, Info, Package, TestTube, Terminal,
  Users, Zap, Globe, ExternalLink, CheckCircle2, Circle,
  Clock, AlertCircle, MoreHorizontal, Copy, Eye, EyeOff,
} from 'lucide-react';
import { useStore } from '@/hooks/useStore';
import { useToast } from '@/hooks/useToast';
import { electronAPI } from '@/lib/electronAPI';
import { formatDate } from '@/lib/utils';

// ── Collapsible Section (VS Code style) ─────────────────────
function Section({ title, count, defaultOpen = true, actions, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="select-none">
      <div
        className="flex items-center h-[22px] px-2 cursor-pointer hover:bg-accent/50 group"
        onClick={() => setOpen(!open)}
      >
        {open ? (
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
        )}
        <span className="text-[11px] font-semibold uppercase tracking-wider ml-0.5 flex-1 truncate">
          {title}
        </span>
        {count != null && (
          <span className="text-[11px] text-muted-foreground mr-1">{count}</span>
        )}
        {actions && (
          <div
            className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={(e) => e.stopPropagation()}
          >
            {actions}
          </div>
        )}
      </div>
      {open && <div className="pb-1">{children}</div>}
    </div>
  );
}

// ── Tree Row ────────────────────────────────────────────────
function TreeRow({ icon, label, sublabel, active, onClick, actions, indent = 0, className = '' }) {
  return (
    <div
      className={`flex items-center h-[22px] pr-2 cursor-pointer group hover:bg-accent/60 ${active ? 'bg-accent' : ''} ${className}`}
      style={{ paddingLeft: `${12 + indent * 16}px` }}
      onClick={onClick}
    >
      {icon && <span className="mr-1.5 shrink-0 flex items-center">{icon}</span>}
      <span className="text-[13px] truncate flex-1">{label}</span>
      {sublabel && <span className="text-[11px] text-muted-foreground shrink-0 ml-1">{sublabel}</span>}
      {actions && (
        <div
          className="flex items-center gap-0.5 ml-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
          onClick={(e) => e.stopPropagation()}
        >
          {actions}
        </div>
      )}
    </div>
  );
}

function IconBtn({ icon: Icon, onClick, title, className = '', size = 14 }) {
  return (
    <button
      className={`h-[18px] w-[18px] flex items-center justify-center rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors ${className}`}
      onClick={onClick}
      title={title}
    >
      <Icon style={{ width: size, height: size }} />
    </button>
  );
}

const CONTEXT_FILES = [
  'context.md', 'stack.md', 'services.md', 'dependencies.md',
  'environment.md', 'team.md', 'scripts.md', 'testing.md',
];

const STATUS_ICONS = {
  todo: <Circle className="h-3.5 w-3.5 text-muted-foreground" />,
  in_progress: <Clock className="h-3.5 w-3.5 text-blue-400" />,
  done: <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />,
  blocked: <AlertCircle className="h-3.5 w-3.5 text-red-400" />,
};

const PRIORITY_DOT = {
  critical: 'bg-red-500',
  high: 'bg-orange-400',
  medium: 'bg-yellow-400',
  low: 'bg-green-500',
};

// ── CONTEXT TAB ─────────────────────────────────────────────
function ContextTab() {
  const { activeProject, projects, setProjects, refresh } = useStore();
  const { toast } = useToast();
  const [context, setContext] = useState(null);
  const [loading, setLoading] = useState(false);

  const projectPath = activeProject?.path;

  const loadContext = useCallback(async () => {
    if (!projectPath) return;
    try {
      const ctx = await electronAPI.getProjectContext(projectPath);
      setContext(ctx);
    } catch {
      setContext(null);
    }
  }, [projectPath]);

  useEffect(() => { loadContext(); }, [loadContext]);

  if (!activeProject) {
    return <EmptyState text="Select a project to view context" />;
  }

  const initialized = context?.initialized;
  const projectSkills = activeProject.skills || [];
  const team = activeProject.team_id;

  const handleInit = async () => {
    setLoading(true);
    try {
      if (!activeProject.last_analyzed) await electronAPI.analyzeProject(projectPath);
      await electronAPI.initProjectContext(projectPath);
      toast({ description: 'Context initialized' });
      await loadContext();
    } catch {
      toast({ description: 'Failed to initialize', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    setLoading(true);
    try {
      await electronAPI.initProjectContext(projectPath);
      toast({ description: 'Context synced' });
      await loadContext();
    } finally {
      setLoading(false);
    }
  };

  const handleRegenerate = async () => {
    setLoading(true);
    try {
      await electronAPI.analyzeProject(projectPath);
      await electronAPI.initProjectContext(projectPath);
      toast({ description: 'Context regenerated' });
      await loadContext();
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollArea className="h-full">
      {loading && (
        <div className="flex items-center gap-2 px-3 py-1.5 text-[13px] text-muted-foreground bg-accent/30">
          <RefreshCw className="h-3.5 w-3.5 animate-spin" />
          Processing...
        </div>
      )}

      {/* Project Info */}
      <Section title="Project" defaultOpen={true}>
        <TreeRow
          icon={<FolderOpen className="h-4 w-4 text-blue-400" />}
          label={activeProject.name}
          sublabel={activeProject.stack?.language}
        />
        {activeProject.stack?.framework && (
          <TreeRow
            indent={1}
            icon={<span className="text-[11px] text-muted-foreground">fw</span>}
            label={activeProject.stack.framework}
          />
        )}
        {activeProject.stack?.language && (
          <TreeRow
            indent={1}
            icon={<span className="text-[11px] text-muted-foreground">lang</span>}
            label={activeProject.stack.language}
          />
        )}
      </Section>

      {/* Context Files */}
      <Section
        title="Context Files"
        count={initialized ? Object.keys(context?.files || {}).length : 0}
        defaultOpen={true}
        actions={
          initialized ? (
            <IconBtn icon={RefreshCw} onClick={handleRegenerate} title="Regenerate all" />
          ) : null
        }
      >
        {initialized ? (
          CONTEXT_FILES.map((fname) => {
            const hasFile = !!context?.files?.[fname];
            return (
              <TreeRow
                key={fname}
                icon={<FileText className={`h-4 w-4 ${hasFile ? 'text-blue-400' : 'text-muted-foreground/40'}`} />}
                label={fname.replace('.md', '')}
                sublabel={hasFile ? '' : 'missing'}
                className={!hasFile ? 'opacity-50' : ''}
                onClick={() => hasFile && electronAPI.getContextFilePath?.(projectPath, fname)}
              />
            );
          })
        ) : (
          <div className="px-4 py-2">
            <p className="text-[13px] text-muted-foreground mb-2">
              No context files yet. Initialize to create project context for AI assistants.
            </p>
            <Button size="sm" className="h-7 text-[13px] w-full" onClick={handleInit} disabled={loading}>
              Initialize Context
            </Button>
          </div>
        )}
      </Section>

      {/* Skills */}
      <Section title="Skills" count={projectSkills.length} defaultOpen={projectSkills.length > 0}>
        {projectSkills.length > 0 ? (
          projectSkills.map((s) => (
            <TreeRow
              key={s}
              icon={<Zap className="h-4 w-4 text-yellow-400" />}
              label={s.includes('/') ? s.split('/').pop() : s}
            />
          ))
        ) : (
          <div className="px-4 py-1 text-[13px] text-muted-foreground">No skills assigned</div>
        )}
      </Section>

      {/* Sync Action */}
      <div className="px-3 py-2 border-t border-border">
        <Button
          size="sm"
          className="h-7 text-[13px] w-full"
          onClick={handleSync}
          disabled={loading}
        >
          <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
          Sync to AI Assistant
        </Button>
      </div>
    </ScrollArea>
  );
}

// ── TASKS TAB ───────────────────────────────────────────────
function TasksTab() {
  const { activeProject, tasks, refreshTasks } = useStore();
  const { toast } = useToast();
  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editTitle, setEditTitle] = useState('');

  const projectTasks = activeProject
    ? (tasks || []).filter((t) => t.project_path === activeProject.path)
    : (tasks || []);
  const openTasks = projectTasks.filter((t) => t.status !== 'done');
  const doneTasks = projectTasks.filter((t) => t.status === 'done');

  const addTask = async () => {
    if (!newTitle.trim()) return;
    try {
      await electronAPI.createTask({
        title: newTitle.trim(),
        project_path: activeProject?.path,
        status: 'todo',
        priority: 'medium',
      });
      setNewTitle('');
      setAdding(false);
      refreshTasks?.(activeProject?.path);
    } catch {
      toast({ description: 'Failed to add task', variant: 'destructive' });
    }
  };

  const cycleStatus = async (task) => {
    const order = ['todo', 'in_progress', 'done'];
    const next = order[(order.indexOf(task.status) + 1) % order.length];
    try {
      await electronAPI.updateTask(task.id, { status: next });
      refreshTasks?.(activeProject?.path);
    } catch {
      toast({ description: 'Failed to update', variant: 'destructive' });
    }
  };

  const deleteTask = async (id) => {
    try {
      await electronAPI.deleteTask(id);
      refreshTasks?.(activeProject?.path);
    } catch {
      toast({ description: 'Failed to delete', variant: 'destructive' });
    }
  };

  const saveEdit = async (id) => {
    if (!editTitle.trim()) return;
    try {
      await electronAPI.updateTask(id, { title: editTitle.trim() });
      setEditingId(null);
      refreshTasks?.(activeProject?.path);
    } catch {
      toast({ description: 'Failed to update', variant: 'destructive' });
    }
  };

  return (
    <ScrollArea className="h-full">
      {/* Open Tasks */}
      <Section
        title="Open"
        count={openTasks.length}
        defaultOpen={true}
        actions={<IconBtn icon={Plus} onClick={() => setAdding(true)} title="Add task" />}
      >
        {adding && (
          <div className="flex items-center gap-1 px-3 py-1">
            <Input
              autoFocus
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') addTask();
                if (e.key === 'Escape') { setAdding(false); setNewTitle(''); }
              }}
              placeholder="Task title..."
              className="h-6 text-[13px] flex-1"
            />
            <IconBtn icon={Check} onClick={addTask} title="Save" />
            <IconBtn icon={X} onClick={() => { setAdding(false); setNewTitle(''); }} title="Cancel" />
          </div>
        )}
        {openTasks.length > 0 ? (
          openTasks.map((t) => (
            editingId === t.id ? (
              <div key={t.id} className="flex items-center gap-1 px-3 py-0.5">
                <Input
                  autoFocus
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') saveEdit(t.id);
                    if (e.key === 'Escape') setEditingId(null);
                  }}
                  className="h-6 text-[13px] flex-1"
                />
                <IconBtn icon={Check} onClick={() => saveEdit(t.id)} title="Save" />
                <IconBtn icon={X} onClick={() => setEditingId(null)} title="Cancel" />
              </div>
            ) : (
              <TreeRow
                key={t.id}
                icon={
                  <span onClick={(e) => { e.stopPropagation(); cycleStatus(t); }} className="cursor-pointer">
                    {STATUS_ICONS[t.status] || STATUS_ICONS.todo}
                  </span>
                }
                label={
                  <span className="flex items-center gap-1.5">
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${PRIORITY_DOT[t.priority] || 'bg-muted-foreground'}`} />
                    <span className="truncate">{t.title}</span>
                  </span>
                }
                actions={
                  <>
                    <IconBtn icon={Pencil} onClick={() => { setEditingId(t.id); setEditTitle(t.title); }} title="Edit" />
                    <IconBtn icon={Trash2} onClick={() => deleteTask(t.id)} title="Delete" className="hover:text-red-400" />
                  </>
                }
              />
            )
          ))
        ) : !adding ? (
          <div className="px-4 py-1 text-[13px] text-muted-foreground">No open tasks</div>
        ) : null}
      </Section>

      {/* Completed Tasks */}
      {doneTasks.length > 0 && (
        <Section title="Completed" count={doneTasks.length} defaultOpen={false}>
          {doneTasks.slice(0, 15).map((t) => (
            <TreeRow
              key={t.id}
              icon={<CheckCircle2 className="h-3.5 w-3.5 text-green-500/60" />}
              label={<span className="line-through text-muted-foreground">{t.title}</span>}
              actions={
                <IconBtn icon={Trash2} onClick={() => deleteTask(t.id)} title="Delete" className="hover:text-red-400" />
              }
            />
          ))}
          {doneTasks.length > 15 && (
            <div className="px-4 py-1 text-[11px] text-muted-foreground">+{doneTasks.length - 15} more</div>
          )}
        </Section>
      )}
    </ScrollArea>
  );
}

// ── ACTIVITY TAB ────────────────────────────────────────────
function ActivityTab() {
  const { activeProject } = useStore();
  const [gitInfo, setGitInfo] = useState(null);
  const [loading, setLoading] = useState(false);

  const projectPath = activeProject?.path;

  const loadGit = useCallback(async () => {
    if (!projectPath) { setGitInfo(null); return; }
    setLoading(true);
    try {
      const info = await electronAPI.getGitInfo(projectPath);
      setGitInfo(info);
    } catch {
      setGitInfo(null);
    } finally {
      setLoading(false);
    }
  }, [projectPath]);

  useEffect(() => { loadGit(); }, [loadGit]);

  if (!activeProject) return <EmptyState text="Select a project" />;
  if (loading) return <EmptyState text="Loading git info..." />;
  if (!gitInfo || gitInfo.error) return <EmptyState text="No git repository detected" />;

  const localBranches = gitInfo.branches?.local || [];
  const remoteBranches = gitInfo.branches?.remote || [];
  const commits = gitInfo.commits || [];
  const remoteShort = gitInfo.remoteUrl?.replace(/^https?:\/\/github\.com\//, '').replace(/\.git$/, '');

  return (
    <ScrollArea className="h-full">
      {/* Current Branch */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
        <GitBranch className="h-4 w-4 text-green-400 shrink-0" />
        <span className="text-[13px] font-medium truncate">{gitInfo.branch}</span>
        <IconBtn icon={RefreshCw} onClick={loadGit} title="Refresh" className="ml-auto" />
      </div>
      {remoteShort && (
        <div className="px-3 py-1 text-[12px] text-muted-foreground truncate border-b border-border" title={gitInfo.remoteUrl}>
          <Globe className="h-3 w-3 inline mr-1 relative -top-px" />
          {remoteShort}
        </div>
      )}

      {/* Branches */}
      <Section title="Branches" count={localBranches.length} defaultOpen={true}>
        {localBranches.slice(0, 20).map((b) => {
          const active = b === gitInfo.branch;
          return (
            <TreeRow
              key={b}
              icon={<GitBranch className={`h-3.5 w-3.5 ${active ? 'text-green-400' : 'text-muted-foreground'}`} />}
              label={<span className={`font-mono text-[12px] ${active ? 'font-semibold' : ''}`}>{b}</span>}
            />
          );
        })}
        {localBranches.length > 20 && (
          <div className="px-4 py-1 text-[11px] text-muted-foreground">+{localBranches.length - 20} more</div>
        )}
      </Section>

      {/* Remote Branches */}
      {remoteBranches.length > 0 && (
        <Section title="Remote" count={remoteBranches.length} defaultOpen={false}>
          {remoteBranches.slice(0, 10).map((b) => (
            <TreeRow
              key={b}
              icon={<GitBranch className="h-3.5 w-3.5 text-muted-foreground/50" />}
              label={<span className="font-mono text-[12px] text-muted-foreground">{b}</span>}
            />
          ))}
          {remoteBranches.length > 10 && (
            <div className="px-4 py-1 text-[11px] text-muted-foreground">+{remoteBranches.length - 10} more</div>
          )}
        </Section>
      )}

      {/* Recent Commits */}
      <Section title="Recent Commits" count={commits.length} defaultOpen={true}>
        {commits.slice(0, 25).map((c, i) => (
          <div key={i} className="px-3 py-1 hover:bg-accent/50 cursor-default">
            <div className="flex items-center gap-1.5">
              <GitCommit className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className="text-[13px] truncate flex-1">{c.message?.substring(0, 72)}</span>
            </div>
            <div className="flex items-center gap-2 pl-5 text-[11px] text-muted-foreground">
              <span>{c.author}</span>
              <span>{formatDate(c.date)}</span>
              {(c.insertions || c.deletions) ? (
                <span className="ml-auto">
                  <span className="text-green-400">+{c.insertions || 0}</span>
                  {' '}
                  <span className="text-red-400">-{c.deletions || 0}</span>
                </span>
              ) : null}
            </div>
          </div>
        ))}
      </Section>
    </ScrollArea>
  );
}

// ── INFO TAB ────────────────────────────────────────────────
function InfoTab() {
  const { activeProject } = useStore();
  const { toast } = useToast();
  const [portsInfo, setPortsInfo] = useState(null);
  const [testInfo, setTestInfo] = useState(null);
  const [envVars, setEnvVars] = useState([]);
  const [addingEnv, setAddingEnv] = useState(false);
  const [newEnvKey, setNewEnvKey] = useState('');
  const [newEnvVal, setNewEnvVal] = useState('');
  const [editingEnv, setEditingEnv] = useState(null);
  const [editEnvVal, setEditEnvVal] = useState('');
  const [showValues, setShowValues] = useState(false);

  const projectPath = activeProject?.path;

  useEffect(() => {
    if (!projectPath) return;
    electronAPI.getProjectPorts(projectPath).then(setPortsInfo).catch(() => null);
    electronAPI.detectTests(projectPath).then(setTestInfo).catch(() => null);
    loadEnvVars();
  }, [projectPath]);

  const loadEnvVars = async () => {
    if (!projectPath) return;
    try {
      const data = await electronAPI.getEnvironments(projectPath);
      const envs = data?.environments || {};
      const active = data?.activeEnv || Object.keys(envs)[0] || 'DEV';
      const vars = Object.entries(envs[active] || {}).map(([key, value]) => ({ key, value }));
      setEnvVars(vars);
    } catch {
      setEnvVars([]);
    }
  };

  const addEnvVar = async () => {
    if (!newEnvKey.trim()) return;
    const updated = [...envVars, { key: newEnvKey.trim(), value: newEnvVal }];
    await saveEnvVars(updated);
    setNewEnvKey('');
    setNewEnvVal('');
    setAddingEnv(false);
  };

  const deleteEnvVar = async (key) => {
    const updated = envVars.filter((v) => v.key !== key);
    await saveEnvVars(updated);
  };

  const saveEnvEdit = async (key) => {
    const updated = envVars.map((v) => v.key === key ? { ...v, value: editEnvVal } : v);
    await saveEnvVars(updated);
    setEditingEnv(null);
  };

  const saveEnvVars = async (vars) => {
    if (!projectPath) return;
    const obj = {};
    vars.forEach((v) => { if (v.key) obj[v.key] = v.value; });
    try {
      const data = await electronAPI.getEnvironments(projectPath);
      const active = data?.activeEnv || 'DEV';
      await electronAPI.saveEnvironment(projectPath, active, obj);
      setEnvVars(vars);
    } catch {
      toast({ description: 'Failed to save env vars', variant: 'destructive' });
    }
  };

  if (!activeProject) return <EmptyState text="Select a project" />;

  const analysis = activeProject.analysis || {};
  const services = analysis.services || [];
  const scripts = Object.entries(analysis.scripts || {});
  const deps = analysis.dependencies || {};
  const depSections = Object.entries(deps).filter(([, l]) => l?.length > 0);
  const totalDeps = depSections.reduce((s, [, l]) => s + l.length, 0);
  const svcUrls = portsInfo?.serviceUrls || {};

  const runScript = (name) => electronAPI.runScript?.(projectPath, name);

  return (
    <ScrollArea className="h-full">
      {/* Environment Variables */}
      <Section
        title="Environment"
        count={envVars.length}
        defaultOpen={true}
        actions={
          <>
            <IconBtn icon={showValues ? EyeOff : Eye} onClick={() => setShowValues(!showValues)} title={showValues ? 'Hide values' : 'Show values'} />
            <IconBtn icon={Plus} onClick={() => setAddingEnv(true)} title="Add variable" />
          </>
        }
      >
        {addingEnv && (
          <div className="px-3 py-1 space-y-1">
            <Input
              autoFocus
              value={newEnvKey}
              onChange={(e) => setNewEnvKey(e.target.value.toUpperCase())}
              placeholder="KEY"
              className="h-6 text-[13px] font-mono"
              onKeyDown={(e) => { if (e.key === 'Enter') addEnvVar(); if (e.key === 'Escape') setAddingEnv(false); }}
            />
            <div className="flex items-center gap-1">
              <Input
                value={newEnvVal}
                onChange={(e) => setNewEnvVal(e.target.value)}
                placeholder="value"
                className="h-6 text-[13px] font-mono flex-1"
                onKeyDown={(e) => { if (e.key === 'Enter') addEnvVar(); if (e.key === 'Escape') setAddingEnv(false); }}
              />
              <IconBtn icon={Check} onClick={addEnvVar} title="Save" />
              <IconBtn icon={X} onClick={() => setAddingEnv(false)} title="Cancel" />
            </div>
          </div>
        )}
        {envVars.length > 0 ? (
          envVars.map((v) => (
            editingEnv === v.key ? (
              <div key={v.key} className="flex items-center gap-1 px-3 py-0.5">
                <span className="text-[12px] font-mono text-muted-foreground shrink-0 w-20 truncate">{v.key}</span>
                <Input
                  autoFocus
                  value={editEnvVal}
                  onChange={(e) => setEditEnvVal(e.target.value)}
                  className="h-6 text-[13px] font-mono flex-1"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') saveEnvEdit(v.key);
                    if (e.key === 'Escape') setEditingEnv(null);
                  }}
                />
                <IconBtn icon={Check} onClick={() => saveEnvEdit(v.key)} title="Save" />
              </div>
            ) : (
              <TreeRow
                key={v.key}
                label={
                  <span className="flex items-center gap-1.5 font-mono text-[12px]">
                    <span className="text-blue-400">{v.key}</span>
                    <span className="text-muted-foreground">=</span>
                    <span className="truncate">{showValues ? v.value : '•••••'}</span>
                  </span>
                }
                actions={
                  <>
                    <IconBtn icon={Copy} onClick={() => { navigator.clipboard.writeText(v.value); toast({ description: 'Copied' }); }} title="Copy value" />
                    <IconBtn icon={Pencil} onClick={() => { setEditingEnv(v.key); setEditEnvVal(v.value); }} title="Edit" />
                    <IconBtn icon={Trash2} onClick={() => deleteEnvVar(v.key)} title="Delete" className="hover:text-red-400" />
                  </>
                }
              />
            )
          ))
        ) : !addingEnv ? (
          <div className="px-4 py-1 text-[13px] text-muted-foreground">No variables set</div>
        ) : null}
      </Section>

      {/* Services */}
      <Section title="Services" count={services.length} defaultOpen={services.length > 0}>
        {services.length > 0 ? services.map((s, i) => {
          const urlKey = Object.keys(svcUrls).find(
            (k) => k.toLowerCase().includes(s.name.toLowerCase().replace('postgresql', 'postgres'))
          );
          return (
            <TreeRow
              key={i}
              icon={<span className="w-2 h-2 rounded-full bg-green-500 shrink-0" />}
              label={s.name}
              sublabel={s.type}
              actions={urlKey ? (
                <IconBtn icon={ExternalLink} onClick={() => electronAPI.openExternal?.(svcUrls[urlKey])} title={svcUrls[urlKey]} />
              ) : null}
            />
          );
        }) : (
          <div className="px-4 py-1 text-[13px] text-muted-foreground">No services detected</div>
        )}
      </Section>

      {/* Dependencies */}
      <Section title="Dependencies" count={totalDeps} defaultOpen={false}>
        {depSections.length > 0 ? depSections.map(([mgr, list]) => {
          const label = { npm: 'npm', python: 'pip', ruby: 'gem', java: 'maven' }[mgr] || mgr;
          return (
            <div key={mgr}>
              <div className="px-3 py-0.5 text-[11px] font-semibold uppercase text-muted-foreground">
                {label} ({list.length})
              </div>
              {list.slice(0, 25).map((d) => (
                <TreeRow
                  key={d.name}
                  indent={1}
                  icon={<Package className="h-3.5 w-3.5 text-muted-foreground" />}
                  label={<span className="font-mono text-[12px]">{d.name}</span>}
                  sublabel={d.version || 'latest'}
                />
              ))}
              {list.length > 25 && (
                <div className="px-4 py-1 text-[11px] text-muted-foreground">+{list.length - 25} more</div>
              )}
            </div>
          );
        }) : (
          <div className="px-4 py-1 text-[13px] text-muted-foreground">Run analysis to detect</div>
        )}
      </Section>

      {/* Testing */}
      <Section title="Testing" count={testInfo?.frameworks?.length || 0} defaultOpen={testInfo?.frameworks?.length > 0}>
        {testInfo?.frameworks?.length > 0 ? (
          <>
            {testInfo.frameworks.map((f) => (
              <TreeRow
                key={f}
                icon={<TestTube className="h-3.5 w-3.5 text-green-400" />}
                label={f}
              />
            ))}
            <TreeRow
              icon={<FileText className="h-3.5 w-3.5 text-muted-foreground" />}
              label="Test files"
              sublabel={String(testInfo.testFileCount || 0)}
            />
            {testInfo.hasTestScript && (
              <div className="px-3 py-1">
                <Button size="sm" variant="secondary" className="h-6 text-[13px] w-full" onClick={() => runScript('test')}>
                  <Play className="h-3.5 w-3.5 mr-1.5" />
                  Run Tests
                </Button>
              </div>
            )}
          </>
        ) : (
          <div className="px-4 py-1 text-[13px] text-muted-foreground">No test frameworks detected</div>
        )}
      </Section>

      {/* Scripts */}
      {scripts.length > 0 && (
        <Section title="Scripts" count={scripts.length} defaultOpen={true}>
          {scripts.slice(0, 20).map(([name, cmd]) => (
            <TreeRow
              key={name}
              icon={<Terminal className="h-3.5 w-3.5 text-muted-foreground" />}
              label={<span className="font-mono text-[12px]">{name}</span>}
              actions={
                <IconBtn icon={Play} onClick={() => runScript(name)} title={String(cmd)} className="text-green-400 hover:text-green-300" />
              }
            />
          ))}
        </Section>
      )}

      {/* File Stats */}
      {analysis.fileStats && (
        <Section title="Files" count={analysis.fileStats.total} defaultOpen={false}>
          {Object.entries(analysis.fileStats.byExt || {})
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([ext, count]) => {
              const pct = Math.round((count / analysis.fileStats.total) * 100);
              return (
                <div key={ext} className="flex items-center gap-2 px-3 py-0.5 h-[22px]">
                  <span className="text-[12px] text-muted-foreground w-10 font-mono shrink-0">{ext}</span>
                  <div className="flex-1 h-1.5 bg-accent rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-[11px] text-muted-foreground w-5 text-right shrink-0">{count}</span>
                </div>
              );
            })}
        </Section>
      )}
    </ScrollArea>
  );
}

// ── Empty State ─────────────────────────────────────────────
function EmptyState({ text }) {
  return <div className="px-3 py-4 text-[13px] text-muted-foreground">{text}</div>;
}

// ── Tab Button ──────────────────────────────────────────────
function TabButton({ icon: Icon, label, active, onClick }) {
  return (
    <button
      className={`flex items-center gap-1 h-[35px] px-2.5 text-[11px] uppercase tracking-wider font-medium border-b-2 transition-colors ${
        active
          ? 'border-primary text-foreground'
          : 'border-transparent text-muted-foreground hover:text-foreground'
      }`}
      onClick={onClick}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}

// ── Main RightPanel ─────────────────────────────────────────
export function RightPanel() {
  const { activeRightTab, setActiveRightTab } = useStore();
  const tab = activeRightTab || 'context';

  const tabs = [
    { id: 'context', icon: FolderOpen, label: 'Context' },
    { id: 'tasks', icon: CheckCircle2, label: 'Tasks' },
    { id: 'activity', icon: Activity, label: 'Activity' },
    { id: 'info', icon: Info, label: 'Info' },
  ];

  return (
    <div className="flex flex-col h-full w-full border-l border-border bg-background">
      {/* Tab bar */}
      <div className="flex items-center h-[35px] border-b border-border px-1 shrink-0 overflow-x-auto">
        {tabs.map((t) => (
          <TabButton
            key={t.id}
            icon={t.icon}
            label={t.label}
            active={tab === t.id}
            onClick={() => setActiveRightTab(t.id)}
          />
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {tab === 'context' && <ContextTab />}
        {tab === 'tasks' && <TasksTab />}
        {tab === 'activity' && <ActivityTab />}
        {tab === 'info' && <InfoTab />}
      </div>
    </div>
  );
}

export default RightPanel;
