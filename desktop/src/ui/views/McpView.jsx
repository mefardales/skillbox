import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import {
  Network,
  Plus,
  X,
  Plug,
  PlugZap,
  Shield,
  Copy,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  RefreshCw,
  Play,
  Square,
  Wrench,
  ChevronDown,
  ChevronRight,
  Link2,
  Server,
  Unplug,
  ShieldCheck,
  ShieldOff,
  Info,
  Hammer,
  Github,
  Database,
  Globe,
  Rocket,
  FileText,
  CreditCard,
  MessageSquare,
  Search,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useStore } from '@/hooks/useStore';
import { useToast } from '@/hooks/useToast';
import { electronAPI } from '@/lib/electronAPI';

// ── Category colors (matches SkillsView pattern) ──
const categoryColors = {
  code: '#f97316',
  database: '#3b82f6',
  testing: '#a855f7',
  deploy: '#22c55e',
  productivity: '#6b7280',
  payments: '#eab308',
  search: '#14b8a6',
};

const categoryList = ['All', 'Code', 'Database', 'Deploy', 'Testing', 'Productivity', 'Payments', 'Search'];

// ── Recommended MCP Server Presets ──
const MCP_PRESETS = [
  {
    id: 'github',
    name: 'GitHub',
    icon: Github,
    badge: 'Official',
    badgeVariant: 'secondary',
    category: 'code',
    description: 'Full GitHub API: repos, issues, PRs, code search, workflows',
    type: 'stdio',
    command: 'npx',
    args: '-y @modelcontextprotocol/server-github',
    url: '',
    authLabel: 'Personal Access Token (PAT)',
    authHint: 'Generate at GitHub → Settings → Developer settings → Personal access tokens. Scopes: repo, read:org',
    authPlaceholder: 'ghp_xxxxxxxxxxxx',
    authEnv: 'GITHUB_PERSONAL_ACCESS_TOKEN',
    tools: ['create_or_update_file', 'search_repositories', 'create_issue', 'create_pull_request', 'get_file_contents', 'push_files'],
  },
  {
    id: 'supabase',
    name: 'Supabase',
    icon: Database,
    badge: 'Official',
    badgeVariant: 'secondary',
    category: 'database',
    description: 'Manage Postgres DB, auth, edge functions, storage, and real-time subscriptions',
    type: 'stdio',
    command: 'npx',
    args: '-y @supabase/mcp-server-supabase',
    url: '',
    authLabel: 'Supabase Access Token',
    authHint: 'Get from Supabase Dashboard → Account → Access Tokens',
    authPlaceholder: 'sbp_xxxxxxxxxxxx',
    authEnv: 'SUPABASE_ACCESS_TOKEN',
    tools: ['query_db', 'get_schema', 'manage_auth', 'edge_functions', 'list_tables'],
  },
  {
    id: 'playwright',
    name: 'Playwright',
    icon: Globe,
    badge: 'Official',
    badgeVariant: 'secondary',
    category: 'testing',
    description: 'Browser automation: navigate, click, screenshot, fill forms, E2E testing',
    type: 'stdio',
    command: 'npx',
    args: '-y @anthropic-ai/mcp-server-playwright',
    url: '',
    authLabel: null,
    authHint: 'No authentication required (runs locally)',
    authPlaceholder: '',
    authEnv: null,
    tools: ['navigate', 'click', 'screenshot', 'fill', 'evaluate', 'get_text'],
  },
  {
    id: 'vercel',
    name: 'Vercel',
    icon: Rocket,
    badge: 'Community',
    badgeVariant: 'outline',
    category: 'deploy',
    description: 'Deploy previews, manage projects, env vars, logs, and domains',
    type: 'stdio',
    command: 'npx',
    args: '-y vercel-mcp-server',
    url: '',
    authLabel: 'Vercel API Token',
    authHint: 'Generate at Vercel → Settings → Tokens',
    authPlaceholder: 'vc_xxxxxxxxxxxx',
    authEnv: 'VERCEL_API_TOKEN',
    tools: ['deploy_preview', 'get_logs', 'manage_projects', 'env_vars'],
  },
  {
    id: 'notion',
    name: 'Notion',
    icon: FileText,
    badge: 'Community',
    badgeVariant: 'outline',
    category: 'productivity',
    description: 'Search pages, query databases, create and update content blocks',
    type: 'stdio',
    command: 'npx',
    args: '-y @notionhq/mcp-server-notion',
    url: '',
    authLabel: 'Notion Integration Token',
    authHint: 'Create integration at notion.so/my-integrations, then share pages with it',
    authPlaceholder: 'ntn_xxxxxxxxxxxx',
    authEnv: 'NOTION_API_KEY',
    tools: ['search_pages', 'query_database', 'create_page', 'update_block'],
  },
  {
    id: 'stripe',
    name: 'Stripe',
    icon: CreditCard,
    badge: 'Official',
    badgeVariant: 'secondary',
    category: 'payments',
    description: 'Payments, customers, subscriptions, invoices, and refunds',
    type: 'stdio',
    command: 'npx',
    args: '-y @stripe/mcp-server-stripe',
    url: '',
    authLabel: 'Stripe Secret Key',
    authHint: 'Get from Stripe Dashboard → Developers → API keys. Use test key (sk_test_) for dev',
    authPlaceholder: 'sk_test_xxxxxxxxxxxx',
    authEnv: 'STRIPE_SECRET_KEY',
    tools: ['create_payment_link', 'get_customer', 'list_subscriptions', 'create_refund'],
  },
  {
    id: 'slack',
    name: 'Slack',
    icon: MessageSquare,
    badge: 'Community',
    badgeVariant: 'outline',
    category: 'productivity',
    description: 'Send messages, read channels, manage threads, and search workspace',
    type: 'stdio',
    command: 'npx',
    args: '-y @anthropic-ai/mcp-server-slack',
    url: '',
    authLabel: 'Slack Bot Token',
    authHint: 'Create app at api.slack.com/apps, add Bot Token Scopes, install to workspace',
    authPlaceholder: 'xoxb-xxxxxxxxxxxx',
    authEnv: 'SLACK_BOT_TOKEN',
    tools: ['send_message', 'read_channel', 'search_messages', 'list_channels'],
  },
  {
    id: 'tavily',
    name: 'Tavily Search',
    icon: Search,
    badge: 'Popular',
    badgeVariant: 'secondary',
    category: 'search',
    description: 'AI-optimized web search for research, fact-checking, and real-time data',
    type: 'stdio',
    command: 'npx',
    args: '-y tavily-mcp-server',
    url: '',
    authLabel: 'Tavily API Key',
    authHint: 'Get free key at tavily.com → Dashboard → API Keys',
    authPlaceholder: 'tvly-xxxxxxxxxxxx',
    authEnv: 'TAVILY_API_KEY',
    tools: ['web_search', 'extract_content', 'search_news'],
  },
];

