import React, { useState, useEffect, useCallback } from 'react';
import {
  Settings,
  Palette,
  Terminal,
  RotateCcw,
  Bot,
  Database,
  Trash2,
  FolderOpen,
  HardDrive,
  RefreshCw,
  Network,
  Copy,
  ExternalLink,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
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
import { applyTheme } from '@/lib/utils';

const ACCENT_COLORS = [
  { value: 'blue', label: 'Blue', swatch: 'bg-blue-500' },
  { value: 'indigo', label: 'Indigo', swatch: 'bg-indigo-500' },
  { value: 'cyan', label: 'Cyan', swatch: 'bg-cyan-500' },
  { value: 'teal', label: 'Teal', swatch: 'bg-teal-500' },
  { value: 'green', label: 'Green', swatch: 'bg-green-500' },
  { value: 'orange', label: 'Orange', swatch: 'bg-orange-500' },
  { value: 'red', label: 'Red', swatch: 'bg-red-500' },
  { value: 'pink', label: 'Pink', swatch: 'bg-pink-500' },
  { value: 'purple', label: 'Purple', swatch: 'bg-purple-500' },
  { value: 'yellow', label: 'Yellow', swatch: 'bg-yellow-500' },
  { value: 'mint', label: 'Mint', swatch: 'bg-emerald-400' },
];

const GRAY_SCALES = [
  { value: 'slate', label: 'Slate' },
  { value: 'mauve', label: 'Mauve' },
  { value: 'sage', label: 'Sage' },
  { value: 'olive', label: 'Olive' },
  { value: 'sand', label: 'Sand' },
];

const FONT_FAMILIES = [
  { value: "'SF Mono', monospace", label: 'SF Mono' },
  { value: "'JetBrains Mono', monospace", label: 'JetBrains Mono' },
  { value: "'Fira Code', monospace", label: 'Fira Code' },
  { value: "'Cascadia Code', monospace", label: 'Cascadia Code' },
  { value: "'Source Code Pro', monospace", label: 'Source Code Pro' },
  { value: 'monospace', label: 'System Monospace' },
];

const AI_TOOLS = [
  { id: 'claude', label: 'Claude Code', file: 'CLAUDE.md' },
  { id: 'cursor', label: 'Cursor', file: '.cursorrules' },
  { id: 'copilot', label: 'GitHub Copilot', file: '.github/copilot-instructions.md' },
  { id: 'windsurf', label: 'Windsurf', file: '.windsurfrules' },
  { id: 'generic', label: 'Generic', file: 'AGENTS.md' },
];

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function timeAgo(isoString) {
  if (!isoString) return 'Never';
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

const DEFAULT_SETTINGS = {
  'workbench.mode': 'dark',
  'workbench.accent': 'blue',
  'workbench.gray': 'slate',
  'editor.fontSize': 13,
  'editor.fontFamily': "'SF Mono', monospace",
  'editor.tabSize': 2,
  'editor.wordWrap': 'off',
  'editor.minimap': true,
  'editor.lineNumbers': 'on',
  'terminal.fontSize': 13,
  'terminal.shell': '',
  'terminal.cursorStyle': 'block',
};

function SettingsSection({ icon: Icon, title, children }) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 mb-3">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-medium">{title}</h3>
      </div>
      <div className="space-y-4">{children}</div>
    </Card>
  );
}

function SettingsRow({ label, description, children }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex-1 min-w-0">
        <Label className="text-sm">{label}</Label>
        {description && (
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        )}
      </div>
      <div className="flex-shrink-0">{children}</div>
    </div>
  );
}

