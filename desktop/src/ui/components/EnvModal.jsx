import React, { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Trash2, Plus, Upload, Download, Key, RefreshCw } from 'lucide-react';
import { useStore } from '@/hooks/useStore';
import { useToast } from '@/hooks/useToast';
import { electronAPI } from '@/lib/electronAPI';

export default function EnvModal({ open, onClose, projectPath }) {
  const { projects, setProjects } = useStore();
  const { toast } = useToast();

  const [environments, setEnvironments] = useState({});
  const [activeEnv, setActiveEnv] = useState('DEV');
  const [vars, setVars] = useState([]);
  const [saving, setSaving] = useState(false);

  const project = projects.find((p) => p.path === projectPath);

  const loadEnvironments = useCallback(async () => {
    if (!projectPath) return;
    const data = await electronAPI.getEnvironments(projectPath);
    const envs = data.environments || {};
    setEnvironments(envs);
    const active = data.activeEnv || Object.keys(envs)[0] || 'DEV';
    setActiveEnv(active);
    setVars(
      Object.entries(envs[active] || {}).map(([key, value]) => ({
        key,
        value,
        id: crypto.randomUUID(),
      }))
    );
  }, [projectPath]);

  useEffect(() => {
    if (open && projectPath) {
      loadEnvironments();
    }
  }, [open, projectPath, loadEnvironments]);

  function switchEnv(envName) {
    // Save current vars before switching
    saveCurrentVars();
    setActiveEnv(envName);
    setVars(
      Object.entries(environments[envName] || {}).map(([key, value]) => ({
        key,
        value,
        id: crypto.randomUUID(),
      }))
    );
  }

  function getVarsObject() {
    const obj = {};
    for (const v of vars) {
      const k = v.key.trim();
      if (k) obj[k] = v.value;
    }
    return obj;
  }

  async function saveCurrentVars() {
    if (!projectPath) return;
    const obj = getVarsObject();
    const updated = await electronAPI.saveEnvironment(
      projectPath,
      activeEnv,
      obj
    );
    if (updated) setProjects(updated);
  }

  function addVar() {
    setVars((prev) => [
      ...prev,
      { key: '', value: '', id: crypto.randomUUID() },
    ]);
  }

  function updateVar(id, field, val) {
    setVars((prev) =>
      prev.map((v) => (v.id === id ? { ...v, [field]: val } : v))
    );
  }

  function removeVar(id) {
    setVars((prev) => prev.filter((v) => v.id !== id));
  }

  const [newEnvName, setNewEnvName] = useState('');
  const [showNewEnv, setShowNewEnv] = useState(false);

  async function handleAddEnvironment() {
    if (!showNewEnv) { setShowNewEnv(true); return; }
    if (!newEnvName?.trim()) return;
    const envName = newEnvName.trim().toUpperCase();
    setShowNewEnv(false);
    setNewEnvName('');
    const updated = await electronAPI.addEnvironment(projectPath, envName);
    if (updated) setProjects(updated);
    const data = await electronAPI.getEnvironments(projectPath);
    setEnvironments(data.environments || {});
    setActiveEnv(envName);
    setVars([]);
  }

  async function handleRemoveEnvironment(envName) {
    if (!confirm(`Remove environment "${envName}"?`)) return;
    const updated = await electronAPI.removeEnvironment(projectPath, envName);
    if (updated) setProjects(updated);
    const data = await electronAPI.getEnvironments(projectPath);
    const envs = data.environments || {};
    setEnvironments(envs);
    const next = Object.keys(envs)[0] || 'DEV';
    setActiveEnv(next);
    setVars(
      Object.entries(envs[next] || {}).map(([key, value]) => ({
        key,
        value,
        id: crypto.randomUUID(),
      }))
    );
  }

  async function handleSyncToFile() {
    setSaving(true);
    try {
      await saveCurrentVars();
      await electronAPI.syncEnvFile(projectPath, activeEnv);
      toast('Synced to .env file');
    } finally {
      setSaving(false);
    }
  }

  async function handleImportFromFile() {
    const imported = await electronAPI.importEnvFile(projectPath, activeEnv);
    if (imported && Object.keys(imported).length > 0) {
      setVars(
        Object.entries(imported).map(([key, value]) => ({
          key,
          value,
          id: crypto.randomUUID(),
        }))
      );
      toast('Imported .env file');
    } else {
      toast('No .env file found');
    }
  }

  function handleClose() {
    saveCurrentVars();
    onClose();
  }

  const envNames = Object.keys(environments);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm">
            <Key className="w-4 h-4" />
            Environment Variables
            {project && (
              <span className="text-muted-foreground font-normal">
                — {project.name}
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        {/* Environment Tabs */}
        <div className="flex items-center gap-1 border-b border-border pb-2">
          {envNames.map((name) => (
            <button
              key={name}
              onClick={() => switchEnv(name)}
              className={`px-3 py-1 text-xs rounded transition-colors ${
                name === activeEnv
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent'
              }`}
            >
              {name}
            </button>
          ))}
          <button
            onClick={handleAddEnvironment}
            className="px-2 py-1 text-xs text-muted-foreground hover:bg-accent rounded"
            title="Add environment"
          >
            <Plus className="w-3 h-3" />
          </button>
          {envNames.length > 1 && (
            <button
              onClick={() => handleRemoveEnvironment(activeEnv)}
              className="ml-auto px-2 py-1 text-xs text-muted-foreground hover:text-red-400 rounded"
              title="Remove this environment"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* Variable List */}
        <ScrollArea className="max-h-[300px]">
          <div className="space-y-2">
            {vars.length === 0 && (
              <p className="text-xs text-muted-foreground py-3 text-center">
                No variables set. Click &quot;+ Add variable&quot; to start.
              </p>
            )}
            {vars.map((v) => (
              <div key={v.id} className="flex items-center gap-2">
                <Input
                  value={v.key}
                  onChange={(e) => updateVar(v.id, 'key', e.target.value)}
                  placeholder="KEY"
                  className="h-7 text-xs font-mono flex-[2]"
                />
                <Input
                  value={v.value}
                  onChange={(e) => updateVar(v.id, 'value', e.target.value)}
                  placeholder="value"
                  className="h-7 text-xs font-mono flex-[3]"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeVar(v.id)}
                  className="h-7 w-7 p-0 text-muted-foreground hover:text-red-400"
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            ))}
          </div>
        </ScrollArea>

        <Button
          variant="ghost"
          size="sm"
          onClick={addVar}
          className="h-7 text-xs w-full"
        >
          <Plus className="w-3 h-3 mr-1" />
          Add variable
        </Button>

        <Separator />

        <DialogFooter className="flex items-center justify-between gap-2 sm:justify-between">
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleSyncToFile}
              disabled={saving}
              className="h-7 text-xs"
            >
              <Download className="w-3 h-3 mr-1" />
              Sync to .env
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleImportFromFile}
              className="h-7 text-xs"
            >
              <Upload className="w-3 h-3 mr-1" />
              Import .env
            </Button>
          </div>
          <Button size="sm" onClick={handleClose} className="h-7 text-xs">
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
