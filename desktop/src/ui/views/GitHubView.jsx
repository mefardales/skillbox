import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Github,
  Star,
  Download,
  Link,
  Key,
  FolderOpen,
  RefreshCw,
} from 'lucide-react';
import { useStore } from '@/hooks/useStore';
import { useToast } from '@/hooks/useToast';
import { electronAPI } from '@/lib/electronAPI';

export default function GitHubView() {
  const { projects, setProjects } = useStore();
  const { toast } = useToast();

  const [status, setStatus] = useState({ connected: false });
  const [token, setToken] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [repos, setRepos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [cloning, setCloning] = useState(null);

  const refreshStatus = useCallback(async () => {
    const s = await electronAPI.githubGetStatus();
    setStatus(s);
    if (s.connected) {
      searchRepos('');
    }
  }, []);

  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  async function handleConnect() {
    if (!token.trim()) {
      toast('Enter a token');
      return;
    }
    setConnecting(true);
    try {
      const result = await electronAPI.githubConnect(token.trim());
      if (result.success) {
        toast(`Connected as ${result.username}`);
        setToken('');
        refreshStatus();
      } else {
        toast(result.error || 'Connection failed');
      }
    } finally {
      setConnecting(false);
    }
  }

  async function handleDisconnect() {
    await electronAPI.githubDisconnect();
    setStatus({ connected: false });
    setRepos([]);
    toast('Disconnected');
  }

  async function searchRepos(query) {
    setLoading(true);
    try {
      const result = await electronAPI.githubListRepos(query);
      if (result.success) {
        setRepos(result.repos || []);
      }
    } finally {
      setLoading(false);
    }
  }

  function handleSearchChange(e) {
    const q = e.target.value;
    setSearchQuery(q);
    searchRepos(q);
  }

  async function handleClone(repoUrl) {
    setCloning(repoUrl);
    try {
      const result = await electronAPI.githubCloneRepo(repoUrl);
      if (result.success) {
        toast('Cloned successfully');
        const addResult = await electronAPI.addProject(result.path);
        if (addResult.projects) {
          setProjects(addResult.projects);
        }
      } else {
        toast(result.error || 'Clone failed');
      }
    } finally {
      setCloning(null);
    }
  }

  async function handleCloneWithPicker(repoUrl) {
    const dest = await electronAPI.selectFolder();
    if (!dest) return;
    setCloning(repoUrl);
    try {
      const result = await electronAPI.githubCloneRepo(repoUrl, dest);
      if (result.success) {
        toast('Cloned successfully');
        const addResult = await electronAPI.addProject(result.path);
        if (addResult.projects) {
          setProjects(addResult.projects);
        }
      } else {
        toast(result.error || 'Clone failed');
      }
    } finally {
      setCloning(null);
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Github className="w-4 h-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold text-foreground">GitHub</h2>
        </div>
        {status.connected && (
          <button
            onClick={refreshStatus}
            className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground text-[10px] font-bold uppercase tracking-wider transition-colors"
          >
            <RefreshCw className="h-2.5 w-2.5" />
            Sync
          </button>
        )}
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {/* Connection Card */}
          {!status.connected ? (
            <Card className="p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Key className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium text-foreground">
                  Connect to GitHub
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Enter a personal access token to connect your GitHub account.
              </p>
              <div className="flex gap-2">
                <Input
                  type="password"
                  placeholder="ghp_xxxxxxxxxxxx"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleConnect()}
                  className="flex-1 h-8 text-xs"
                />
                <Button
                  size="sm"
                  onClick={handleConnect}
                  disabled={connecting}
                  className="h-8 px-3 text-xs"
                >
                  {connecting ? 'Connecting...' : 'Connect'}
                </Button>
              </div>
            </Card>
          ) : (
            <Card className="p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {status.avatarUrl && (
                    <img
                      src={status.avatarUrl}
                      alt=""
                      className="w-8 h-8 rounded-full"
                    />
                  )}
                  <div>
                    <div className="text-sm font-medium text-foreground">
                      {status.username}
                    </div>
                    <div className="flex items-center gap-1">
                      <Badge
                        variant="secondary"
                        className="text-[10px] px-1.5 py-0"
                      >
                        Connected
                      </Badge>
                    </div>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleDisconnect}
                  className="h-7 px-2 text-xs text-muted-foreground"
                >
                  Disconnect
                </Button>
              </div>
            </Card>
          )}

          {/* Repo Search */}
          {status.connected && (
            <>
              <Separator />
              <div className="space-y-3">
                <Input
                  placeholder="Search repositories..."
                  value={searchQuery}
                  onChange={handleSearchChange}
                  className="h-8 text-xs"
                />

                {loading && (
                  <div className="flex items-center justify-center py-6">
                    <RefreshCw className="w-4 h-4 animate-spin text-muted-foreground" />
                  </div>
                )}

                {!loading && repos.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-6">
                    No repositories found.
                  </p>
                )}

                <div className="space-y-1">
                  {repos.map((repo) => (
                    <Card
                      key={repo.url}
                      className="p-3 hover:bg-accent/50 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <Link className="w-3 h-3 text-muted-foreground shrink-0" />
                            <span className="text-sm font-medium text-foreground truncate">
                              {repo.name}
                            </span>
                          </div>
                          {repo.description && (
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                              {repo.description}
                            </p>
                          )}
                          <div className="flex items-center gap-3 mt-1.5">
                            {repo.language && (
                              <Badge
                                variant="outline"
                                className="text-[10px] px-1.5 py-0"
                              >
                                {repo.language}
                              </Badge>
                            )}
                            <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                              <Star className="w-3 h-3" />
                              {repo.stars || 0}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleClone(repo.url)}
                            disabled={cloning === repo.url}
                            className="h-7 px-2 text-xs"
                          >
                            <Download className="w-3 h-3 mr-1" />
                            {cloning === repo.url ? 'Cloning...' : 'Clone'}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleCloneWithPicker(repo.url)}
                            disabled={cloning === repo.url}
                            className="h-7 px-1.5"
                            title="Choose folder"
                          >
                            <FolderOpen className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
