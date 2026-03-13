import React, { useEffect, useState, useCallback } from 'react';
import {
  FolderPlus,
  Zap,
  Users,
  Clock,
  ArrowRight,
  Activity,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useStore } from '@/hooks/useStore';
import { useToast } from '@/hooks/useToast';
import { electronAPI } from '@/lib/electronAPI';
import { formatDate } from '@/lib/utils';

function StatCard({ icon: Icon, label, value }) {
  return (
    <Card className="flex-1 min-w-0">
      <CardContent className="flex items-center gap-3 p-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted">
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground truncate">{label}</p>
          <p className="text-lg font-semibold leading-tight">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function ActivityItem({ detail, timestamp }) {
  const date = new Date(timestamp);
  const now = new Date();
  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday =
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear();

  const dayLabel = isToday
    ? 'Today'
    : isYesterday
      ? 'Yesterday'
      : date.toLocaleDateString();
  const time = date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="flex items-start gap-2 py-1.5">
      <div className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
      <span className="flex-1 text-sm text-foreground truncate">{detail}</span>
      <span className="shrink-0 text-xs text-muted-foreground whitespace-nowrap">
        {dayLabel} {time}
      </span>
    </div>
  );
}

function ProjectRow({ project, onClick }) {
  const stack =
    project.analysis?.stack?.map((s) => s.name).join(', ') || 'Not analyzed';

  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-left hover:bg-muted/50 transition-colors"
    >
      <FolderPlus className="h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium truncate">{project.name}</p>
        <p className="text-xs text-muted-foreground truncate">{stack}</p>
      </div>
    </button>
  );
}

export default function DashboardView() {
  const {
    projects,
    teams,
    history,
    activeProjectPath,
    setActiveProjectPath,
    setActiveView,
    refreshProjects,
  } = useStore();
  const { toast } = useToast();

  const skillsCount = projects.reduce(
    (acc, p) => acc + (p.skills?.length || 0),
    0
  );

  const activeProject = activeProjectPath
    ? projects.find((p) => p.path === activeProjectPath)
    : null;

  const handleSelectProject = useCallback(
    (path) => {
      setActiveProjectPath(path);
      setActiveView('projects');
    },
    [setActiveProjectPath, setActiveView]
  );

  const handleAddProject = useCallback(async () => {
    const folder = await electronAPI.browseFolder();
    if (!folder) return;
    toast('Loading project...', 'info');
    try {
      const result = await electronAPI.addProject(folder);
      await refreshProjects();
      setActiveProjectPath(folder);
      if (result?.isNew === false) {
        toast('Project already in workspace', 'info');
      } else {
        const name = folder.split(/[/\\]/).pop();
        toast(`Added "${name}" to workspace`, 'success');
      }
    } catch (err) {
      toast(`Failed to add project: ${err.message || err}`, 'error');
    }
  }, [setActiveProjectPath, refreshProjects, toast]);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <h1 className="text-sm font-semibold">Dashboard</h1>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {/* Stats row */}
          <div className="flex gap-3">
            <StatCard
              icon={FolderPlus}
              label="Projects"
              value={projects.length}
            />
            <StatCard icon={Users} label="Agents" value={teams.length} />
            <StatCard icon={Zap} label="Skills" value={skillsCount} />
          </div>

          {/* Quick actions */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={handleAddProject}
            >
              <FolderPlus className="mr-1.5 h-3 w-3" />
              Add Project
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={() => setActiveView('skills')}
            >
              <Zap className="mr-1.5 h-3 w-3" />
              Browse Skills
            </Button>
          </div>

          {/* Active project details */}
          {activeProject && (
            <Card>
              <CardHeader className="px-4 py-2.5">
                <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <Activity className="h-3 w-3" />
                  Active Project
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-3 pt-0">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{activeProject.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {activeProject.analysis?.stack
                        ?.map((s) => s.name)
                        .join(', ') || 'Not analyzed'}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs"
                    onClick={() => setActiveView('projects')}
                  >
                    Open
                    <ArrowRight className="ml-1 h-3 w-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="space-y-4">
            {/* Recent projects */}
            <Card>
              <CardHeader className="px-4 py-2.5">
                <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <FolderPlus className="h-3 w-3" />
                  Recent Projects
                </CardTitle>
              </CardHeader>
              <CardContent className="px-2 pb-3 pt-0">
                {projects.length === 0 ? (
                  <p className="text-xs text-muted-foreground px-2 py-4 text-center">
                    No projects yet. Add a project folder to get started.
                  </p>
                ) : (
                  <div className="space-y-0.5">
                    {projects.slice(0, 5).map((p) => (
                      <ProjectRow
                        key={p.path}
                        project={p}
                        onClick={() => handleSelectProject(p.path)}
                      />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

          </div>

          {/* Activity feed */}
          <Card>
            <CardHeader className="px-4 py-2.5">
              <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <Clock className="h-3 w-3" />
                Recent Activity
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-3 pt-0">
              {!history || history.length === 0 ? (
                <p className="text-xs text-muted-foreground py-4 text-center">
                  No recent activity
                </p>
              ) : (
                <div className="space-y-0">
                  {history.slice(0, 15).map((h, i) => (
                    <ActivityItem
                      key={h.id ?? i}
                      detail={h.detail}
                      timestamp={h.timestamp}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </ScrollArea>
    </div>
  );
}