// ── Shared UI components ──

function SectionHeader({ icon: Icon, title, children, badge }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-medium">{title}</h3>
        {badge}
      </div>
      {children}
    </div>
  );
}

function StatusBadge({ children, variant = 'default' }) {
  const variants = {
    default: 'bg-secondary text-secondary-foreground',
    success: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
    warning: 'bg-amber-500/15 text-amber-400 border-amber-500/20',
    error: 'bg-red-500/15 text-red-400 border-red-500/20',
    info: 'bg-blue-500/15 text-blue-400 border-blue-500/20',
  };
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium rounded border ${variants[variant]}`}>
      {children}
    </span>
  );
}

// ── Tab: Discover (Marketplace) ──

function DiscoverTab({ mcpConnections, onConnect }) {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('');
  const [selectedPreset, setSelectedPreset] = useState(null);

  const filtered = useMemo(() => {
    let result = MCP_PRESETS;
    if (activeCategory) {
      result = result.filter(p => p.category === activeCategory.toLowerCase());
    }
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.tools.some(t => t.toLowerCase().includes(q))
      );
    }
    return result;
  }, [activeCategory, search]);

  return (
    <div className="flex flex-col h-full">
      {/* Header — matches SkillsView */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">Discover Servers</h2>
        </div>
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            placeholder="Search servers..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-8 h-7 text-xs"
          />
        </div>
        <div className="flex items-center gap-1.5 ml-auto">
          <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5" onClick={() => onConnect()}>
            <Plus className="w-3.5 h-3.5" />
            Custom Server
          </Button>
        </div>
      </div>

      {/* Category pills — matches SkillsView */}
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

      {/* Presets grid — matches SkillsView card grid */}
      <ScrollArea className="flex-1">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <Network className="w-8 h-8 mb-3 opacity-40" />
            <p className="text-sm">No servers found</p>
            <p className="text-xs mt-1">Try adjusting your search or filters</p>
          </div>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-3 p-4">
            {filtered.map(preset => {
              const Icon = preset.icon;
              const color = categoryColors[preset.category] || categoryColors.code;
              const isConnected = mcpConnections.some(
                (c) => c.name?.toLowerCase() === preset.name.toLowerCase()
              );
              return (
                <Card
                  key={preset.id}
                  className={cn(
                    'p-3 cursor-pointer transition-colors border-border',
                    isConnected
                      ? 'bg-emerald-500/5 border-emerald-500/30'
                      : 'hover:bg-muted/50'
                  )}
                  onClick={() => setSelectedPreset(preset)}
                >
                  <div className="flex items-start gap-2.5 mb-2">
                    <div
                      className="w-8 h-8 rounded-md flex items-center justify-center shrink-0"
                      style={{ backgroundColor: color }}
                    >
                      <Icon className="w-4 h-4 text-white" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-medium text-foreground truncate">
                          {preset.name}
                        </span>
                        <Badge variant={preset.badgeVariant} className="text-[10px] px-1.5 py-0 h-4">
                          {preset.badge}
                        </Badge>
                        {isConnected && (
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 bg-emerald-500/15 text-emerald-400 border-emerald-500/20">
                            Connected
                          </Badge>
                        )}
                      </div>
                      <Badge
                        variant="outline"
                        className="text-[10px] px-1.5 py-0 h-4 mt-0.5"
                        style={{ borderColor: color, color }}
                      >
                        {preset.category}
                      </Badge>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                    {preset.description}
                  </p>
                  {preset.tools.length > 0 && (
                    <div className="flex items-center gap-1 flex-wrap mt-1.5">
                      {preset.tools.slice(0, 3).map(tool => (
                        <span
                          key={tool}
                          className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground"
                        >
                          {tool}
                        </span>
                      ))}
                      {preset.tools.length > 3 && (
                        <span className="text-[10px] text-muted-foreground/60">
                          +{preset.tools.length - 3} more
                        </span>
                      )}
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </ScrollArea>

      {/* Detail panel (slide-over, matches SkillDetailPanel) */}
      {selectedPreset && (
        <PresetDetailPanel
          preset={selectedPreset}
          isConnected={mcpConnections.some(
            (c) => c.name?.toLowerCase() === selectedPreset.name.toLowerCase()
          )}
          onClose={() => setSelectedPreset(null)}
          onConnect={onConnect}
        />
      )}
    </div>
  );
}

// ── Preset Detail Panel (matches SkillDetailPanel) ──

function PresetDetailPanel({ preset, isConnected, onClose, onConnect }) {
  const Icon = preset.icon;
  const color = categoryColors[preset.category] || categoryColors.code;

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose} />
      <div className="fixed top-0 right-0 h-full w-full max-w-lg bg-background border-l border-border shadow-xl z-50 flex flex-col animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="flex items-start gap-3 px-5 py-4 border-b border-border shrink-0">
          <div
            className="w-7 h-7 rounded-md flex items-center justify-center shrink-0"
            style={{ backgroundColor: color }}
          >
            <Icon className="w-3.5 h-3.5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-base font-semibold text-foreground">{preset.name}</h3>
              <Badge variant={preset.badgeVariant} className="text-[10px] px-1.5 py-0 h-4">
                {preset.badge}
              </Badge>
              <Badge
                variant="outline"
                className="text-[10px] px-1.5 py-0 h-4"
                style={{ borderColor: color, color }}
              >
                {preset.category}
              </Badge>
              {isConnected && (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 bg-emerald-500/15 text-emerald-400 border-emerald-500/20">
                  Connected
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">{preset.description}</p>
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Actions */}
        <div className="px-5 py-3 border-b border-border shrink-0">
          <Button
            size="sm"
            className="h-7 text-xs gap-1.5"
            onClick={() => { onConnect(preset); onClose(); }}
            disabled={isConnected}
          >
            <Plug className="w-3.5 h-3.5" />
            {isConnected ? 'Already Connected' : 'Connect Server'}
          </Button>
        </div>

        {/* Content */}
        <ScrollArea className="flex-1">
          <div className="px-5 py-4 space-y-4">
            {/* Auth guide */}
            {preset.authLabel && (
              <div>
                <h4 className="text-xs font-semibold text-foreground mb-2">Authentication</h4>
                <div className="flex items-start gap-2 p-3 rounded-md bg-primary/5 border border-primary/20">
                  <Info className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                  <div className="text-[11px] text-muted-foreground space-y-1">
                    <p><span className="text-foreground font-medium">{preset.authLabel}</span></p>
                    <p>{preset.authHint}</p>
                    {preset.authEnv && (
                      <p className="font-mono text-[10px]">
                        Env variable: <span className="text-primary">{preset.authEnv}</span>
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {!preset.authLabel && (
              <div>
                <h4 className="text-xs font-semibold text-foreground mb-2">Authentication</h4>
                <p className="text-xs text-muted-foreground">{preset.authHint}</p>
              </div>
            )}

            {/* Connection info */}
            <div>
              <h4 className="text-xs font-semibold text-foreground mb-2">Connection</h4>
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-muted-foreground w-16 shrink-0">Type</span>
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                    {preset.type.toUpperCase()}
                  </Badge>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-muted-foreground w-16 shrink-0">Command</span>
                  <code className="text-[11px] font-mono text-foreground bg-muted/50 px-1.5 py-0.5 rounded">
                    {preset.command} {preset.args}
                  </code>
                </div>
              </div>
            </div>

            {/* Available tools */}
            <div>
              <h4 className="text-xs font-semibold text-foreground mb-2">
                Available Tools ({preset.tools.length})
              </h4>
              <div className="space-y-1">
                {preset.tools.map(tool => (
                  <div key={tool} className="flex items-center gap-2 text-xs py-1">
                    <Wrench className="h-3 w-3 text-muted-foreground shrink-0" />
                    <span className="font-mono text-foreground">{tool}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </ScrollArea>
      </div>
    </>
  );
}

// ── Tab: Server ──

function ServerTab({
  mcpServerStatus, mcpConnections, mcpApprovals, setMcpApprovals,
  refreshMcpStatus, globalSettings, globalSetSettings, addLog, mcpToolEvents,
  connectForm, setConnectForm, showConnectForm, setShowConnectForm,
  activePreset, setActivePreset, connectLoading, setConnectLoading,
}) {
  const { toast } = useToast();
  const lastEventCount = useRef(mcpToolEvents.length);

  const [serverLoading, setServerLoading] = useState(false);
  const [expandedConn, setExpandedConn] = useState(null);
  const [toolResult, setToolResult] = useState(null);
  const [toolLoading, setToolLoading] = useState(false);
  const [serverConfig, setServerConfig] = useState({ port: 0, token: '' });
  const [connectionLogs, setConnectionLogs] = useState([]);
  const [showLogs, setShowLogs] = useState(false);

  useEffect(() => {
    setServerConfig({
      port: globalSettings['mcp.serverPort'] ?? 0,
      token: globalSettings['mcp.serverToken'] ?? '',
    });
  }, [globalSettings]);

  const addConnectionLog = useCallback((level, message, timestamp) => {
    const entry = { id: Date.now() + Math.random(), level, message, timestamp: timestamp || new Date().toISOString() };
    setConnectionLogs(prev => [entry, ...prev].slice(0, 100));
    addLog?.(level, 'MCP', message);
  }, [addLog]);

  useEffect(() => {
    if (mcpToolEvents.length > lastEventCount.current) {
      const newEvents = mcpToolEvents.slice(0, mcpToolEvents.length - lastEventCount.current);
      for (const evt of newEvents) {
        const status = evt.success ? 'success' : 'fail';
        const ip = evt.clientIp || '?';
        const ms = evt.elapsed != null ? ` (${evt.elapsed}ms)` : '';
        addConnectionLog(
          evt.success ? 'info' : 'error',
          `${ip} → ${evt.toolName} — ${status}${ms}${evt.error ? ': ' + evt.error : ''}`,
          evt.timestamp
        );
      }
    }
    lastEventCount.current = mcpToolEvents.length;
  }, [mcpToolEvents, addConnectionLog]);

  const generateToken = useCallback(() => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let token = 'sk-';
    for (let i = 0; i < 32; i++) token += chars[Math.floor(Math.random() * chars.length)];
    setServerConfig(prev => ({ ...prev, token }));
    const updated = { ...globalSettings, 'mcp.serverToken': token };
    electronAPI.saveSettings(updated);
    globalSetSettings(updated);
    toast('Auth token generated', 'success');
  }, [globalSettings, globalSetSettings, toast]);

  const saveServerConfig = useCallback(async (key, value) => {
    const updated = { ...globalSettings, [key]: value };
    await electronAPI.saveSettings(updated);
    globalSetSettings(updated);
  }, [globalSettings, globalSetSettings]);

  const handleToggleServer = async () => {
    setServerLoading(true);
    try {
      if (mcpServerStatus.running) {
        const result = await electronAPI.mcpServerStop();
        if (result?.error) throw new Error(result.error);
        toast('MCP server stopped', 'info');
        addConnectionLog('info', 'MCP server stopped');
        await saveServerConfig('mcp.serverEnabled', false);
      } else {
        const port = serverConfig.port || 0;
        const token = serverConfig.token || '';
        if (!token) {
          addConnectionLog('warning', 'Server started without authentication (localhost only)');
        }
        const result = await electronAPI.mcpServerStart({ port, token: token || null });
        if (result?.error) throw new Error(result.error);
        toast(`MCP server started on port ${result.port}`, 'success');
        addConnectionLog('info', `MCP server started on port ${result.port}`);
        await saveServerConfig('mcp.serverEnabled', true);
      }
      await refreshMcpStatus();
    } catch (e) {
      toast(`MCP error: ${e.message}`, 'error');
      addConnectionLog('error', `Server error: ${e.message}`);
    } finally {
      setServerLoading(false);
    }
  };

  const handleCopyUrl = () => {
    if (mcpServerStatus.port) {
      const url = `http://127.0.0.1:${mcpServerStatus.port}/mcp`;
      navigator.clipboard.writeText(url);
      toast('Server URL copied', 'success');
    }
  };

  const handleConnect = async () => {
    if (!connectForm.name) { toast('Name is required', 'error'); return; }
    setConnectLoading(true);
    try {
      let result;
      if (connectForm.type === 'http') {
        if (!connectForm.url) { toast('URL is required', 'error'); setConnectLoading(false); return; }
        result = await electronAPI.mcpClientConnectHttp({
          name: connectForm.name,
          url: connectForm.url,
          authToken: connectForm.token || null,
        });
      } else {
        if (!connectForm.command) { toast('Command is required', 'error'); setConnectLoading(false); return; }
        result = await electronAPI.mcpClientConnectStdio({
          name: connectForm.name,
          command: connectForm.command,
          args: connectForm.args ? connectForm.args.split(' ').filter(Boolean) : [],
        });
      }
      if (result?.error) throw new Error(result.error);
      const toolCount = result.tools?.length || 0;
      toast(`Connected to ${connectForm.name} (${toolCount} tools)`, 'success');
      addConnectionLog('info', `Connected to "${connectForm.name}" — ${toolCount} tool(s) discovered`);
      setConnectForm({ name: '', url: '', token: '', type: 'http', command: '', args: '', envVar: '' });
      setShowConnectForm(false);
      setActivePreset(null);
      await refreshMcpStatus();
    } catch (e) {
      toast(`Connection failed: ${e.message}`, 'error');
      addConnectionLog('error', `Connection to "${connectForm.name}" failed: ${e.message}`);
    } finally {
      setConnectLoading(false);
    }
  };

  const handleDisconnect = async (id, name) => {
    try {
      await electronAPI.mcpClientDisconnect(id);
      toast('Disconnected', 'info');
      addConnectionLog('info', `Disconnected from "${name}"`);
      await refreshMcpStatus();
    } catch (e) {
      toast(`Disconnect failed: ${e.message}`, 'error');
    }
  };

  const handleRefreshTools = async (id) => {
    try {
      await electronAPI.mcpClientRefreshTools(id);
      toast('Tools refreshed', 'success');
      await refreshMcpStatus();
    } catch (e) {
      toast(`Refresh failed: ${e.message}`, 'error');
    }
  };

  const handleCallTool = async (connId, toolName) => {
    setToolLoading(true);
    setToolResult(null);
    try {
      const result = await electronAPI.mcpClientCallTool(connId, toolName, {});
      setToolResult({ tool: toolName, result });
      addConnectionLog('info', `Called tool "${toolName}" — success`);
    } catch (e) {
      setToolResult({ tool: toolName, error: e.message });
      addConnectionLog('error', `Tool "${toolName}" failed: ${e.message}`);
    } finally {
      setToolLoading(false);
    }
  };

  const handleApproval = async (id, approved) => {
    try {
      await electronAPI.mcpResolveApproval(id, approved);
      setMcpApprovals(prev => prev.filter(a => a.id !== id));
      toast(approved ? 'Approved' : 'Denied', approved ? 'success' : 'info');
      addConnectionLog('info', `Approval ${approved ? 'granted' : 'denied'} for request ${id.slice(0, 8)}`);
    } catch (e) {
      toast(`Approval failed: ${e.message}`, 'error');
    }
  };

  const serverUrl = mcpServerStatus.port ? `http://127.0.0.1:${mcpServerStatus.port}/mcp` : null;
  const totalTools = mcpConnections.reduce((sum, c) => sum + (c.tools?.length || 0), 0);

  return (
    <ScrollArea className="flex-1">
      <div className="max-w-3xl mx-auto p-5 space-y-4">

        {/* ── MCP Server ── */}
        <Card className="p-4">
          <SectionHeader
            icon={Server}
            title="MCP Server"
            badge={mcpServerStatus.running
              ? <StatusBadge variant="success">Running</StatusBadge>
              : <StatusBadge variant="default">Stopped</StatusBadge>
            }
          >
            <div className="flex items-center gap-2">
              {serverLoading ? (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              ) : (
                <Button
                  size="sm"
                  variant={mcpServerStatus.running ? 'outline' : 'default'}
                  className="h-7 text-xs"
                  onClick={handleToggleServer}
                >
                  {mcpServerStatus.running ? (
                    <><Square className="h-3 w-3 mr-1.5" />Stop Server</>
                  ) : (
                    <><Play className="h-3 w-3 mr-1.5" />Start Server</>
                  )}
                </Button>
              )}
            </div>
          </SectionHeader>

          <p className="text-xs text-muted-foreground mb-3">
            Expose Skillbox tools to external LLMs (Claude Code, Cursor, etc.) via the MCP protocol.
          </p>

          <div className="space-y-3">
            {mcpServerStatus.running && serverUrl && (
              <div className="flex items-center gap-2 rounded-md border border-border bg-secondary/30 px-3 py-2">
                <Link2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <code className="text-xs font-mono text-foreground flex-1 select-all">{serverUrl}</code>
                <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={handleCopyUrl} title="Copy URL">
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
            )}

            <div className="flex items-center justify-between gap-4">
              <div className="flex-1 min-w-0">
                <Label className="text-sm">Server Port</Label>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  0 = random free port (recommended for dev). Changes require server restart.
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Input
                  type="number"
                  min={0}
                  max={65535}
                  className="w-[100px]"
                  value={serverConfig.port}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10) || 0;
                    setServerConfig(prev => ({ ...prev, port: val }));
                    saveServerConfig('mcp.serverPort', val);
                  }}
                />
              </div>
            </div>

            <Separator />

            <div className="flex items-center justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <Label className="text-sm">Auth Token</Label>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-[240px]">
                      <p className="text-[11px]">Leave empty for no authentication (localhost only recommended). Set a token to require Bearer auth from MCP clients.</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Bearer token for authenticating MCP clients
                </p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <Input
                  type="password"
                  className="w-[180px]"
                  placeholder="No auth"
                  value={serverConfig.token}
                  onChange={(e) => {
                    setServerConfig(prev => ({ ...prev, token: e.target.value }));
                    saveServerConfig('mcp.serverToken', e.target.value);
                  }}
                />
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={generateToken} title="Generate random token">
                      <RefreshCw className="h-3 w-3" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top">Generate random token</TooltipContent>
                </Tooltip>
              </div>
            </div>

            {mcpServerStatus.running && (
              <>
                <Separator />
                <div className="flex items-center gap-1.5 text-xs">
                  {mcpServerStatus.hasAuth ? (
                    <>
                      <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                      <span className="text-emerald-400">Authentication enabled</span>
                    </>
                  ) : (
                    <>
                      <ShieldOff className="h-3.5 w-3.5 text-amber-400" />
                      <span className="text-amber-400">No authentication — localhost access only</span>
                    </>
                  )}
                </div>
              </>
            )}

            {mcpServerStatus.running && (
              <>
                <Separator />
                <div>
                  <p className="text-xs text-muted-foreground mb-1.5">Exposed Tools (7)</p>
                  <div className="flex flex-wrap gap-1">
                    {['get_project_env_vars', 'list_agents', 'list_projects', 'git_status', 'query_database', 'run_service', 'get_skill_content'].map(t => (
                      <StatusBadge key={t} variant={t === 'query_database' || t === 'run_service' ? 'warning' : 'default'}>
                        {t === 'query_database' || t === 'run_service' ? <Shield className="h-2.5 w-2.5 mr-0.5" /> : null}
                        {t}
                      </StatusBadge>
                    ))}
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    <Shield className="h-2.5 w-2.5 inline mr-0.5" /> = requires human approval
                  </p>
                </div>
              </>
            )}
          </div>
        </Card>

        {/* ── Pending Approvals ── */}
        {mcpApprovals.length > 0 && (
          <Card className="p-4 border-amber-500/30">
            <SectionHeader
              icon={AlertTriangle}
              title="Pending Approvals"
              badge={<StatusBadge variant="warning">{mcpApprovals.length}</StatusBadge>}
            />
            <div className="space-y-1.5">
              {mcpApprovals.map((a) => (
                <div
                  key={a.id}
                  className="flex items-center gap-2 rounded-md border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-sm"
                >
                  <Shield className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{a.toolName}</p>
                    <p className="text-[11px] text-muted-foreground font-mono truncate">
                      {JSON.stringify(a.args)}
                    </p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button size="sm" className="h-6 px-2 text-xs" onClick={() => handleApproval(a.id, true)}>
                      Approve
                    </Button>
                    <Button variant="outline" size="sm" className="h-6 px-2 text-xs" onClick={() => handleApproval(a.id, false)}>
                      Deny
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* ── External MCP Connections ── */}
        <Card className="p-4">
          <SectionHeader
            icon={PlugZap}
            title="Connected Servers"
            badge={totalTools > 0 ? <StatusBadge variant="info">{totalTools} tools</StatusBadge> : null}
          >
            <Button
              variant={showConnectForm ? 'secondary' : 'outline'}
              size="sm"
              className="h-7 text-xs"
              onClick={() => setShowConnectForm(!showConnectForm)}
            >
              {showConnectForm ? (
                <><X className="h-3 w-3 mr-1" />Cancel</>
              ) : (
                <><Plus className="h-3 w-3 mr-1" />Connect</>
              )}
            </Button>
          </SectionHeader>

          {/* Connect form */}
          {showConnectForm && (
            <div className="space-y-2.5 mb-4 p-3 rounded-md border border-border bg-secondary/30">
              {activePreset && (() => {
                const preset = MCP_PRESETS.find(p => p.id === activePreset);
                if (!preset) return null;
                return (
                  <div className="flex items-start gap-2 p-2 rounded-md bg-primary/5 border border-primary/20 mb-1">
                    <Info className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                    <div className="text-[11px] text-muted-foreground">
                      <span className="text-foreground font-medium">{preset.name} Setup</span>
                      <p className="mt-0.5">{preset.authHint}</p>
                      {preset.authEnv && (
                        <p className="mt-1 font-mono text-[10px]">
                          Env: <span className="text-primary">{preset.authEnv}</span>
                        </p>
                      )}
                    </div>
                  </div>
                );
              })()}

              <div className="flex gap-2">
                <Select
                  value={connectForm.type}
                  onValueChange={(v) => setConnectForm(f => ({ ...f, type: v }))}
                >
                  <SelectTrigger className="w-[100px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="http">HTTP</SelectItem>
                    <SelectItem value="stdio">Stdio</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  placeholder="Connection name"
                  className="flex-1"
                  value={connectForm.name}
                  onChange={(e) => setConnectForm(f => ({ ...f, name: e.target.value }))}
                />
              </div>

              {connectForm.type === 'http' ? (
                <>
                  <Input
                    placeholder="http://localhost:3001/mcp"
                    value={connectForm.url}
                    onChange={(e) => setConnectForm(f => ({ ...f, url: e.target.value }))}
                  />
                  <Input
                    type="password"
                    placeholder={activePreset ? (MCP_PRESETS.find(p => p.id === activePreset)?.authPlaceholder || 'Auth token (optional)') : 'Auth token (optional)'}
                    value={connectForm.token}
                    onChange={(e) => setConnectForm(f => ({ ...f, token: e.target.value }))}
                  />
                </>
              ) : (
                <>
                  <Input
                    placeholder="Command (e.g., npx, python)"
                    value={connectForm.command}
                    onChange={(e) => setConnectForm(f => ({ ...f, command: e.target.value }))}
                  />
                  <Input
                    placeholder="Arguments (space-separated)"
                    value={connectForm.args}
                    onChange={(e) => setConnectForm(f => ({ ...f, args: e.target.value }))}
                  />
                  {activePreset && MCP_PRESETS.find(p => p.id === activePreset)?.authLabel && (
                    <div>
                      <Label className="text-[11px] text-muted-foreground mb-1">
                        {MCP_PRESETS.find(p => p.id === activePreset)?.authLabel}
                      </Label>
                      <Input
                        type="password"
                        placeholder={MCP_PRESETS.find(p => p.id === activePreset)?.authPlaceholder || ''}
                        value={connectForm.token}
                        onChange={(e) => setConnectForm(f => ({ ...f, token: e.target.value }))}
                      />
                    </div>
                  )}
                </>
              )}

              <div className="flex items-center gap-2 justify-end pt-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => { setShowConnectForm(false); setActivePreset(null); }}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  className="h-7 text-xs"
                  onClick={handleConnect}
                  disabled={connectLoading}
                >
                  {connectLoading ? (
                    <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
                  ) : (
                    <Plug className="h-3 w-3 mr-1.5" />
                  )}
                  Connect & Discover Tools
                </Button>
              </div>
            </div>
          )}

          {/* Connected servers list */}
          <div className="space-y-2">
            {mcpConnections.map((conn) => {
              const isExpanded = expandedConn === conn.id;
              const toolCount = conn.tools?.length || 0;
              return (
                <div key={conn.id} className="rounded-md border border-border overflow-hidden">
                  <div
                    className="flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-secondary/30 transition-colors"
                    onClick={() => setExpandedConn(isExpanded ? null : conn.id)}
                  >
                    {isExpanded ? (
                      <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" />
                    ) : (
                      <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
                    )}
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{conn.name}</span>
                        <StatusBadge variant={conn.status === 'connected' ? 'success' : 'error'}>
                          {conn.status === 'connected' ? 'Connected' : 'Error'}
                        </StatusBadge>
                        <StatusBadge variant="default">{conn.type?.toUpperCase()}</StatusBadge>
                        {toolCount > 0 && (
                          <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                            <Hammer className="h-2.5 w-2.5" />
                            {toolCount}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground font-mono truncate">
                        {conn.type === 'http' ? conn.url : conn.command}
                      </p>
                    </div>
                    <div className="flex gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleRefreshTools(conn.id)}>
                            <RefreshCw className="h-3 w-3" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="top">Refresh tools</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive" onClick={() => handleDisconnect(conn.id, conn.name)}>
                            <Unplug className="h-3 w-3" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="top">Disconnect</TooltipContent>
                      </Tooltip>
                    </div>
                  </div>

                  {isExpanded && conn.tools?.length > 0 && (
                    <div className="border-t border-border bg-secondary/20 px-3 py-2">
                      <p className="text-[11px] text-muted-foreground mb-1.5">Available Tools</p>
                      <div className="space-y-1">
                        {conn.tools.map((tool) => (
                          <div key={tool.name} className="flex items-center gap-2 text-xs">
                            <Wrench className="h-3 w-3 text-muted-foreground shrink-0" />
                            <div className="flex-1 min-w-0">
                              <span className="font-mono text-foreground">{tool.name}</span>
                              {tool.description && (
                                <span className="text-muted-foreground ml-1.5">— {tool.description}</span>
                              )}
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-5 px-1.5 text-[10px]"
                              onClick={() => handleCallTool(conn.id, tool.name)}
                              disabled={toolLoading}
                            >
                              <Play className="h-2.5 w-2.5 mr-0.5" />
                              Test
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {isExpanded && (!conn.tools || conn.tools.length === 0) && (
                    <div className="border-t border-border bg-secondary/20 px-3 py-2">
                      <p className="text-xs text-muted-foreground">No tools discovered</p>
                    </div>
                  )}
                </div>
              );
            })}

            {mcpConnections.length === 0 && !showConnectForm && (
              <div className="text-center py-6">
                <PlugZap className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">No external MCP servers connected</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">Click "Connect" to add a server, or browse the Discover tab</p>
              </div>
            )}
          </div>
        </Card>

        {/* ── Tool Result ── */}
        {toolResult && (
          <Card className="p-4">
            <SectionHeader icon={Wrench} title={`Tool Result: ${toolResult.tool}`}>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setToolResult(null)}>
                <X className="h-3 w-3" />
              </Button>
            </SectionHeader>
            <pre className="text-xs font-mono bg-secondary/50 rounded-md p-3 overflow-auto max-h-[200px] whitespace-pre-wrap">
              {toolResult.error
                ? `Error: ${toolResult.error}`
                : JSON.stringify(toolResult.result, null, 2)
              }
            </pre>
          </Card>
        )}

        {/* ── Connection Logs ── */}
        <Card className="p-4">
          <div
            className="flex items-center justify-between cursor-pointer"
            onClick={() => setShowLogs(!showLogs)}
          >
            <div className="flex items-center gap-2">
              {showLogs ? (
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
              )}
              <span className="text-sm font-medium">Connection Logs</span>
              {connectionLogs.length > 0 && (
                <StatusBadge variant="default">{connectionLogs.length}</StatusBadge>
              )}
            </div>
            {showLogs && connectionLogs.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-[11px]"
                onClick={(e) => { e.stopPropagation(); setConnectionLogs([]); }}
              >
                Clear
              </Button>
            )}
          </div>
          {showLogs && (
            <div className="mt-2 max-h-[180px] overflow-y-auto space-y-0.5">
              {connectionLogs.length === 0 ? (
                <p className="text-xs text-muted-foreground py-2 text-center">No logs yet</p>
              ) : (
                connectionLogs.map((log) => (
                  <div key={log.id} className="flex items-start gap-2 text-[11px] py-0.5">
                    <span className="text-muted-foreground font-mono shrink-0">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </span>
                    <span className={
                      log.level === 'error' ? 'text-red-400' :
                      log.level === 'warning' ? 'text-amber-400' :
                      'text-muted-foreground'
                    }>
                      {log.message}
                    </span>
                  </div>
                ))
              )}
            </div>
          )}
        </Card>
      </div>
    </ScrollArea>
  );
}

// ── Tabs definition ──
const MCP_TABS = [
  { id: 'server', label: 'Server', icon: Server },
  { id: 'discover', label: 'Discover', icon: Sparkles },
];

// ── Main McpView (tabbed) ──

export default function McpView() {
  const {
    mcpServerStatus, mcpConnections, mcpApprovals, setMcpApprovals,
    refreshMcpStatus, settings: globalSettings, setSettings: globalSetSettings,
    addLog, mcpToolEvents,
  } = useStore();

  const [activeTab, setActiveTab] = useState('server');
  const [connectForm, setConnectForm] = useState({ name: '', url: '', token: '', type: 'http', command: '', args: '', envVar: '' });
  const [showConnectForm, setShowConnectForm] = useState(false);
  const [activePreset, setActivePreset] = useState(null);
  const [connectLoading, setConnectLoading] = useState(false);

  // Called from Discover tab when user clicks "Connect" on a preset
  const handleConnectFromDiscover = useCallback((preset) => {
    if (preset) {
      setConnectForm({
        name: preset.name,
        url: preset.url || '',
        token: '',
        type: preset.type,
        command: preset.command || '',
        args: preset.args || '',
        envVar: preset.authEnv || '',
      });
      setActivePreset(preset.id);
      setShowConnectForm(true);
    } else {
      setShowConnectForm(true);
    }
    setActiveTab('server');
  }, []);

  return (
    <div className="flex flex-col h-full">
      {/* Tab bar — matches GitView pattern */}
      <div className="flex items-center gap-0 border-b border-border shrink-0 bg-background">
        {MCP_TABS.map((tab) => {
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
              {tab.id === 'server' && mcpConnections.length > 0 && (
                <span className="ml-1 text-[10px] text-muted-foreground">
                  ({mcpConnections.length})
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {activeTab === 'server' ? (
          <ServerTab
            mcpServerStatus={mcpServerStatus}
            mcpConnections={mcpConnections}
            mcpApprovals={mcpApprovals}
            setMcpApprovals={setMcpApprovals}
            refreshMcpStatus={refreshMcpStatus}
            globalSettings={globalSettings}
            globalSetSettings={globalSetSettings}
            addLog={addLog}
            mcpToolEvents={mcpToolEvents}
            connectForm={connectForm}
            setConnectForm={setConnectForm}
            showConnectForm={showConnectForm}
            setShowConnectForm={setShowConnectForm}
            activePreset={activePreset}
            setActivePreset={setActivePreset}
            connectLoading={connectLoading}
            setConnectLoading={setConnectLoading}
          />
        ) : (
          <DiscoverTab
            mcpConnections={mcpConnections}
            onConnect={handleConnectFromDiscover}
          />
        )}
      </div>
    </div>
  );
}
