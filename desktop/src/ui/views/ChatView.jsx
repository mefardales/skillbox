import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import {
  Send,
  Bot,
  User,
  ChevronDown,
  Plus,
  Trash2,
  Copy,
  Check,
  Loader2,
  Paperclip,
  X,
  Sparkles,
  MessageSquare,
  Key,
  Eye,
  EyeOff,
  Wrench,
  FolderOpen,
  Search,
  GitBranch,
  Network,
  SplitSquareHorizontal,
  FileCode,
  Image,
  ShieldAlert,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useStore } from '@/hooks/useStore';
import { useToast } from '@/hooks/useToast';
import { electronAPI } from '@/lib/electronAPI';

// ── Model capability badges ──
const MODEL_BADGES = {
  'claude-sonnet-4-20250514': [{ label: 'Fast', color: 'emerald' }, { label: 'Code', color: 'blue' }],
  'claude-opus-4-20250514': [{ label: 'Best', color: 'amber' }, { label: 'Code', color: 'blue' }],
  'claude-haiku-3-5-20241022': [{ label: 'Fastest', color: 'emerald' }],
  'gpt-4o': [{ label: 'Multimodal', color: 'purple' }, { label: 'Code', color: 'blue' }],
  'gpt-4o-mini': [{ label: 'Fast', color: 'emerald' }],
  'o3-mini': [{ label: 'Reasoning', color: 'amber' }],
  'gemini-2.5-pro': [{ label: 'Best', color: 'amber' }, { label: 'Multimodal', color: 'purple' }],
  'gemini-2.5-flash': [{ label: 'Fast', color: 'emerald' }],
  'grok-3': [{ label: 'Best', color: 'amber' }],
  'grok-3-mini': [{ label: 'Fast', color: 'emerald' }],
  'llama3.1': [{ label: 'Local', color: 'gray' }],
  'codellama': [{ label: 'Local', color: 'gray' }, { label: 'Code', color: 'blue' }],
  'mistral': [{ label: 'Local', color: 'gray' }],
  'deepseek-coder-v2': [{ label: 'Local', color: 'gray' }, { label: 'Code', color: 'blue' }],
};

const BADGE_COLORS = {
  emerald: 'bg-emerald-500/15 text-emerald-400',
  blue: 'bg-blue-500/15 text-blue-400',
  amber: 'bg-amber-500/15 text-amber-400',
  purple: 'bg-purple-500/15 text-purple-400',
  gray: 'bg-zinc-500/15 text-zinc-400',
};

// ── Sensitive tool patterns that require approval ──
const SENSITIVE_TOOLS = ['query_database', 'run_service', 'delete_', 'write_file', 'execute_command'];

