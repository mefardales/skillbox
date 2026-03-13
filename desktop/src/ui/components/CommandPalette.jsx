import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  FolderOpen,
  Zap,
  Users,
  Clock,
  Github,
  Terminal,
  Settings,
  Puzzle,
  Search,
  PanelLeft,
  PanelRight,
  ToggleLeft,
} from 'lucide-react';
import { useStore } from '@/hooks/useStore';

const COMMANDS = [
  // Views
  { id: 'view:projects', label: 'Projects', category: 'Navigate', icon: FolderOpen, keywords: 'dashboard home' },
  { id: 'view:skills', label: 'Skills', category: 'Navigate', icon: Zap, keywords: 'ai automation' },
  { id: 'view:teams', label: 'Agents', category: 'Navigate', icon: Users, keywords: 'ai bot agent' },
  { id: 'view:history', label: 'History', category: 'Navigate', icon: Clock, keywords: 'log recent' },
  { id: 'view:github', label: 'GitHub', category: 'Navigate', icon: Github, keywords: 'repo git' },
  { id: 'view:extensions', label: 'Extensions', category: 'Navigate', icon: Puzzle, keywords: 'plugins addons' },
  { id: 'view:settings', label: 'Settings', category: 'Navigate', icon: Settings, keywords: 'preferences config' },
  // Panels
  { id: 'panel:terminal', label: 'Toggle Terminal', category: 'Panel', icon: Terminal, keywords: 'shell console' },
  { id: 'panel:sidebar', label: 'Toggle Sidebar', category: 'Panel', icon: PanelLeft, keywords: 'explorer files' },
  { id: 'panel:right', label: 'Toggle Right Panel', category: 'Panel', icon: PanelRight, keywords: 'context info' },
];

export default function CommandPalette({ open, onClose }) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  const {
    setActiveView,
    terminalPanelOpen, setTerminalPanelOpen,
    projectSidebarOpen, setProjectSidebarOpen,
    rightPanelOpen, setRightPanelOpen,
    projects,
  } = useStore();

  // Build dynamic items from projects and tasks
  const dynamicItems = useMemo(() => {
    const items = [];
    projects.forEach((p) => {
      items.push({
        id: `project:${p.path}`,
        label: p.name,
        category: 'Project',
        icon: FolderOpen,
        keywords: p.path || '',
      });
    });
    return items;
  }, [projects]);

  const allItems = useMemo(() => [...COMMANDS, ...dynamicItems], [dynamicItems]);

  const filtered = useMemo(() => {
    if (!query.trim()) return allItems;
    const q = query.toLowerCase();
    return allItems.filter((item) =>
      item.label.toLowerCase().includes(q) ||
      item.category.toLowerCase().includes(q) ||
      (item.keywords && item.keywords.toLowerCase().includes(q))
    );
  }, [query, allItems]);

  // Group by category
  const grouped = useMemo(() => {
    const map = new Map();
    filtered.forEach((item) => {
      if (!map.has(item.category)) map.set(item.category, []);
      map.get(item.category).push(item);
    });
    return map;
  }, [filtered]);

  // Reset on open
  useEffect(() => {
    if (open) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  // Clamp selection
  useEffect(() => {
    if (selectedIndex >= filtered.length) {
      setSelectedIndex(Math.max(0, filtered.length - 1));
    }
  }, [filtered.length, selectedIndex]);

  // Scroll selected into view
  useEffect(() => {
    const el = listRef.current?.querySelector('[data-selected="true"]');
    if (el) el.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  const executeCommand = useCallback((item) => {
    const [type, value] = item.id.split(':');
    switch (type) {
      case 'view':
        setActiveView(value);
        break;
      case 'panel':
        if (value === 'terminal') setTerminalPanelOpen(!terminalPanelOpen);
        if (value === 'sidebar') setProjectSidebarOpen(!projectSidebarOpen);
        if (value === 'right') setRightPanelOpen(!rightPanelOpen);
        break;
      case 'project':
        setActiveView('projects');
        break;
    }
    onClose();
  }, [setActiveView, terminalPanelOpen, setTerminalPanelOpen, projectSidebarOpen, setProjectSidebarOpen, rightPanelOpen, setRightPanelOpen, onClose]);

  const handleKeyDown = useCallback((e) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (filtered[selectedIndex]) executeCommand(filtered[selectedIndex]);
        break;
      case 'Escape':
        e.preventDefault();
        onClose();
        break;
    }
  }, [filtered, selectedIndex, executeCommand, onClose]);

  if (!open) return null;

  let flatIndex = 0;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]" onClick={onClose}>
      <div className="fixed inset-0 bg-black/50" />
      <div
        className="relative z-50 w-full max-w-[540px] rounded-lg border border-border bg-popover shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-2 px-3 border-b border-border">
          <Search className="w-4 h-4 text-muted-foreground shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setSelectedIndex(0); }}
            onKeyDown={handleKeyDown}
            placeholder="Search commands, views, projects..."
            className="flex-1 h-11 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
          />
          <kbd className="hidden sm:inline-flex h-5 items-center gap-0.5 rounded border border-border bg-muted px-1.5 text-[10px] font-medium text-muted-foreground">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-[340px] overflow-y-auto py-1">
          {filtered.length === 0 && (
            <div className="px-3 py-6 text-center text-sm text-muted-foreground">
              No results found
            </div>
          )}
          {Array.from(grouped.entries()).map(([category, items]) => (
            <div key={category}>
              <div className="px-3 py-1.5 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                {category}
              </div>
              {items.map((item) => {
                const idx = flatIndex++;
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    data-selected={idx === selectedIndex}
                    className={`flex items-center gap-2.5 w-full px-3 py-1.5 text-sm text-left transition-colors ${
                      idx === selectedIndex
                        ? 'bg-primary/15 text-foreground'
                        : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
                    }`}
                    onClick={() => executeCommand(item)}
                    onMouseEnter={() => setSelectedIndex(idx)}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="flex-1 truncate">{item.label}</span>
                    <span className="text-[11px] text-muted-foreground/60">{item.category}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