export function SettingsView() {
  const { settings: globalSettings, setSettings: globalSetSettings } = useStore();
  const { toast } = useToast();
  const [settings, setSettings] = useState(null);
  const [dirty, setDirty] = useState(false);

  const loadSettings = useCallback(async () => {
    const s = await electronAPI.getSettings();
    setSettings(s);
    setDirty(false);
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const update = useCallback(
    (key, value) => {
      setSettings((prev) => ({ ...prev, [key]: value }));
      setDirty(true);
    },
    []
  );

  const handleSave = useCallback(async () => {
    if (!settings) return;
    try {
      await electronAPI.saveSettings(settings);
      toast('Settings saved', 'success');
      setDirty(false);
      applyTheme(settings);
      // Sync to global store so other components pick up changes
      globalSetSettings(settings);
    } catch (e) {
      toast('Failed to save settings: ' + e.message, 'error');
    }
  }, [settings, toast, globalSetSettings]);

  const handleReset = useCallback(async () => {
    try {
      const defaults = await electronAPI.getDefaultSettings();
      await electronAPI.saveSettings(defaults);
      setSettings(defaults);
      setDirty(false);
      toast('Settings reset to defaults', 'success');
      applyTheme(defaults);
      globalSetSettings(defaults);
    } catch (e) {
      toast('Failed to reset settings: ' + e.message, 'error');
    }
  }, [toast, globalSetSettings]);

  if (!settings) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
        Loading settings...
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <Settings className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">Settings</h2>
          {dirty && (
            <span className="text-xs text-amber-400 ml-2">Unsaved changes</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={handleReset}>
            <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
            Reset to Defaults
          </Button>
          <Button size="sm" onClick={handleSave} disabled={!dirty}>
            Save Settings
          </Button>
        </div>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1">
        <div className="max-w-2xl mx-auto p-5 space-y-4">
          {/* Appearance */}
          <SettingsSection icon={Palette} title="Appearance">
            <SettingsRow label="Theme Mode" description="Switch between dark and light mode">
              <Select
                value={settings['workbench.mode'] || 'dark'}
                onValueChange={(v) => update('workbench.mode', v)}
              >
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="dark">Dark</SelectItem>
                  <SelectItem value="light">Light</SelectItem>
                </SelectContent>
              </Select>
            </SettingsRow>

            <Separator />

            <SettingsRow label="Accent Color" description="Primary accent color for the UI">
              <div className="flex flex-wrap items-center gap-1.5">
                {ACCENT_COLORS.map((c) => (
                  <button
                    key={c.value}
                    title={c.label}
                    className={`w-6 h-6 rounded-full ${c.swatch} ring-offset-background transition-all ${
                      settings['workbench.accent'] === c.value
                        ? 'ring-2 ring-ring ring-offset-2'
                        : 'hover:ring-1 hover:ring-ring hover:ring-offset-1'
                    }`}
                    onClick={() => update('workbench.accent', c.value)}
                  />
                ))}
                {/* Custom color picker */}
                <div className="relative inline-flex items-center justify-center w-6 h-6 shrink-0">
                  <button
                    title="Custom color"
                    className={`w-6 h-6 rounded-full ring-offset-background transition-all overflow-hidden ${
                      settings['workbench.accent']?.startsWith('#')
                        ? 'ring-2 ring-ring ring-offset-2'
                        : 'ring-1 ring-border hover:ring-ring hover:ring-offset-1'
                    }`}
                    style={{
                      background: settings['workbench.accent']?.startsWith('#')
                        ? settings['workbench.accent']
                        : 'conic-gradient(from 0deg, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)',
                    }}
                    onClick={() => document.getElementById('accent-color-input')?.click()}
                  />
                  <input
                    id="accent-color-input"
                    type="color"
                    className="absolute inset-0 w-6 h-6 opacity-0 cursor-pointer"
                    value={settings['workbench.accent']?.startsWith('#') ? settings['workbench.accent'] : '#3b82f6'}
                    onChange={(e) => update('workbench.accent', e.target.value)}
                  />
                </div>
                {settings['workbench.accent']?.startsWith('#') && (
                  <span className="text-[11px] text-muted-foreground font-mono leading-6">{settings['workbench.accent']}</span>
                )}
              </div>
            </SettingsRow>

            <Separator />

            <SettingsRow label="Gray Scale" description="Gray tone for backgrounds and surfaces">
              <Select
                value={settings['workbench.gray'] || 'slate'}
                onValueChange={(v) => update('workbench.gray', v)}
              >
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {GRAY_SCALES.map((g) => (
                    <SelectItem key={g.value} value={g.value}>
                      {g.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </SettingsRow>

            <Separator />

            <SettingsRow label="UI Font Size" description="Base font size for the entire platform (px)">
              <Input
                type="number"
                min={10}
                max={24}
                className="w-[80px]"
                value={settings['ui.fontSize'] ?? 13}
                onChange={(e) =>
                  update('ui.fontSize', parseInt(e.target.value, 10) || 13)
                }
              />
            </SettingsRow>

            <Separator />

            <SettingsRow label="UI Font Family" description="Primary font for the entire platform">
              <Select
                value={settings['ui.fontFamily'] || 'Inter'}
                onValueChange={(v) => update('ui.fontFamily', v)}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Inter">Inter</SelectItem>
                  <SelectItem value="system-ui">System UI</SelectItem>
                  <SelectItem value="SF Pro">SF Pro</SelectItem>
                </SelectContent>
              </Select>
            </SettingsRow>
          </SettingsSection>

          {/* Terminal */}
          <SettingsSection icon={Terminal} title="Terminal">
            <SettingsRow label="Shell Path" description="Path to shell executable (leave empty for default)">
              <Input
                type="text"
                className="w-[220px]"
                placeholder="/bin/zsh"
                value={settings['terminal.shell'] || ''}
                onChange={(e) => update('terminal.shell', e.target.value)}
              />
            </SettingsRow>

            <Separator />

            <SettingsRow label="Font Size" description="Terminal font size in pixels">
              <Input
                type="number"
                min={10}
                max={24}
                className="w-[80px]"
                value={settings['terminal.fontSize'] ?? 13}
                onChange={(e) =>
                  update(
                    'terminal.fontSize',
                    parseInt(e.target.value, 10) || 13
                  )
                }
              />
            </SettingsRow>

            <Separator />

            <SettingsRow label="Cursor Style" description="Terminal cursor appearance">
              <Select
                value={settings['terminal.cursorStyle'] || 'block'}
                onValueChange={(v) => update('terminal.cursorStyle', v)}
              >
                <SelectTrigger className="w-[120px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="block">Block</SelectItem>
                  <SelectItem value="bar">Bar</SelectItem>
                  <SelectItem value="underline">Underline</SelectItem>
                </SelectContent>
              </Select>
            </SettingsRow>
          </SettingsSection>

          {/* AI Context Sync */}
          <SettingsSection icon={Bot} title="AI Context Sync">
            <div className="space-y-1.5">
              <Label className="text-sm">AI Tools</Label>
              <p className="text-xs text-muted-foreground">
                Select which tools you use. Skillbox generates the context file for each one.
              </p>
              <div className="space-y-2 pt-1">
                {AI_TOOLS.map((tool) => {
                  const aiTools = settings['context.aiTools'] || ['claude'];
                  const checked = aiTools.includes(tool.id);
                  return (
                    <div key={tool.id} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={checked}
                          onCheckedChange={(v) => {
                            const current = settings['context.aiTools'] || ['claude'];
                            const next = v
                              ? [...current, tool.id]
                              : current.filter((t) => t !== tool.id);
                            update('context.aiTools', next.length > 0 ? next : ['generic']);
                          }}
                        />
                        <span className="text-sm">{tool.label}</span>
                      </div>
                      <span className="text-xs text-muted-foreground font-mono">{tool.file}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <Separator />

            <SettingsRow
              label="Auto-sync"
              description="Update context files when agents, skills, or stack change"
            >
              <Switch
                checked={settings['context.autoSync'] !== false}
                onCheckedChange={(v) => update('context.autoSync', v)}
              />
            </SettingsRow>
          </SettingsSection>

          {/* MCP Quick Status */}
          <McpQuickStatus />

          {/* Storage & Cache */}
          <StorageSection />
        </div>
      </ScrollArea>
    </div>
  );
}

function StorageSection() {
  const { toast } = useToast();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);

  const loadStats = useCallback(async () => {
    setLoading(true);
    try {
      const s = await electronAPI.getStorageStats();
      setStats(s);
    } catch {
      setStats(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadStats(); }, [loadStats]);

  const handleCleanProject = async (projectPath) => {
    try {
      await electronAPI.cleanProjectContext(projectPath);
      toast('Context cleaned', 'success');
      loadStats();
    } catch {
      toast('Failed to clean', 'error');
    }
  };

  const handleCleanCache = async (projectPath) => {
    try {
      await electronAPI.cleanProjectCache(projectPath);
      toast('Cache cleaned', 'success');
      loadStats();
    } catch {
      toast('Failed to clean cache', 'error');
    }
  };

  const handleCleanStale = async () => {
    try {
      const maxAge = settings?.['context.maxCacheAgeDays'] || 30;
      const result = await electronAPI.cleanAllStaleCache(maxAge);
      toast(`Cleaned ${result.cleaned} stale project(s)`, 'success');
      loadStats();
    } catch {
      toast('Failed to clean stale cache', 'error');
    }
  };

  return (
    <SettingsSection icon={HardDrive} title="Storage & Cache">
      {loading && !stats ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <RefreshCw className="h-3.5 w-3.5 animate-spin" />
          Loading storage info...
        </div>
      ) : stats ? (
        <div className="space-y-4">
          {/* Database */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Database className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm">Database</p>
                <p className="text-xs text-muted-foreground font-mono truncate max-w-[300px]">
                  {stats.dbPath}
                </p>
              </div>
            </div>
            <span className="text-sm font-medium">{formatBytes(stats.dbSize)}</span>
          </div>

          <Separator />

          {/* Generated Context per project */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium">Generated Context</p>
              <span className="text-xs text-muted-foreground">
                Total: {formatBytes(stats.totalContext + stats.totalCache)}
              </span>
            </div>
            <div className="space-y-1.5 max-h-[240px] overflow-y-auto">
              {stats.projectStats.map((p) => (
                <div
                  key={p.projectPath}
                  className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm"
                >
                  <FolderOpen className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate">{p.projectName}</p>
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                      <span>{formatBytes(p.totalSize)}</span>
                      {p.files.length > 0 && (
                        <span className="truncate">{p.files.join(' · ')}</span>
                      )}
                      {p.lastSync && <span>Synced {timeAgo(p.lastSync)}</span>}
                    </div>
                    {!p.projectExists && (
                      <span className="text-[10px] text-amber-400">Project folder not found</span>
                    )}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      title="Clean cache"
                      onClick={() => handleCleanCache(p.projectPath)}
                    >
                      <RefreshCw className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-destructive hover:text-destructive"
                      title="Clean all context"
                      onClick={() => handleCleanProject(p.projectPath)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
              {stats.projectStats.length === 0 && (
                <p className="text-xs text-muted-foreground py-2 text-center">No projects</p>
              )}
            </div>
          </div>

          <Separator />

          {/* Bulk actions */}
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={handleCleanStale}>
              <Trash2 className="h-3 w-3 mr-1.5" />
              Clean Stale (&gt; 30 days)
            </Button>
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={loadStats}>
              <RefreshCw className="h-3 w-3 mr-1.5" />
              Refresh
            </Button>
          </div>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">Failed to load storage info</p>
      )}
    </SettingsSection>
  );
}

function McpQuickStatus() {
  const { mcpServerStatus, mcpConnections, setActiveView } = useStore();
  const { toast } = useToast();

  const serverUrl = mcpServerStatus.port ? `http://127.0.0.1:${mcpServerStatus.port}/mcp` : null;

  const handleCopyUrl = () => {
    if (serverUrl) {
      navigator.clipboard.writeText(serverUrl);
      toast('MCP URL copied to clipboard', 'success');
    }
  };

  return (
    <SettingsSection icon={Network} title="MCP Integration">
      <div className="flex items-center justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-sm">
            Server: {mcpServerStatus.running ? (
              <span className="text-emerald-400 font-medium">Active on port {mcpServerStatus.port}</span>
            ) : (
              <span className="text-muted-foreground">Stopped</span>
            )}
          </p>
          {mcpConnections.length > 0 && (
            <p className="text-xs text-muted-foreground mt-0.5">
              {mcpConnections.length} external connection{mcpConnections.length !== 1 ? 's' : ''}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {serverUrl && (
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={handleCopyUrl}>
              <Copy className="h-3 w-3 mr-1.5" />
              Copy URL
            </Button>
          )}
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setActiveView('mcp')}>
            <ExternalLink className="h-3 w-3 mr-1.5" />
            Open MCP Panel
          </Button>
        </div>
      </div>
    </SettingsSection>
  );
}
