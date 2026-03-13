import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { GitBranch, Download, RefreshCw } from 'lucide-react';
import { useStore } from '@/hooks/useStore';
import { useToast } from '@/hooks/useToast';
import { electronAPI } from '@/lib/electronAPI';

export default function GitImportModal({ open, onClose }) {
  const { setRegistry } = useStore();
  const { toast } = useToast();

  const [url, setUrl] = useState('');
  const [importing, setImporting] = useState(false);
  const [status, setStatus] = useState(null); // { type: 'success' | 'error', message: string }

  async function handleImport() {
    if (!url.trim()) {
      toast('Enter a repository URL');
      return;
    }

    setImporting(true);
    setStatus(null);

    try {
      const result = await electronAPI.cloneSkillFromGit(url.trim());
      if (result.success) {
        const names = result.imported.map((s) => s.name).join(', ');
        setStatus({
          type: 'success',
          message: `Imported ${result.imported.length} skill(s): ${names}`,
        });
        const registry = await electronAPI.getRegistry();
        setRegistry(registry);
        toast(`Imported ${result.imported.length} skill(s)`);
      } else {
        setStatus({
          type: 'error',
          message: result.error || 'Import failed',
        });
      }
    } catch (err) {
      setStatus({ type: 'error', message: err.message || 'Import failed' });
    } finally {
      setImporting(false);
    }
  }

  function handleClose() {
    setUrl('');
    setStatus(null);
    setImporting(false);
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm">
            <GitBranch className="w-4 h-4" />
            Import Skills from Git
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Repository URL</Label>
            <Input
              placeholder="https://github.com/user/repo.git"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !importing && handleImport()}
              className="h-8 text-xs font-mono"
              disabled={importing}
            />
          </div>

          {/* Progress / Status */}
          {importing && (
            <div className="flex items-center gap-2 p-3 rounded bg-accent text-xs text-muted-foreground">
              <RefreshCw className="w-3 h-3 animate-spin" />
              Cloning and scanning for skills...
            </div>
          )}

          {status && (
            <div
              className={`p-3 rounded text-xs ${
                status.type === 'success'
                  ? 'bg-green-500/10 text-green-400'
                  : 'bg-red-500/10 text-red-400'
              }`}
            >
              {status.message}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            size="sm"
            onClick={handleClose}
            className="h-7 text-xs"
          >
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleImport}
            disabled={importing}
            className="h-7 text-xs"
          >
            <Download className="w-3 h-3 mr-1" />
            {importing ? 'Importing...' : 'Import'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
