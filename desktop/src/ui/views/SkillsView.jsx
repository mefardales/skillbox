import React, { useState, useMemo, useCallback } from 'react';
import { Search, Plus, GitBranch, Zap } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useStore } from '@/hooks/useStore';
import { useToast } from '@/hooks/useToast';
import { electronAPI } from '@/lib/electronAPI';
import { catColors, simpleMarkdown } from '@/lib/utils';
import SkillDetailPanel from '@/components/SkillDetailPanel';
import SkillModal from '@/components/SkillModal';

const categoryColors = {
  frontend: '#f97316',
  backend: '#3b82f6',
  data: '#14b8a6',
  devops: '#22c55e',
  testing: '#a855f7',
  general: '#6b7280',
  mobile: '#ef4444',
  security: '#eab308',
};

const categoryList = ['All', 'Frontend', 'Backend', 'Data', 'DevOps', 'Testing', 'General', 'Mobile', 'Security'];

export default function SkillsView() {
  const { registry, setRegistry, activeProjectPath, refresh } = useStore();
  const { toast } = useToast();

  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('');
  const [selectedSkillId, setSelectedSkillId] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingSkill, setEditingSkill] = useState(null);
  const [gitImportOpen, setGitImportOpen] = useState(false);
  const [gitUrl, setGitUrl] = useState('');

  const skills = registry?.skills || [];

  const filtered = useMemo(() => {
    let result = skills;
    if (activeCategory) {
      result = result.filter(s => s.category === activeCategory.toLowerCase());
    }
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(s =>
        s.name?.toLowerCase().includes(q) ||
        s.description?.toLowerCase().includes(q) ||
        (s.tags || []).some(t => t.toLowerCase().includes(q))
      );
    }
    return result;
  }, [skills, activeCategory, search]);

  const selectedSkill = useMemo(
    () => skills.find(s => s.id === selectedSkillId) || null,
    [skills, selectedSkillId]
  );

  const handleCreateSkill = useCallback(() => {
    setEditingSkill(null);
    setModalOpen(true);
  }, []);

  const handleImportGit = useCallback(async () => {
    if (!gitUrl?.trim()) {
      setGitImportOpen(true);
      return;
    }
    try {
      const result = await electronAPI.cloneSkillFromGit(gitUrl.trim());
      if (result.success) {
        toast(`Imported ${result.imported.length} skill(s): ${result.imported.map(s => s.name).join(', ')}`);
        await refresh();
      } else {
        toast(result.error || 'Import failed', 'error');
      }
    } catch (err) {
      toast('Git import failed: ' + err.message, 'error');
    }
    setGitUrl('');
    setGitImportOpen(false);
  }, [gitUrl, toast, refresh]);

  const handleSaveSkill = useCallback(async (data) => {
    try {
      if (editingSkill?.id) {
        await electronAPI.updateSkill(editingSkill.id, data);
        toast('Skill updated');
      } else {
        await electronAPI.createSkill(data);
        toast('Skill created');
      }
      setModalOpen(false);
      setEditingSkill(null);
      await refresh();
    } catch (err) {
      toast('Save failed: ' + err.message, 'error');
    }
  }, [editingSkill, toast, refresh]);

  const handleDeleteSkill = useCallback(async (id) => {
    try {
      await electronAPI.deleteSkill(id);
      toast('Skill deleted');
      setModalOpen(false);
      setEditingSkill(null);
      setSelectedSkillId(null);
      await refresh();
    } catch (err) {
      toast('Delete failed: ' + err.message, 'error');
    }
  }, [toast, refresh]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">Skills</h2>
        </div>
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            placeholder="Search skills..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-8 h-7 text-xs"
          />
        </div>
        <div className="flex items-center gap-1.5 ml-auto">
          <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5" onClick={handleImportGit}>
            <GitBranch className="w-3.5 h-3.5" />
            Import from Git
          </Button>
          <Button size="sm" className="h-7 text-xs gap-1.5" onClick={handleCreateSkill}>
            <Plus className="w-3.5 h-3.5" />
            Create Skill
          </Button>
        </div>
      </div>

      {/* Category pills */}
      <div className="flex items-center gap-1.5 px-4 py-2 border-b border-border shrink-0 overflow-x-auto">
        {categoryList.map(cat => {
          const catKey = cat === 'All' ? '' : cat;
          const isActive = activeCategory === catKey;
          const color = categoryColors[cat.toLowerCase()];
          return (
            <button
              key={cat}
              onClick={() => setActiveCategory(catKey)}
              className={`
                inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium
                transition-colors whitespace-nowrap
                ${isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'
                }
              `}
            >
              {color && cat !== 'All' && (
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: color }}
                />
              )}
              {cat}
            </button>
          );
        })}
      </div>

      {/* Skills grid */}
      <ScrollArea className="flex-1">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <Zap className="w-8 h-8 mb-3 opacity-40" />
            <p className="text-sm">No skills found</p>
            <p className="text-xs mt-1">Try adjusting your search or filters</p>
          </div>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-3 p-4">
            {filtered.map(skill => {
              const cat = skill.category || 'general';
              const color = categoryColors[cat] || categoryColors.general;
              return (
                <Card
                  key={skill.id}
                  className="p-3 cursor-pointer hover:bg-muted/50 transition-colors border-border"
                  onClick={() => setSelectedSkillId(skill.id)}
                >
                  <div className="flex items-start gap-2.5 mb-2">
                    <div
                      className="w-8 h-8 rounded-md flex items-center justify-center text-xs font-bold text-white shrink-0"
                      style={{ backgroundColor: color }}
                    >
                      {cat[0].toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-medium text-foreground truncate">
                          {skill.name}
                        </span>
                        {skill.isCustom && (
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                            Custom
                          </Badge>
                        )}
                      </div>
                      <Badge
                        variant="outline"
                        className="text-[10px] px-1.5 py-0 h-4 mt-0.5"
                        style={{ borderColor: color, color }}
                      >
                        {cat}
                      </Badge>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                    {skill.description || 'No description'}
                  </p>
                  {skill.installCount != null && (
                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                      <Download className="w-3 h-3" />
                      {skill.installCount}
                    </div>
                  )}
                  {(skill.tags || []).length > 0 && (
                    <div className="flex items-center gap-1 flex-wrap mt-1.5">
                      {skill.tags.slice(0, 3).map(tag => (
                        <span
                          key={tag}
                          className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </ScrollArea>

      {/* Detail panel */}
      {selectedSkill && (
        <SkillDetailPanel
          skill={selectedSkill}
          activeProjectPath={activeProjectPath}
          onClose={() => setSelectedSkillId(null)}
          onInstall={async () => {
            if (!activeProjectPath || !selectedSkill) return;
            try {
              const r = await electronAPI.installSkillToProject(activeProjectPath, selectedSkill.id);
              toast(`Installed to ${r.installed} tool locations`);
            } catch (err) {
              toast('Install failed: ' + err.message, 'error');
            }
          }}
        />
      )}

      {/* Create/Edit modal */}
      <SkillModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        skill={editingSkill}
        onSave={handleSaveSkill}
        onDelete={editingSkill?.id ? () => handleDeleteSkill(editingSkill.id) : undefined}
      />
    </div>
  );
}
