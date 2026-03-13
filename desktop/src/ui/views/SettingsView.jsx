import React, { useState, useEffect, useCallback } from 'react';
import {
  Settings,
  Palette,
  Terminal,
  Code,
  Eye,
  RotateCcw,
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
      const result = await electronAPI.saveSettings(settings);
      toast('Settings saved', 'success');
      setDirty(false);
      // Apply theme attributes to document
      const root = document.documentElement;
      root.setAttribute('data-mode', settings['workbench.mode'] || 'dark');
      root.setAttribute('data-gray', settings['workbench.gray'] || 'slate');
      root.setAttribute('data-accent', settings['workbench.accent'] || 'blue');
    } catch (e) {
      toast('Failed to save settings: ' + e.message, 'error');
    }
  }, [settings, toast]);

  const handleReset = useCallback(async () => {
    try {
      const defaults = await electronAPI.getDefaultSettings();
      await electronAPI.saveSettings(defaults);
      setSettings(defaults);
      setDirty(false);
      toast('Settings reset to defaults', 'success');
      const root = document.documentElement;
      root.setAttribute('data-mode', defaults['workbench.mode'] || 'dark');
      root.setAttribute('data-gray', defaults['workbench.gray'] || 'slate');
      root.setAttribute('data-accent', defaults['workbench.accent'] || 'blue');
    } catch (e) {
      toast('Failed to reset settings: ' + e.message, 'error');
    }
  }, [toast]);

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
              <div className="flex flex-wrap gap-1.5">
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

            <SettingsRow label="Font Size" description="Base font size for the editor">
              <Input
                type="number"
                min={10}
                max={24}
                className="w-[80px]"
                value={settings['editor.fontSize'] ?? 13}
                onChange={(e) =>
                  update('editor.fontSize', parseInt(e.target.value, 10) || 13)
                }
              />
            </SettingsRow>

            <Separator />

            <SettingsRow label="Font Family" description="Monospace font for editor and terminal">
              <Select
                value={settings['editor.fontFamily'] || "'SF Mono', monospace"}
                onValueChange={(v) => update('editor.fontFamily', v)}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FONT_FAMILIES.map((f) => (
                    <SelectItem key={f.value} value={f.value}>
                      {f.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </SettingsRow>
          </SettingsSection>

          {/* Editor */}
          <SettingsSection icon={Code} title="Editor">
            <SettingsRow label="Tab Size" description="Number of spaces per tab">
              <Select
                value={String(settings['editor.tabSize'] ?? 2)}
                onValueChange={(v) => update('editor.tabSize', parseInt(v, 10))}
              >
                <SelectTrigger className="w-[80px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="2">2</SelectItem>
                  <SelectItem value="4">4</SelectItem>
                </SelectContent>
              </Select>
            </SettingsRow>

            <Separator />

            <SettingsRow label="Word Wrap" description="Wrap long lines in the editor">
              <Switch
                checked={settings['editor.wordWrap'] === 'on'}
                onCheckedChange={(v) =>
                  update('editor.wordWrap', v ? 'on' : 'off')
                }
              />
            </SettingsRow>

            <Separator />

            <SettingsRow label="Minimap" description="Show code minimap on the right side">
              <Switch
                checked={settings['editor.minimap'] !== false}
                onCheckedChange={(v) => update('editor.minimap', v)}
              />
            </SettingsRow>

            <Separator />

            <SettingsRow label="Line Numbers" description="Show line numbers in the gutter">
              <Switch
                checked={settings['editor.lineNumbers'] !== 'off'}
                onCheckedChange={(v) =>
                  update('editor.lineNumbers', v ? 'on' : 'off')
                }
              />
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

          {/* General */}
          <SettingsSection icon={Eye} title="General">
            <SettingsRow
              label="Auto Save"
              description="Automatically save files after a delay"
            >
              <Switch
                checked={settings['general.autoSave'] !== false}
                onCheckedChange={(v) => update('general.autoSave', v)}
              />
            </SettingsRow>

            <Separator />

            <SettingsRow
              label="Telemetry"
              description="Send anonymous usage data to improve Skillbox"
            >
              <Switch
                checked={settings['general.telemetry'] !== false}
                onCheckedChange={(v) => update('general.telemetry', v)}
              />
            </SettingsRow>
          </SettingsSection>
        </div>
      </ScrollArea>
    </div>
  );
}
