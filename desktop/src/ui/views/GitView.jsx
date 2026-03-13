import React, { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  GitBranch, GitMerge, Check, ChevronDown, ChevronRight,
  RefreshCw, ArrowUp, ArrowDown, Globe, Plus, Minus,
  AlertCircle, CircleDot, FileText, Trash2, Archive,
  ArrowUpFromLine, ArrowDownToLine, GitPullRequest, X,
  Github,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useStore } from '@/hooks/useStore';
import { useToast } from '@/hooks/useToast';
import { electronAPI } from '@/lib/electronAPI';
import { formatDate } from '@/lib/utils';
import GitHubView from './GitHubView';

// ── File status badge ──
const STATUS_MAP = {
  modified: { label: 'M', color: 'text-yellow-400' },
  added: { label: 'A', color: 'text-green-400' },
  deleted: { label: 'D', color: 'text-red-400' },
  renamed: { label: 'R', color: 'text-blue-400' },
  copied: { label: 'C', color: 'text-blue-400' },
  untracked: { label: 'U', color: 'text-green-400' },
};

function StatusBadge({ status }) {
  const s = STATUS_MAP[status] || { label: status?.[0] || '?', color: 'text-muted-foreground' };
  return <span className={`text-[11px] font-bold font-mono ${s.color} shrink-0 w-4 text-center`}>{s.label}</span>;
}

// ── Collapsible Section ──
function Section({ title, count, defaultOpen = true, actions, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div>
      <div className="flex items-center h-[28px] px-3 cursor-pointer hover:bg-accent/50 select-none" onClick={() => setOpen(!open)}>
        {open ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0 mr-1" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0 mr-1" />}
        <span className="text-[12px] font-semibold uppercase tracking-wider flex-1">{title}</span>
        {actions && <div className="flex items-center gap-0.5" onClick={e => e.stopPropagation()}>{actions}</div>}
        {count !== undefined && <span className="text-[11px] text-muted-foreground ml-1">{count}</span>}
      </div>
      {open && children}
    </div>
  );
}

