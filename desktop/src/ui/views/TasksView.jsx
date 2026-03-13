import React, { useState, useCallback, useMemo } from 'react';
import { Plus, GripVertical, Calendar, User, Flag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { useStore } from '@/hooks/useStore';
import { useToast } from '@/hooks/useToast';
import { electronAPI } from '@/lib/electronAPI';
import { TaskModal } from '@/components/TaskModal';

const STATUS_COLUMNS = [
  { key: 'todo', label: 'To Do', color: 'bg-slate-400' },
  { key: 'in_progress', label: 'In Progress', color: 'bg-blue-500' },
  { key: 'review', label: 'In Review', color: 'bg-amber-500' },
  { key: 'done', label: 'Done', color: 'bg-green-500' },
];

const STATUS_LABELS = {
  todo: 'To Do',
  in_progress: 'In Progress',
  review: 'In Review',
  done: 'Done',
};

const PRIORITY_COLORS = {
  critical: 'bg-red-500/20 text-red-400 border-red-500/30',
  high: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  medium: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  low: 'bg-green-500/20 text-green-400 border-green-500/30',
};

const PRIORITY_ORDER = { critical: 0, high: 1, medium: 2, low: 3 };

export function TasksView() {
  const { tasks, setTasks, projects, activeProjectPath } = useStore();
  const { toast } = useToast();
  const [filterProject, setFilterProject] = useState('__all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [draggedTaskId, setDraggedTaskId] = useState(null);

  const filteredTasks = useMemo(() => {
    let list = tasks || [];
    if (filterProject && filterProject !== '__all') {
      list = list.filter((t) => t.project_path === filterProject);
    }
    return list.sort(
      (a, b) =>
        (PRIORITY_ORDER[a.priority] ?? 2) - (PRIORITY_ORDER[b.priority] ?? 2)
    );
  }, [tasks, filterProject]);

  const tasksByStatus = useMemo(() => {
    const groups = {};
    for (const col of STATUS_COLUMNS) {
      groups[col.key] = [];
    }
    for (const t of filteredTasks) {
      const status = t.status || 'todo';
      if (!groups[status]) groups[status] = [];
      groups[status].push(t);
    }
    return groups;
  }, [filteredTasks]);

  const refreshTasks = useCallback(async () => {
    const updated = await electronAPI.getTasks();
    setTasks(updated);
  }, [setTasks]);

  const handleNewTask = () => {
    setEditingTask(null);
    setModalOpen(true);
  };

  const handleEditTask = (task) => {
    setEditingTask(task);
    setModalOpen(true);
  };

  const handleSave = async (data) => {
    if (editingTask) {
      await electronAPI.updateTask(editingTask.id, data);
      toast('Task updated');
    } else {
      await electronAPI.createTask(data);
      toast('Task created');
    }
    setModalOpen(false);
    setEditingTask(null);
    await refreshTasks();
  };

  const handleDelete = async (taskId) => {
    await electronAPI.deleteTask(taskId);
    toast('Task deleted');
    setModalOpen(false);
    setEditingTask(null);
    await refreshTasks();
  };

  // Drag and drop handlers
  const handleDragStart = (e, taskId) => {
    setDraggedTaskId(taskId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', taskId);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (e, targetStatus) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('text/plain');
    if (!taskId) return;

    const task = (tasks || []).find((t) => t.id === taskId);
    if (!task || task.status === targetStatus) {
      setDraggedTaskId(null);
      return;
    }

    await electronAPI.updateTask(taskId, { status: targetStatus });
    toast(`Moved to ${STATUS_LABELS[targetStatus]}`);
    setDraggedTaskId(null);
    await refreshTasks();
  };

  const handleDragEnd = () => {
    setDraggedTaskId(null);
  };

  const getProjectName = (projectPath) => {
    const proj = (projects || []).find((p) => p.path === projectPath);
    return proj?.name || '';
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
        <h2 className="text-sm font-semibold text-foreground">Tasks</h2>
        <div className="flex items-center gap-2">
          <Select value={filterProject} onValueChange={setFilterProject}>
            <SelectTrigger className="h-7 w-[180px] text-xs">
              <SelectValue placeholder="All projects" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all">All projects</SelectItem>
              {(projects || []).map((p) => (
                <SelectItem key={p.path} value={p.path}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" className="h-7 text-xs gap-1" onClick={handleNewTask}>
            <Plus className="w-3.5 h-3.5" />
            New Task
          </Button>
        </div>
      </div>

      {/* Kanban columns */}
      <ScrollArea className="flex-1">
        <div className="grid grid-cols-4 gap-3 p-4 min-h-full">
          {STATUS_COLUMNS.map((col) => (
            <div
              key={col.key}
              className="flex flex-col min-h-[200px] rounded-md bg-surface/50 border border-border"
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, col.key)}
            >
              {/* Column header */}
              <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
                <span className={`w-2 h-2 rounded-full ${col.color}`} />
                <span className="text-xs font-medium text-foreground">
                  {col.label}
                </span>
                <span className="text-[10px] text-muted-foreground ml-auto">
                  {tasksByStatus[col.key]?.length || 0}
                </span>
              </div>

              {/* Cards */}
              <div className="flex flex-col gap-1.5 p-2 flex-1">
                {(tasksByStatus[col.key] || []).map((task) => (
                  <Card
                    key={task.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, task.id)}
                    onDragEnd={handleDragEnd}
                    onClick={() => handleEditTask(task)}
                    className={`p-2.5 cursor-pointer hover:bg-accent/50 transition-colors border-border ${
                      draggedTaskId === task.id ? 'opacity-40' : ''
                    }`}
                  >
                    <div className="flex items-start gap-1.5">
                      <GripVertical className="w-3 h-3 text-muted-foreground mt-0.5 shrink-0 cursor-grab" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-foreground truncate">
                          {task.title}
                        </p>

                        <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                          {/* Priority badge */}
                          <Badge
                            variant="outline"
                            className={`text-[10px] px-1 py-0 h-4 ${
                              PRIORITY_COLORS[task.priority] || PRIORITY_COLORS.medium
                            }`}
                          >
                            <Flag className="w-2.5 h-2.5 mr-0.5" />
                            {task.priority}
                          </Badge>

                          {/* Assignee */}
                          {task.assignee && (
                            <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                              <User className="w-2.5 h-2.5" />
                              {task.assignee}
                            </span>
                          )}

                          {/* Project name */}
                          {getProjectName(task.project_path) && (
                            <span className="text-[10px] text-muted-foreground truncate max-w-[80px]">
                              {getProjectName(task.project_path)}
                            </span>
                          )}

                          {/* Due date */}
                          {task.due_date && (
                            <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                              <Calendar className="w-2.5 h-2.5" />
                              {task.due_date}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>

      {/* Task Modal */}
      <TaskModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        task={editingTask}
        projects={projects || []}
        activeProjectPath={activeProjectPath}
        onSave={handleSave}
        onDelete={handleDelete}
      />
    </div>
  );
}
