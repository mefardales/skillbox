import React, { useState, useEffect, useCallback } from 'react';
import {
  Puzzle,
  Download,
  Trash2,
  RefreshCw,
  Settings,
  Eye,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useStore } from '@/hooks/useStore';
import { useToast } from '@/hooks/useToast';
import { electronAPI } from '@/lib/electronAPI';

function ExtensionCard({ ext, onSelect, onToggle, onUninstall }) {
  return (
    <Card
      className="flex items-start gap-3 p-3 cursor-pointer hover:bg-accent/50 transition-colors"
      onClick={() => onSelect(ext)}
    >
      <div className="flex-shrink-0 w-10 h-10 rounded-md bg-muted flex items-center justify-center text-lg">
        {ext.icon ? (
          <img
            src={`file://${ext.icon}`}
            alt=""
            className="w-10 h-10 rounded-md object-cover"
          />
        ) : (
          <Puzzle className="h-5 w-5 text-muted-foreground" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium truncate">{ext.name}</span>
          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
            v{ext.version}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
          {ext.description || 'No description'}
        </p>
      </div>

      <div
        className="flex items-center gap-2 flex-shrink-0"
        onClick={(e) => e.stopPropagation()}
      >
        <Switch
          checked={ext.enabled !== false}
          onCheckedChange={(checked) => onToggle(ext, checked)}
        />
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-destructive"
          onClick={() => onUninstall(ext)}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </Card>
  );
}

function ExtensionDetail({ ext, onBack }) {
  const { toast } = useToast();
  const [activated, setActivated] = useState(ext.enabled !== false);

  const handleActivate = useCallback(async () => {
    try {
      await electronAPI.activateExtension(ext.id);
      setActivated(true);
      toast(`${ext.name} activated`, 'success');
    } catch (e) {
      toast('Failed to activate: ' + e.message, 'error');
    }
  }, [ext, toast]);

  const handleDeactivate = useCallback(async () => {
    try {
      await electronAPI.deactivateExtension(ext.id);
      setActivated(false);
      toast(`${ext.name} deactivated`, 'success');
    } catch (e) {
      toast('Failed to deactivate: ' + e.message, 'error');
    }
  }, [ext, toast]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-5 py-3 border-b border-border shrink-0">
        <Button variant="ghost" size="sm" onClick={onBack}>
          Back
        </Button>
        <Separator orientation="vertical" className="h-4" />
        <span className="text-sm font-medium">{ext.name}</span>
      </div>

      <ScrollArea className="flex-1">
        <div className="max-w-2xl mx-auto p-5 space-y-4">
          {/* Header */}
          <Card className="p-4">
            <div className="flex items-start gap-4">
              <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center">
                {ext.icon ? (
                  <img
                    src={`file://${ext.icon}`}
                    alt=""
                    className="w-16 h-16 rounded-lg object-cover"
                  />
                ) : (
                  <Puzzle className="h-8 w-8 text-muted-foreground" />
                )}
              </div>
              <div className="flex-1">
                <h3 className="text-base font-semibold">{ext.name}</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {ext.description || 'No description provided.'}
                </p>
                <div className="flex items-center gap-2 mt-2">
                  <Badge variant="outline">v{ext.version}</Badge>
                  <Badge variant={activated ? 'default' : 'secondary'}>
                    {activated ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
              </div>
              <div>
                {activated ? (
                  <Button variant="outline" size="sm" onClick={handleDeactivate}>
                    Deactivate
                  </Button>
                ) : (
                  <Button size="sm" onClick={handleActivate}>
                    Activate
                  </Button>
                )}
              </div>
            </div>
          </Card>

          {/* Configuration */}
          {ext.config && Object.keys(ext.config).length > 0 && (
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <Settings className="h-4 w-4 text-muted-foreground" />
                <h4 className="text-sm font-medium">Configuration</h4>
              </div>
              <div className="space-y-3">
                {Object.entries(ext.config).map(([key, value]) => (
                  <div
                    key={key}
                    className="flex items-center justify-between text-sm"
                  >
                    <span className="text-muted-foreground font-mono text-xs">
                      {key}
                    </span>
                    <span className="text-xs">{String(value)}</span>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Details */}
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Eye className="h-4 w-4 text-muted-foreground" />
              <h4 className="text-sm font-medium">Details</h4>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">ID</span>
                <span className="font-mono text-xs">{ext.id}</span>
              </div>
              <Separator />
              <div className="flex justify-between">
                <span className="text-muted-foreground">Version</span>
                <span>{ext.version}</span>
              </div>
              {ext.publisher && (
                <>
                  <Separator />
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Publisher</span>
                    <span>{ext.publisher}</span>
                  </div>
                </>
              )}
              <Separator />
              <div className="flex justify-between">
                <span className="text-muted-foreground">Status</span>
                <span>{activated ? 'Activated' : 'Inactive'}</span>
              </div>
            </div>
          </Card>
        </div>
      </ScrollArea>
    </div>
  );
}

function EmptyState({ search }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <Puzzle className="h-10 w-10 text-muted-foreground/40 mb-3" />
      <p className="text-sm text-muted-foreground">
        {search ? 'No matching extensions' : 'No extensions installed'}
      </p>
      <p className="text-xs text-muted-foreground/60 mt-1">
        {search
          ? 'Try a different search term'
          : 'Install extensions from VSIX files or the extensions folder'}
      </p>
    </div>
  );
}

export function ExtensionsView() {
  const { toast } = useToast();
  const [extensions, setExtensions] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedExt, setSelectedExt] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadExtensions = useCallback(async () => {
    setLoading(true);
    try {
      const list = await electronAPI.getInstalledExtensions();
      setExtensions(list || []);
    } catch {
      setExtensions([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadExtensions();
  }, [loadExtensions]);

  const handleInstallVsix = useCallback(async () => {
    try {
      const vsixPath = await electronAPI.browseVsix();
      if (!vsixPath) return;
      const result = await electronAPI.installExtensionVsix(vsixPath);
      if (result.success) {
        toast(`Installed: ${result.name}`, 'success');
        loadExtensions();
      } else {
        toast(result.error || 'Install failed', 'error');
      }
    } catch (e) {
      toast('Install failed: ' + e.message, 'error');
    }
  }, [toast, loadExtensions]);

  const handleOpenFolder = useCallback(() => {
    electronAPI.openExtensionsDir?.();
  }, []);

  const handleToggle = useCallback(
    async (ext, enabled) => {
      try {
        if (enabled) {
          await electronAPI.activateExtension(ext.id);
        } else {
          await electronAPI.deactivateExtension(ext.id);
        }
        setExtensions((prev) =>
          prev.map((e) => (e.id === ext.id ? { ...e, enabled } : e))
        );
        toast(
          `${ext.name} ${enabled ? 'enabled' : 'disabled'}`,
          'success'
        );
      } catch (e) {
        toast('Failed: ' + e.message, 'error');
      }
    },
    [toast]
  );

  const handleUninstall = useCallback(
    async (ext) => {
      try {
        const result = await electronAPI.uninstallExtension(ext.id);
        if (result.success) {
          toast('Extension uninstalled', 'success');
          loadExtensions();
        } else {
          toast(result.error || 'Uninstall failed', 'error');
        }
      } catch (e) {
        toast('Uninstall failed: ' + e.message, 'error');
      }
    },
    [toast, loadExtensions]
  );

  // Detail view
  if (selectedExt) {
    return (
      <ExtensionDetail
        ext={selectedExt}
        onBack={() => setSelectedExt(null)}
      />
    );
  }

  const filtered = search
    ? extensions.filter(
        (e) =>
          e.name.toLowerCase().includes(search.toLowerCase()) ||
          (e.description || '').toLowerCase().includes(search.toLowerCase())
      )
    : extensions;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <Puzzle className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">Extensions</h2>
          <Badge variant="secondary" className="text-[10px] ml-1">
            {extensions.length}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={loadExtensions}>
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
            Refresh
          </Button>
          <Button variant="ghost" size="sm" onClick={handleOpenFolder}>
            Open Folder
          </Button>
          <Button size="sm" onClick={handleInstallVsix}>
            <Download className="h-3.5 w-3.5 mr-1.5" />
            Install from VSIX
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="px-5 py-2 border-b border-border shrink-0">
        <Input
          type="text"
          placeholder="Search installed extensions..."
          className="h-8 text-sm"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* List */}
      <ScrollArea className="flex-1">
        <div className="p-5 space-y-2">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
              Loading extensions...
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState search={search} />
          ) : (
            filtered.map((ext) => (
              <ExtensionCard
                key={ext.id}
                ext={ext}
                onSelect={setSelectedExt}
                onToggle={handleToggle}
                onUninstall={handleUninstall}
              />
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
