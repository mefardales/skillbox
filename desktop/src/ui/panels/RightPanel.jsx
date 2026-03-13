import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import {
  ChevronRight, ChevronDown, FolderOpen, GitBranch, GitCommit, GitMerge,
  Play, RefreshCw, Plus, Check, X, Pencil, Trash2,
  FileText, Info, Package, TestTube, Terminal,
  Users, Zap, Globe, ExternalLink, CheckCircle2, Circle,
  Clock, AlertCircle, MoreHorizontal, Copy, Eye, EyeOff,
  ArrowUp, ArrowDown, CircleDot, Minus, Archive,
} from 'lucide-react';
import { useStore } from '@/hooks/useStore';
import { useToast } from '@/hooks/useToast';
import { electronAPI } from '@/lib/electronAPI';
import { formatDate } from '@/lib/utils';
import MonacoViewer from '@/components/MonacoViewer';

// ── Collapsible Section (VS Code style) ─────────────────────
function Section({ title, count, defaultOpen = true, actions, alwaysShowActions = false, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="select-none">
      <div
        className="flex items-center h-[22px] px-2 cursor-pointer hover:bg-accent/50 group"
        onClick={() => setOpen(!open)}
      >
        {open ? (
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
        )}
        <span className="text-[11px] font-semibold uppercase tracking-wider ml-0.5 flex-1 truncate">
          {title}
        </span>
        {count != null && (
          <span className="text-[11px] text-muted-foreground mr-1">{count}</span>
        )}
        {actions && (
          <div
            className={`flex items-center gap-0.5 transition-opacity ${alwaysShowActions ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
            onClick={(e) => e.stopPropagation()}
          >
            {actions}
          </div>
        )}
      </div>
      {open && <div className="pb-1">{children}</div>}
    </div>
  );
}

// ── Tree Row ────────────────────────────────────────────────
function TreeRow({ icon, label, sublabel, active, onClick, actions, indent = 0, className = '' }) {
  return (
    <div
      className={`flex items-center h-[22px] pr-2 cursor-pointer group hover:bg-accent/60 ${active ? 'bg-accent' : ''} ${className}`}
      style={{ paddingLeft: `${12 + indent * 16}px` }}
      onClick={onClick}
    >
      {icon && <span className="mr-1.5 shrink-0 flex items-center">{icon}</span>}
      <span className="text-[13px] truncate flex-1">{label}</span>
      {sublabel && <span className="text-[11px] text-muted-foreground shrink-0 ml-1">{sublabel}</span>}
      {actions && (
        <div
          className="flex items-center gap-0.5 ml-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
          onClick={(e) => e.stopPropagation()}
        >
          {actions}
        </div>
      )}
    </div>
  );
}

function IconBtn({ icon: Icon, onClick, title, className = '', size = 14 }) {
  return (
    <button
      className={`h-[18px] w-[18px] flex items-center justify-center rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors ${className}`}
      onClick={onClick}
      title={title}
    >
      <Icon style={{ width: size, height: size }} />
    </button>
  );
}

// ── CONTEXT TAB ─────────────────────────────────────────────
function ContextTab() {
  const { activeProject } = useStore();
  const { toast } = useToast();
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const projectPath = activeProject?.path;

  const loadPreview = useCallback(async () => {
    if (!projectPath) return;
    try {
      const p = await electronAPI.getContextPreview(projectPath);
      setPreview(p);
    } catch {
      setPreview(null);
    }
  }, [projectPath]);

  useEffect(() => { loadPreview(); }, [loadPreview]);

  if (!activeProject) {
    return <EmptyState text="Select a project to view context" />;
  }

  const handleSync = async () => {
    setLoading(true);
    try {
      const result = await electronAPI.generateContextSync(projectPath);
      toast(`Synced: ${result.writtenFiles.join(', ')}`, 'success');
      await loadPreview();
    } catch {
      toast('Failed to sync', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (preview?.markdown) {
      navigator.clipboard.writeText(preview.markdown);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const projectSkills = activeProject.skills || [];
  const fileEntries = preview?.fileStatus ? Object.entries(preview.fileStatus) : [];

  const syncButton = (
    <button
      onClick={handleSync}
      disabled={loading}
      className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed text-primary-foreground text-[10px] font-bold uppercase tracking-wider transition-colors"
    >
      <RefreshCw className={`h-2.5 w-2.5 ${loading ? 'animate-spin' : ''}`} />
      {loading ? 'Syncing' : 'Sync'}
    </button>
  );

  return (
    <ScrollArea className="h-full">
      {/* Context Preview */}
      <Section
        title="Context Preview"
        defaultOpen={true}
        alwaysShowActions={true}
        actions={syncButton}
      >
        {preview?.markdown ? (
          <div className="px-2 py-1.5">
            <MonacoViewer
              value={preview.markdown}
              language="markdown"
              maxHeight={260}
              minHeight={80}
              lineNumbers={false}
            />
            <div className="flex items-center justify-between mt-2 px-1">
              <span className="text-[10px] text-muted-foreground">
                ~{preview.tokenEstimate} tokens
              </span>
              <button
                onClick={handleCopy}
                className="text-[11px] text-primary hover:underline transition-colors"
              >
                {copied ? 'Copied!' : 'Copy to Clipboard'}
              </button>
            </div>
          </div>
        ) : (
          <div className="px-4 py-2 text-[13px] text-muted-foreground">
            Click <span className="text-primary font-semibold">Sync</span> to generate context preview
          </div>
        )}
      </Section>

      {/* Synced Files */}
      {fileEntries.length > 0 && (
        <Section title="Synced Files" count={fileEntries.filter(([,s]) => s.exists).length} defaultOpen={true}>
          {fileEntries.map(([fileName, status]) => (
            <TreeRow
              key={fileName}
              icon={<FileText className={`h-4 w-4 ${status.exists ? 'text-green-400' : 'text-muted-foreground/40'}`} />}
              label={<span className="font-mono text-[12px]">{fileName}</span>}
              sublabel={status.exists ? 'synced' : 'pending'}
              className={!status.exists ? 'opacity-50' : ''}
            />
          ))}
        </Section>
      )}

      {/* Skills */}
      <Section title="Skills" count={projectSkills.length} defaultOpen={projectSkills.length > 0}>
        {projectSkills.length > 0 ? (
          projectSkills.map((s) => (
            <TreeRow
              key={s}
              icon={<Zap className="h-4 w-4 text-yellow-400" />}
              label={s.includes('/') ? s.split('/').pop() : s}
            />
          ))
        ) : (
          <div className="px-4 py-1 text-[13px] text-muted-foreground">No skills assigned</div>
        )}
      </Section>
    </ScrollArea>
  );
}

// ── File status icon + color ──
const STATUS_MAP = {
  modified: { label: 'M', color: 'text-yellow-400' },
  added: { label: 'A', color: 'text-green-400' },
  deleted: { label: 'D', color: 'text-red-400' },
  renamed: { label: 'R', color: 'text-blue-400' },
  copied: { label: 'C', color: 'text-blue-400' },
  untracked: { label: 'U', color: 'text-green-400' },
  M: { label: 'M', color: 'text-yellow-400' },
  A: { label: 'A', color: 'text-green-400' },
  D: { label: 'D', color: 'text-red-400' },
};

function FileStatusBadge({ status }) {
  const s = STATUS_MAP[status] || { label: status?.[0] || '?', color: 'text-muted-foreground' };
  return <span className={`text-[10px] font-bold font-mono ${s.color} shrink-0 w-3 text-center`}>{s.label}</span>;
}

// ── SOURCE CONTROL TAB ──────────────────────────────────────
function SourceControlTab() {
  const { activeProject, gitInfo, gitStatus, refreshGit, addLog } = useStore();
  const { toast } = useToast();
  const [switching, setSwitching] = useState(false);
  const [branchDropdown, setBranchDropdown] = useState(false);
  const [commitMsg, setCommitMsg] = useState('');
  const [operating, setOperating] = useState(null);
  const [confirmAction, setConfirmAction] = useState(null);
  const [newBranchModal, setNewBranchModal] = useState(false);
  const [newBranchName, setNewBranchName] = useState('');
  const [newBranchFrom, setNewBranchFrom] = useState('');
  const [mergeModal, setMergeModal] = useState(false);
  const [mergeBranch, setMergeBranch] = useState('');

  if (!activeProject) return <EmptyState text="Select a project" />;
  if (!gitInfo) return <EmptyState text="No git repository detected" />;

  const pp = activeProject.path;
  const localBranches = gitInfo.branches?.local || [];
  const remoteBranches = gitInfo.branches?.remote || [];
  const commits = gitInfo.commits || [];
  const staged = gitStatus?.staged || [];
  const unstaged = gitStatus?.unstaged || [];
  const untracked = gitStatus?.untracked || [];
  const totalChanges = staged.length + unstaged.length + untracked.length;
  const remoteShort = gitInfo.remoteUrl?.replace(/^https?:\/\/github\.com\//, '').replace(/\.git$/, '');
  const ahead = gitInfo.ahead || 0;
  const behind = gitInfo.behind || 0;

  const gitOp = async (name, fn) => {
    setOperating(name);
    try { await fn(); refreshGit(); } finally { setOperating(null); }
  };

  const handleCheckout = async (branch) => {
    if (branch === gitInfo.branch || switching) return;
    if (totalChanges > 0) {
      setConfirmAction({ type: 'checkout', branch, message: `You have ${totalChanges} uncommitted change${totalChanges > 1 ? 's' : ''}. Switching to "${branch}" may lose them. Continue?` });
      setBranchDropdown(false);
      return;
    }
    await doCheckout(branch);
  };

  const doCheckout = async (branch) => {
    setSwitching(true); setBranchDropdown(false); setConfirmAction(null);
    addLog('info', 'git', `Switching to branch "${branch}"...`);
    try {
      const result = await electronAPI.gitCheckout(pp, branch);
      if (result?.ok) {
        addLog('success', 'git', `Switched to branch "${result.branch}"`);
        toast({ title: `Switched to ${result.branch}` });
        refreshGit();
      } else {
        const raw = result?.error || 'Unknown error';
        const summary = raw.includes('overwritten') ? 'Uncommitted changes would be overwritten. Commit or stash first.' : raw.split('\n')[0].substring(0, 120);
        addLog('error', 'git', `Checkout failed: ${summary}`, raw);
        toast({ title: 'Checkout failed', description: summary, variant: 'destructive' });
      }
    } catch (e) {
      addLog('error', 'git', `Checkout error: ${e.message}`);
      toast({ title: 'Checkout failed', description: e.message, variant: 'destructive' });
    } finally { setSwitching(false); }
  };

  const handleStage = (file) => gitOp('stage', async () => { const r = await electronAPI.gitStage(pp, [file]); if (!r?.ok) toast({ title: 'Stage failed', description: r?.error, variant: 'destructive' }); });
  const handleUnstage = (file) => gitOp('unstage', async () => { const r = await electronAPI.gitUnstage(pp, [file]); if (!r?.ok) toast({ title: 'Unstage failed', description: r?.error, variant: 'destructive' }); });
  const handleStageAll = () => gitOp('stage', async () => { const r = await electronAPI.gitStageAll(pp); if (!r?.ok) toast({ title: 'Stage all failed', description: r?.error, variant: 'destructive' }); });
  const handleUnstageAll = () => gitOp('unstage', async () => { const r = await electronAPI.gitUnstageAll(pp); if (!r?.ok) toast({ title: 'Unstage all failed', description: r?.error, variant: 'destructive' }); });

  const handleCommit = () => gitOp('commit', async () => {
    if (!commitMsg.trim()) { toast({ title: 'Enter a commit message' }); return; }
    if (staged.length === 0) { toast({ title: 'No staged changes to commit' }); return; }
    addLog('info', 'git', `Committing: "${commitMsg.trim()}"...`);
    const r = await electronAPI.gitCommit(pp, commitMsg.trim());
    if (r?.ok) { addLog('success', 'git', `Committed ${r.hash}`); toast({ title: `Committed ${r.hash}` }); setCommitMsg(''); }
    else { addLog('error', 'git', `Commit failed: ${r?.error}`); toast({ title: 'Commit failed', description: r?.error, variant: 'destructive' }); }
  });

  const handlePush = () => gitOp('push', async () => { addLog('info', 'git', 'Pushing...'); const r = await electronAPI.gitPush(pp); toast(r?.ok ? { title: 'Push completed' } : { title: 'Push failed', description: r?.error, variant: 'destructive' }); });
  const handlePull = () => gitOp('pull', async () => { addLog('info', 'git', 'Pulling...'); const r = await electronAPI.gitPull(pp); toast(r?.ok ? { title: 'Pull completed' } : { title: 'Pull failed', description: r?.error, variant: 'destructive' }); });
  const handleFetch = () => gitOp('fetch', async () => { addLog('info', 'git', 'Fetching...'); const r = await electronAPI.gitFetch(pp); toast(r?.ok ? { title: 'Fetch completed' } : { title: 'Fetch failed', description: r?.error, variant: 'destructive' }); });
  const handleStash = () => gitOp('stash', async () => { addLog('info', 'git', 'Stashing...'); const r = await electronAPI.gitStash(pp, 'push'); toast(r?.ok ? { title: 'Changes stashed' } : { title: 'Stash failed', description: r?.error, variant: 'destructive' }); });
  const handleStashPop = () => gitOp('stash', async () => { addLog('info', 'git', 'Popping stash...'); const r = await electronAPI.gitStash(pp, 'pop'); toast(r?.ok ? { title: 'Stash applied' } : { title: 'Stash pop failed', description: r?.error, variant: 'destructive' }); });
  const handleMergeAbort = () => gitOp('merge-abort', async () => { addLog('info', 'git', 'Aborting merge...'); const r = await electronAPI.gitMergeAbort(pp); toast(r?.ok ? { title: 'Merge aborted' } : { title: 'Merge abort failed', description: r?.error, variant: 'destructive' }); });

  const handleDiscard = (file) => setConfirmAction({ type: 'discard', file, message: `Discard changes to "${file}"? This cannot be undone.` });
  const doDiscard = async (file) => { setConfirmAction(null); await gitOp('discard', async () => { const r = await electronAPI.gitDiscard(pp, [file]); r?.ok ? addLog('info', 'git', `Discarded: ${file}`) : toast({ title: 'Discard failed', description: r?.error, variant: 'destructive' }); }); };

  const handleCreateBranch = () => gitOp('create-branch', async () => {
    if (!newBranchName.trim()) return toast({ title: 'Enter a branch name' });
    addLog('info', 'git', `Creating branch "${newBranchName.trim()}"...`);
    const r = await electronAPI.gitCreateBranch(pp, newBranchName.trim(), newBranchFrom || undefined);
    if (r?.ok) { toast({ title: `Created branch ${r.branch}` }); setNewBranchModal(false); setNewBranchName(''); setNewBranchFrom(''); }
    else toast({ title: 'Create branch failed', description: r?.error, variant: 'destructive' });
  });

  const handleMerge = () => gitOp('merge', async () => {
    if (!mergeBranch) return toast({ title: 'Select a branch to merge' });
    addLog('info', 'git', `Merging "${mergeBranch}" into "${gitInfo.branch}"...`);
    const r = await electronAPI.gitMerge(pp, mergeBranch);
    if (r?.ok) { toast({ title: `Merged ${mergeBranch}` }); setMergeModal(false); setMergeBranch(''); }
    else if (r?.conflict) { toast({ title: 'Merge conflict', description: 'Resolve conflicts or abort merge.', variant: 'destructive' }); setMergeModal(false); }
    else toast({ title: 'Merge failed', description: r?.error, variant: 'destructive' });
  });

  const handleDeleteBranch = (branch) => setConfirmAction({ type: 'delete-branch', branch, message: `Delete branch "${branch}"?` });
  const doDeleteBranch = async (branch) => { setConfirmAction(null); await gitOp('delete-branch', async () => {
    const r = await electronAPI.gitDeleteBranch(pp, branch, false);
    if (r?.ok) toast({ title: `Deleted ${branch}` });
    else if (r?.error?.includes('not fully merged')) setConfirmAction({ type: 'force-delete-branch', branch, message: `"${branch}" is not fully merged. Force delete?` });
    else toast({ title: 'Delete failed', description: r?.error, variant: 'destructive' });
  }); };
  const doForceDeleteBranch = async (branch) => { setConfirmAction(null); await gitOp('delete-branch', async () => {
    const r = await electronAPI.gitDeleteBranch(pp, branch, true);
    if (r?.ok) toast({ title: `Deleted ${branch}` });
    else toast({ title: 'Delete failed', description: r?.error, variant: 'destructive' });
  }); };

  return (
    <div className="flex flex-col h-full relative">
      {/* Confirmation dialog */}
      {confirmAction && (
        <div className="absolute inset-0 z-50 bg-background/80 flex items-center justify-center p-4">
          <div className="bg-background border border-border rounded-lg p-4 max-w-[280px] shadow-xl">
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle className="h-4 w-4 text-yellow-400 shrink-0" />
              <span className="text-[13px] font-semibold">Confirm</span>
            </div>
            <p className="text-[12px] text-muted-foreground mb-3">{confirmAction.message}</p>
            <div className="flex items-center gap-2 justify-end">
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setConfirmAction(null)}>Cancel</Button>
              <Button size="sm" variant="destructive" className="h-7 text-xs" onClick={() => {
                if (confirmAction.type === 'checkout') doCheckout(confirmAction.branch);
                else if (confirmAction.type === 'discard') doDiscard(confirmAction.file);
                else if (confirmAction.type === 'delete-branch') doDeleteBranch(confirmAction.branch);
                else if (confirmAction.type === 'force-delete-branch') doForceDeleteBranch(confirmAction.branch);
              }}>Continue</Button>
            </div>
          </div>
        </div>
      )}

      {/* New Branch Modal */}
      {newBranchModal && (
        <div className="absolute inset-0 z-50 bg-background/80 flex items-center justify-center p-3">
          <div className="bg-background border border-border rounded-lg p-3 w-full max-w-[280px] shadow-xl">
            <div className="flex items-center gap-2 mb-2">
              <GitBranch className="h-4 w-4 text-primary" />
              <span className="text-[12px] font-semibold">New Branch</span>
              <button className="ml-auto text-muted-foreground hover:text-foreground" onClick={() => setNewBranchModal(false)}><X className="h-3.5 w-3.5" /></button>
            </div>
            <input className="w-full h-[26px] px-2 rounded-md border border-border bg-background text-[11px] mb-1.5 focus:outline-none focus:ring-1 focus:ring-primary" placeholder="feature/my-branch" value={newBranchName} onChange={e => setNewBranchName(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Enter') handleCreateBranch(); }} />
            <select className="w-full h-[26px] px-1.5 rounded-md border border-border bg-background text-[11px] mb-2 focus:outline-none focus:ring-1 focus:ring-primary" value={newBranchFrom} onChange={e => setNewBranchFrom(e.target.value)}>
              <option value="">From: {gitInfo.branch} (current)</option>
              {localBranches.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
            <div className="flex gap-1.5 justify-end">
              <Button size="sm" variant="ghost" className="h-6 text-[10px]" onClick={() => setNewBranchModal(false)}>Cancel</Button>
              <Button size="sm" className="h-6 text-[10px]" onClick={handleCreateBranch} disabled={!newBranchName.trim()}>Create</Button>
            </div>
          </div>
        </div>
      )}

      {/* Merge Modal */}
      {mergeModal && (
        <div className="absolute inset-0 z-50 bg-background/80 flex items-center justify-center p-3">
          <div className="bg-background border border-border rounded-lg p-3 w-full max-w-[280px] shadow-xl">
            <div className="flex items-center gap-2 mb-2">
              <GitMerge className="h-4 w-4 text-primary" />
              <span className="text-[12px] font-semibold">Merge into {gitInfo.branch}</span>
              <button className="ml-auto text-muted-foreground hover:text-foreground" onClick={() => setMergeModal(false)}><X className="h-3.5 w-3.5" /></button>
            </div>
            <select className="w-full h-[26px] px-1.5 rounded-md border border-border bg-background text-[11px] mb-2 focus:outline-none focus:ring-1 focus:ring-primary" value={mergeBranch} onChange={e => setMergeBranch(e.target.value)}>
              <option value="">Select branch...</option>
              {localBranches.filter(b => b !== gitInfo.branch).map(b => <option key={b} value={b}>{b}</option>)}
              {remoteBranches.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
            <div className="flex gap-1.5 justify-end">
              <Button size="sm" variant="ghost" className="h-6 text-[10px]" onClick={() => setMergeModal(false)}>Cancel</Button>
              <Button size="sm" className="h-6 text-[10px]" onClick={handleMerge} disabled={!mergeBranch}>Merge</Button>
            </div>
          </div>
        </div>
      )}

      {/* Branch header */}
      <div className="px-3 py-2 border-b border-border shrink-0">
        <div className="flex items-center gap-1">
          <div className="relative flex-1 min-w-0">
            <button onClick={() => setBranchDropdown(!branchDropdown)} disabled={switching}
              className="flex items-center gap-1.5 h-[26px] px-2 rounded-md border border-border bg-background hover:bg-accent/50 transition-colors w-full text-left">
              <GitBranch className="h-3.5 w-3.5 text-primary shrink-0" />
              <span className="text-[13px] font-semibold truncate">{gitInfo.branch}</span>
              {switching ? <RefreshCw className="h-3 w-3 animate-spin text-muted-foreground ml-auto shrink-0" /> : <ChevronDown className="h-3 w-3 text-muted-foreground ml-auto shrink-0" />}
            </button>
            {branchDropdown && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setBranchDropdown(false)} />
                <div className="absolute left-0 right-0 top-[28px] z-50 bg-background border border-border rounded-md shadow-lg max-h-[240px] overflow-y-auto">
                  {localBranches.map((b) => {
                    const active = b === gitInfo.branch;
                    return (
                      <button key={b} onClick={() => handleCheckout(b)}
                        className={`flex items-center gap-1.5 w-full px-2.5 py-1.5 text-left text-[12px] font-mono hover:bg-accent/50 ${active ? 'text-primary font-semibold' : 'text-foreground'}`}>
                        {active ? <Check className="h-3 w-3 text-primary shrink-0" /> : <GitBranch className="h-3 w-3 text-muted-foreground shrink-0" />}
                        <span className="truncate">{b}</span>
                      </button>
                    );
                  })}
                  {remoteBranches.length > 0 && (
                    <>
                      <div className="h-px bg-border my-1" />
                      <div className="px-2.5 py-1 text-[10px] text-muted-foreground uppercase tracking-wider">Remote</div>
                      {remoteBranches.map((b) => (
                        <button key={b} onClick={() => handleCheckout(b.replace(/^origin\//, ''))}
                          className="flex items-center gap-1.5 w-full px-2.5 py-1.5 text-left text-[12px] font-mono text-muted-foreground hover:bg-accent/50">
                          <Globe className="h-3 w-3 shrink-0" /><span className="truncate">{b}</span>
                        </button>
                      ))}
                    </>
                  )}
                </div>
              </>
            )}
          </div>
          <IconBtn icon={Plus} onClick={() => { setNewBranchName(''); setNewBranchFrom(''); setNewBranchModal(true); }} title="New Branch" />
          <IconBtn icon={GitMerge} onClick={() => { setMergeBranch(''); setMergeModal(true); }} title="Merge" />
          <IconBtn icon={RefreshCw} onClick={refreshGit} title="Refresh" />
        </div>
        {remoteShort && (
          <div className="flex items-center gap-1 mt-1 text-[11px] text-muted-foreground truncate" title={gitInfo.remoteUrl}>
            <Globe className="h-3 w-3 shrink-0" /><span className="truncate">{remoteShort}</span>
          </div>
        )}
      </div>

      {/* Sync actions bar */}
      <div className="flex items-center gap-1 px-2 py-1.5 border-b border-border shrink-0">
        <button onClick={handleFetch} disabled={!!operating}
          className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed text-primary-foreground text-[10px] font-bold uppercase tracking-wider transition-colors">
          <RefreshCw className={`h-2.5 w-2.5 ${operating === 'fetch' ? 'animate-spin' : ''}`} /> Sync
        </button>
        <Button size="sm" variant="ghost" className="h-6 text-[11px] gap-1 px-2" onClick={handlePull} disabled={!!operating}>
          <ArrowDown className={`h-3 w-3 ${operating === 'pull' ? 'animate-pulse' : ''}`} /> Pull{behind > 0 && <span className="text-orange-400">({behind})</span>}
        </Button>
        <Button size="sm" variant="ghost" className="h-6 text-[11px] gap-1 px-2" onClick={handlePush} disabled={!!operating}>
          <ArrowUp className={`h-3 w-3 ${operating === 'push' ? 'animate-pulse' : ''}`} /> Push{ahead > 0 && <span className="text-primary">({ahead})</span>}
        </Button>
        <div className="ml-auto flex items-center gap-0.5">
          <Button size="sm" variant="ghost" className="h-6 text-[11px] gap-1 px-1.5" onClick={handleStash} disabled={!!operating || totalChanges === 0}>
            <Archive className="h-3 w-3" />
          </Button>
          <Button size="sm" variant="ghost" className="h-6 text-[11px] px-1.5" onClick={handleStashPop} disabled={!!operating}>Pop</Button>
          <Button size="sm" variant="ghost" className="h-6 text-[11px] px-1.5 text-red-400 hover:text-red-300" onClick={handleMergeAbort} disabled={!!operating} title="Abort merge">
            <X className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Scrollable content */}
      <ScrollArea className="flex-1">
        {/* Staged Changes */}
        <Section title="Staged Changes" count={staged.length} defaultOpen={true}
          actions={staged.length > 0 && <button onClick={handleUnstageAll} className="text-[10px] text-muted-foreground hover:text-foreground px-1" title="Unstage all">−</button>}>
          {staged.length === 0 ? (
            <div className="px-3 py-1 text-[11px] text-muted-foreground">No staged changes</div>
          ) : staged.map((f) => (
            <div key={f.file} className="flex items-center gap-1.5 px-3 py-0.5 hover:bg-accent/50 group text-[12px]">
              <FileStatusBadge status={f.status} />
              <span className="truncate flex-1 font-mono text-[11px]" title={f.file}>{f.file}</span>
              <button onClick={() => handleUnstage(f.file)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground text-[10px] px-1" title="Unstage">−</button>
            </div>
          ))}
        </Section>

        {/* Unstaged Changes */}
        <Section title="Changes" count={unstaged.length + untracked.length} defaultOpen={true}
          actions={(unstaged.length + untracked.length > 0) && <button onClick={handleStageAll} className="text-[10px] text-muted-foreground hover:text-foreground px-1" title="Stage all">+</button>}>
          {unstaged.length === 0 && untracked.length === 0 ? (
            <div className="px-3 py-1 text-[11px] text-muted-foreground">No changes</div>
          ) : (
            <>
              {unstaged.map((f) => (
                <div key={f.file} className="flex items-center gap-1.5 px-3 py-0.5 hover:bg-accent/50 group text-[12px]">
                  <FileStatusBadge status={f.status} />
                  <span className="truncate flex-1 font-mono text-[11px]" title={f.file}>{f.file}</span>
                  <button onClick={() => handleDiscard(f.file)} className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 text-[10px] px-1" title="Discard">✕</button>
                  <button onClick={() => handleStage(f.file)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground text-[10px] px-1" title="Stage">+</button>
                </div>
              ))}
              {untracked.map((f) => (
                <div key={f.file} className="flex items-center gap-1.5 px-3 py-0.5 hover:bg-accent/50 group text-[12px]">
                  <FileStatusBadge status="untracked" />
                  <span className="truncate flex-1 font-mono text-[11px]" title={f.file}>{f.file}</span>
                  <button onClick={() => handleStage(f.file)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground text-[10px] px-1" title="Stage">+</button>
                </div>
              ))}
            </>
          )}
        </Section>

        {/* Commit box */}
        <div className="px-3 py-2 border-b border-border">
          <textarea className="w-full h-[52px] px-2 py-1.5 rounded-md border border-border bg-background text-[12px] resize-none placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            placeholder="Commit message..." value={commitMsg} onChange={(e) => setCommitMsg(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleCommit(); }} />
          <Button size="sm" className="w-full h-7 text-xs mt-1.5 gap-1.5" onClick={handleCommit} disabled={!!operating || staged.length === 0 || !commitMsg.trim()}>
            {operating === 'commit' ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
            Commit ({staged.length} file{staged.length !== 1 ? 's' : ''})
          </Button>
        </div>

        {/* Local Branches */}
        <Section title="Branches" count={localBranches.length} defaultOpen={false}>
          {localBranches.map((b) => {
            const active = b === gitInfo.branch;
            return (
              <div key={b} className="flex items-center gap-1.5 px-3 py-0.5 hover:bg-accent/50 group text-[12px]">
                <GitBranch className={`h-3 w-3 shrink-0 ${active ? 'text-primary' : 'text-muted-foreground'}`} />
                <span className={`truncate flex-1 font-mono text-[11px] cursor-pointer ${active ? 'text-primary font-semibold' : ''}`} onClick={() => !active && handleCheckout(b)}>{b}</span>
                {!active && (
                  <>
                    <button onClick={() => { setMergeBranch(b); setMergeModal(true); }} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground text-[10px] px-0.5" title={`Merge ${b}`}>
                      <GitMerge className="h-3 w-3" />
                    </button>
                    <button onClick={() => handleDeleteBranch(b)} className="opacity-0 group-hover:opacity-100 text-red-400 text-[10px] px-0.5" title="Delete">
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </>
                )}
              </div>
            );
          })}
        </Section>

        {/* Recent Commits */}
        <Section title="Recent Commits" count={commits.length} defaultOpen={true}>
          {commits.map((c, i) => (
            <div key={c.hash || i} className="px-3 py-1.5 hover:bg-accent/50 cursor-default border-b border-border/30 last:border-0">
              <div className="flex items-start gap-2">
                <CircleDot className="h-3 w-3 text-muted-foreground shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] text-foreground leading-snug">{c.message}</p>
                  <div className="flex items-center gap-2 mt-0.5 text-[10px] text-muted-foreground">
                    <span>{c.author}</span><span>·</span><span>{formatDate(c.date)}</span>
                    {(c.insertions > 0 || c.deletions > 0) && (
                      <span className="ml-auto"><span className="text-green-400">+{c.insertions || 0}</span> <span className="text-red-400">-{c.deletions || 0}</span></span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </Section>
      </ScrollArea>

      {/* Status footer */}
      <div className="flex items-center justify-between px-3 py-1.5 border-t border-border text-[10px] text-muted-foreground shrink-0">
        <div className="flex items-center gap-1.5">
          <Check className="h-3 w-3 text-primary" />
          {ahead === 0 && behind === 0 ? 'Up to date' : (<>{ahead > 0 && `${ahead} ahead`}{ahead > 0 && behind > 0 && ', '}{behind > 0 && `${behind} behind`}</>)}
        </div>
        <span>{totalChanges} change{totalChanges !== 1 ? 's' : ''}</span>
      </div>
    </div>
  );
}

// ── INFO TAB ────────────────────────────────────────────────
function InfoTab() {
  const { activeProject } = useStore();
  const { toast } = useToast();
  const [portsInfo, setPortsInfo] = useState(null);
  const [testInfo, setTestInfo] = useState(null);
  const [envVars, setEnvVars] = useState([]);
  const [addingEnv, setAddingEnv] = useState(false);
  const [newEnvKey, setNewEnvKey] = useState('');
  const [newEnvVal, setNewEnvVal] = useState('');
  const [editingEnv, setEditingEnv] = useState(null);
  const [editEnvVal, setEditEnvVal] = useState('');
  const [showValues, setShowValues] = useState(false);

  const projectPath = activeProject?.path;

  useEffect(() => {
    if (!projectPath) return;
    electronAPI.getProjectPorts(projectPath).then(setPortsInfo).catch(() => null);
    electronAPI.detectTests(projectPath).then(setTestInfo).catch(() => null);
    loadEnvVars();
  }, [projectPath]);

  const loadEnvVars = async () => {
    if (!projectPath) return;
    try {
      const data = await electronAPI.getEnvironments(projectPath);
      const envs = data?.environments || {};
      const active = data?.activeEnv || Object.keys(envs)[0] || 'DEV';
      const vars = Object.entries(envs[active] || {}).map(([key, value]) => ({ key, value }));
      setEnvVars(vars);
    } catch {
      setEnvVars([]);
    }
  };

  const addEnvVar = async () => {
    if (!newEnvKey.trim()) return;
    const updated = [...envVars, { key: newEnvKey.trim(), value: newEnvVal }];
    await saveEnvVars(updated);
    setNewEnvKey('');
    setNewEnvVal('');
    setAddingEnv(false);
  };

  const deleteEnvVar = async (key) => {
    const updated = envVars.filter((v) => v.key !== key);
    await saveEnvVars(updated);
  };

  const saveEnvEdit = async (key) => {
    const updated = envVars.map((v) => v.key === key ? { ...v, value: editEnvVal } : v);
    await saveEnvVars(updated);
    setEditingEnv(null);
  };

  const saveEnvVars = async (vars) => {
    if (!projectPath) return;
    const obj = {};
    vars.forEach((v) => { if (v.key) obj[v.key] = v.value; });
    try {
      const data = await electronAPI.getEnvironments(projectPath);
      const active = data?.activeEnv || 'DEV';
      await electronAPI.saveEnvironment(projectPath, active, obj);
      setEnvVars(vars);
    } catch {
      toast('Failed to save env vars', 'error');
    }
  };

  if (!activeProject) return <EmptyState text="Select a project" />;

  const analysis = activeProject.analysis || {};
  const services = analysis.services || [];
  const scripts = Object.entries(analysis.scripts || {});
  const deps = analysis.dependencies || {};
  const depSections = Object.entries(deps).filter(([, l]) => l?.length > 0);
  const totalDeps = depSections.reduce((s, [, l]) => s + l.length, 0);
  const svcUrls = portsInfo?.serviceUrls || {};

  const runScript = (name) => electronAPI.runScript?.(projectPath, name);

  return (
    <ScrollArea className="h-full">
      {/* Environment Variables */}
      <Section
        title="Environment"
        count={envVars.length}
        defaultOpen={true}
        actions={
          <>
            <IconBtn icon={showValues ? EyeOff : Eye} onClick={() => setShowValues(!showValues)} title={showValues ? 'Hide values' : 'Show values'} />
            <IconBtn icon={Plus} onClick={() => setAddingEnv(true)} title="Add variable" />
          </>
        }
      >
        {addingEnv && (
          <div className="px-3 py-1 space-y-1">
            <Input
              autoFocus
              value={newEnvKey}
              onChange={(e) => setNewEnvKey(e.target.value.toUpperCase())}
              placeholder="KEY"
              className="h-6 text-[13px] font-mono"
              onKeyDown={(e) => { if (e.key === 'Enter') addEnvVar(); if (e.key === 'Escape') setAddingEnv(false); }}
            />
            <div className="flex items-center gap-1">
              <Input
                value={newEnvVal}
                onChange={(e) => setNewEnvVal(e.target.value)}
                placeholder="value"
                className="h-6 text-[13px] font-mono flex-1"
                onKeyDown={(e) => { if (e.key === 'Enter') addEnvVar(); if (e.key === 'Escape') setAddingEnv(false); }}
              />
              <IconBtn icon={Check} onClick={addEnvVar} title="Save" />
              <IconBtn icon={X} onClick={() => setAddingEnv(false)} title="Cancel" />
            </div>
          </div>
        )}
        {envVars.length > 0 ? (
          envVars.map((v) => (
            editingEnv === v.key ? (
              <div key={v.key} className="flex items-center gap-1 px-3 py-0.5">
                <span className="text-[12px] font-mono text-muted-foreground shrink-0 w-20 truncate">{v.key}</span>
                <Input
                  autoFocus
                  value={editEnvVal}
                  onChange={(e) => setEditEnvVal(e.target.value)}
                  className="h-6 text-[13px] font-mono flex-1"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') saveEnvEdit(v.key);
                    if (e.key === 'Escape') setEditingEnv(null);
                  }}
                />
                <IconBtn icon={Check} onClick={() => saveEnvEdit(v.key)} title="Save" />
              </div>
            ) : (
              <TreeRow
                key={v.key}
                label={
                  <span className="flex items-center gap-1.5 font-mono text-[12px]">
                    <span className="text-blue-400">{v.key}</span>
                    <span className="text-muted-foreground">=</span>
                    <span className="truncate">{showValues ? v.value : '•••••'}</span>
                  </span>
                }
                actions={
                  <>
                    <IconBtn icon={Copy} onClick={() => { navigator.clipboard.writeText(v.value); toast('Copied', 'success'); }} title="Copy value" />
                    <IconBtn icon={Pencil} onClick={() => { setEditingEnv(v.key); setEditEnvVal(v.value); }} title="Edit" />
                    <IconBtn icon={Trash2} onClick={() => deleteEnvVar(v.key)} title="Delete" className="hover:text-red-400" />
                  </>
                }
              />
            )
          ))
        ) : !addingEnv ? (
          <div className="px-4 py-1 text-[13px] text-muted-foreground">No variables set</div>
        ) : null}
      </Section>

      {/* Services */}
      <Section title="Services" count={services.length} defaultOpen={services.length > 0}>
        {services.length > 0 ? services.map((s, i) => {
          const urlKey = Object.keys(svcUrls).find(
            (k) => k.toLowerCase().includes(s.name.toLowerCase().replace('postgresql', 'postgres'))
          );
          return (
            <TreeRow
              key={i}
              icon={<span className="w-2 h-2 rounded-full bg-green-500 shrink-0" />}
              label={s.name}
              sublabel={s.type}
              actions={urlKey ? (
                <IconBtn icon={ExternalLink} onClick={() => electronAPI.openExternal?.(svcUrls[urlKey])} title={svcUrls[urlKey]} />
              ) : null}
            />
          );
        }) : (
          <div className="px-4 py-1 text-[13px] text-muted-foreground">No services detected</div>
        )}
      </Section>

      {/* Dependencies */}
      <Section title="Dependencies" count={totalDeps} defaultOpen={false}>
        {depSections.length > 0 ? depSections.map(([mgr, list]) => {
          const label = { npm: 'npm', python: 'pip', ruby: 'gem', java: 'maven' }[mgr] || mgr;
          return (
            <div key={mgr}>
              <div className="px-3 py-0.5 text-[11px] font-semibold uppercase text-muted-foreground">
                {label} ({list.length})
              </div>
              {list.slice(0, 25).map((d) => (
                <TreeRow
                  key={d.name}
                  indent={1}
                  icon={<Package className="h-3.5 w-3.5 text-muted-foreground" />}
                  label={<span className="font-mono text-[12px]">{d.name}</span>}
                  sublabel={d.version || 'latest'}
                />
              ))}
              {list.length > 25 && (
                <div className="px-4 py-1 text-[11px] text-muted-foreground">+{list.length - 25} more</div>
              )}
            </div>
          );
        }) : (
          <div className="px-4 py-1 text-[13px] text-muted-foreground">Run analysis to detect</div>
        )}
      </Section>

      {/* Testing */}
      <Section title="Testing" count={testInfo?.frameworks?.length || 0} defaultOpen={testInfo?.frameworks?.length > 0}>
        {testInfo?.frameworks?.length > 0 ? (
          <>
            {testInfo.frameworks.map((f) => (
              <TreeRow
                key={f}
                icon={<TestTube className="h-3.5 w-3.5 text-green-400" />}
                label={f}
              />
            ))}
            <TreeRow
              icon={<FileText className="h-3.5 w-3.5 text-muted-foreground" />}
              label="Test files"
              sublabel={String(testInfo.testFileCount || 0)}
            />
            {testInfo.hasTestScript && (
              <div className="px-3 py-1">
                <Button size="sm" variant="secondary" className="h-6 text-[13px] w-full" onClick={() => runScript('test')}>
                  <Play className="h-3.5 w-3.5 mr-1.5" />
                  Run Tests
                </Button>
              </div>
            )}
          </>
        ) : (
          <div className="px-4 py-1 text-[13px] text-muted-foreground">No test frameworks detected</div>
        )}
      </Section>

      {/* Scripts */}
      {scripts.length > 0 && (
        <Section title="Scripts" count={scripts.length} defaultOpen={true}>
          {scripts.slice(0, 20).map(([name, cmd]) => (
            <TreeRow
              key={name}
              icon={<Terminal className="h-3.5 w-3.5 text-muted-foreground" />}
              label={<span className="font-mono text-[12px]">{name}</span>}
              actions={
                <IconBtn icon={Play} onClick={() => runScript(name)} title={String(cmd)} className="text-green-400 hover:text-green-300" />
              }
            />
          ))}
        </Section>
      )}

      {/* File Stats */}
      {analysis.fileStats && (
        <Section title="Files" count={analysis.fileStats.total} defaultOpen={false}>
          {Object.entries(analysis.fileStats.byExt || {})
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([ext, count]) => {
              const pct = Math.round((count / analysis.fileStats.total) * 100);
              return (
                <div key={ext} className="flex items-center gap-2 px-3 py-0.5 h-[22px]">
                  <span className="text-[12px] text-muted-foreground w-10 font-mono shrink-0">{ext}</span>
                  <div className="flex-1 h-1.5 bg-accent rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-[11px] text-muted-foreground w-5 text-right shrink-0">{count}</span>
                </div>
              );
            })}
        </Section>
      )}
    </ScrollArea>
  );
}

// ── Empty State ─────────────────────────────────────────────
function EmptyState({ text }) {
  return <div className="px-3 py-4 text-[13px] text-muted-foreground">{text}</div>;
}

// ── Tab Button ──────────────────────────────────────────────
function TabButton({ icon: Icon, label, badge, active, onClick }) {
  return (
    <button
      className={`flex items-center gap-1 h-[35px] px-2.5 text-[11px] uppercase tracking-wider font-medium border-b-2 transition-colors ${
        active
          ? 'border-primary text-foreground'
          : 'border-transparent text-muted-foreground hover:text-foreground'
      }`}
      onClick={onClick}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
      {badge > 0 && (
        <span className="ml-0.5 min-w-[16px] h-4 px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">
          {badge > 99 ? '99+' : badge}
        </span>
      )}
    </button>
  );
}

// ── Main RightPanel ─────────────────────────────────────────
export function RightPanel() {
  const { activeRightTab, setActiveRightTab, gitStatus } = useStore();
  const tab = activeRightTab || 'context';
  const changeCount = gitStatus?.changes || 0;

  const tabs = [
    { id: 'context', icon: FolderOpen, label: 'Context' },
    { id: 'sc', icon: GitBranch, label: 'SC', badge: changeCount },
    { id: 'info', icon: Info, label: 'Info' },
  ];

  return (
    <div className="flex flex-col h-full w-full border-l border-border bg-background">
      {/* Tab bar */}
      <div className="flex items-center h-[35px] border-b border-border px-1 shrink-0 overflow-x-auto">
        {tabs.map((t) => (
          <TabButton
            key={t.id}
            icon={t.icon}
            label={t.label}
            badge={t.badge}
            active={tab === t.id}
            onClick={() => setActiveRightTab(t.id)}
          />
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {tab === 'context' && <ContextTab />}
        {tab === 'sc' && <SourceControlTab />}
        {tab === 'info' && <InfoTab />}
      </div>
    </div>
  );
}

export default RightPanel;
