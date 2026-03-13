import React, { useState, useEffect } from 'react';
import { Users, Plus, Trash2, Edit } from 'lucide-react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { useStore } from '@/hooks/useStore';
import { useToast } from '@/hooks/useToast';
import { electronAPI } from '@/lib/electronAPI';
import { TeamModal } from '@/components/TeamModal';

function getInitials(name) {
  return (name || '?')
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function TeamsView() {
  const { teams, setTeams, activeProject } = useStore();
  const { toast } = useToast();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState(null);

  useEffect(() => {
    loadTeams();
  }, []);

  async function loadTeams() {
    try {
      const data = await electronAPI.getTeams();
      setTeams(data);
    } catch (err) {
      toast('Failed to load teams', 'error');
    }
  }

  function handleCreate() {
    setEditingTeam(null);
    setModalOpen(true);
  }

  function handleEdit(team) {
    setEditingTeam(team);
    setModalOpen(true);
  }

  async function handleDelete(e, teamId) {
    e.stopPropagation();
    try {
      const updated = await electronAPI.deleteTeam(teamId);
      setTeams(updated);
      toast('Team deleted');
    } catch (err) {
      toast('Failed to delete team', 'error');
    }
  }

  function handleSaved(updatedTeams) {
    setTeams(updatedTeams);
    setModalOpen(false);
    setEditingTeam(null);
  }

  function parseMembers(members) {
    if (typeof members === 'string') {
      try {
        return JSON.parse(members);
      } catch {
        return [];
      }
    }
    return members || [];
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold text-foreground">Teams</h2>
        </div>
        <Button size="sm" onClick={handleCreate}>
          <Plus className="h-4 w-4 mr-1" />
          Create Team
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-5">
        {teams.length === 0 ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center h-full gap-4 text-muted-foreground">
            <Users className="h-12 w-12 opacity-40" />
            <p className="text-sm">No teams yet</p>
            <Button variant="outline" size="sm" onClick={handleCreate}>
              <Plus className="h-4 w-4 mr-1" />
              Create Team
            </Button>
          </div>
        ) : (
          /* Team grid */
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {teams.map((team) => {
              const members = parseMembers(team.members);
              return (
                <Card
                  key={team.id}
                  className="group cursor-pointer hover:border-primary/40 transition-colors"
                  onClick={() => handleEdit(team)}
                >
                  <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">
                      {team.name}
                    </CardTitle>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEdit(team);
                        }}
                      >
                        <Edit className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={(e) => handleDelete(e, team.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {team.description && (
                      <p className="text-xs text-muted-foreground mb-3 line-clamp-2">
                        {team.description}
                      </p>
                    )}
                    <div className="flex items-center justify-between">
                      {/* Member avatars */}
                      <div className="flex -space-x-2">
                        {members.slice(0, 5).map((m, i) => (
                          <Avatar
                            key={i}
                            className="h-7 w-7 border-2 border-background"
                          >
                            <AvatarFallback className="text-[10px]">
                              {getInitials(m.name)}
                            </AvatarFallback>
                          </Avatar>
                        ))}
                        {members.length > 5 && (
                          <Avatar className="h-7 w-7 border-2 border-background">
                            <AvatarFallback className="text-[10px]">
                              +{members.length - 5}
                            </AvatarFallback>
                          </Avatar>
                        )}
                      </div>
                      {/* Member count */}
                      <Badge variant="secondary" className="text-xs">
                        {members.length}{' '}
                        {members.length === 1 ? 'member' : 'members'}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal */}
      <TeamModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        team={editingTeam}
        onSaved={handleSaved}
      />
    </div>
  );
}
