import { useState, useEffect } from 'react';
import { Trash2, Plus, X, Bot, Zap } from 'lucide-react';
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
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useStore } from '@/hooks/useStore';
import { useToast } from '@/hooks/useToast';
import { electronAPI } from '@/lib/electronAPI';

const AGENT_ROLES = [
  'Backend Developer',
  'Frontend Developer',
  'Full-Stack Developer',
  'DevOps Engineer',
  'QA / Testing',
  'Data Engineer',
  'Code Reviewer',
  'Security Analyst',
  'General Assistant',
];

function parseSkills(members) {
  if (typeof members === 'string') {
    try { return JSON.parse(members); } catch { return []; }
  }
  return members || [];
}

export function AgentModal({ open, onOpenChange, agent, onSaved }) {
  const { registry } = useStore();
  const { toast } = useToast();
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [description, setDescription] = useState('');
  const [skills, setSkills] = useState([]);
  const [skillSearch, setSkillSearch] = useState('');
  const [saving, setSaving] = useState(false);

  const isEditing = !!agent;

  useEffect(() => {
    if (open) {
      if (agent) {
        setName(agent.name || '');
        setRole(agent.description || '');
        setDescription('');
        setSkills(parseSkills(agent.members));
      } else {
        setName('');
        setRole('');
        setDescription('');
        setSkills([]);
      }
      setSkillSearch('');
    }
  }, [open, agent]);

  // Available skills from registry, filtered by search
  const availableSkills = (registry?.skills || []).filter((s) => {
    const skillName = s.name || s.id || '';
    const alreadyAdded = skills.some((added) => {
      const addedName = typeof added === 'string' ? added : added?.name || added?.id || '';
      return addedName === (s.id || s.name);
    });
    if (alreadyAdded) return false;
    if (!skillSearch.trim()) return true;
    return skillName.toLowerCase().includes(skillSearch.toLowerCase()) ||
      (s.category || '').toLowerCase().includes(skillSearch.toLowerCase());
  });

  function addSkill(skill) {
    const skillId = skill.id || skill.name;
    setSkills((prev) => [...prev, { name: skillId, category: skill.category }]);
    setSkillSearch('');
  }

  function removeSkill(index) {
    setSkills((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSave() {
    const trimmedName = name.trim();
    if (!trimmedName) {
      toast('Agent name is required', 'error');
      return;
    }

    setSaving(true);
    try {
      // Store role in description field, skills in members field (backward compatible)
      const data = {
        name: trimmedName,
        description: role || 'General Assistant',
        members: skills,
      };

      let updatedTeams;
      if (isEditing) {
        updatedTeams = await electronAPI.updateTeam(agent.id, data);
        toast('Agent updated', 'success');
      } else {
        updatedTeams = await electronAPI.createTeam(data);
        toast('Agent created', 'success');
      }
      onSaved(updatedTeams);
    } catch {
      toast('Failed to save agent', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!isEditing) return;
    try {
      const updatedTeams = await electronAPI.deleteTeam(agent.id);
      toast('Agent deleted', 'success');
      onSaved(updatedTeams);
    } catch {
      toast('Failed to delete agent', 'error');
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bot className="h-4 w-4 text-primary" />
            {isEditing ? 'Edit Agent' : 'New Agent'}
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-1">
          {/* Name */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="agent-name" className="text-xs">Name</Label>
            <Input
              id="agent-name"
              placeholder="e.g. Backend Agent"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-8"
            />
          </div>

          {/* Role */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Role</Label>
            <div className="flex flex-wrap gap-1.5">
              {AGENT_ROLES.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRole(r)}
                  className={`px-2 py-1 text-[11px] rounded-md border transition-colors ${
                    role === r
                      ? 'bg-primary/15 border-primary/40 text-primary'
                      : 'border-border text-muted-foreground hover:border-primary/30 hover:text-foreground'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          {/* Skills */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs flex items-center gap-1.5">
              <Zap className="h-3 w-3" />
              Skills ({skills.length})
            </Label>

            {/* Selected skills */}
            {skills.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pb-1">
                {skills.map((s, i) => {
                  const sName = typeof s === 'string' ? s : s?.name || '';
                  const short = sName.includes('/') ? sName.split('/').pop() : sName;
                  return (
                    <Badge key={i} variant="secondary" className="text-[11px] px-2 py-0.5 gap-1 pr-1">
                      <Zap className="h-2.5 w-2.5" />
                      {short}
                      <button
                        type="button"
                        onClick={() => removeSkill(i)}
                        className="ml-0.5 rounded-sm hover:bg-accent p-0.5"
                      >
                        <X className="h-2.5 w-2.5" />
                      </button>
                    </Badge>
                  );
                })}
              </div>
            )}

            {/* Skill search */}
            <Input
              placeholder="Search skills to add..."
              value={skillSearch}
              onChange={(e) => setSkillSearch(e.target.value)}
              className="h-8 text-xs"
            />

            {/* Available skills list */}
            {(skillSearch.trim() || skills.length === 0) && (
              <ScrollArea className="max-h-[140px] rounded-md border border-border">
                {availableSkills.length === 0 ? (
                  <p className="text-[11px] text-muted-foreground py-3 text-center">
                    {skillSearch ? 'No matching skills' : 'No skills available'}
                  </p>
                ) : (
                  <div className="p-1">
                    {availableSkills.slice(0, 20).map((skill) => {
                      const displayName = (skill.name || skill.id || '').includes('/')
                        ? (skill.name || skill.id).split('/').pop()
                        : skill.name || skill.id;
                      return (
                        <button
                          key={skill.id || skill.name}
                          type="button"
                          onClick={() => addSkill(skill)}
                          className="flex items-center gap-2 w-full px-2 py-1.5 rounded text-left text-[12px] hover:bg-accent/60 transition-colors"
                        >
                          <Zap className="h-3 w-3 text-yellow-400 shrink-0" />
                          <span className="flex-1 truncate">{displayName}</span>
                          <span className="text-[10px] text-muted-foreground shrink-0">{skill.category}</span>
                          <Plus className="h-3 w-3 text-muted-foreground shrink-0" />
                        </button>
                      );
                    })}
                  </div>
                )}
              </ScrollArea>
            )}
          </div>
        </div>

        <DialogFooter className="flex items-center justify-between sm:justify-between">
          {isEditing ? (
            <Button type="button" variant="destructive" size="sm" className="h-7 text-xs" onClick={handleDelete}>
              <Trash2 className="h-3.5 w-3.5 mr-1" />
              Delete
            </Button>
          ) : (
            <div />
          )}
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="button" size="sm" className="h-7 text-xs" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : isEditing ? 'Save Changes' : 'Create Agent'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
