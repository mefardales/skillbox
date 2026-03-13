import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const categories = [
  'frontend',
  'backend',
  'data',
  'devops',
  'testing',
  'general',
  'mobile',
  'security',
];

export default function SkillModal({ open, onOpenChange, skill, onSave, onDelete }) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('general');
  const [description, setDescription] = useState('');
  const [content, setContent] = useState('');
  const [tags, setTags] = useState('');

  const isEditing = !!skill?.id;

  useEffect(() => {
    if (open) {
      if (skill) {
        setName(skill.name || '');
        setCategory(skill.category || 'general');
        setDescription(skill.description || '');
        setContent(skill.content || '');
        setTags((skill.tags || []).join(', '));
      } else {
        setName('');
        setCategory('general');
        setDescription('');
        setContent('');
        setTags('');
      }
    }
  }, [open, skill]);

  const handleSave = () => {
    if (!name.trim()) return;
    onSave({
      name: name.trim(),
      category,
      description: description.trim(),
      content,
      tags: tags.split(',').map(t => t.trim()).filter(Boolean),
      version: '1.0',
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-sm">
            {isEditing ? 'Edit Skill' : 'New Skill'}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 py-2">
          {/* Name */}
          <div className="space-y-1.5">
            <Label htmlFor="skill-name" className="text-xs">Name</Label>
            <Input
              id="skill-name"
              placeholder="Skill name"
              value={name}
              onChange={e => setName(e.target.value)}
              className="h-8 text-xs"
            />
          </div>

          {/* Category */}
          <div className="space-y-1.5">
            <Label htmlFor="skill-category" className="text-xs">Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {categories.map(cat => (
                  <SelectItem key={cat} value={cat} className="text-xs">
                    {cat.charAt(0).toUpperCase() + cat.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="skill-desc" className="text-xs">Description</Label>
            <Textarea
              id="skill-desc"
              placeholder="Brief description of this skill..."
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="text-xs min-h-[60px] resize-none"
              rows={2}
            />
          </div>

          {/* Content */}
          <div className="space-y-1.5">
            <Label htmlFor="skill-content" className="text-xs">Content (Markdown)</Label>
            <Textarea
              id="skill-content"
              placeholder="# Skill content in markdown..."
              value={content}
              onChange={e => setContent(e.target.value)}
              className="text-xs font-mono min-h-[160px] resize-y"
              rows={8}
            />
          </div>

          {/* Tags */}
          <div className="space-y-1.5">
            <Label htmlFor="skill-tags" className="text-xs">Tags (comma-separated)</Label>
            <Input
              id="skill-tags"
              placeholder="react, hooks, state"
              value={tags}
              onChange={e => setTags(e.target.value)}
              className="h-8 text-xs"
            />
          </div>
        </div>

        <DialogFooter className="flex items-center gap-2 pt-2">
          {isEditing && onDelete && (
            <Button
              variant="destructive"
              size="sm"
              className="h-7 text-xs mr-auto"
              onClick={onDelete}
            >
              Delete
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            className="h-7 text-xs"
            onClick={handleSave}
            disabled={!name.trim()}
          >
            {isEditing ? 'Save Changes' : 'Create Skill'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
