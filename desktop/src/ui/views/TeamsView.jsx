import React, { useState } from 'react';
import { Bot, Plus, Trash2, Pencil, Zap, FolderOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useStore } from '@/hooks/useStore';
import { useToast } from '@/hooks/useToast';
import { electronAPI } from '@/lib/electronAPI';
import { AgentModal } from '@/components/AgentModal';

function parseSkills(members) {
  if (typeof members === 'string') {
    try { return JSON.parse(members); } catch { return []; }
  }
  return members || [];
}

function getAgentProjects(agentId, projects) {
  return projects.filter((p) => {
    const teamIds = typeof p.teams === 'string'
      ? JSON.parse(p.teams || '[]')
      : p.teams || [];
    return teamIds.includes(agentId);
  });
}

const ROLE_COLORS = {
  backend: 'bg-blue-500/15 text-blue-400 border-blue-500/20',
  frontend: 'bg-purple-500/15 text-purple-400 border-purple-500/20',
  fullstack: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/20',
  devops: 'bg-orange-500/15 text-orange-400 border-orange-500/20',
  testing: 'bg-green-500/15 text-green-400 border-green-500/20',
  data: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/20',
  general: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/20',
};

function getRoleFromSkills(skills) {
  if (!skills.length) return 'general';
  const first = typeof skills[0] === 'string' ? skills[0] : skills[0]?.name || '';
  if (first.includes('backend') || first.includes('api')) return 'backend';
  if (first.includes('frontend') || first.includes('react') || first.includes('css')) return 'frontend';
  if (first.includes('devops') || first.includes('docker') || first.includes('deploy')) return 'devops';
  if (first.includes('test')) return 'testing';
  if (first.includes('data') || first.includes('sql')) return 'data';
  return 'general';
}

function AgentCard({ agent, projects, onEdit, onDelete }) {
  const skills = parseSkills(agent.members);
  const agentProjects = getAgentProjects(agent.id, projects);
  const role = agent.description || getRoleFromSkills(skills);
  const roleKey = role.toLowerCase().split(' ')[0];
  const colorClass = ROLE_COLORS[roleKey] || ROLE_COLORS.general;

  return (
    <div
      className="group flex flex-col gap-3 rounded-lg border border-border bg-card p-4 hover:border-primary/30 transition-colors cursor-pointer"
      onClick={() => onEdit(agent)}
    >
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10">
            <Bot className="h-4 w-4 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">{agent.name}</p>
            <Badge variant="outline" className={`mt-0.5 text-[10px] px-1.5 py-0 border ${colorClass}`}>
              {role}
            </Badge>
          </div>
        </div>
        <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); onEdit(agent); }}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={(e) => { e.stopPropagation(); onDelete(agent.id); }}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Skills */}
      {skills.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {skills.slice(0, 5).map((s, i) => {
            const name = typeof s === 'string' ? s : s?.name || s;
            const shortName = String(name).includes('/') ? String(name).split('/').pop() : String(name);
            return (
              <Badge key={i} variant="secondary" className="text-[10px] px-1.5 py-0 gap-1">
                <Zap className="h-2.5 w-2.5" />
                {shortName}
              </Badge>
            );
          })}
          {skills.length > 5 && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
              +{skills.length - 5}
            </Badge>
          )}
        </div>
      )}

      {/* Projects */}
      {agentProjects.length > 0 && (
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <FolderOpen className="h-3 w-3 shrink-0" />
          <span className="truncate">
            {agentProjects.map((p) => p.name).join(', ')}
          </span>
        </div>
      )}

      {/* Empty state for skills */}
      {skills.length === 0 && agentProjects.length === 0 && (
        <p className="text-[11px] text-muted-foreground/60">No skills or projects assigned</p>
      )}
    </div>
  );
}

export function TeamsView() {
  const { teams, setTeams, projects } = useStore();
  const { toast } = useToast();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingAgent, setEditingAgent] = useState(null);

  function handleCreate() {
    setEditingAgent(null);
    setModalOpen(true);
  }

  function handleEdit(agent) {
    setEditingAgent(agent);
    setModalOpen(true);
  }

  async function handleDelete(agentId) {
    try {
      const updated = await electronAPI.deleteTeam(agentId);
      setTeams(updated);
      toast('Agent deleted', 'success');
    } catch {
      toast('Failed to delete agent', 'error');
    }
  }

  function handleSaved(updatedTeams) {
    setTeams(updatedTeams);
    setModalOpen(false);
    setEditingAgent(null);
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold">Agents</h2>
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
            {teams.length}
          </Badge>
        </div>
        <Button size="sm" className="h-7 text-xs" onClick={handleCreate}>
          <Plus className="h-3.5 w-3.5 mr-1" />
          New Agent
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {teams.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
            <Bot className="h-10 w-10 opacity-30" />
            <div className="text-center">
              <p className="text-sm font-medium">No agents yet</p>
              <p className="text-xs text-muted-foreground/70 mt-1">
                Create AI agents with specific roles and skills to work on your projects
              </p>
            </div>
            <Button variant="outline" size="sm" className="h-7 text-xs mt-1" onClick={handleCreate}>
              <Plus className="h-3.5 w-3.5 mr-1" />
              Create Agent
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {teams.map((agent) => (
              <AgentCard
                key={agent.id}
                agent={agent}
                projects={projects}
                onEdit={handleEdit}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </div>

      <AgentModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        agent={editingAgent}
        onSaved={handleSaved}
      />
    </div>
  );
}