function SourceControlContent() {
  const { activeProject, gitInfo, gitStatus, refreshGit, addLog } = useStore();
  const { toast } = useToast();
  const [commitMsg, setCommitMsg] = useState('');
  const [operating, setOperating] = useState(null);
  const [branchDropdown, setBranchDropdown] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);
  const [diffContent, setDiffContent] = useState(null); // { file, diff, staged }
  const [diffOpen, setDiffOpen] = useState(false);
  const [newBranchModal, setNewBranchModal] = useState(false);
  const [newBranchName, setNewBranchName] = useState('');
  const [newBranchFrom, setNewBranchFrom] = useState('');
  const [mergeModal, setMergeModal] = useState(false);
  const [mergeBranch, setMergeBranch] = useState('');
  const [leftWidth, setLeftWidth] = useState(320);

  const handleDividerMouseDown = useCallback((e) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = leftWidth;
    const onMouseMove = (ev) => {
      const newWidth = Math.max(200, Math.min(600, startWidth + ev.clientX - startX));
      setLeftWidth(newWidth);
    };
    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [leftWidth]);

  if (!activeProject) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
        Select a project to view source control
      </div>
    );
  }

  if (!gitInfo) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
        No git repository detected in this project
      </div>
    );
  }

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
      const r = await electronAPI.gitCheckout(pp, branch);
      if (r?.ok) {
        addLog('success', 'git', `Switched to branch "${r.branch}"`);
        toast({ title: `Switched to ${r.branch}` });
        refreshGit();
      } else {
        const raw = r?.error || 'Unknown error';
        const summary = raw.includes('overwritten') ? 'Uncommitted changes would be overwritten. Commit or stash first.' : raw.split('\n')[0].substring(0, 120);
        addLog('error', 'git', `Checkout failed: ${summary}`, raw);
        toast({ title: 'Checkout failed', description: summary, variant: 'destructive' });
      }
    } catch (e) {
      addLog('error', 'git', `Checkout error: ${e.message}`);
      toast({ title: 'Checkout failed', description: e.message, variant: 'destructive' });
    } finally { setSwitching(false); }
  };

  const handleStage = (f) => gitOp('stage', () => electronAPI.gitStage(pp, [f]));
  const handleUnstage = (f) => gitOp('unstage', () => electronAPI.gitUnstage(pp, [f]));
  const handleStageAll = () => gitOp('stage', () => electronAPI.gitStageAll(pp));
  const handleUnstageAll = () => gitOp('unstage', () => electronAPI.gitUnstageAll(pp));

  const handleCommit = () => gitOp('commit', async () => {
    if (!commitMsg.trim()) return toast({ title: 'Enter a commit message' });
    if (staged.length === 0) return toast({ title: 'No staged changes to commit' });
    addLog('info', 'git', `Committing: "${commitMsg.trim()}"...`);
    const r = await electronAPI.gitCommit(pp, commitMsg.trim());
    if (r?.ok) {
      addLog('success', 'git', `Committed ${r.hash}: "${commitMsg.trim()}"`);
      toast({ title: `Committed ${r.hash}` });
      setCommitMsg('');
    } else {
      addLog('error', 'git', `Commit failed: ${r?.error}`, r?.error);
      toast({ title: 'Commit failed', description: r?.error, variant: 'destructive' });
    }
  });

  const handlePush = () => gitOp('push', async () => {
    addLog('info', 'git', 'Pushing to remote...');
    const r = await electronAPI.gitPush(pp);
    r?.ok ? addLog('success', 'git', 'Push completed') : addLog('error', 'git', `Push failed: ${r?.error}`, r?.error);
    toast(r?.ok ? { title: 'Push completed' } : { title: 'Push failed', description: r?.error, variant: 'destructive' });
  });

  const handlePull = () => gitOp('pull', async () => {
    addLog('info', 'git', 'Pulling from remote...');
    const r = await electronAPI.gitPull(pp);
    r?.ok ? addLog('success', 'git', 'Pull completed') : addLog('error', 'git', `Pull failed: ${r?.error}`, r?.error);
    toast(r?.ok ? { title: 'Pull completed' } : { title: 'Pull failed', description: r?.error, variant: 'destructive' });
  });

  const handleFetch = () => gitOp('fetch', async () => {
    addLog('info', 'git', 'Fetching all remotes...');
    const r = await electronAPI.gitFetch(pp);
    r?.ok ? addLog('success', 'git', 'Fetch completed') : addLog('error', 'git', `Fetch failed: ${r?.error}`, r?.error);
    toast(r?.ok ? { title: 'Fetch completed' } : { title: 'Fetch failed', description: r?.error, variant: 'destructive' });
  });

  const handleStash = () => gitOp('stash', async () => {
    addLog('info', 'git', 'Stashing changes...');
    const r = await electronAPI.gitStash(pp, 'push');
    r?.ok ? addLog('success', 'git', 'Changes stashed') : addLog('error', 'git', `Stash failed: ${r?.error}`);
    toast(r?.ok ? { title: 'Changes stashed' } : { title: 'Stash failed', description: r?.error, variant: 'destructive' });
  });

  const handleStashPop = () => gitOp('stash', async () => {
    addLog('info', 'git', 'Popping stash...');
    const r = await electronAPI.gitStash(pp, 'pop');
    r?.ok ? addLog('success', 'git', 'Stash applied') : addLog('error', 'git', `Stash pop failed: ${r?.error}`);
    toast(r?.ok ? { title: 'Stash applied' } : { title: 'Stash pop failed', description: r?.error, variant: 'destructive' });
  });

  const handleDiscard = (file) => {
    setConfirmAction({ type: 'discard', file, message: `Discard changes to "${file}"? This cannot be undone.` });
  };

  const doDiscard = async (file) => {
    setConfirmAction(null);
    await gitOp('discard', async () => {
      const r = await electronAPI.gitDiscard(pp, [file]);
      r?.ok ? addLog('info', 'git', `Discarded: ${file}`) : toast({ title: 'Discard failed', description: r?.error, variant: 'destructive' });
    });
  };

  const handleViewDiff = async (file, isStaged) => {
    const r = await electronAPI.gitDiff(pp, file, isStaged);
    if (r?.ok) {
      setDiffContent({ file, diff: r.diff || '(no diff)', staged: isStaged });
      setDiffOpen(true);
    }
  };

  const handleCreateBranch = () => gitOp('create-branch', async () => {
    if (!newBranchName.trim()) return toast({ title: 'Enter a branch name' });
    addLog('info', 'git', `Creating branch "${newBranchName.trim()}" from ${newBranchFrom || gitInfo.branch}...`);
    const r = await electronAPI.gitCreateBranch(pp, newBranchName.trim(), newBranchFrom || undefined);
    if (r?.ok) {
      addLog('success', 'git', `Created and switched to branch "${r.branch}"`);
      toast({ title: `Created branch ${r.branch}` });
      setNewBranchModal(false);
      setNewBranchName('');
      setNewBranchFrom('');
    } else {
      addLog('error', 'git', `Create branch failed: ${r?.error}`, r?.error);
      toast({ title: 'Create branch failed', description: r?.error, variant: 'destructive' });
    }
  });

  const handleMerge = () => gitOp('merge', async () => {
    if (!mergeBranch) return toast({ title: 'Select a branch to merge' });
    addLog('info', 'git', `Merging "${mergeBranch}" into "${gitInfo.branch}"...`);
    const r = await electronAPI.gitMerge(pp, mergeBranch);
    if (r?.ok) {
      addLog('success', 'git', `Merged "${mergeBranch}" into "${gitInfo.branch}"`);
      toast({ title: `Merged ${mergeBranch}` });
      setMergeModal(false);
      setMergeBranch('');
    } else {
      if (r?.conflict) {
        addLog('error', 'git', `Merge conflict merging "${mergeBranch}". Resolve conflicts or abort.`, r?.error);
        toast({ title: 'Merge conflict', description: 'Resolve conflicts manually or abort the merge.', variant: 'destructive' });
        setMergeModal(false);
      } else {
        addLog('error', 'git', `Merge failed: ${r?.error}`, r?.error);
        toast({ title: 'Merge failed', description: r?.error, variant: 'destructive' });
      }
    }
  });

  const handleMergeAbort = () => gitOp('merge-abort', async () => {
    addLog('info', 'git', 'Aborting merge...');
    const r = await electronAPI.gitMergeAbort(pp);
    r?.ok ? addLog('success', 'git', 'Merge aborted') : addLog('error', 'git', `Merge abort failed: ${r?.error}`);
    toast(r?.ok ? { title: 'Merge aborted' } : { title: 'Merge abort failed', description: r?.error, variant: 'destructive' });
  });

  const handleDeleteBranch = (branch) => {
    setConfirmAction({ type: 'delete-branch', branch, message: `Delete branch "${branch}"? This cannot be undone.` });
  };

  const doDeleteBranch = async (branch) => {
    setConfirmAction(null);
    await gitOp('delete-branch', async () => {
      const r = await electronAPI.gitDeleteBranch(pp, branch, false);
      if (r?.ok) {
        addLog('success', 'git', `Deleted branch "${branch}"`);
        toast({ title: `Deleted branch ${branch}` });
      } else {
        // If not fully merged, ask to force delete
        if (r?.error?.includes('not fully merged')) {
          setConfirmAction({ type: 'force-delete-branch', branch, message: `Branch "${branch}" is not fully merged. Force delete?` });
        } else {
          toast({ title: 'Delete failed', description: r?.error, variant: 'destructive' });
        }
      }
    });
  };

  const doForceDeleteBranch = async (branch) => {
    setConfirmAction(null);
    await gitOp('delete-branch', async () => {
      const r = await electronAPI.gitDeleteBranch(pp, branch, true);
      r?.ok ? addLog('success', 'git', `Force deleted branch "${branch}"`) : toast({ title: 'Delete failed', description: r?.error, variant: 'destructive' });
      if (r?.ok) toast({ title: `Deleted branch ${branch}` });
    });
  };

  return (
    <div className="flex h-full">
      {/* Confirmation overlay */}
      {confirmAction && (
        <div className="absolute inset-0 z-50 bg-background/80 flex items-center justify-center p-4">
          <div className="bg-background border border-border rounded-lg p-4 max-w-[360px] shadow-xl">
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
        <div className="absolute inset-0 z-50 bg-background/80 flex items-center justify-center p-4">
          <div className="bg-background border border-border rounded-lg p-4 w-[340px] shadow-xl">
            <div className="flex items-center gap-2 mb-3">
              <GitBranch className="h-4 w-4 text-primary" />
              <span className="text-[13px] font-semibold">Create New Branch</span>
              <button className="ml-auto text-muted-foreground hover:text-foreground" onClick={() => setNewBranchModal(false)}><X className="h-4 w-4" /></button>
            </div>
            <div className="space-y-2">
              <div>
                <label className="text-[11px] text-muted-foreground mb-1 block">Branch Name</label>
                <input className="w-full h-[30px] px-2.5 rounded-md border border-border bg-background text-[12px] focus:outline-none focus:ring-1 focus:ring-primary" placeholder="feature/my-branch" value={newBranchName} onChange={e => setNewBranchName(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Enter') handleCreateBranch(); }} />
              </div>
              <div>
                <label className="text-[11px] text-muted-foreground mb-1 block">Based On</label>
                <select className="w-full h-[30px] px-2 rounded-md border border-border bg-background text-[12px] focus:outline-none focus:ring-1 focus:ring-primary" value={newBranchFrom} onChange={e => setNewBranchFrom(e.target.value)}>
                  <option value="">Current branch ({gitInfo.branch})</option>
                  {localBranches.map(b => <option key={b} value={b}>{b}</option>)}
                  {remoteBranches.map(b => <option key={b} value={b}>remote: {b}</option>)}
                </select>
              </div>
            </div>
            <div className="flex items-center gap-2 justify-end mt-3">
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setNewBranchModal(false)}>Cancel</Button>
              <Button size="sm" className="h-7 text-xs" onClick={handleCreateBranch} disabled={!newBranchName.trim() || !!operating}>Create Branch</Button>
            </div>
          </div>
        </div>
      )}

      {/* Merge Modal */}
      {mergeModal && (
        <div className="absolute inset-0 z-50 bg-background/80 flex items-center justify-center p-4">
          <div className="bg-background border border-border rounded-lg p-4 w-[340px] shadow-xl">
            <div className="flex items-center gap-2 mb-3">
              <GitMerge className="h-4 w-4 text-primary" />
              <span className="text-[13px] font-semibold">Merge Branch</span>
              <button className="ml-auto text-muted-foreground hover:text-foreground" onClick={() => setMergeModal(false)}><X className="h-4 w-4" /></button>
            </div>
            <p className="text-[11px] text-muted-foreground mb-2">Merge into <span className="text-foreground font-semibold">{gitInfo.branch}</span></p>
            <select className="w-full h-[30px] px-2 rounded-md border border-border bg-background text-[12px] focus:outline-none focus:ring-1 focus:ring-primary" value={mergeBranch} onChange={e => setMergeBranch(e.target.value)}>
              <option value="">Select branch to merge...</option>
              {localBranches.filter(b => b !== gitInfo.branch).map(b => <option key={b} value={b}>{b}</option>)}
              {remoteBranches.map(b => <option key={b} value={b}>remote: {b}</option>)}
            </select>
            <div className="flex items-center gap-2 justify-end mt-3">
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setMergeModal(false)}>Cancel</Button>
              <Button size="sm" className="h-7 text-xs" onClick={handleMerge} disabled={!mergeBranch || !!operating}>Merge</Button>
            </div>
          </div>
        </div>
      )}

      {/* Left: Changes + Commit */}
      <div style={{ width: leftWidth, minWidth: leftWidth }} className="shrink-0 border-r border-border flex flex-col h-full">
        {/* Branch switcher */}
        <div className="px-3 py-2 border-b border-border shrink-0">
          <div className="flex items-center gap-1.5">
            <div className="relative flex-1 min-w-0">
            <button
              onClick={() => setBranchDropdown(!branchDropdown)}
              disabled={switching}
              className="flex items-center gap-1.5 h-[30px] px-2.5 rounded-md border border-border bg-background hover:bg-accent/50 transition-colors w-full text-left"
            >
              <GitBranch className="h-4 w-4 text-primary shrink-0" />
              <span className="text-[13px] font-semibold truncate">{gitInfo.branch}</span>
              {switching ? <RefreshCw className="h-3 w-3 animate-spin text-muted-foreground ml-auto" /> : <ChevronDown className="h-3 w-3 text-muted-foreground ml-auto" />}
            </button>
            {branchDropdown && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setBranchDropdown(false)} />
                <div className="absolute left-0 right-0 top-[32px] z-50 bg-background border border-border rounded-md shadow-lg max-h-[280px] overflow-y-auto">
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
            {/* New branch + Merge buttons */}
            <button onClick={() => { setNewBranchFrom(''); setNewBranchName(''); setNewBranchModal(true); }} title="New Branch" className="h-[30px] w-[30px] flex items-center justify-center rounded-md border border-border hover:bg-accent/50 text-muted-foreground hover:text-foreground shrink-0">
              <Plus className="h-3.5 w-3.5" />
            </button>
            <button onClick={() => { setMergeBranch(''); setMergeModal(true); }} title="Merge Branch" className="h-[30px] w-[30px] flex items-center justify-center rounded-md border border-border hover:bg-accent/50 text-muted-foreground hover:text-foreground shrink-0">
              <GitMerge className="h-3.5 w-3.5" />
            </button>
          </div>
          {remoteShort && (
            <div className="flex items-center gap-1 mt-1 text-[11px] text-muted-foreground truncate" title={gitInfo.remoteUrl}>
              <Globe className="h-3 w-3 shrink-0" /><span className="truncate">{remoteShort}</span>
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-1 px-2 py-1.5 border-b border-border shrink-0 flex-wrap">
          <button onClick={handleFetch} disabled={!!operating}
            className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed text-primary-foreground text-[10px] font-bold uppercase tracking-wider transition-colors">
            <RefreshCw className={`h-2.5 w-2.5 ${operating === 'fetch' ? 'animate-spin' : ''}`} /> Sync
          </button>
          <Button size="sm" variant="ghost" className="h-6 text-[11px] gap-1 px-2" onClick={handlePull} disabled={!!operating}>
            <ArrowDownToLine className={`h-3 w-3 ${operating === 'pull' ? 'animate-pulse' : ''}`} /> Pull{behind > 0 && <span className="text-orange-400">({behind})</span>}
          </Button>
          <Button size="sm" variant="ghost" className="h-6 text-[11px] gap-1 px-2" onClick={handlePush} disabled={!!operating}>
            <ArrowUpFromLine className={`h-3 w-3 ${operating === 'push' ? 'animate-pulse' : ''}`} /> Push{ahead > 0 && <span className="text-primary">({ahead})</span>}
          </Button>
          <Button size="sm" variant="ghost" className="h-6 text-[11px] gap-1 px-2" onClick={handleStash} disabled={!!operating || totalChanges === 0}>
            <Archive className="h-3 w-3" /> Stash
          </Button>
          <Button size="sm" variant="ghost" className="h-6 text-[11px] gap-1 px-2" onClick={handleStashPop} disabled={!!operating}>
            Pop
          </Button>
          <Button size="sm" variant="ghost" className="h-6 text-[11px] gap-1 px-2 text-red-400 hover:text-red-300" onClick={handleMergeAbort} disabled={!!operating} title="Abort merge in progress">
            <X className="h-3 w-3" /> Abort
          </Button>
        </div>

        {/* File changes */}
        <ScrollArea className="flex-1">
          <Section title="Staged Changes" count={staged.length} defaultOpen={true}
            actions={staged.length > 0 && (
              <button onClick={handleUnstageAll} className="h-5 w-5 flex items-center justify-center rounded hover:bg-accent/50 text-muted-foreground hover:text-foreground" title="Unstage all">
                <Minus className="h-3 w-3" />
              </button>
            )}>
            {staged.length === 0 ? (
              <div className="px-4 py-2 text-[11px] text-muted-foreground">No staged changes</div>
            ) : staged.map((f) => (
              <div key={f.file} className="flex items-center gap-1.5 px-4 py-1 hover:bg-accent/50 group cursor-pointer" onClick={() => handleViewDiff(f.file, true)}>
                <StatusBadge status={f.status} />
                <span className="truncate flex-1 text-[12px] font-mono" title={f.file}>{f.file}</span>
                <button onClick={(e) => { e.stopPropagation(); handleUnstage(f.file); }} className="opacity-0 group-hover:opacity-100 h-5 w-5 flex items-center justify-center rounded hover:bg-accent text-muted-foreground" title="Unstage">
                  <Minus className="h-3 w-3" />
                </button>
              </div>
            ))}
          </Section>

          <Section title="Changes" count={unstaged.length + untracked.length} defaultOpen={true}
            actions={(unstaged.length + untracked.length > 0) && (
              <button onClick={handleStageAll} className="h-5 w-5 flex items-center justify-center rounded hover:bg-accent/50 text-muted-foreground hover:text-foreground" title="Stage all">
                <Plus className="h-3 w-3" />
              </button>
            )}>
            {unstaged.length === 0 && untracked.length === 0 ? (
              <div className="px-4 py-2 text-[11px] text-muted-foreground">Working tree clean</div>
            ) : (
              <>
                {unstaged.map((f) => (
                  <div key={f.file} className="flex items-center gap-1.5 px-4 py-1 hover:bg-accent/50 group cursor-pointer" onClick={() => handleViewDiff(f.file, false)}>
                    <StatusBadge status={f.status} />
                    <span className="truncate flex-1 text-[12px] font-mono" title={f.file}>{f.file}</span>
                    <button onClick={(e) => { e.stopPropagation(); handleDiscard(f.file); }} className="opacity-0 group-hover:opacity-100 h-5 w-5 flex items-center justify-center rounded hover:bg-accent text-red-400" title="Discard">
                      <Trash2 className="h-3 w-3" />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); handleStage(f.file); }} className="opacity-0 group-hover:opacity-100 h-5 w-5 flex items-center justify-center rounded hover:bg-accent text-muted-foreground" title="Stage">
                      <Plus className="h-3 w-3" />
                    </button>
                  </div>
                ))}
                {untracked.map((f) => (
                  <div key={f.file} className="flex items-center gap-1.5 px-4 py-1 hover:bg-accent/50 group cursor-pointer">
                    <StatusBadge status="untracked" />
                    <span className="truncate flex-1 text-[12px] font-mono" title={f.file}>{f.file}</span>
                    <button onClick={() => handleStage(f.file)} className="opacity-0 group-hover:opacity-100 h-5 w-5 flex items-center justify-center rounded hover:bg-accent text-muted-foreground" title="Stage">
                      <Plus className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </>
            )}
          </Section>
        </ScrollArea>

        {/* Commit box */}
        <div className="px-3 py-2 border-t border-border shrink-0">
          <textarea
            className="w-full h-[60px] px-2.5 py-2 rounded-md border border-border bg-background text-[12px] resize-none placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            placeholder="Commit message..."
            value={commitMsg}
            onChange={(e) => setCommitMsg(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleCommit(); }}
          />
          <Button className="w-full h-8 text-xs mt-1.5 gap-1.5" onClick={handleCommit}
            disabled={!!operating || staged.length === 0 || !commitMsg.trim()}>
            {operating === 'commit' ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
            Commit to {gitInfo.branch} ({staged.length} file{staged.length !== 1 ? 's' : ''})
          </Button>
        </div>

        {/* Status footer */}
        <div className="flex items-center justify-between px-3 py-1.5 border-t border-border text-[10px] text-muted-foreground shrink-0">
          <div className="flex items-center gap-1.5">
            {ahead === 0 && behind === 0 ? (
              <><Check className="h-3 w-3 text-primary" /> Up to date</>
            ) : (
              <>{ahead > 0 && <span className="text-primary">{ahead} ahead</span>}{ahead > 0 && behind > 0 && <span>·</span>}{behind > 0 && <span className="text-orange-400">{behind} behind</span>}</>
            )}
          </div>
          <span>{totalChanges} change{totalChanges !== 1 ? 's' : ''}</span>
        </div>
      </div>

      {/* Resize divider */}
      <div
        className="resize-handle resize-handle-vertical"
        onMouseDown={handleDividerMouseDown}
      />

      {/* Right: Commits + Diff viewer */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Diff panel */}
        {diffOpen && diffContent ? (
          <div className="flex flex-col h-full">
            <div className="flex items-center gap-2 h-[32px] px-3 border-b border-border shrink-0 bg-secondary/30">
              <FileText className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-[12px] font-mono truncate">{diffContent.file}</span>
              <Badge variant="outline" className="text-[10px] h-4 px-1">{diffContent.staged ? 'staged' : 'working'}</Badge>
              <button className="ml-auto text-muted-foreground hover:text-foreground text-[11px]" onClick={() => setDiffOpen(false)}>Close</button>
            </div>
            <ScrollArea className="flex-1">
              <pre className="p-3 text-[12px] font-mono leading-relaxed whitespace-pre-wrap break-words">
                {diffContent.diff.split('\n').map((line, i) => {
                  let cls = 'text-foreground/80';
                  if (line.startsWith('+') && !line.startsWith('+++')) cls = 'text-green-400 bg-green-500/10';
                  else if (line.startsWith('-') && !line.startsWith('---')) cls = 'text-red-400 bg-red-500/10';
                  else if (line.startsWith('@@')) cls = 'text-blue-400';
                  else if (line.startsWith('diff') || line.startsWith('index')) cls = 'text-muted-foreground';
                  return <div key={i} className={cls}>{line}</div>;
                })}
              </pre>
            </ScrollArea>
          </div>
        ) : (
          /* Commit history */
          <ScrollArea className="flex-1">
            <div className="px-3 py-2 border-b border-border">
              <div className="flex items-center gap-2">
                <GitBranch className="h-4 w-4 text-primary" />
                <span className="text-[13px] font-semibold">{gitInfo.branch}</span>
                <span className="text-[11px] text-muted-foreground ml-auto">{gitInfo.totalCommits} commits total</span>
                <IconBtn icon={RefreshCw} onClick={refreshGit} title="Refresh" />
              </div>
            </div>
            {/* Branches */}
            <Section title="Local Branches" count={localBranches.length} defaultOpen={false}>
              {localBranches.map((b) => {
                const active = b === gitInfo.branch;
                return (
                  <div key={b} className="flex items-center gap-1.5 px-4 py-1 hover:bg-accent/50 group">
                    <GitBranch className={`h-3.5 w-3.5 shrink-0 ${active ? 'text-primary' : 'text-muted-foreground'}`} />
                    <span className={`truncate flex-1 text-[12px] font-mono cursor-pointer ${active ? 'text-primary font-semibold' : ''}`} onClick={() => !active && handleCheckout(b)}>{b}</span>
                    {active && <span className="text-[10px] text-primary">current</span>}
                    {!active && (
                      <>
                        <button onClick={() => { setMergeBranch(b); setMergeModal(true); }} className="opacity-0 group-hover:opacity-100 h-5 w-5 flex items-center justify-center rounded hover:bg-accent text-muted-foreground" title={`Merge ${b} into ${gitInfo.branch}`}>
                          <GitMerge className="h-3 w-3" />
                        </button>
                        <button onClick={() => handleDeleteBranch(b)} className="opacity-0 group-hover:opacity-100 h-5 w-5 flex items-center justify-center rounded hover:bg-accent text-red-400" title="Delete branch">
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </>
                    )}
                  </div>
                );
              })}
            </Section>

            <Section title="Remote Branches" count={remoteBranches.length} defaultOpen={false}>
              {remoteBranches.map((b) => (
                <div key={b} className="flex items-center gap-1.5 px-4 py-1 hover:bg-accent/50 cursor-pointer" onClick={() => handleCheckout(b.replace(/^origin\//, ''))}>
                  <Globe className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="truncate flex-1 text-[12px] font-mono text-muted-foreground">{b}</span>
                </div>
              ))}
            </Section>

            {/* Recent Commits */}
            <Section title="Recent Commits" count={commits.length} defaultOpen={true}>
              {commits.map((c, i) => (
                <div key={c.hash || i} className="px-4 py-2.5 hover:bg-accent/50 cursor-default border-b border-border/30 last:border-0">
                  <div className="flex items-start gap-2.5">
                    <CircleDot className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] text-foreground leading-snug">{c.message}</p>
                      <div className="flex items-center gap-2 mt-1 text-[11px] text-muted-foreground">
                        <span>{c.author}</span>
                        <span>·</span>
                        <span>{formatDate(c.date)}</span>
                        {(c.insertions > 0 || c.deletions > 0) && (
                          <span className="ml-auto">
                            <span className="text-green-400">+{c.insertions || 0}</span>{' '}
                            <span className="text-red-400">-{c.deletions || 0}</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </Section>
          </ScrollArea>
        )}
      </div>
    </div>
  );
}

// Small icon button used in header
function IconBtn({ icon: Icon, onClick, title, className = '' }) {
  return (
    <button onClick={onClick} title={title} className={`h-6 w-6 flex items-center justify-center rounded hover:bg-accent/50 text-muted-foreground hover:text-foreground transition-colors ${className}`}>
      <Icon className="h-3.5 w-3.5" />
    </button>
  );
}

// ── Tabbed wrapper: Source Control + GitHub ──
const TABS = [
  { id: 'sc', label: 'Source Control', icon: GitBranch },
  { id: 'github', label: 'GitHub', icon: Github },
];

export default function GitView() {
  const [activeTab, setActiveTab] = useState('sc');

  return (
    <div className="flex flex-col h-full">
      {/* Tab bar */}
      <div className="flex items-center gap-0 border-b border-border shrink-0 bg-background">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex items-center gap-1.5 px-4 py-2 text-xs font-medium transition-colors border-b-2 -mb-px',
                active
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {activeTab === 'sc' ? <SourceControlContent /> : <GitHubView />}
      </div>
    </div>
  );
}
