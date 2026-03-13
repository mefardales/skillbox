import React, { useState, useEffect } from 'react';
import { Trash2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';

const STATUS_OPTIONS = [
  { value: 'todo', label: 'To Do' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'review', label: 'In Review' },
  { value: 'done', label: 'Done' },
];

const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'critical', label: 'Critical' },
];

export function TaskModal({
  open,
  onOpenChange,
  task,
  projects,
  activeProjectPath,
  onSave,
  onDelete,
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState('todo');
  const [priority, setPriority] = useState('medium');
  const [projectPath, setProjectPath] = useState('');
  const [assignee, setAssignee] = useState('');

  const isEditing = !!task;

  useEffect(() => {
    if (open) {
      if (task) {
        setTitle(task.title || '');
        setDescription(task.description || '');
        setStatus(task.status || 'todo');
        setPriority(task.priority || 'medium');
        setProjectPath(task.project_path || '');
        setAssignee(task.assignee || '');
      } else {
        setTitle('');
        setDescription('');
        setStatus('todo');
        setPriority('medium');
        setProjectPath(activeProjectPath || (projects[0]?.path ?? ''));
        setAssignee('');
      }
    }
  }, [open, task, activeProjectPath, projects]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    if (!projectPath) return;

    onSave({
      title: title.trim(),
      description: description.trim(),
      status,
      priority,
      projectPath,
      assignee: assignee.trim() || null,
    });
  };

  const handleDelete = () => {
    if (task?.id) {
      onDelete(task.id);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="text-sm">
              {isEditing ? 'Edit Task' : 'New Task'}
            </DialogTitle>
          </DialogHeader>

          <div className="grid gap-3 py-4">
            {/* Title */}
            <div className="grid gap-1.5">
              <Label htmlFor="task-title" className="text-xs">
                Title
              </Label>
              <Input
                id="task-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Task title"
                className="h-8 text-xs"
                autoFocus
              />
            </div>

            {/* Description */}
            <div className="grid gap-1.5">
              <Label htmlFor="task-desc" className="text-xs">
                Description
              </Label>
              <Textarea
                id="task-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional description..."
                className="text-xs min-h-[80px] resize-none"
              />
            </div>

            {/* Status & Priority row */}
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label className="text-xs">Status</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-1.5">
                <Label className="text-xs">Priority</Label>
                <Select value={priority} onValueChange={setPriority}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRIORITY_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Project */}
            <div className="grid gap-1.5">
              <Label className="text-xs">Project</Label>
              <Select value={projectPath} onValueChange={setProjectPath}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Select project" />
                </SelectTrigger>
                <SelectContent>
                  {projects.length === 0 ? (
                    <SelectItem value="__none" disabled>
                      No projects
                    </SelectItem>
                  ) : (
                    projects.map((p) => (
                      <SelectItem key={p.path} value={p.path}>
                        {p.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Assignee */}
            <div className="grid gap-1.5">
              <Label htmlFor="task-assignee" className="text-xs">
                Assignee
              </Label>
              <Input
                id="task-assignee"
                value={assignee}
                onChange={(e) => setAssignee(e.target.value)}
                placeholder="Name or @handle"
                className="h-8 text-xs"
              />
            </div>
          </div>

          <DialogFooter className="flex items-center gap-2">
            {isEditing && (
              <Button
                type="button"
                variant="destructive"
                size="sm"
                className="mr-auto h-7 text-xs gap-1"
                onClick={handleDelete}
              >
                <Trash2 className="w-3 h-3" />
                Delete
              </Button>
            )}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" className="h-7 text-xs">
              {isEditing ? 'Save Changes' : 'Create Task'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
