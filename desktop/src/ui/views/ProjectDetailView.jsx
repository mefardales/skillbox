import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  Bot,
  Plus,
  X,
  Zap,
  FolderOpen,
  Layers,
  ChevronRight,
  Search,
  RefreshCw,
  Check,
  FileText,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useStore } from '@/hooks/useStore';
import { useToast } from '@/hooks/useToast';
import { electronAPI } from '@/lib/electronAPI';

function parseSkills(members) {
  if (typeof members === 'string') {
    try { return JSON.parse(members); } catch { return []; }
  }
  return members || [];
}

function parseTeamIds(teams) {
  if (typeof teams === 'string') {
    try { return JSON.parse(teams); } catch { return []; }
  }
  return teams || [];
}

function timeAgo(isoString) {
  if (!isoString) return 'Never';
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// ── Assigned Agent Card ──
function AssignedAgentCard({ agent, onRemove }) {
  const skills = parseSkills(agent.members);
  const role = agent.description || 'General Assistant';

  return (
    <div className="group flex items-center gap-3 rounded-md border border-border bg-card px-3 py-2.5 hover:border-primary/30 transition-colors">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10">
        <Bot className="h-3.5 w-3.5 text-primary" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium truncate">{agent.name}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[11px] text-muted-foreground truncate">{role}</span>
          {skills.length > 0 && (
            <span className="text-[10px] text-muted-foreground/60">
              · {skills.length} skill{skills.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
        onClick={(e) => { e.stopPropagation(); onRemove(agent.id); }}
      >
        <X className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

// ── Agent Picker (inline dropdown) ──
function AgentPicker({ availableAgents, onAdd, onClose }) {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    if (!search.trim()) return availableAgents;
    const q = search.toLowerCase();
    return availableAgents.filter((a) =>
      a.name.toLowerCase().includes(q) ||
      (a.description || '').toLowerCase().includes(q)
    );
  }, [search, availableAgents]);

  return (
    <div className="rounded-lg border border-border bg-card shadow-lg overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
        <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <input
          autoFocus
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search agents..."
          className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
        />
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <ScrollArea className="max-h-[200px]">
        {filtered.length === 0 ? (
          <p className="text-xs text-muted-foreground py-4 text-center">
            {availableAgents.length === 0
              ? 'No agents available. Create one first.'
              : 'No matching agents'}
          </p>
        ) : (
          <div className="p-1">
            {filtered.map((agent) => (
              <button
                key={agent.id}
                onClick={() => onAdd(agent.id)}
                className="flex items-center gap-2.5 w-full px-2.5 py-2 rounded-md text-left hover:bg-accent/60 transition-colors"
              >
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-primary/10">
                  <Bot className="h-3 w-3 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{agent.name}</p>
                  <p className="text-[11px] text-muted-foreground truncate">
                    {agent.description || 'General Assistant'}
                  </p>
                </div>
                <Plus className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              </button>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

// ── Main View ──
export default function ProjectDetailView() {
  const { activeProject, teams, refreshProjects, setActiveView } = useStore();
  const { toast } = useToast();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [syncStatus, setSyncStatus] = useState(null);
  const [syncing, setSyncing] = useState(false);

  const teamIds = useMemo(
    () => parseTeamIds(activeProject?.teams),
    [activeProject?.teams]
  );

  const assignedAgents = useMemo(
    () => teams.filter((t) => teamIds.includes(t.id)),
    [teams, teamIds]
  );

  const availableAgents = useMemo(
    () => teams.filter((t) => !teamIds.includes(t.id)),
    [teams, teamIds]
  );

  const stack = activeProject?.analysis?.stack?.map((s) => s.name) || [];
  const skills = activeProject?.skills || [];

  // Load context preview on mount and when project changes
  useEffect(() => {
    if (!activeProject?.path) return;
    electronAPI.getContextPreview(activeProject.path).then(setSyncStatus).catch(() => null);
  }, [activeProject?.path, activeProject?.teams, activeProject?.skills]);

  const handleAssign = useCallback(async (agentId) => {
    try {
      await electronAPI.assignTeamToProject(activeProject.path, agentId);
      await refreshProjects();
      setPickerOpen(false);
      toast('Agent assigned to project', 'success');
    } catch {
      toast('Failed to assign agent', 'error');
    }
  }, [activeProject?.path, refreshProjects, toast]);

  const handleUnassign = useCallback(async (agentId) => {
    try {
      await electronAPI.unassignTeamFromProject(activeProject.path, agentId);
      await refreshProjects();
      toast('Agent removed from project', 'success');
    } catch {
      toast('Failed to remove agent', 'error');
    }
  }, [activeProject?.path, refreshProjects, toast]);

  const handleSync = useCallback(async () => {
    if (!activeProject?.path) return;
    setSyncing(true);
    try {
      const result = await electronAPI.generateContextSync(activeProject.path);
      toast(`Synced: ${result.writtenFiles.join(', ')}`, 'success');
      // Refresh preview
      const preview = await electronAPI.getContextPreview(activeProject.path);
      setSyncStatus(preview);
    } catch {
      toast('Failed to sync context', 'error');
    } finally {
      setSyncing(false);
    }
  }, [activeProject?.path, toast]);

  if (!activeProject) return null;

  const fileEntries = syncStatus?.fileStatus ? Object.entries(syncStatus.fileStatus) : [];

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10">
            <FolderOpen className="h-4 w-4 text-primary" />
          </div>
          <div className="min-w-0">
            <h1 className="text-sm font-semibold truncate">{activeProject.name}</h1>
            <p className="text-[11px] text-muted-foreground truncate">{activeProject.path}</p>
          </div>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {/* Stack & Skills summary */}
          {(stack.length > 0 || skills.length > 0) && (
            <div className="flex flex-wrap gap-1.5">
              {stack.map((s) => (
                <Badge key={s} variant="secondary" className="text-[10px] px-1.5 py-0 gap-1">
                  <Layers className="h-2.5 w-2.5" />
                  {s}
                </Badge>
              ))}
              {skills.map((s) => {
                const name = typeof s === 'string' ? s : s?.name || s?.id || '';
                const short = name.includes('/') ? name.split('/').pop() : name;
                return (
                  <Badge key={name} variant="outline" className="text-[10px] px-1.5 py-0 gap-1 text-yellow-400 border-yellow-500/20">
                    <Zap className="h-2.5 w-2.5" />
                    {short}
                  </Badge>
                );
              })}
            </div>
          )}

          {/* ── Team / Agents Section ── */}
          <Card>
            <CardHeader className="px-4 py-2.5">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <Bot className="h-3 w-3" />
                  Team
                  {assignedAgents.length > 0 && (
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 ml-1">
                      {assignedAgents.length}
                    </Badge>
                  )}
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-[11px]"
                  onClick={() => setPickerOpen(!pickerOpen)}
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Add Agent
                </Button>
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-3 pt-0 space-y-2">
              {/* Agent picker */}
              {pickerOpen && (
                <AgentPicker
                  availableAgents={availableAgents}
                  onAdd={handleAssign}
                  onClose={() => setPickerOpen(false)}
                />
              )}

              {/* Assigned agents */}
              {assignedAgents.length === 0 && !pickerOpen ? (
                <div className="flex flex-col items-center py-6 gap-2 text-muted-foreground">
                  <Bot className="h-8 w-8 opacity-20" />
                  <p className="text-xs">No agents assigned to this project</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-6 text-[11px] mt-1"
                    onClick={() => setPickerOpen(true)}
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Assign Agent
                  </Button>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {assignedAgents.map((agent) => (
                    <AssignedAgentCard
                      key={agent.id}
                      agent={agent}
                      onRemove={handleUnassign}
                    />
                  ))}
                </div>
              )}

              {/* Link to agents view */}
              {teams.length === 0 && (
                <button
                  onClick={() => setActiveView('teams')}
                  className="flex items-center gap-1.5 text-[11px] text-primary hover:underline mt-1"
                >
                  Create your first agent
                  <ChevronRight className="h-3 w-3" />
                </button>
              )}
            </CardContent>
          </Card>

          {/* ── Context Sync Section ── */}
          <Card>
            <CardHeader className="px-4 py-2.5">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <Zap className="h-3 w-3" />
                  Context Sync
                  {syncStatus?.tokenEstimate && (
                    <span className="text-[10px] text-muted-foreground/60 ml-1">
                      ~{syncStatus.tokenEstimate} tokens
                    </span>
                  )}
                </CardTitle>
                <button
                  onClick={handleSync}
                  disabled={syncing}
                  className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed text-primary-foreground text-[10px] font-bold uppercase tracking-wider transition-colors"
                >
                  <RefreshCw className={`h-2.5 w-2.5 ${syncing ? 'animate-spin' : ''}`} />
                  {syncing ? 'Syncing' : 'Sync'}
                </button>
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-3 pt-0">
              {fileEntries.length > 0 ? (
                <div className="space-y-1">
                  {fileEntries.map(([fileName, status]) => (
                    <div key={fileName} className="flex items-center gap-2 text-sm">
                      <FileText className={`h-3.5 w-3.5 shrink-0 ${status.exists ? 'text-green-400' : 'text-muted-foreground/40'}`} />
                      <span className="font-mono text-xs flex-1 truncate">{fileName}</span>
                      {status.exists ? (
                        <span className="flex items-center gap-1 text-[10px] text-green-400">
                          <Check className="h-3 w-3" />
                          {timeAgo(status.lastModified)}
                        </span>
                      ) : (
                        <span className="text-[10px] text-muted-foreground">Not synced</span>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-3">
                  <p className="text-xs text-muted-foreground">
                    No context files generated yet
                  </p>
                  <button
                    onClick={handleSync}
                    disabled={syncing}
                    className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed text-primary-foreground text-[10px] font-bold uppercase tracking-wider transition-colors mt-2"
                  >
                    <RefreshCw className={`h-2.5 w-2.5 ${syncing ? 'animate-spin' : ''}`} />
                    {syncing ? 'Syncing' : 'Sync'}
                  </button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </ScrollArea>
    </div>
  );
}
