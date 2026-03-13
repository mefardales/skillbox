import React, { useState, useEffect } from 'react';
import { Trash2, UserPlus, Shield } from 'lucide-react';
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
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/useToast';
import { electronAPI } from '@/lib/electronAPI';

const MEMBER_ROLES = [
  { value: 'lead', label: 'Lead' },
  { value: 'developer', label: 'Developer' },
  { value: 'designer', label: 'Designer' },
  { value: 'qa', label: 'QA' },
  { value: 'devops', label: 'DevOps' },
  { value: 'pm', label: 'PM' },
];

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

export function TeamModal({ open, onOpenChange, team, onSaved }) {
  const { toast } = useToast();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [members, setMembers] = useState([]);
  const [saving, setSaving] = useState(false);

  const isEditing = !!team;

  useEffect(() => {
    if (open) {
      if (team) {
        setName(team.name || '');
        setDescription(team.description || '');
        setMembers(parseMembers(team.members).map((m) => ({ ...m })));
      } else {
        setName('');
        setDescription('');
        setMembers([]);
      }
    }
  }, [open, team]);

  function addMember() {
    setMembers((prev) => [...prev, { name: '', role: 'developer' }]);
  }

  function removeMember(index) {
    setMembers((prev) => prev.filter((_, i) => i !== index));
  }

  function updateMember(index, field, value) {
    setMembers((prev) =>
      prev.map((m, i) => (i === index ? { ...m, [field]: value } : m))
    );
  }

  async function handleSave() {
    const trimmedName = name.trim();
    if (!trimmedName) {
      toast('Team name is required', 'error');
      return;
    }

    setSaving(true);
    try {
      const data = {
        name: trimmedName,
        description: description.trim(),
        members: members.filter((m) => m.name.trim()),
      };

      let updatedTeams;
      if (isEditing) {
        updatedTeams = await electronAPI.updateTeam(team.id, data);
        toast('Team updated');
      } else {
        updatedTeams = await electronAPI.createTeam(data);
        toast('Team created');
      }
      onSaved(updatedTeams);
    } catch (err) {
      toast('Failed to save team', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!isEditing) return;
    try {
      const updatedTeams = await electronAPI.deleteTeam(team.id);
      toast('Team deleted');
      onSaved(updatedTeams);
    } catch (err) {
      toast('Failed to delete team', 'error');
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[540px]">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Team' : 'New Team'}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          {/* Team name */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="team-name">Team Name</Label>
            <Input
              id="team-name"
              placeholder="e.g. Frontend Squad"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          {/* Description */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="team-desc">Description</Label>
            <Textarea
              id="team-desc"
              placeholder="What does this team do?"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {/* Members */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-1.5">
                <Shield className="h-3.5 w-3.5 text-muted-foreground" />
                Members
              </Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={addMember}
              >
                <UserPlus className="h-3.5 w-3.5 mr-1" />
                Add Member
              </Button>
            </div>

            <ScrollArea className="max-h-[240px]">
              {members.length === 0 ? (
                <p className="text-xs text-muted-foreground py-3 text-center">
                  No members added yet
                </p>
              ) : (
                <div className="flex flex-col gap-2">
                  {members.map((member, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-2 rounded-md border border-border p-2"
                    >
                      {/* Name input */}
                      <Input
                        className="flex-1 h-8 text-sm"
                        placeholder="Name"
                        value={member.name}
                        onChange={(e) =>
                          updateMember(index, 'name', e.target.value)
                        }
                      />
                      {/* Role select */}
                      <Select
                        value={member.role || 'developer'}
                        onValueChange={(val) =>
                          updateMember(index, 'role', val)
                        }
                      >
                        <SelectTrigger className="w-[130px] h-8 text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {MEMBER_ROLES.map((role) => (
                            <SelectItem key={role.value} value={role.value}>
                              {role.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {/* Remove button */}
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0 text-destructive hover:text-destructive"
                        onClick={() => removeMember(index)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        </div>

        <DialogFooter className="flex items-center justify-between sm:justify-between">
          {isEditing ? (
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={handleDelete}
            >
              <Trash2 className="h-3.5 w-3.5 mr-1" />
              Delete
            </Button>
          ) : (
            <div />
          )}
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