// ── Default provider definitions ──
const DEFAULT_PROVIDERS = [
  {
    id: 'anthropic',
    name: 'Anthropic',
    color: '#d97706',
    models: [
      { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4', default: true },
      { id: 'claude-opus-4-20250514', name: 'Claude Opus 4' },
      { id: 'claude-haiku-3-5-20241022', name: 'Claude 3.5 Haiku' },
    ],
    settingsKey: 'chat.anthropicKey',
    placeholder: 'sk-ant-xxxxxxxxxxxx',
    docsUrl: 'console.anthropic.com',
  },
  {
    id: 'openai',
    name: 'OpenAI',
    color: '#10b981',
    models: [
      { id: 'gpt-4o', name: 'GPT-4o', default: true },
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini' },
      { id: 'o3-mini', name: 'o3-mini' },
    ],
    settingsKey: 'chat.openaiKey',
    placeholder: 'sk-xxxxxxxxxxxx',
    docsUrl: 'platform.openai.com',
  },
  {
    id: 'google',
    name: 'Google',
    color: '#3b82f6',
    models: [
      { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', default: true },
      { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
    ],
    settingsKey: 'chat.googleKey',
    placeholder: 'AI-xxxxxxxxxxxx',
    docsUrl: 'aistudio.google.com',
  },
  {
    id: 'xai',
    name: 'xAI',
    color: '#8b5cf6',
    models: [
      { id: 'grok-3', name: 'Grok 3', default: true },
      { id: 'grok-3-mini', name: 'Grok 3 Mini' },
    ],
    settingsKey: 'chat.xaiKey',
    placeholder: 'xai-xxxxxxxxxxxx',
    docsUrl: 'console.x.ai',
  },
  {
    id: 'ollama',
    name: 'Ollama (Local)',
    color: '#6b7280',
    models: [
      { id: 'llama3.1', name: 'Llama 3.1', default: true },
      { id: 'codellama', name: 'Code Llama' },
      { id: 'mistral', name: 'Mistral' },
      { id: 'deepseek-coder-v2', name: 'DeepSeek Coder V2' },
    ],
    settingsKey: null,
    placeholder: '',
    docsUrl: 'ollama.ai',
    local: true,
  },
];

// Merge default providers with user-added custom models from settings
function getProviders(settings) {
  const customModels = settings['chat.customModels'] || [];
  // Deep clone defaults to avoid mutation
  const providers = DEFAULT_PROVIDERS.map(p => ({
    ...p,
    models: [...p.models],
  }));

  // Add custom models to their respective providers, or to a "Custom" bucket
  customModels.forEach(cm => {
    const existing = providers.find(p => p.id === cm.providerId);
    if (existing) {
      if (!existing.models.find(m => m.id === cm.id)) {
        existing.models.push({ id: cm.id, name: cm.name, custom: true });
      }
    } else {
      // Custom provider
      let custom = providers.find(p => p.id === 'custom');
      if (!custom) {
        custom = {
          id: 'custom',
          name: 'Custom',
          color: '#ec4899',
          models: [],
          settingsKey: 'chat.customKey',
          placeholder: 'your-api-key',
          docsUrl: '',
        };
        providers.push(custom);
      }
      if (!custom.models.find(m => m.id === cm.id)) {
        custom.models.push({ id: cm.id, name: cm.name, custom: true });
      }
    }
  });

  return providers;
}

// Helper to get agent's assigned projects
function getAgentProjects(agentId, projects) {
  if (!projects || !Array.isArray(projects)) return [];
  return projects.filter(p => {
    try {
      const teamIds = typeof p.teams === 'string' ? JSON.parse(p.teams || '[]') : p.teams || [];
      return teamIds.includes(agentId);
    } catch { return false; }
  });
}

// ── Markdown-like message rendering ──
function MessageContent({ content }) {
  const parts = content.split(/(```[\s\S]*?```)/g);
  return (
    <div className="text-[13px] leading-relaxed whitespace-pre-wrap break-words">
      {parts.map((part, i) => {
        if (part.startsWith('```') && part.endsWith('```')) {
          const inner = part.slice(3, -3);
          const newline = inner.indexOf('\n');
          const lang = newline > 0 ? inner.slice(0, newline).trim() : '';
          const code = newline > 0 ? inner.slice(newline + 1) : inner;
          return (
            <pre key={i} className="my-2 rounded-md border border-border bg-secondary/50 overflow-x-auto">
              {lang && (
                <div className="flex items-center justify-between px-3 py-1 border-b border-border text-[10px] text-muted-foreground">
                  <span>{lang}</span>
                </div>
              )}
              <code className="block px-3 py-2 text-[12px] font-mono">{code}</code>
            </pre>
          );
        }
        const inlined = part.split(/(`[^`]+`)/g);
        return (
          <span key={i}>
            {inlined.map((seg, j) => {
              if (seg.startsWith('`') && seg.endsWith('`')) {
                return (
                  <code key={j} className="px-1 py-0.5 rounded bg-secondary text-[12px] font-mono">
                    {seg.slice(1, -1)}
                  </code>
                );
              }
              const bolded = seg.split(/(\*\*[^*]+\*\*)/g);
              return bolded.map((b, k) => {
                if (b.startsWith('**') && b.endsWith('**')) {
                  return <strong key={`${j}-${k}`}>{b.slice(2, -2)}</strong>;
                }
                return <span key={`${j}-${k}`}>{b}</span>;
              });
            })}
          </span>
        );
      })}
    </div>
  );
}

// ── MCP Tool list rendered inside chat ──
function McpToolsMessage({ tools }) {
  return (
    <div className="flex gap-2.5 px-4 py-3 bg-secondary/20">
      <div className="shrink-0 w-6 h-6 rounded-md bg-blue-500/15 flex items-center justify-center mt-0.5">
        <Network className="w-3 h-3 text-blue-400" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-2">
          <span className="text-[11px] font-medium text-blue-400">MCP Tools Available</span>
          <Badge variant="secondary" className="text-[9px] px-1 py-0 h-3.5">{tools.length} tools</Badge>
        </div>
        <div className="grid gap-1.5">
          {tools.map((tool, idx) => {
            const isSensitive = SENSITIVE_TOOLS.some(s => tool.name?.toLowerCase().includes(s));
            return (
              <div key={idx} className="flex items-center gap-2 py-1 px-2 rounded bg-background/50 border border-border/50">
                <Wrench className="w-3 h-3 text-muted-foreground shrink-0" />
                <span className="text-[12px] font-mono text-foreground">{tool.name}</span>
                {tool.description && (
                  <span className="text-[11px] text-muted-foreground truncate flex-1">{tool.description}</span>
                )}
                {isSensitive ? (
                  <Badge variant="outline" className="text-[8px] px-1 py-0 h-3.5 border-amber-500/50 text-amber-400">
                    <ShieldAlert className="w-2 h-2 mr-0.5" />approval
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-[8px] px-1 py-0 h-3.5 border-emerald-500/50 text-emerald-400">
                    read-only
                  </Badge>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Tool Approval Modal ──
function ApprovalModal({ tool, args, onApprove, onDeny }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-[420px] bg-background border border-border rounded-lg shadow-xl overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-amber-500/5">
          <ShieldAlert className="w-4 h-4 text-amber-400" />
          <h3 className="text-sm font-semibold text-foreground">Tool Approval Required</h3>
        </div>
        <div className="p-4 space-y-3">
          <p className="text-xs text-muted-foreground">
            The assistant wants to execute a sensitive tool. Review and approve or deny.
          </p>
          <div className="rounded-md border border-border bg-secondary/30 p-3 space-y-2">
            <div className="flex items-center gap-2">
              <Wrench className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-[13px] font-mono font-medium text-foreground">{tool}</span>
            </div>
            {args && (
              <pre className="text-[11px] font-mono text-muted-foreground overflow-x-auto whitespace-pre-wrap">
                {typeof args === 'string' ? args : JSON.stringify(args, null, 2)}
              </pre>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 px-4 py-3 border-t border-border justify-end">
          <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={onDeny}>
            <XCircle className="h-3 w-3" />
            Deny
          </Button>
          <Button size="sm" className="h-7 text-xs gap-1 bg-amber-600 hover:bg-amber-700" onClick={onApprove}>
            <CheckCircle className="h-3 w-3" />
            Approve & Execute
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Single message bubble ──
function ChatMessage({ message, onCopy }) {
  const [copied, setCopied] = useState(false);
  const isUser = message.author === 'user';
  const isSystem = message.author === 'system';
  const isTool = message.author === 'tool';
  const isMcpTools = message.author === 'mcp-tools';

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
    onCopy?.();
  };

  if (isSystem) {
    return (
      <div className="flex justify-center py-2">
        <span className="text-[11px] text-muted-foreground bg-secondary/50 px-3 py-1 rounded-full">
          {message.content}
        </span>
      </div>
    );
  }

  if (isMcpTools) {
    return <McpToolsMessage tools={message.tools || []} />;
  }

  if (isTool) {
    return (
      <div className="flex gap-2.5 px-4 py-2">
        <div className="shrink-0 w-6 h-6 rounded-md bg-amber-500/15 flex items-center justify-center mt-0.5">
          <Wrench className="w-3 h-3 text-amber-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-1">
            <span className="text-[11px] font-medium text-amber-400">Tool Call</span>
            <span className="text-[11px] text-muted-foreground font-mono">{message.toolName}</span>
          </div>
          <pre className="text-[11px] font-mono text-muted-foreground bg-secondary/30 rounded-md px-2.5 py-1.5 overflow-x-auto whitespace-pre-wrap">
            {message.content}
          </pre>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('group flex gap-2.5 px-4 py-3', isUser ? 'bg-transparent' : 'bg-secondary/20')}>
      <div className={cn(
        'shrink-0 w-6 h-6 rounded-md flex items-center justify-center mt-0.5',
        isUser ? 'bg-primary/15' : message.isAgent ? 'bg-emerald-500/15' : 'bg-purple-500/15'
      )}>
        {isUser ? <User className="w-3 h-3 text-primary" /> : message.isAgent ? <Bot className="w-3 h-3 text-emerald-400" /> : <Bot className="w-3 h-3 text-purple-400" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[11px] font-medium text-foreground">
            {isUser ? 'You' : message.agentName || message.model || 'Assistant'}
          </span>
          {message.provider && (
            <Badge variant="outline" className="text-[9px] px-1 py-0 h-3.5">
              {message.provider}
            </Badge>
          )}
          {message.isCompare && (
            <Badge variant="outline" className="text-[9px] px-1 py-0 h-3.5 border-purple-500/50 text-purple-400">
              <SplitSquareHorizontal className="w-2 h-2 mr-0.5" />
              compare
            </Badge>
          )}
          <span className="text-[10px] text-muted-foreground">
            {new Date(message.created_at).toLocaleTimeString()}
          </span>
          <button
            onClick={handleCopy}
            className="ml-auto opacity-0 group-hover:opacity-100 h-5 w-5 flex items-center justify-center rounded hover:bg-accent text-muted-foreground transition-opacity"
          >
            {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
          </button>
        </div>
        <MessageContent content={message.content} />
      </div>
    </div>
  );
}

// ── Model selector dropdown with search, badges, and custom model support ──
function ModelSelector({ selectedProvider, selectedModel, onSelect, settings, agents, onSelectAgent, activeAgentId, providers, onAddCustomModel, onRemoveCustomModel }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [showAddModel, setShowAddModel] = useState(false);
  const [newModelId, setNewModelId] = useState('');
  const [newModelName, setNewModelName] = useState('');
  const [newModelProvider, setNewModelProvider] = useState('openai');
  const searchRef = useRef(null);
  const addInputRef = useRef(null);

  const currentProvider = providers.find(p => p.id === selectedProvider);
  const currentModel = currentProvider?.models.find(m => m.id === selectedModel);
  const currentAgent = agents?.find(a => a.id === activeAgentId);

  useEffect(() => {
    if (open && !showAddModel) setTimeout(() => searchRef.current?.focus(), 50);
  }, [open, showAddModel]);

  useEffect(() => {
    if (showAddModel) setTimeout(() => addInputRef.current?.focus(), 50);
  }, [showAddModel]);

  const filteredProviders = useMemo(() => {
    if (!search.trim()) return providers;
    const q = search.toLowerCase();
    return providers.map(p => ({
      ...p,
      models: p.models.filter(m =>
        m.name.toLowerCase().includes(q) || p.name.toLowerCase().includes(q) || m.id.toLowerCase().includes(q)
      ),
    })).filter(p => p.models.length > 0);
  }, [search, providers]);

  const handleAddModel = () => {
    const id = newModelId.trim();
    const name = newModelName.trim() || id;
    if (!id) return;
    onAddCustomModel({ id, name, providerId: newModelProvider });
    onSelect(newModelProvider, id);
    onSelectAgent(null);
    setNewModelId('');
    setNewModelName('');
    setShowAddModel(false);
    setOpen(false);
    setSearch('');
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 h-7 px-2.5 rounded-md border border-border bg-background hover:bg-accent/50 transition-colors text-xs"
      >
        {currentAgent ? (
          <>
            <Bot className="w-3 h-3 text-emerald-400" />
            <span className="font-medium text-foreground">{currentAgent.name}</span>
          </>
        ) : (
          <>
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{ backgroundColor: currentProvider?.color || '#6b7280' }}
            />
            <span className="font-medium text-foreground">{currentModel?.name || 'Select model'}</span>
          </>
        )}
        <ChevronDown className="h-3 w-3 text-muted-foreground" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => { setOpen(false); setSearch(''); setShowAddModel(false); }} />
          <div className="absolute left-0 top-[32px] z-50 w-[320px] bg-background border border-border rounded-md shadow-lg overflow-hidden">
            {showAddModel ? (
              /* Add custom model form */
              <div className="p-3 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-foreground">Add Custom Model</span>
                  <button onClick={() => setShowAddModel(false)} className="text-muted-foreground hover:text-foreground">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] text-muted-foreground">Provider</label>
                  <select
                    value={newModelProvider}
                    onChange={(e) => setNewModelProvider(e.target.value)}
                    className="w-full h-7 px-2 rounded border border-border bg-secondary/50 text-[11px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    {DEFAULT_PROVIDERS.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                    <option value="custom">Custom Provider</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] text-muted-foreground">Model ID (exact API identifier)</label>
                  <input
                    ref={addInputRef}
                    type="text"
                    placeholder="e.g. claude-3-opus-20240229"
                    value={newModelId}
                    onChange={(e) => setNewModelId(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddModel()}
                    className="w-full h-7 px-2 text-[11px] bg-secondary/50 border border-border rounded text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary font-mono"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] text-muted-foreground">Display name (optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. Claude 3 Opus"
                    value={newModelName}
                    onChange={(e) => setNewModelName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddModel()}
                    className="w-full h-7 px-2 text-[11px] bg-secondary/50 border border-border rounded text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <Button size="sm" className="w-full h-7 text-xs" onClick={handleAddModel} disabled={!newModelId.trim()}>
                  <Plus className="h-3 w-3 mr-1" />
                  Add Model
                </Button>
              </div>
            ) : (
              <>
                {/* Search */}
                <div className="px-2 py-1.5 border-b border-border">
                  <div className="relative">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                    <input
                      ref={searchRef}
                      type="text"
                      placeholder="Search models or agents..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="w-full h-6 pl-7 pr-2 text-[11px] bg-secondary/50 border border-border rounded text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                </div>

                <ScrollArea className="max-h-[380px]">
                  {/* Agents section */}
                  {agents && agents.length > 0 && !search.trim() && (
                    <div>
                      <div className="flex items-center gap-2 px-3 py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground bg-emerald-500/5">
                        <Bot className="w-2.5 h-2.5 text-emerald-400" />
                        Agents
                        <span className="ml-auto text-[9px] normal-case tracking-normal text-emerald-400/60">chat with your team</span>
                      </div>
                      {agents.map(agent => {
                        const isSelected = activeAgentId === agent.id;
                        return (
                          <button
                            key={agent.id}
                            onClick={() => { onSelectAgent(agent.id); setOpen(false); setSearch(''); }}
                            className={cn(
                              'flex items-center gap-2 w-full px-3 py-1.5 text-left text-[12px] transition-colors',
                              isSelected
                                ? 'bg-emerald-500/10 text-emerald-400 font-medium'
                                : 'text-foreground hover:bg-accent/50'
                            )}
                          >
                            {isSelected && <Check className="h-3 w-3 text-emerald-400 shrink-0" />}
                            {!isSelected && <span className="w-3" />}
                            <span className="truncate">{agent.name}</span>
                            <Badge variant="secondary" className="text-[8px] px-1 py-0 h-3 ml-auto bg-emerald-500/15 text-emerald-400 max-w-[100px] truncate">
                              {agent.description || 'Agent'}
                            </Badge>
                          </button>
                        );
                      })}
                      <div className="h-px bg-border" />
                    </div>
                  )}

                  {/* Models */}
                  {filteredProviders.map(provider => {
                    const hasKey = provider.local || (settings[provider.settingsKey] && settings[provider.settingsKey].length > 0);
                    return (
                      <div key={provider.id}>
                        <div className="flex items-center gap-2 px-3 py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground bg-secondary/30">
                          <span
                            className="w-1.5 h-1.5 rounded-full"
                            style={{ backgroundColor: provider.color }}
                          />
                          {provider.name}
                          {!hasKey && !provider.local && (
                            <span className="ml-auto flex items-center gap-0.5 text-amber-400 normal-case tracking-normal">
                              <Key className="h-2.5 w-2.5" />
                              No key
                            </span>
                          )}
                          {provider.local && (
                            <span className="ml-auto text-emerald-400 normal-case tracking-normal">Local</span>
                          )}
                        </div>
                        {provider.models.map(model => {
                          const isSelected = !activeAgentId && selectedProvider === provider.id && selectedModel === model.id;
                          const badges = MODEL_BADGES[model.id] || (model.custom ? [{ label: 'Custom', color: 'purple' }] : []);
                          return (
                            <div key={model.id} className="group/model flex items-center">
                              <button
                                onClick={() => { onSelect(provider.id, model.id); onSelectAgent(null); setOpen(false); setSearch(''); }}
                                className={cn(
                                  'flex items-center gap-2 flex-1 px-3 py-1.5 text-left text-[12px] transition-colors',
                                  isSelected
                                    ? 'bg-primary/10 text-primary font-medium'
                                    : 'text-foreground hover:bg-accent/50'
                                )}
                              >
                                {isSelected && <Check className="h-3 w-3 text-primary shrink-0" />}
                                {!isSelected && <span className="w-3" />}
                                <span className="truncate">{model.name}</span>
                                <div className="flex items-center gap-1 ml-auto shrink-0">
                                  {badges.map((badge, idx) => (
                                    <span
                                      key={idx}
                                      className={cn('text-[8px] px-1 py-0 rounded', BADGE_COLORS[badge.color])}
                                    >
                                      {badge.label}
                                    </span>
                                  ))}
                                </div>
                              </button>
                              {model.custom && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); onRemoveCustomModel(model.id); }}
                                  className="opacity-0 group-hover/model:opacity-100 h-5 w-5 flex items-center justify-center mr-1 rounded hover:bg-destructive/20 text-muted-foreground transition-opacity"
                                  title="Remove custom model"
                                >
                                  <X className="h-2.5 w-2.5" />
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}

                  {filteredProviders.length === 0 && (
                    <p className="text-[11px] text-muted-foreground text-center py-4">No models match "{search}"</p>
                  )}
                </ScrollArea>

                {/* Add custom model button */}
                <div className="border-t border-border">
                  <button
                    onClick={() => setShowAddModel(true)}
                    className="flex items-center gap-2 w-full px-3 py-2 text-[11px] text-muted-foreground hover:bg-accent/50 hover:text-foreground transition-colors"
                  >
                    <Plus className="h-3 w-3" />
                    Add custom model...
                  </button>
                </div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ── API Keys settings panel ──
function ApiKeysPanel({ settings, onSave, onClose }) {
  const [keys, setKeys] = useState({});
  const [showKeys, setShowKeys] = useState({});

  useEffect(() => {
    const initial = {};
    DEFAULT_PROVIDERS.forEach(p => {
      if (p.settingsKey) {
        initial[p.settingsKey] = settings[p.settingsKey] || '';
      }
    });
    setKeys(initial);
  }, [settings]);

  const handleSave = () => {
    onSave(keys);
    onClose();
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <Key className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold">API Keys</h3>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          <p className="text-xs text-muted-foreground">
            Configure API keys to enable LLM providers. Keys are stored locally and never shared.
          </p>

          {DEFAULT_PROVIDERS.map(provider => {
            if (!provider.settingsKey) {
              return (
                <div key={provider.id} className="flex items-center gap-3 p-3 rounded-md border border-border">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: provider.color }} />
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium">{provider.name}</span>
                    <p className="text-[11px] text-muted-foreground">No API key needed — runs locally</p>
                  </div>
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 bg-emerald-500/15 text-emerald-400">
                    Local
                  </Badge>
                </div>
              );
            }

            const val = keys[provider.settingsKey] || '';
            const isSet = val.length > 0;
            const show = showKeys[provider.id];

            return (
              <div key={provider.id} className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: provider.color }} />
                  <Label className="text-sm">{provider.name}</Label>
                  {isSet && (
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 bg-emerald-500/15 text-emerald-400">
                      Configured
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  <Input
                    type={show ? 'text' : 'password'}
                    placeholder={provider.placeholder}
                    value={val}
                    onChange={(e) => setKeys(prev => ({ ...prev, [provider.settingsKey]: e.target.value }))}
                    className="flex-1 font-mono text-xs"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    onClick={() => setShowKeys(prev => ({ ...prev, [provider.id]: !show }))}
                  >
                    {show ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                  </Button>
                </div>
                <p className="text-[10px] text-muted-foreground">{provider.docsUrl}</p>
              </div>
            );
          })}
        </div>
      </ScrollArea>

      <div className="flex items-center gap-2 px-4 py-3 border-t border-border shrink-0">
        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={onClose}>
          Cancel
        </Button>
        <Button size="sm" className="h-7 text-xs" onClick={handleSave}>
          Save Keys
        </Button>
      </div>
    </div>
  );
}

// ── Conversation sidebar ──
function ConversationList({ conversations, activeId, onSelect, onNew, onDelete }) {
  return (
    <div className="flex flex-col h-full border-r border-border">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border shrink-0">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Conversations</span>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onNew}>
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">New conversation</TooltipContent>
        </Tooltip>
      </div>
      <ScrollArea className="flex-1">
        <div className="py-1">
          {conversations.length === 0 && (
            <p className="text-[11px] text-muted-foreground text-center py-4">No conversations yet</p>
          )}
          {conversations.map(conv => (
            <div
              key={conv.id}
              onClick={() => onSelect(conv.id)}
              className={cn(
                'group flex items-center gap-2 px-3 py-2 cursor-pointer transition-colors',
                activeId === conv.id ? 'bg-accent/60' : 'hover:bg-accent/30'
              )}
            >
              <MessageSquare className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-[12px] text-foreground truncate">{conv.title || 'New conversation'}</p>
                <p className="text-[10px] text-muted-foreground">
                  {conv.messageCount || 0} messages
                  {conv.project && <span> · {conv.project}</span>}
                </p>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); onDelete(conv.id); }}
                className="opacity-0 group-hover:opacity-100 h-5 w-5 flex items-center justify-center rounded hover:bg-accent text-muted-foreground shrink-0"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

// ── Dynamic quick replies based on project context ──
function useQuickReplies(activeProject, gitInfo, mcpConnections, teams) {
  return useMemo(() => {
    const replies = [];

    if (activeProject) {
      replies.push({ label: `Analyze ${activeProject.name}`, icon: FolderOpen });

      if (gitInfo?.branch) {
        replies.push({ label: `What changed on ${gitInfo.branch}?`, icon: GitBranch });
      }
    }

    if (mcpConnections && mcpConnections.length > 0) {
      replies.push({ label: 'List my MCP tools', icon: Network });
    }

    if (teams && teams.length > 0) {
      replies.push({ label: 'What can my agents do?', icon: Bot });
    }

    // Always available
    replies.push({ label: 'Help me debug an issue', icon: Wrench });
    replies.push({ label: 'Explain this codebase', icon: FileCode });

    return replies.slice(0, 6);
  }, [activeProject, gitInfo?.branch, mcpConnections?.length, teams?.length]);
}

// ── Main ChatView ──
export default function ChatView() {
  const { activeProject, projects, settings, setSettings, teams, gitInfo, mcpConnections, mcpServerStatus, setActiveView } = useStore();
  const { toast } = useToast();

  const [conversations, setConversations] = useState([
    { id: 'default', title: 'New conversation', messageCount: 0, project: null },
  ]);
  const [activeConversationId, setActiveConversationId] = useState('default');
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [selectedProvider, setSelectedProvider] = useState('anthropic');
  const [selectedModel, setSelectedModel] = useState('claude-sonnet-4-20250514');
  const [activeAgentId, setActiveAgentId] = useState(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [showKeys, setShowKeys] = useState(false);
  const [attachProject, setAttachProject] = useState(false);
  const [sidebarWidth] = useState(220);
  const [pendingApproval, setPendingApproval] = useState(null);
  const [compareModel, setCompareModel] = useState(null);

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const quickReplies = useQuickReplies(activeProject, gitInfo, mcpConnections, teams);

  // Dynamic providers (defaults + custom models from settings)
  const providers = useMemo(() => getProviders(settings), [settings]);

  // Get available agents from teams with their assigned projects
  const agents = useMemo(() => {
    if (!teams || !Array.isArray(teams)) return [];
    return teams.map(t => {
      const agentProjects = getAgentProjects(t.id, projects);
      return {
        id: t.id,
        name: t.name,
        description: t.description || 'Agent',
        skills: (() => { try { return JSON.parse(t.members || '[]'); } catch { return []; } })(),
        projects: agentProjects.map(p => ({ name: p.name, path: p.path })),
      };
    });
  }, [teams, projects]);

  // Add/remove custom models and persist to settings
  const handleAddCustomModel = useCallback(async (model) => {
    const current = settings['chat.customModels'] || [];
    if (current.find(m => m.id === model.id)) {
      toast('Model already exists', 'error');
      return;
    }
    const updated = { ...settings, 'chat.customModels': [...current, model] };
    await electronAPI.saveSettings(updated);
    setSettings(updated);
    toast(`Added ${model.name || model.id}`, 'success');
  }, [settings, setSettings, toast]);

  const handleRemoveCustomModel = useCallback(async (modelId) => {
    const current = settings['chat.customModels'] || [];
    const updated = { ...settings, 'chat.customModels': current.filter(m => m.id !== modelId) };
    await electronAPI.saveSettings(updated);
    setSettings(updated);
    toast('Model removed', 'success');
  }, [settings, setSettings, toast]);

  // Load messages for active conversation
  useEffect(() => {
    if (activeConversationId) {
      electronAPI.getMessages(activeProject?.path || null, activeConversationId).then(msgs => {
        if (Array.isArray(msgs)) {
          setMessages(msgs);
        }
      });
    }
  }, [activeConversationId, activeProject?.path]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleModelSelect = useCallback((providerId, modelId) => {
    setSelectedProvider(providerId);
    setSelectedModel(modelId);
  }, []);

  const handleSelectAgent = useCallback((agentId) => {
    setActiveAgentId(agentId);
  }, []);

  const handleNewConversation = useCallback(() => {
    const id = `conv-${Date.now()}`;
    setConversations(prev => [
      { id, title: 'New conversation', messageCount: 0, project: activeProject?.name || null },
      ...prev,
    ]);
    setActiveConversationId(id);
    setMessages([]);
  }, [activeProject?.name]);

  const handleDeleteConversation = useCallback((id) => {
    setConversations(prev => prev.filter(c => c.id !== id));
    if (activeConversationId === id) {
      setActiveConversationId(conversations[0]?.id || 'default');
      setMessages([]);
    }
  }, [activeConversationId, conversations]);

  // ── MCP tool discovery ──
  const handleListMcpTools = useCallback(async () => {
    const tools = await electronAPI.mcpClientAllTools();
    if (Array.isArray(tools) && tools.length > 0) {
      const toolMsg = {
        id: `msg-mcp-${Date.now()}`,
        author: 'mcp-tools',
        tools,
        created_at: new Date().toISOString(),
      };
      setMessages(prev => [...prev, toolMsg]);
    } else {
      const noToolsMsg = {
        id: `msg-${Date.now()}`,
        author: 'assistant',
        content: 'No MCP tools are currently available. Connect to an MCP server first via the **MCP** panel to discover available tools.',
        model: 'System',
        created_at: new Date().toISOString(),
      };
      setMessages(prev => [...prev, noToolsMsg]);
    }
  }, []);

  // ── Multi-model compare ──
  const handleCompare = useCallback(async (text) => {
    if (!compareModel) return;

    const [compProviderId, compModelId] = compareModel.split(':');
    const compProvider = providers.find(p => p.id === compProviderId);
    const compModel = compProvider?.models.find(m => m.id === compModelId);

    if (!compProvider || !compModel) return;

    const compMsg = {
      id: `msg-cmp-${Date.now()}`,
      author: 'assistant',
      content: '',
      model: compModel.name,
      provider: compProvider.name,
      isCompare: true,
      created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, compMsg]);

    const placeholder = getPlaceholderResponse(text, compProvider.name, compModel.name, activeProject, attachProject);
    let accumulated = '';
    for (let i = 0; i < placeholder.length; i++) {
      accumulated += placeholder[i];
      setMessages(prev => prev.map(m =>
        m.id === compMsg.id ? { ...m, content: accumulated } : m
      ));
      await new Promise(r => setTimeout(r, 8));
    }

    electronAPI.sendMessage({
      id: compMsg.id,
      project_path: activeProject?.path || null,
      task_id: activeConversationId,
      author: 'assistant',
      content: accumulated,
    });
  }, [compareModel, activeProject, attachProject, activeConversationId, providers]);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || isStreaming) return;

    // Check for MCP tool listing intent
    const lower = text.toLowerCase();
    if (lower.includes('list') && (lower.includes('mcp') || lower.includes('tool'))) {
      const userMsg = {
        id: `msg-${Date.now()}`,
        author: 'user',
        content: text,
        created_at: new Date().toISOString(),
      };
      setMessages(prev => [...prev, userMsg]);
      setInput('');

      electronAPI.sendMessage({
        id: userMsg.id,
        project_path: activeProject?.path || null,
        task_id: activeConversationId,
        author: 'user',
        content: text,
      });

      setConversations(prev => prev.map(c =>
        c.id === activeConversationId
          ? { ...c, title: c.messageCount === 0 ? text.slice(0, 50) : c.title, messageCount: (c.messageCount || 0) + 1 }
          : c
      ));

      await handleListMcpTools();
      return;
    }

    const provider = providers.find(p => p.id === selectedProvider);
    const model = provider?.models.find(m => m.id === selectedModel);
    const hasKey = provider?.local || (settings[provider?.settingsKey] && settings[provider?.settingsKey].length > 0);

    if (!hasKey && !provider?.local && !activeAgentId) {
      toast('Configure an API key first', 'error');
      setShowKeys(true);
      return;
    }

    // Add user message
    const userMsg = {
      id: `msg-${Date.now()}`,
      author: 'user',
      content: text,
      created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, userMsg]);
    setInput('');

    electronAPI.sendMessage({
      id: userMsg.id,
      project_path: activeProject?.path || null,
      task_id: activeConversationId,
      author: 'user',
      content: text,
    });

    setConversations(prev => prev.map(c =>
      c.id === activeConversationId
        ? { ...c, title: c.messageCount === 0 ? text.slice(0, 50) : c.title, messageCount: (c.messageCount || 0) + 1 }
        : c
    ));

    // Check if prompt implies sensitive tool usage
    const sensitiveMatch = SENSITIVE_TOOLS.find(s =>
      lower.includes(s.replace('_', ' ')) || lower.includes(s)
    );
    if (sensitiveMatch && !lower.includes('list') && !lower.includes('what')) {
      setPendingApproval({ tool: sensitiveMatch, args: text, resolve: null });
    }

    // Simulate streaming response
    setIsStreaming(true);

    const activeAgent = agents.find(a => a.id === activeAgentId);
    const assistantMsg = {
      id: `msg-${Date.now() + 1}`,
      author: 'assistant',
      content: '',
      model: activeAgent ? activeAgent.name : (model?.name || 'Assistant'),
      provider: activeAgent ? 'Agent' : provider?.name,
      isAgent: !!activeAgent,
      agentName: activeAgent?.name || null,
      created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, assistantMsg]);

    const placeholder = getPlaceholderResponse(text, provider?.name, model?.name, activeProject, attachProject, activeAgent);
    let accumulated = '';
    for (let i = 0; i < placeholder.length; i++) {
      accumulated += placeholder[i];
      setMessages(prev => prev.map(m =>
        m.id === assistantMsg.id ? { ...m, content: accumulated } : m
      ));
      await new Promise(r => setTimeout(r, 8));
    }

    electronAPI.sendMessage({
      id: assistantMsg.id,
      project_path: activeProject?.path || null,
      task_id: activeConversationId,
      author: 'assistant',
      content: accumulated,
    });

    setConversations(prev => prev.map(c =>
      c.id === activeConversationId ? { ...c, messageCount: (c.messageCount || 0) + 1 } : c
    ));
    setIsStreaming(false);

    // Trigger compare if enabled
    if (compareModel) {
      await handleCompare(text, accumulated);
    }
  }, [input, isStreaming, selectedProvider, selectedModel, settings, activeProject, activeConversationId, attachProject, toast, activeAgentId, agents, compareModel, handleCompare, handleListMcpTools, providers, projects]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSaveKeys = useCallback(async (keys) => {
    const updated = { ...settings, ...keys };
    await electronAPI.saveSettings(updated);
    setSettings(updated);
    toast('API keys saved', 'success');
  }, [settings, setSettings, toast]);

  const hasAnyKey = providers.some(p => p.local || (settings[p.settingsKey] && settings[p.settingsKey].length > 0));

  // Build compare model options (all models except the currently selected one)
  const compareOptions = useMemo(() => {
    const opts = [];
    providers.forEach(p => {
      p.models.forEach(m => {
        if (!(p.id === selectedProvider && m.id === selectedModel)) {
          opts.push({ value: `${p.id}:${m.id}`, label: m.name, providerName: p.name, color: p.color });
        }
      });
    });
    return opts;
  }, [selectedProvider, selectedModel]);

  if (showKeys) {
    return (
      <div className="flex flex-col h-full">
        <ApiKeysPanel
          settings={settings}
          onSave={handleSaveKeys}
          onClose={() => setShowKeys(false)}
        />
      </div>
    );
  }

  return (
    <div className="flex h-full">
      {/* Tool approval modal */}
      {pendingApproval && (
        <ApprovalModal
          tool={pendingApproval.tool}
          args={pendingApproval.args}
          onApprove={() => {
            toast('Tool execution approved', 'success');
            setPendingApproval(null);
          }}
          onDeny={() => {
            toast('Tool execution denied', 'info');
            setPendingApproval(null);
            const denyMsg = {
              id: `msg-deny-${Date.now()}`,
              author: 'system',
              content: `Tool "${pendingApproval.tool}" was denied by user.`,
              created_at: new Date().toISOString(),
            };
            setMessages(prev => [...prev, denyMsg]);
          }}
        />
      )}

      {/* Conversation sidebar */}
      <div style={{ width: sidebarWidth, minWidth: sidebarWidth }} className="shrink-0">
        <ConversationList
          conversations={conversations}
          activeId={activeConversationId}
          onSelect={setActiveConversationId}
          onNew={handleNewConversation}
          onDelete={handleDeleteConversation}
        />
      </div>

      {/* Main chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Chat header */}
        <div className="flex items-center gap-2 px-4 py-2 border-b border-border shrink-0">
          <ModelSelector
            selectedProvider={selectedProvider}
            selectedModel={selectedModel}
            onSelect={handleModelSelect}
            settings={settings}
            agents={agents}
            onSelectAgent={handleSelectAgent}
            activeAgentId={activeAgentId}
            providers={providers}
            onAddCustomModel={handleAddCustomModel}
            onRemoveCustomModel={handleRemoveCustomModel}
          />

          {activeProject && (
            <button
              onClick={() => setAttachProject(!attachProject)}
              className={cn(
                'flex items-center gap-1.5 h-7 px-2.5 rounded-md border text-xs transition-colors',
                attachProject
                  ? 'border-primary/50 bg-primary/10 text-primary'
                  : 'border-border bg-background text-muted-foreground hover:bg-accent/50'
              )}
            >
              <FolderOpen className="h-3 w-3" />
              <span className="truncate max-w-[120px]">{activeProject.name}</span>
              {attachProject && <Check className="h-3 w-3" />}
            </button>
          )}

          {/* Compare mode toggle */}
          <div className="relative group">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => setCompareModel(compareModel ? null : compareOptions[0]?.value || null)}
                  className={cn(
                    'flex items-center gap-1 h-7 px-2 rounded-md border text-xs transition-colors',
                    compareModel
                      ? 'border-purple-500/50 bg-purple-500/10 text-purple-400'
                      : 'border-border bg-background text-muted-foreground hover:bg-accent/50'
                  )}
                >
                  <SplitSquareHorizontal className="h-3 w-3" />
                  {compareModel ? 'Compare' : ''}
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                {compareModel ? 'Disable compare mode' : 'Compare responses with another model'}
              </TooltipContent>
            </Tooltip>
          </div>

          {/* Compare model picker (shown when compare is active) */}
          {compareModel && (
            <select
              value={compareModel}
              onChange={(e) => setCompareModel(e.target.value)}
              className="h-7 px-2 rounded-md border border-border bg-background text-[11px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              {compareOptions.map(opt => (
                <option key={opt.value} value={opt.value}>
                  {opt.providerName} · {opt.label}
                </option>
              ))}
            </select>
          )}

          <div className="flex items-center gap-1 ml-auto">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setShowKeys(true)}>
                  <Key className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">API Keys</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleNewConversation}>
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">New conversation</TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* Messages area */}
        <ScrollArea className="flex-1">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full py-16">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                <Sparkles className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-sm font-semibold text-foreground mb-1">Start a conversation</h3>
              <p className="text-xs text-muted-foreground text-center max-w-[300px] mb-4">
                Chat with any LLM. Your agents and MCP tools are available as context.
              </p>
              {!hasAnyKey && (
                <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5 mb-4" onClick={() => setShowKeys(true)}>
                  <Key className="h-3 w-3" />
                  Configure API Keys
                </Button>
              )}
              {/* Dynamic quick replies */}
              <div className="flex flex-wrap gap-2 justify-center max-w-[480px]">
                {quickReplies.map((qr, idx) => {
                  const Icon = qr.icon;
                  return (
                    <button
                      key={idx}
                      onClick={() => { setInput(qr.label); inputRef.current?.focus(); }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border text-xs text-muted-foreground hover:bg-accent/50 hover:text-foreground transition-colors"
                    >
                      <Icon className="h-3 w-3" />
                      {qr.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div>
              {messages.map(msg => (
                <ChatMessage
                  key={msg.id}
                  message={msg}
                  onCopy={() => toast('Copied to clipboard', 'success')}
                />
              ))}
              {isStreaming && (
                <div className="flex items-center gap-2 px-4 py-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Generating...
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </ScrollArea>

        {/* Input area */}
        <div className="px-4 py-3 border-t border-border shrink-0">
          {attachProject && activeProject && (
            <div className="flex items-center gap-1.5 mb-2 text-[11px] text-muted-foreground">
              <Paperclip className="h-3 w-3" />
              Project context attached: <span className="text-foreground font-medium">{activeProject.name}</span>
              <button onClick={() => setAttachProject(false)} className="ml-1 text-muted-foreground hover:text-foreground">
                <X className="h-3 w-3" />
              </button>
            </div>
          )}

          {/* Input toolbar */}
          <div className="flex items-center gap-1 mb-1.5">
            <Tooltip>
              <TooltipTrigger asChild>
                <button className="flex items-center gap-1 h-6 px-2 rounded text-[11px] text-muted-foreground hover:bg-accent/50 hover:text-foreground transition-colors">
                  <Paperclip className="h-3 w-3" />
                  Attach
                </button>
              </TooltipTrigger>
              <TooltipContent side="top">Attach file or code snippet</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <button className="flex items-center gap-1 h-6 px-2 rounded text-[11px] text-muted-foreground hover:bg-accent/50 hover:text-foreground transition-colors">
                  <Image className="h-3 w-3" />
                  Image
                </button>
              </TooltipTrigger>
              <TooltipContent side="top">Attach image</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <button className="flex items-center gap-1 h-6 px-2 rounded text-[11px] text-muted-foreground hover:bg-accent/50 hover:text-foreground transition-colors">
                  <FileCode className="h-3 w-3" />
                  Snippet
                </button>
              </TooltipTrigger>
              <TooltipContent side="top">Insert code snippet from project</TooltipContent>
            </Tooltip>

            {activeAgentId && (
              <div className="flex items-center gap-1 ml-auto text-[10px] text-emerald-400">
                <Bot className="h-3 w-3" />
                Agent: {agents.find(a => a.id === activeAgentId)?.name}
              </div>
            )}
          </div>

          <div className="flex items-end gap-2">
            <div className="flex-1 relative">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={activeAgentId
                  ? `Message ${agents.find(a => a.id === activeAgentId)?.name || 'agent'}...`
                  : 'Send a message...'
                }
                rows={1}
                className="w-full min-h-[40px] max-h-[160px] px-3 py-2.5 rounded-md border border-border bg-background text-[13px] resize-none placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                style={{ height: 'auto', overflow: 'hidden' }}
                onInput={(e) => {
                  e.target.style.height = 'auto';
                  e.target.style.height = Math.min(e.target.scrollHeight, 160) + 'px';
                }}
              />
            </div>
            <Button
              size="icon"
              className="h-10 w-10 shrink-0"
              onClick={handleSend}
              disabled={!input.trim() || isStreaming}
            >
              {isStreaming ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
          <div className="flex items-center gap-2 mt-1.5">
            <span className="text-[10px] text-muted-foreground">
              {activeAgentId ? 'Agent mode' : (selectedProvider === 'ollama' ? 'Local model' : 'API')} · Enter to send · Shift+Enter for new line
            </span>
            {!mcpServerStatus?.running && (
              <button
                onClick={() => setActiveView('mcp')}
                className="flex items-center gap-1 text-[10px] text-amber-400 hover:text-amber-300 transition-colors ml-auto"
              >
                <Network className="h-2.5 w-2.5" />
                MCP disconnected
              </button>
            )}
            {mcpServerStatus?.running && (
              <span className="flex items-center gap-1 text-[10px] text-emerald-400 ml-auto">
                <Network className="h-2.5 w-2.5" />
                MCP :{mcpServerStatus.port}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Placeholder response generator (temporary) ──
function getPlaceholderResponse(prompt, provider, model, project, hasContext, agent) {
  const projectInfo = hasContext && project
    ? `\n\nI can see you have the project **${project.name}** attached. `
    : '';

  const lower = prompt.toLowerCase();

  // ── Agent-aware responses ──
  if (agent) {
    const agentProjectList = agent.projects?.length
      ? agent.projects.map(p => `- **${p.name}** (\`${p.path}\`)`).join('\n')
      : '- No projects assigned yet';
    const skillList = agent.skills?.length ? agent.skills.join(', ') : 'None configured';

    // Agent intro / greeting
    if (lower.includes('hello') || lower.includes('hi') || lower.includes('hey') || lower.includes('hola')) {
      return `Hey! I'm **${agent.name}**, your **${agent.description}**.\n\n**My skills:** ${skillList}\n\n**Projects I'm working on:**\n${agentProjectList}\n\nWhat do you need help with?`;
    }

    // Ask about projects
    if (lower.includes('project') || lower.includes('trabajo') || lower.includes('working')) {
      return `Here are the projects I'm assigned to:\n\n${agentProjectList}\n\n**My role:** ${agent.description}\n**Skills:** ${skillList}\n\nI can help with any of these projects. Which one do you want to work on?`;
    }

    // Ask about skills/capabilities
    if (lower.includes('skill') || lower.includes('can you') || lower.includes('what do you') || lower.includes('que sabes') || lower.includes('capable')) {
      return `As a **${agent.description}**, here's what I can help with:\n\n**Skills:** ${skillList}\n\n**Assigned projects:** ${agent.projects?.length || 0}\n${agentProjectList}\n\nI specialize in ${agent.description.toLowerCase()} tasks. Ask me anything related to my expertise!`;
    }

    // Ask about tasks
    if (lower.includes('task') || lower.includes('tarea') || lower.includes('pending') || lower.includes('status') || lower.includes('doing')) {
      return `Here's my current status as **${agent.name}** (${agent.description}):\n\n**Assigned projects:**\n${agentProjectList}\n\n**Skills:** ${skillList}\n\nI'm ready to work on any of these projects. What would you like me to focus on?${projectInfo}`;
    }

    // Default agent response
    return `I'm **${agent.name}**, a **${agent.description}** agent.\n\n**Skills:** ${skillList}\n**Projects:** ${agent.projects?.map(p => p.name).join(', ') || 'None'}${projectInfo}\n\nI received your message: "${prompt.slice(0, 80)}${prompt.length > 80 ? '...' : ''}"\n\nThis is a placeholder response — once the LLM backend is connected, I'll respond using my specialized system prompt with full context of my role, skills, and project assignments.`;
  }

  // ── Standard (non-agent) responses ──
  if (lower.includes('hello') || lower.includes('hi') || lower.includes('hey') || lower.includes('hola')) {
    return `Hello! I'm ready to help you with your development tasks.${projectInfo}What would you like to work on?`;
  }

  if (lower.includes('mcp') || lower.includes('tool')) {
    return `I can access your Skillbox MCP tools to interact with your projects. Available tools include:\n\n- \`list_projects\` — List all registered projects\n- \`git_status\` — Check repository status\n- \`query_database\` — Run queries (requires approval)\n- \`get_project_env_vars\` — Read environment variables\n- \`run_service\` — Execute commands (requires approval)\n\nWould you like me to call any of these tools?${projectInfo}`;
  }

  if (lower.includes('agent') && lower.includes('what')) {
    return 'Select an agent from the model dropdown to activate agent mode. Each agent has a specialized role, skill set, and project assignments. You can chat with them naturally — ask about their projects, tasks, and capabilities.';
  }

  if (lower.includes('project') || lower.includes('structure') || lower.includes('analyze')) {
    return `${projectInfo || "I'd be happy to help analyze your project. "}To give you the best insights, I can:\n\n1. **Analyze the file structure** — understand the architecture\n2. **Review recent commits** — see what changed recently\n3. **Check dependencies** — identify the tech stack\n4. **Read config files** — understand build and deployment setup\n\nWhat would you like me to look into?`;
  }

  if (lower.includes('debug')) {
    return `I'll help you debug. To get started, please share:\n\n1. **The error message** — paste the full error or stack trace\n2. **What you expected** — the correct behavior\n3. **What you tried** — any debugging steps so far\n\n${hasContext && project ? `I have access to your project **${project.name}** context and can reference your codebase.` : 'Tip: Attach your project context for more targeted help.'}`;
  }

  return `I received your message. I'm currently running as a **${model}** model via **${provider}**.${projectInfo}\n\nThis is a placeholder response — real LLM integration is coming soon. The chat infrastructure is ready:\n\n- Multi-provider model selection + custom models\n- Agent mode with project-aware conversations\n- MCP tool discovery and approval flow\n- Multi-model compare mode\n- Project context injection\n- Conversation persistence in SQLite\n- Streaming response rendering\n\nOnce API keys are configured and the backend proxy is wired up, I'll provide real responses with full tool-use capabilities.`;
}
