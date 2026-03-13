import { useRef, useEffect, useState, useCallback } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import '@xterm/xterm/css/xterm.css';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '@/components/ui/tooltip';
import { Separator } from '@/components/ui/separator';
import {
  Terminal as TerminalIcon,
  Plus,
  Columns2,
  Rows2,
  X,
  Trash2,
  Pencil,
  ArrowRightLeft,
  Maximize2,
  PanelRightOpen,
  PanelRightClose,
  ChevronRight,
  GripVertical,
  Circle,
  Merge,
  SplitSquareHorizontal,
  Copy,
  ScrollText,
  AlertTriangle,
  CheckCircle2,
  InfoIcon,
  XCircle,
  Ban,
} from 'lucide-react';
import { useStore } from '@/hooks/useStore';
import { electronAPI } from '@/lib/electronAPI';

// ── Accent Colors ─────────────────────────────────
const ACCENT_COLORS = {
  blue:   { primary: '#3b82f6', cursor: '#93c5fd', selection: 'rgba(59,130,246,0.3)' },
  indigo: { primary: '#6366f1', cursor: '#a5b4fc', selection: 'rgba(99,102,241,0.3)' },
  cyan:   { primary: '#06b6d4', cursor: '#67e8f9', selection: 'rgba(6,182,212,0.3)' },
  teal:   { primary: '#14b8a6', cursor: '#5eead4', selection: 'rgba(20,184,166,0.3)' },
  green:  { primary: '#22c55e', cursor: '#86efac', selection: 'rgba(34,197,94,0.3)' },
  orange: { primary: '#f97316', cursor: '#fdba74', selection: 'rgba(249,115,22,0.3)' },
  red:    { primary: '#ef4444', cursor: '#fca5a5', selection: 'rgba(239,68,68,0.3)' },
  pink:   { primary: '#ec4899', cursor: '#f9a8d4', selection: 'rgba(236,72,153,0.3)' },
  purple: { primary: '#a855f7', cursor: '#d8b4fe', selection: 'rgba(168,85,247,0.3)' },
  yellow: { primary: '#eab308', cursor: '#fde047', selection: 'rgba(234,179,8,0.3)' },
  mint:   { primary: '#34d399', cursor: '#6ee7b7', selection: 'rgba(52,211,153,0.3)' },
};

function buildXtermTheme(accent, mode) {
  const colors = ACCENT_COLORS[accent] || ACCENT_COLORS.blue;
  if (mode === 'light') {
    return {
      background: '#f8f8f8', foreground: '#1e1e1e', cursor: colors.primary,
      selectionBackground: colors.selection,
      black: '#1e1e1e', red: '#dc2626', green: '#16a34a', yellow: '#ca8a04',
      blue: colors.primary, magenta: '#9333ea', cyan: '#0891b2', white: '#f8f8f8',
      brightBlack: '#71717a', brightRed: '#ef4444', brightGreen: '#22c55e',
      brightYellow: '#eab308', brightBlue: colors.primary, brightMagenta: '#a855f7',
      brightCyan: '#06b6d4', brightWhite: '#ffffff',
    };
  }
  return {
    background: '#0f1117', foreground: '#e4e4e7', cursor: colors.cursor,
    selectionBackground: colors.selection,
    black: '#27272a', red: '#ef4444', green: '#22c55e', yellow: '#eab308',
    blue: colors.primary, magenta: '#a855f7', cyan: '#06b6d4', white: '#e4e4e7',
  };
}

function buildXtermOptions(settings) {
  return {
    fontSize: settings['terminal.fontSize'] || 13,
    fontFamily: settings['terminal.fontFamily'] || "'JetBrains Mono', 'SF Mono', monospace",
    lineHeight: settings['terminal.lineHeight'] || 1.3,
    theme: buildXtermTheme(settings['workbench.accent'] || 'blue', settings['workbench.mode'] || 'dark'),
    cursorBlink: settings['terminal.cursorBlink'] ?? true,
    cursorStyle: settings['terminal.cursorStyle'] || 'block',
    scrollback: settings['terminal.scrollback'] || 5000,
    allowProposedApi: true,
  };
}

// ── Tree helpers ──────────────────────────────────
// Node types:
//   leaf:   { type: 'leaf', id, terminals: [{id, name, cwd}], activeTerminalId }
//   branch: { type: 'branch', id, direction: 'horizontal'|'vertical', children: Node[], sizes: number[] }

let _nodeId = 1;
const uid = () => `n${_nodeId++}`;

function makeLeaf(terminals, activeTerminalId) {
  return { type: 'leaf', id: uid(), terminals, activeTerminalId };
}

function makeBranch(direction, children, sizes) {
  return { type: 'branch', id: uid(), direction, children, sizes: sizes || children.map(() => 100 / children.length) };
}

// Find a leaf by its id
function findLeaf(node, leafId) {
  if (!node) return null;
  if (node.type === 'leaf') return node.id === leafId ? node : null;
  for (const c of node.children) {
    const found = findLeaf(c, leafId);
    if (found) return found;
  }
  return null;
}

// Find leaf that contains a terminal ptyId
function findLeafByTerminal(node, ptyId) {
  if (!node) return null;
  if (node.type === 'leaf') return node.terminals.some(t => t.id === ptyId) ? node : null;
  for (const c of node.children) {
    const found = findLeafByTerminal(c, ptyId);
    if (found) return found;
  }
  return null;
}

// Get all leaves
function allLeaves(node) {
  if (!node) return [];
  if (node.type === 'leaf') return [node];
  return node.children.flatMap(allLeaves);
}

// Deep-update a node in the tree by id
function updateNode(tree, nodeId, updater) {
  if (!tree) return tree;
  if (tree.id === nodeId) return updater(tree);
  if (tree.type === 'branch') {
    return { ...tree, children: tree.children.map(c => updateNode(c, nodeId, updater)) };
  }
  return tree;
}

// Replace a leaf with a new node (for splitting)
function replaceNode(tree, nodeId, replacement) {
  if (!tree) return tree;
  if (tree.id === nodeId) return replacement;
  if (tree.type === 'branch') {
    return { ...tree, children: tree.children.map(c => replaceNode(c, nodeId, replacement)) };
  }
  return tree;
}

// Remove a leaf and clean up empty branches
function removeLeaf(tree, leafId) {
  if (!tree) return null;
  if (tree.type === 'leaf') return tree.id === leafId ? null : tree;
  if (tree.type === 'branch') {
    const newChildren = [];
    const newSizes = [];
    for (let i = 0; i < tree.children.length; i++) {
      const result = removeLeaf(tree.children[i], leafId);
      if (result) {
        newChildren.push(result);
        newSizes.push(tree.sizes[i]);
      }
    }
    if (newChildren.length === 0) return null;
    if (newChildren.length === 1) return newChildren[0]; // Collapse single-child branch
    // Normalize sizes
    const total = newSizes.reduce((a, b) => a + b, 0);
    const normalized = newSizes.map(s => (s / total) * 100);
    return { ...tree, children: newChildren, sizes: normalized };
  }
  return tree;
}

// ── Main Component ────────────────────────────────
// ── Log Panel ──────────────────────────────────────
function LogPanel() {
  const { logs, clearLogs } = useStore();
  const scrollRef = useRef(null);

  const levelIcon = (level) => {
    switch (level) {
      case 'error': return <XCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />;
      case 'warn': return <AlertTriangle className="w-3.5 h-3.5 text-yellow-400 shrink-0" />;
      case 'success': return <CheckCircle2 className="w-3.5 h-3.5 text-green-400 shrink-0" />;
      default: return <InfoIcon className="w-3.5 h-3.5 text-blue-400 shrink-0" />;
    }
  };

  const levelBg = (level) => {
    switch (level) {
      case 'error': return 'bg-red-500/5 border-l-2 border-l-red-500/40';
      case 'warn': return 'bg-yellow-500/5 border-l-2 border-l-yellow-500/40';
      case 'success': return 'bg-green-500/5 border-l-2 border-l-green-500/40';
      default: return 'border-l-2 border-l-transparent';
    }
  };

  const formatTime = (iso) => {
    try {
      const d = new Date(iso);
      return d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch { return ''; }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Log toolbar */}
      <div className="flex items-center h-7 px-2 gap-1 border-b border-border shrink-0">
        <span className="text-[11px] text-muted-foreground mr-auto">
          {logs.length} {logs.length === 1 ? 'entry' : 'entries'}
        </span>
        {logs.length > 0 && (
          <Button variant="ghost" size="icon" className="h-5 w-5" onClick={clearLogs} title="Clear logs">
            <Ban className="w-3 h-3" />
          </Button>
        )}
      </div>

      {/* Log entries */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto font-mono text-[12px]">
        {logs.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted-foreground text-xs">
            No log entries yet
          </div>
        ) : (
          logs.map((entry) => (
            <LogEntry key={entry.id} entry={entry} levelIcon={levelIcon} levelBg={levelBg} formatTime={formatTime} />
          ))
        )}
      </div>
    </div>
  );
}

function LogEntry({ entry, levelIcon, levelBg, formatTime }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className={`px-2 py-1.5 hover:bg-accent/30 ${levelBg(entry.level)}`}>
      <div className="flex items-start gap-2 cursor-default" onClick={() => entry.detail && setExpanded(!expanded)}>
        {levelIcon(entry.level)}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground/60 shrink-0">{formatTime(entry.timestamp)}</span>
            <span className="text-[10px] text-primary/70 font-medium uppercase shrink-0">{entry.source}</span>
          </div>
          <p className="text-[12px] text-foreground/90 leading-snug mt-0.5 break-words">{entry.message}</p>
        </div>
        {entry.detail && (
          <ChevronRight className={`w-3 h-3 text-muted-foreground shrink-0 mt-1 transition-transform ${expanded ? 'rotate-90' : ''}`} />
        )}
      </div>
      {expanded && entry.detail && (
        <pre className="mt-1.5 ml-5.5 p-2 rounded bg-muted/50 text-[11px] text-muted-foreground overflow-x-auto whitespace-pre-wrap break-words border border-border/50 max-h-[200px] overflow-y-auto">
          {entry.detail}
        </pre>
      )}
    </div>
  );
}

export default function TerminalPanel() {
  const [tree, setTree] = useState(null); // root SplitNode | null
  const [activeLeafId, setActiveLeafId] = useState(null);
  const [renamingId, setRenamingId] = useState(null);
  const [contextMenu, setContextMenu] = useState(null);
  const [maximizedLeafId, setMaximizedLeafId] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(200);
  const [paneNames, setPaneNames] = useState({}); // Map<leafId, string>
  const [panelTab, setPanelTab] = useState('terminal'); // 'terminal' | 'log'
  const { settings, setTerminalPanelOpen, logs } = useStore();

  const xtermMapRef = useRef(new Map()); // Map<ptyId, { term, fitAddon }>
  const treeRef = useRef(null);
  const activeLeafIdRef = useRef(null);
  const navigateRef = useRef(null);

  useEffect(() => { treeRef.current = tree; }, [tree]);
  useEffect(() => { activeLeafIdRef.current = activeLeafId; }, [activeLeafId]);

  // ── IPC: terminal data ──
  useEffect(() => {
    const cleanupData = electronAPI.onTerminalData(({ id, data }) => {
      xtermMapRef.current.get(id)?.term?.write(data);
    });

    const cleanupExit = electronAPI.onTerminalExit(({ id }) => {
      const entry = xtermMapRef.current.get(id);
      if (entry?.term) entry.term.dispose();
      xtermMapRef.current.delete(id);

      setTree(prev => {
        if (!prev) return null;
        // Find the leaf containing this terminal
        const leaf = findLeafByTerminal(prev, id);
        if (!leaf) return prev;

        const remaining = leaf.terminals.filter(t => t.id !== id);
        if (remaining.length > 0) {
          // Just remove the terminal from the leaf
          return updateNode(prev, leaf.id, (l) => ({
            ...l,
            terminals: remaining,
            activeTerminalId: l.activeTerminalId === id
              ? remaining[remaining.length - 1].id
              : l.activeTerminalId,
          }));
        }
        // Leaf is now empty — remove it
        const result = removeLeaf(prev, leaf.id);
        setTimeout(() => {
          setActiveLeafId(curr => {
            if (curr === leaf.id) {
              const leaves = result ? allLeaves(result) : [];
              return leaves[0]?.id || null;
            }
            return curr;
          });
          setMaximizedLeafId(curr => curr === leaf.id ? null : curr);
        }, 0);
        return result;
      });
    });

    return () => { cleanupData?.(); cleanupExit?.(); };
  }, []);

  // ── Hot-reload settings ──
  useEffect(() => {
    if (xtermMapRef.current.size === 0) return;
    const opts = buildXtermOptions(settings);
    for (const [, entry] of xtermMapRef.current) {
      if (!entry.term) continue;
      Object.assign(entry.term.options, {
        fontSize: opts.fontSize, fontFamily: opts.fontFamily, lineHeight: opts.lineHeight,
        cursorBlink: opts.cursorBlink, cursorStyle: opts.cursorStyle,
        scrollback: opts.scrollback, theme: opts.theme,
      });
      try { entry.fitAddon.fit(); } catch {}
    }
  }, [
    settings['terminal.fontSize'], settings['terminal.fontFamily'],
    settings['terminal.lineHeight'], settings['terminal.cursorBlink'],
    settings['terminal.cursorStyle'], settings['terminal.scrollback'],
    settings['workbench.accent'], settings['workbench.mode'],
  ]);

  // ── Create xterm + pty ──
  const createXterm = useCallback(async (options = {}) => {
    const term = new Terminal(buildXtermOptions(settings));
    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.loadAddon(new WebLinksAddon());

    const result = await electronAPI.terminalCreate({
      ...options,
      shell: options.shell || settings['terminal.shell'] || undefined,
      cols: 120, rows: 30,
    });

    const ptyId = result.id;
    term.onData((data) => electronAPI.terminalWrite(ptyId, data));
    term.onResize(({ cols, rows }) => electronAPI.terminalResize(ptyId, cols, rows));

    // Intercept navigation shortcuts before xterm swallows them
    term.attachCustomKeyEventHandler((e) => {
      if (navigateRef.current) return navigateRef.current(e);
      return true;
    });

    xtermMapRef.current.set(ptyId, { term, fitAddon, opened: false });

    return { id: ptyId, name: result.name || `Terminal ${ptyId}`, cwd: result.cwd };
  }, [settings]);

  // ── Add terminal to active leaf (or create first leaf) ──
  const createTerminal = useCallback(async (options = {}) => {
    const termMeta = await createXterm(options);

    setTree(prev => {
      if (!prev) {
        const leaf = makeLeaf([termMeta], termMeta.id);
        setTimeout(() => setActiveLeafId(leaf.id), 0);
        return leaf;
      }
      const leafId = activeLeafIdRef.current;
      const leaf = leafId ? findLeaf(prev, leafId) : allLeaves(prev)[0];
      if (!leaf) {
        const newLeaf = makeLeaf([termMeta], termMeta.id);
        setTimeout(() => setActiveLeafId(newLeaf.id), 0);
        return newLeaf;
      }
      return updateNode(prev, leaf.id, (l) => ({
        ...l,
        terminals: [...l.terminals, termMeta],
        activeTerminalId: termMeta.id,
      }));
    });
  }, [createXterm]);

  // ── Kill terminal ──
  const killTerminal = useCallback((id) => {
    if (!id) {
      const leaf = treeRef.current && activeLeafIdRef.current
        ? findLeaf(treeRef.current, activeLeafIdRef.current)
        : null;
      id = leaf?.activeTerminalId;
    }
    if (id) electronAPI.terminalKill(id);
  }, []);

  // ── Split active leaf (direction: 'horizontal' or 'vertical') ──
  const splitActiveLeaf = useCallback(async (direction) => {
    const currentTree = treeRef.current;
    if (!currentTree) return;
    const leafId = activeLeafIdRef.current;
    const leaf = leafId ? findLeaf(currentTree, leafId) : allLeaves(currentTree)[0];
    if (!leaf) return;

    const cwd = leaf.terminals.find(t => t.id === leaf.activeTerminalId)?.cwd;
    const termMeta = await createXterm({ cwd });
    const newLeaf = makeLeaf([termMeta], termMeta.id);

    setTree(prev => {
      if (!prev) return newLeaf;
      const branch = makeBranch(direction, [
        findLeaf(prev, leaf.id) ? { ...findLeaf(prev, leaf.id) } : leaf,
        newLeaf,
      ], [50, 50]);
      return replaceNode(prev, leaf.id, branch);
    });
    setActiveLeafId(newLeaf.id);
  }, [createXterm]);

  // ── Rename terminal ──
  const renameTerminal = useCallback((termId, newName) => {
    if (!newName?.trim()) { setRenamingId(null); return; }
    setTree(prev => {
      if (!prev) return prev;
      const leaf = findLeafByTerminal(prev, termId);
      if (!leaf) return prev;
      return updateNode(prev, leaf.id, (l) => ({
        ...l,
        terminals: l.terminals.map(t => t.id === termId ? { ...t, name: newName.trim() } : t),
      }));
    });
    setRenamingId(null);
  }, []);

  // ── Set active tab in a leaf ──
  const setActiveTab = useCallback((leafId, termId) => {
    setTree(prev => updateNode(prev, leafId, (l) => ({ ...l, activeTerminalId: termId })));
    setActiveLeafId(leafId);
  }, []);

  // ── Move terminal to a different leaf or new split ──
  const moveTerminal = useCallback((termId, fromLeafId, toLeafId) => {
    setTree(prev => {
      if (!prev) return prev;
      const fromLeaf = findLeaf(prev, fromLeafId);
      if (!fromLeaf) return prev;
      const termMeta = fromLeaf.terminals.find(t => t.id === termId);
      if (!termMeta) return prev;

      // Remove from source
      const remaining = fromLeaf.terminals.filter(t => t.id !== termId);
      let updated = remaining.length > 0
        ? updateNode(prev, fromLeafId, (l) => ({
            ...l,
            terminals: remaining,
            activeTerminalId: l.activeTerminalId === termId
              ? remaining[remaining.length - 1].id : l.activeTerminalId,
          }))
        : removeLeaf(prev, fromLeafId);

      if (!updated) {
        const leaf = makeLeaf([termMeta], termId);
        setTimeout(() => setActiveLeafId(leaf.id), 0);
        return leaf;
      }

      if (toLeafId === '__new_h__' || toLeafId === '__new_v__') {
        // Create new split from root
        const newLeaf = makeLeaf([termMeta], termId);
        const dir = toLeafId === '__new_h__' ? 'horizontal' : 'vertical';
        setTimeout(() => setActiveLeafId(newLeaf.id), 0);
        return makeBranch(dir, [updated, newLeaf], [50, 50]);
      }

      // Add to target leaf
      const targetLeaf = findLeaf(updated, toLeafId);
      if (!targetLeaf) return updated;
      setTimeout(() => setActiveLeafId(toLeafId), 0);
      return updateNode(updated, toLeafId, (l) => ({
        ...l,
        terminals: [...l.terminals, termMeta],
        activeTerminalId: termId,
      }));
    });
  }, []);

  // Rename a pane/group
  const renamePaneCommit = useCallback((leafId, name) => {
    const trimmed = name.trim();
    if (trimmed) {
      setPaneNames(prev => ({ ...prev, [leafId]: trimmed }));
    } else {
      setPaneNames(prev => { const next = { ...prev }; delete next[leafId]; return next; });
    }
  }, []);

  // Kill all terminals in a pane
  const killAllInPane = useCallback((leafId) => {
    const leaf = tree ? findLeaf(tree, leafId) : null;
    if (!leaf) return;
    for (const t of leaf.terminals) {
      electronAPI.terminalKill(t.id);
    }
  }, [tree]);

  // Create terminal in a specific pane
  const createTerminalInLeaf = useCallback(async (leafId) => {
    const result = await electronAPI.terminalCreate({});
    if (!result) return;
    const { id: ptyId, name } = result;

    const term = new Terminal(buildXtermOptions(settings));
    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();
    term.loadAddon(fitAddon);
    term.loadAddon(webLinksAddon);
    term.attachCustomKeyEventHandler((e) => {
      if (navigateRef.current) return navigateRef.current(e);
      return true;
    });
    xtermMapRef.current.set(ptyId, { term, fitAddon, opened: false });

    const unsub = electronAPI.onTerminalData?.((data) => {
      if (data.id === ptyId) term.write(data.data);
    });
    term.onData((data) => electronAPI.terminalWrite(ptyId, data));

    setTree(prev => {
      if (!prev) return makeLeaf([{ id: ptyId, name, cwd: '' }], ptyId);
      return updateNode(prev, leafId, (l) => ({
        ...l,
        terminals: [...l.terminals, { id: ptyId, name, cwd: '' }],
        activeTerminalId: ptyId,
      }));
    });
    setActiveLeafId(leafId);
  }, [settings]);

  // Merge all terminals from one pane into another
  const mergePane = useCallback((fromLeafId, toLeafId) => {
    setTree(prev => {
      if (!prev) return prev;
      const fromLeaf = findLeaf(prev, fromLeafId);
      const toLeaf = findLeaf(prev, toLeafId);
      if (!fromLeaf || !toLeaf) return prev;

      // Add all terminals from source to target
      let updated = updateNode(prev, toLeafId, (l) => ({
        ...l,
        terminals: [...l.terminals, ...fromLeaf.terminals],
      }));
      // Remove source pane
      updated = removeLeaf(updated, fromLeafId);
      setActiveLeafId(toLeafId);
      return updated || makeLeaf([], null);
    });
    // Clean up pane name
    setPaneNames(prev => { const next = { ...prev }; delete next[fromLeafId]; return next; });
  }, []);

  // Split a specific pane (create new empty pane next to it)
  const splitPaneById = useCallback(async (leafId, direction) => {
    const result = await electronAPI.terminalCreate({});
    if (!result) return;
    const { id: ptyId, name } = result;

    const term = new Terminal(buildXtermOptions(settings));
    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();
    term.loadAddon(fitAddon);
    term.loadAddon(webLinksAddon);
    term.attachCustomKeyEventHandler((e) => {
      if (navigateRef.current) return navigateRef.current(e);
      return true;
    });
    xtermMapRef.current.set(ptyId, { term, fitAddon, opened: false });

    const unsub = electronAPI.onTerminalData?.((data) => {
      if (data.id === ptyId) term.write(data.data);
    });
    term.onData((data) => electronAPI.terminalWrite(ptyId, data));

    const newLeaf = makeLeaf([{ id: ptyId, name, cwd: '' }], ptyId);

    setTree(prev => {
      if (!prev) return newLeaf;
      const existingLeaf = findLeaf(prev, leafId);
      if (!existingLeaf) return prev;
      const branch = makeBranch(direction, [existingLeaf, newLeaf], [50, 50]);
      return replaceNode(prev, leafId, branch);
    });
    setTimeout(() => setActiveLeafId(newLeaf.id), 0);
  }, [settings]);

  // ── Keyboard navigation handler (called from xterm's customKeyEventHandler) ──
  navigateRef.current = (e) => {
    if (!treeRef.current) return false;

    // Ctrl+Tab / Ctrl+Shift+Tab — cycle all terminals across all panes
    if (e.ctrlKey && e.key === 'Tab' && e.type === 'keydown') {
      const currentTree = treeRef.current;
      const flat = [];
      for (const leaf of allLeaves(currentTree)) {
        for (const t of leaf.terminals) flat.push({ termId: t.id, leafId: leaf.id });
      }
      if (flat.length <= 1) return true;

      const activeLeaf = activeLeafIdRef.current ? findLeaf(currentTree, activeLeafIdRef.current) : null;
      const currentIdx = flat.findIndex(f => f.termId === activeLeaf?.activeTerminalId);
      const nextIdx = e.shiftKey
        ? (currentIdx <= 0 ? flat.length - 1 : currentIdx - 1)
        : (currentIdx >= flat.length - 1 ? 0 : currentIdx + 1);

      const next = flat[nextIdx];
      setTree(prev => updateNode(prev, next.leafId, (l) => ({ ...l, activeTerminalId: next.termId })));
      setActiveLeafId(next.leafId);
      setTimeout(() => xtermMapRef.current.get(next.termId)?.term?.focus(), 50);
      return false; // Prevent xterm from processing this key
    }

    // Ctrl+PageDown/PageUp — cycle tabs in current pane
    if (e.ctrlKey && (e.key === 'PageDown' || e.key === 'PageUp') && e.type === 'keydown') {
      const leaf = activeLeafIdRef.current ? findLeaf(treeRef.current, activeLeafIdRef.current) : null;
      if (!leaf || leaf.terminals.length <= 1) return true;

      const idx = leaf.terminals.findIndex(t => t.id === leaf.activeTerminalId);
      const nextIdx = e.key === 'PageDown'
        ? (idx >= leaf.terminals.length - 1 ? 0 : idx + 1)
        : (idx <= 0 ? leaf.terminals.length - 1 : idx - 1);

      const nextTermId = leaf.terminals[nextIdx].id;
      setTree(prev => updateNode(prev, leaf.id, (l) => ({ ...l, activeTerminalId: nextTermId })));
      setTimeout(() => xtermMapRef.current.get(nextTermId)?.term?.focus(), 50);
      return false;
    }

    // Alt+Arrow — navigate between panes
    if (e.altKey && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key) && e.type === 'keydown') {
      const currentLeaves = allLeaves(treeRef.current);
      if (currentLeaves.length <= 1) return true;

      const currentIdx = currentLeaves.findIndex(l => l.id === activeLeafIdRef.current);
      const nextIdx = (e.key === 'ArrowRight' || e.key === 'ArrowDown')
        ? (currentIdx >= currentLeaves.length - 1 ? 0 : currentIdx + 1)
        : (currentIdx <= 0 ? currentLeaves.length - 1 : currentIdx - 1);

      const nextLeaf = currentLeaves[nextIdx];
      setActiveLeafId(nextLeaf.id);
      setTimeout(() => xtermMapRef.current.get(nextLeaf.activeTerminalId)?.term?.focus(), 50);
      return false;
    }

    return true; // Let xterm handle all other keys
  };

  // Close context menu
  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [contextMenu]);

  // Computed
  const leaves = tree ? allLeaves(tree) : [];
  const totalTerminals = leaves.reduce((s, l) => s + l.terminals.length, 0);
  const activeLeaf = activeLeafId ? findLeaf(tree, activeLeafId) : null;
  const activeTermName = activeLeaf?.terminals.find(t => t.id === activeLeaf.activeTerminalId)?.name || 'Terminal';

  return (
    <div className="flex flex-col h-full border-t border-border bg-background">
      {/* Header */}
      <div className="flex items-center h-9 px-2 gap-1 border-b border-border shrink-0 bg-secondary/50">
        {/* Tab buttons */}
        <div className="flex items-center gap-0 mr-auto">
          <button
            onClick={() => setPanelTab('terminal')}
            className={`flex items-center gap-1 px-2 h-7 text-[11px] font-medium transition-colors rounded-sm ${
              panelTab === 'terminal' ? 'text-foreground bg-accent/50' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <TerminalIcon className="w-3.5 h-3.5" />
            Terminal
            {totalTerminals > 0 && <span className="text-[10px] text-muted-foreground/60">({totalTerminals})</span>}
          </button>
          <button
            onClick={() => setPanelTab('log')}
            className={`flex items-center gap-1 px-2 h-7 text-[11px] font-medium transition-colors rounded-sm ${
              panelTab === 'log' ? 'text-foreground bg-accent/50' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <ScrollText className="w-3.5 h-3.5" />
            Log
            {logs.length > 0 && (
              <span className="min-w-[16px] h-4 px-1 rounded-full bg-muted text-muted-foreground text-[10px] font-bold flex items-center justify-center">
                {logs.length > 99 ? '99+' : logs.length}
              </span>
            )}
          </button>
        </div>

        <div className="flex items-center gap-0.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-6 w-6"
                onClick={() => createTerminal({})}
              ><Plus className="w-3.5 h-3.5" /></Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">New Terminal</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-6 w-6"
                onClick={() => splitActiveLeaf('horizontal')}
                disabled={!tree}
              ><Columns2 className="w-3.5 h-3.5" /></Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Split Right</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-6 w-6"
                onClick={() => splitActiveLeaf('vertical')}
                disabled={!tree}
              ><Rows2 className="w-3.5 h-3.5" /></Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Split Down</TooltipContent>
          </Tooltip>

          {maximizedLeafId && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-6 w-6"
                  onClick={() => setMaximizedLeafId(null)}
                ><Maximize2 className="w-3.5 h-3.5 text-primary" /></Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Restore Layout</TooltipContent>
            </Tooltip>
          )}

          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-6 w-6"
                onClick={() => killTerminal()}
                disabled={totalTerminals === 0}
              ><Trash2 className="w-3.5 h-3.5" /></Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Kill Terminal</TooltipContent>
          </Tooltip>

          <Separator orientation="vertical" className="h-4 mx-0.5" />

          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-6 w-6"
                onClick={() => setSidebarOpen(p => !p)}
              >
                {sidebarOpen
                  ? <PanelRightClose className="w-3.5 h-3.5" />
                  : <PanelRightOpen className="w-3.5 h-3.5" />
                }
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">{sidebarOpen ? 'Hide' : 'Show'} Groups</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-6 w-6"
                onClick={() => setTerminalPanelOpen(false)}
              ><X className="w-3.5 h-3.5" /></Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Close Panel</TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* Main area */}
      {panelTab === 'log' ? (
        <LogPanel />
      ) : (
      <div className="flex flex-1 min-h-0 overflow-hidden">

      {/* Tree layout */}
      <div className="flex-1 min-h-0 min-w-0 overflow-hidden relative">
        {tree ? (
          maximizedLeafId ? (
            <LeafPane
              leaf={findLeaf(tree, maximizedLeafId) || allLeaves(tree)[0]}
              xtermMapRef={xtermMapRef}
              isActive={true}
              onFocusLeaf={setActiveLeafId}
              onSelectTab={setActiveTab}
              onKillTab={(id) => electronAPI.terminalKill(id)}
              renamingId={renamingId}
              onStartRename={setRenamingId}
              onRename={renameTerminal}
              onContextMenu={(termId, leafId, x, y) => setContextMenu({ termId, leafId, x, y })}
              leafCount={1}
            />
          ) : (
            <SplitNode
              node={tree}
              xtermMapRef={xtermMapRef}
              activeLeafId={activeLeafId}
              onFocusLeaf={setActiveLeafId}
              onSelectTab={setActiveTab}
              onKillTab={(id) => electronAPI.terminalKill(id)}
              renamingId={renamingId}
              onStartRename={setRenamingId}
              onRename={renameTerminal}
              onContextMenu={(termId, leafId, x, y) => setContextMenu({ termId, leafId, x, y })}
              onUpdateSizes={(branchId, sizes) => {
                setTree(prev => updateNode(prev, branchId, (b) => ({ ...b, sizes })));
              }}
              leafCount={leaves.length}
            />
          )
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
            <button
              className="flex items-center gap-2 px-3 py-1.5 rounded hover:bg-accent/50 transition-colors hover:text-foreground"
              onClick={() => createTerminal({})}
            >
              <Plus className="w-4 h-4" /> Create Terminal
            </button>
          </div>
        )}

        {contextMenu && (
          <TerminalContextMenu
            {...contextMenu}
            leaves={leaves}
            onClose={() => setContextMenu(null)}
            onRename={(id) => { setRenamingId(id); setContextMenu(null); }}
            onKill={(id) => { electronAPI.terminalKill(id); setContextMenu(null); }}
            onMove={(termId, fromLeafId, toLeafId) => { moveTerminal(termId, fromLeafId, toLeafId); setContextMenu(null); }}
            onMaximize={(leafId) => { setMaximizedLeafId(leafId); setContextMenu(null); }}
            onSplit={(termId, fromLeafId, dir) => {
              moveTerminal(termId, fromLeafId, dir === 'horizontal' ? '__new_h__' : '__new_v__');
              setContextMenu(null);
            }}
          />
        )}
      </div>

      {/* Groups sidebar */}
      {sidebarOpen && (
        <TerminalSidebar
          leaves={leaves}
          activeLeafId={activeLeafId}
          width={sidebarWidth}
          onWidthChange={setSidebarWidth}
          onFocusLeaf={setActiveLeafId}
          onSelectTab={setActiveTab}
          onKillTerminal={(id) => electronAPI.terminalKill(id)}
          onCreateTerminal={() => createTerminal({})}
          onCreateTerminalInLeaf={createTerminalInLeaf}
          onSplitLeaf={splitPaneById}
          onRename={renameTerminal}
          renamingId={renamingId}
          onStartRename={setRenamingId}
          onMoveTerminal={moveTerminal}
          onSplitTerminal={(termId, fromLeafId, dir) => {
            moveTerminal(termId, fromLeafId, dir === 'horizontal' ? '__new_h__' : '__new_v__');
          }}
          onKillAllInPane={killAllInPane}
          onMergePane={mergePane}
          onMaximizePane={(leafId) => setMaximizedLeafId(leafId)}
          paneNames={paneNames}
          onRenamePaneCommit={renamePaneCommit}
          xtermMapRef={xtermMapRef}
        />
      )}

      </div>
      )}
    </div>
  );
}


// ── Recursive Split Node Renderer ─────────────────
function SplitNode({ node, xtermMapRef, activeLeafId, onFocusLeaf, onSelectTab, onKillTab,
  renamingId, onStartRename, onRename, onContextMenu, onUpdateSizes, leafCount }) {

  if (node.type === 'leaf') {
    return (
      <LeafPane
        leaf={node}
        xtermMapRef={xtermMapRef}
        isActive={node.id === activeLeafId}
        onFocusLeaf={onFocusLeaf}
        onSelectTab={onSelectTab}
        onKillTab={onKillTab}
        renamingId={renamingId}
        onStartRename={onStartRename}
        onRename={onRename}
        onContextMenu={onContextMenu}
        leafCount={leafCount}
      />
    );
  }

  // Branch node
  const isHorizontal = node.direction === 'horizontal';
  const containerRef = useRef(null);

  const handleResize = useCallback((index, e) => {
    e.preventDefault();
    const container = containerRef.current;
    if (!container) return;
    const startPos = isHorizontal ? e.clientX : e.clientY;
    const containerSize = isHorizontal ? container.offsetWidth : container.offsetHeight;
    const startSizes = [...node.sizes];

    const onMouseMove = (ev) => {
      const delta = (isHorizontal ? ev.clientX : ev.clientY) - startPos;
      const deltaPct = (delta / containerSize) * 100;
      const newA = Math.max(10, Math.min(90, startSizes[index] + deltaPct));
      const newB = Math.max(10, Math.min(90, startSizes[index + 1] - deltaPct));
      const next = [...startSizes];
      next[index] = newA;
      next[index + 1] = newB;
      onUpdateSizes(node.id, next);
    };

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.body.style.cursor = isHorizontal ? 'col-resize' : 'row-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [node.sizes, node.id, isHorizontal, onUpdateSizes]);

  return (
    <div
      ref={containerRef}
      className={`flex ${isHorizontal ? 'flex-row' : 'flex-col'} w-full h-full min-w-0 min-h-0`}
    >
      {node.children.map((child, i) => (
        <div key={child.id} className={`flex ${isHorizontal ? 'flex-row' : 'flex-col'} min-w-0 min-h-0 overflow-hidden`}
          style={isHorizontal ? { width: `${node.sizes[i]}%` } : { height: `${node.sizes[i]}%` }}
        >
          {i > 0 && (
            <div
              className={`shrink-0 ${
                isHorizontal
                  ? 'w-1 cursor-col-resize'
                  : 'h-1 cursor-row-resize'
              } bg-border/50 hover:bg-primary/50 transition-colors`}
              onMouseDown={(e) => handleResize(i - 1, e)}
            />
          )}
          <div className="flex-1 min-w-0 min-h-0 overflow-hidden">
            <SplitNode
              node={child}
              xtermMapRef={xtermMapRef}
              activeLeafId={activeLeafId}
              onFocusLeaf={onFocusLeaf}
              onSelectTab={onSelectTab}
              onKillTab={onKillTab}
              renamingId={renamingId}
              onStartRename={onStartRename}
              onRename={onRename}
              onContextMenu={onContextMenu}
              onUpdateSizes={onUpdateSizes}
              leafCount={leafCount}
            />
          </div>
        </div>
      ))}
    </div>
  );
}


// ── Leaf Pane (tab bar + terminals) ───────────────
function LeafPane({ leaf, xtermMapRef, isActive, onFocusLeaf, onSelectTab, onKillTab,
  renamingId, onStartRename, onRename, onContextMenu, leafCount }) {
  return (
    <div className={`flex flex-col w-full h-full min-w-0 min-h-0 ${
      leafCount > 1 && isActive ? 'ring-1 ring-primary/20 ring-inset' : ''
    }`}>
      {/* Tab bar */}
      <TerminalTabBar
        leaf={leaf}
        onSelectTab={(termId) => onSelectTab(leaf.id, termId)}
        onKillTab={onKillTab}
        renamingId={renamingId}
        onStartRename={onStartRename}
        onRename={onRename}
        onContextMenu={(termId, x, y) => onContextMenu(termId, leaf.id, x, y)}
        onFocus={() => onFocusLeaf(leaf.id)}
      />
      {/* Terminal panes (all mounted, visibility via CSS) */}
      <div className="flex-1 min-w-0 min-h-0 overflow-hidden relative"
        onMouseDown={() => onFocusLeaf(leaf.id)}
      >
        {leaf.terminals.map((t) => (
          <TerminalPane
            key={t.id}
            ptyId={t.id}
            xtermMapRef={xtermMapRef}
            visible={t.id === leaf.activeTerminalId}
            shouldFocus={isActive && t.id === leaf.activeTerminalId}
          />
        ))}
      </div>
    </div>
  );
}


// ── Tab Bar ──────────────────────────────────────
function TerminalTabBar({ leaf, onSelectTab, onKillTab, renamingId, onStartRename, onRename, onContextMenu, onFocus }) {
  const renameInputRef = useRef(null);

  useEffect(() => {
    if (renamingId && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [renamingId]);

  return (
    <div className="flex items-center h-[26px] shrink-0 bg-secondary/30 border-b border-border/50 overflow-x-auto"
      style={{ scrollbarWidth: 'none' }}
      onMouseDown={onFocus}
    >
      {leaf.terminals.map((t) => {
        const isActive = t.id === leaf.activeTerminalId;
        const isRenaming = renamingId === t.id;

        return (
          <div
            key={t.id}
            className={`group flex items-center gap-1 h-full px-2 text-[11px] cursor-pointer shrink-0 border-r border-border/30 select-none transition-colors ${
              isActive
                ? 'bg-background text-foreground border-b-2 border-b-primary'
                : 'text-muted-foreground hover:text-foreground hover:bg-accent/30'
            }`}
            onClick={() => onSelectTab(t.id)}
            onDoubleClick={() => onStartRename(t.id)}
            onContextMenu={(e) => { e.preventDefault(); onContextMenu(t.id, e.clientX, e.clientY); }}
          >
            <TerminalIcon className="w-3 h-3 shrink-0 opacity-60" />
            {isRenaming ? (
              <input
                ref={renameInputRef}
                className="bg-transparent border border-primary/50 rounded px-0.5 text-[11px] w-[80px] outline-none text-foreground"
                defaultValue={t.name}
                onBlur={(e) => onRename(t.id, e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') onRename(t.id, e.target.value);
                  if (e.key === 'Escape') onStartRename(null);
                }}
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <span className="truncate max-w-[100px]">{t.name}</span>
            )}
            <button
              className="ml-0.5 opacity-0 group-hover:opacity-100 hover:text-destructive transition-opacity"
              onClick={(e) => { e.stopPropagation(); onKillTab(t.id); }}
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        );
      })}
    </div>
  );
}


// ── Terminal Pane ─────────────────────────────────
// xterm.open() can only be called once per Terminal instance.
// After that, we reparent the xterm DOM element when the React tree changes
// (e.g., after a split causes remounting).
function TerminalPane({ ptyId, xtermMapRef, visible, shouldFocus }) {
  const mountRef = useRef(null);

  useEffect(() => {
    const el = mountRef.current;
    const entry = xtermMapRef.current.get(ptyId);
    if (!el || !entry?.term) return;

    if (!entry.opened) {
      // First mount: call open()
      entry.opened = true;
      entry.term.open(el);
    } else {
      // Already opened: reparent the xterm DOM element
      const xtermEl = entry.term.element;
      if (xtermEl && xtermEl.parentElement !== el) {
        el.appendChild(xtermEl);
      }
    }

    const timer = setTimeout(() => {
      try { entry.fitAddon.fit(); } catch {}
    }, 50);

    const ro = new ResizeObserver(() => {
      try { entry.fitAddon.fit(); } catch {}
    });
    ro.observe(el);

    return () => { clearTimeout(timer); ro.disconnect(); };
  }, [ptyId, xtermMapRef]);

  useEffect(() => {
    if (!visible) return;
    const entry = xtermMapRef.current.get(ptyId);
    if (!entry) return;
    const timer = setTimeout(() => {
      try { entry.fitAddon.fit(); } catch {}
      if (shouldFocus) entry.term.focus();
    }, 30);
    return () => clearTimeout(timer);
  }, [visible, shouldFocus, ptyId, xtermMapRef]);

  return (
    <div
      ref={mountRef}
      className="absolute inset-0 p-0 m-0"
      style={{ visibility: visible ? 'visible' : 'hidden', zIndex: visible ? 1 : 0 }}
    />
  );
}


// ── Groups Sidebar ───────────────────────────────
const PANE_COLORS = ['#3b82f6', '#22c55e', '#f97316', '#a855f7', '#ec4899', '#06b6d4', '#eab308', '#ef4444'];

// Context menu for sidebar items (pane-level and terminal-level)
function SidebarContextMenu({ x, y, type, leafId, termId, leaves, onClose,
  onRenameTerminal, onKillTerminal, onMoveTerminal, onSplitTerminal,
  onRenamePaneStart, onKillAllInPane, onNewTerminalInPane, onSplitPane, onMergePane, onMaximizePane,
}) {
  const leaf = leaves.find(l => l.id === leafId);
  const otherLeaves = leaves.filter(l => l.id !== leafId);

  useEffect(() => {
    const handleClick = () => onClose();
    const handleKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('mousedown', handleClick);
    window.addEventListener('keydown', handleKey);
    return () => {
      window.removeEventListener('mousedown', handleClick);
      window.removeEventListener('keydown', handleKey);
    };
  }, [onClose]);

  const menuBtn = 'flex items-center gap-2 w-full px-2 py-1.5 rounded-sm hover:bg-accent hover:text-accent-foreground transition-colors text-left';
  const menuBtnDisabled = 'flex items-center gap-2 w-full px-2 py-1.5 rounded-sm opacity-40 cursor-default text-left';
  const divider = <div className="h-px bg-border my-1" />;

  return (
    <div
      className="fixed z-[200] min-w-[200px] rounded-md border bg-popover p-1 text-popover-foreground shadow-md text-xs"
      style={{ left: x, top: y }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {type === 'pane' && (
        <>
          <button className={menuBtn} onClick={() => { onRenamePaneStart(leafId); onClose(); }}>
            <Pencil className="w-3.5 h-3.5" /> Rename Group
          </button>

          <button className={menuBtn} onClick={() => { onNewTerminalInPane(leafId); onClose(); }}>
            <Plus className="w-3.5 h-3.5" /> New Terminal Here
          </button>

          {divider}

          <button className={menuBtn} onClick={() => { onSplitPane(leafId, 'horizontal'); onClose(); }}>
            <Columns2 className="w-3.5 h-3.5" /> Split Right
          </button>
          <button className={menuBtn} onClick={() => { onSplitPane(leafId, 'vertical'); onClose(); }}>
            <Rows2 className="w-3.5 h-3.5" /> Split Down
          </button>

          {leaves.length > 1 && (
            <>
              {divider}
              <button className={menuBtn} onClick={() => { onMaximizePane(leafId); onClose(); }}>
                <Maximize2 className="w-3.5 h-3.5" /> Maximize Group
              </button>
              {otherLeaves.length > 0 && (
                <>
                  <div className="px-2 py-1 text-[10px] text-muted-foreground/60 uppercase tracking-wider">Merge into</div>
                  {otherLeaves.map((l, i) => (
                    <button key={l.id} className={menuBtn} onClick={() => { onMergePane(leafId, l.id); onClose(); }}>
                      <Merge className="w-3.5 h-3.5" /> {l._sidebarName || `Pane ${leaves.indexOf(l) + 1}`}
                    </button>
                  ))}
                </>
              )}
            </>
          )}

          {divider}

          <button
            className={`${menuBtn} hover:!bg-destructive/10 hover:!text-destructive`}
            onClick={() => { onKillAllInPane(leafId); onClose(); }}
          >
            <Trash2 className="w-3.5 h-3.5" /> Kill All in Group
          </button>
        </>
      )}

      {type === 'terminal' && (
        <>
          <button className={menuBtn} onClick={() => { onRenameTerminal(termId); onClose(); }}>
            <Pencil className="w-3.5 h-3.5" /> Rename
          </button>

          {divider}

          <button
            className={leaf?.terminals.length > 1 ? menuBtn : menuBtnDisabled}
            onClick={() => { if (leaf?.terminals.length > 1) { onSplitTerminal(termId, leafId, 'horizontal'); onClose(); } }}
          >
            <Columns2 className="w-3.5 h-3.5" /> Split to Right
          </button>
          <button
            className={leaf?.terminals.length > 1 ? menuBtn : menuBtnDisabled}
            onClick={() => { if (leaf?.terminals.length > 1) { onSplitTerminal(termId, leafId, 'vertical'); onClose(); } }}
          >
            <Rows2 className="w-3.5 h-3.5" /> Split Down
          </button>

          {otherLeaves.length > 0 && (
            <>
              {divider}
              <div className="px-2 py-1 text-[10px] text-muted-foreground/60 uppercase tracking-wider">Move to</div>
              {otherLeaves.map((l, i) => (
                <button key={l.id} className={menuBtn} onClick={() => { onMoveTerminal(termId, leafId, l.id); onClose(); }}>
                  <ArrowRightLeft className="w-3.5 h-3.5" /> {l._sidebarName || `Pane ${leaves.indexOf(l) + 1}`}
                </button>
              ))}
            </>
          )}

          {divider}

          <button
            className={`${menuBtn} hover:!bg-destructive/10 hover:!text-destructive`}
            onClick={() => { onKillTerminal(termId); onClose(); }}
          >
            <Trash2 className="w-3.5 h-3.5" /> Kill Terminal
          </button>
        </>
      )}
    </div>
  );
}

function TerminalSidebar({ leaves, activeLeafId, width, onWidthChange, onFocusLeaf, onSelectTab,
  onKillTerminal, onCreateTerminal, onCreateTerminalInLeaf, onSplitLeaf, onRename, renamingId, onStartRename,
  onMoveTerminal, onSplitTerminal, onKillAllInPane, onMergePane, onMaximizePane, paneNames, onRenamePaneCommit,
  xtermMapRef }) {
  const renameInputRef = useRef(null);
  const paneRenameInputRef = useRef(null);
  const [ctxMenu, setCtxMenu] = useState(null);
  const [renamingPaneId, setRenamingPaneId] = useState(null);

  useEffect(() => {
    if (renamingId && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [renamingId]);

  useEffect(() => {
    if (renamingPaneId && paneRenameInputRef.current) {
      paneRenameInputRef.current.focus();
      paneRenameInputRef.current.select();
    }
  }, [renamingPaneId]);

  // Resize handle
  const handleResize = useCallback((e) => {
    e.preventDefault();
    const startX = e.clientX;
    const startW = width;

    const onMouseMove = (ev) => {
      const delta = startX - ev.clientX;
      onWidthChange(Math.max(140, Math.min(400, startW + delta)));
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
  }, [width, onWidthChange]);

  // Annotate leaves with sidebar names for context menu display
  const annotatedLeaves = leaves.map((l, i) => ({
    ...l,
    _sidebarName: paneNames[l.id] || `Pane ${i + 1}`,
  }));

  return (
    <div className="flex shrink-0 h-full" style={{ width }}>
      {/* Resize handle */}
      <div
        className="w-1 shrink-0 cursor-col-resize bg-border/30 hover:bg-primary/50 transition-colors"
        onMouseDown={handleResize}
      />
      {/* Sidebar content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-secondary/20 border-l border-border/50">
        {/* Header */}
        <div className="flex items-center h-[26px] px-2 shrink-0 border-b border-border/50">
          <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Groups</span>
        </div>

        {/* Pane list */}
        <div className="flex-1 overflow-y-auto py-1" style={{ scrollbarWidth: 'thin' }}>
          {annotatedLeaves.map((leaf, leafIdx) => {
            const isActiveLeaf = leaf.id === activeLeafId;
            const color = PANE_COLORS[leafIdx % PANE_COLORS.length];
            const paneName = leaf._sidebarName;
            const isPaneRenaming = renamingPaneId === leaf.id;

            return (
              <div key={leaf.id} className="mb-0.5">
                {/* Pane header */}
                <div
                  className={`flex items-center gap-1.5 px-2 py-1 cursor-pointer transition-colors ${
                    isActiveLeaf ? 'bg-primary/10 text-foreground' : 'text-muted-foreground hover:bg-accent/30 hover:text-foreground'
                  }`}
                  onClick={() => onFocusLeaf(leaf.id)}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    setCtxMenu({ type: 'pane', leafId: leaf.id, x: e.clientX, y: e.clientY });
                  }}
                  onDoubleClick={() => setRenamingPaneId(leaf.id)}
                >
                  <Circle className="w-2 h-2 shrink-0" style={{ fill: color, color }} />
                  {isPaneRenaming ? (
                    <input
                      ref={paneRenameInputRef}
                      className="bg-transparent border border-primary/50 rounded px-0.5 text-[11px] w-full outline-none text-foreground font-medium"
                      defaultValue={paneName}
                      onBlur={(e) => { onRenamePaneCommit(leaf.id, e.target.value); setRenamingPaneId(null); }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') { onRenamePaneCommit(leaf.id, e.target.value); setRenamingPaneId(null); }
                        if (e.key === 'Escape') setRenamingPaneId(null);
                      }}
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <span className="text-[11px] font-medium truncate flex-1">{paneName}</span>
                  )}
                  <span className="text-[10px] text-muted-foreground/50">{leaf.terminals.length}</span>
                  {isActiveLeaf && <ChevronRight className="w-3 h-3 text-muted-foreground/50" />}
                </div>

                {/* Terminals in this pane */}
                {leaf.terminals.map((t) => {
                  const isActiveTerm = isActiveLeaf && t.id === leaf.activeTerminalId;
                  const isRenaming = renamingId === t.id;

                  return (
                    <div
                      key={t.id}
                      className={`flex items-center gap-1.5 pl-5 pr-2 py-0.5 cursor-pointer transition-colors group ${
                        isActiveTerm
                          ? 'bg-primary/5 text-foreground'
                          : 'text-muted-foreground hover:bg-accent/20 hover:text-foreground'
                      }`}
                      onClick={() => onSelectTab(leaf.id, t.id)}
                      onDoubleClick={() => onStartRename(t.id)}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        setCtxMenu({ type: 'terminal', leafId: leaf.id, termId: t.id, x: e.clientX, y: e.clientY });
                      }}
                    >
                      <TerminalIcon className="w-3 h-3 shrink-0 opacity-50" />
                      {isRenaming ? (
                        <input
                          ref={renameInputRef}
                          className="bg-transparent border border-primary/50 rounded px-0.5 text-[11px] w-full outline-none text-foreground"
                          defaultValue={t.name}
                          onBlur={(e) => onRename(t.id, e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') onRename(t.id, e.target.value);
                            if (e.key === 'Escape') onStartRename(null);
                          }}
                          onClick={(e) => e.stopPropagation()}
                        />
                      ) : (
                        <span className="text-[11px] truncate flex-1">{t.name}</span>
                      )}
                      <button
                        className="opacity-0 group-hover:opacity-100 hover:text-destructive transition-opacity shrink-0"
                        onClick={(e) => { e.stopPropagation(); onKillTerminal(t.id); }}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>

        {/* Footer actions */}
        <div className="shrink-0 border-t border-border/50 p-1.5 flex flex-col gap-1">
          <button
            className="flex items-center gap-1.5 w-full px-2 py-1 rounded text-[11px] text-muted-foreground hover:text-foreground hover:bg-accent/30 transition-colors"
            onClick={onCreateTerminal}
          >
            <Plus className="w-3 h-3" /> New Terminal
          </button>
          <button
            className="flex items-center gap-1.5 w-full px-2 py-1 rounded text-[11px] text-muted-foreground hover:text-foreground hover:bg-accent/30 transition-colors"
            onClick={() => onSplitLeaf('horizontal')}
            disabled={leaves.length === 0}
          >
            <Columns2 className="w-3 h-3" /> New Group
          </button>
        </div>
      </div>

      {/* Context menu */}
      {ctxMenu && (
        <SidebarContextMenu
          x={ctxMenu.x}
          y={ctxMenu.y}
          type={ctxMenu.type}
          leafId={ctxMenu.leafId}
          termId={ctxMenu.termId}
          leaves={annotatedLeaves}
          onClose={() => setCtxMenu(null)}
          onRenameTerminal={(id) => onStartRename(id)}
          onKillTerminal={onKillTerminal}
          onMoveTerminal={onMoveTerminal}
          onSplitTerminal={onSplitTerminal}
          onRenamePaneStart={(id) => setRenamingPaneId(id)}
          onKillAllInPane={onKillAllInPane}
          onNewTerminalInPane={onCreateTerminalInLeaf}
          onSplitPane={onSplitLeaf}
          onMergePane={onMergePane}
          onMaximizePane={onMaximizePane}
        />
      )}
    </div>
  );
}


// ── Context Menu ─────────────────────────────────
function TerminalContextMenu({ termId, leafId, x, y, leaves, onClose, onRename, onKill, onMove, onMaximize, onSplit }) {
  const otherLeaves = leaves.filter(l => l.id !== leafId);
  const currentLeaf = leaves.find(l => l.id === leafId);
  const isLastInLeaf = currentLeaf?.terminals.length === 1;

  return (
    <div
      className="fixed z-[100] min-w-[200px] rounded-md border bg-popover p-1 text-popover-foreground shadow-md text-xs"
      style={{ left: x, top: y }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <button className="flex items-center gap-2 w-full px-2 py-1.5 rounded-sm hover:bg-accent hover:text-accent-foreground transition-colors"
        onClick={() => onRename(termId)}
      >
        <Pencil className="w-3.5 h-3.5" /> Rename
      </button>

      <div className="h-px bg-border my-1" />

      <button
        className={`flex items-center gap-2 w-full px-2 py-1.5 rounded-sm transition-colors ${isLastInLeaf ? 'opacity-40 cursor-default' : 'hover:bg-accent hover:text-accent-foreground'}`}
        onClick={() => !isLastInLeaf && onSplit(termId, leafId, 'horizontal')}
      >
        <Columns2 className="w-3.5 h-3.5" /> Split Right
      </button>
      <button
        className={`flex items-center gap-2 w-full px-2 py-1.5 rounded-sm transition-colors ${isLastInLeaf ? 'opacity-40 cursor-default' : 'hover:bg-accent hover:text-accent-foreground'}`}
        onClick={() => !isLastInLeaf && onSplit(termId, leafId, 'vertical')}
      >
        <Rows2 className="w-3.5 h-3.5" /> Split Down
      </button>

      {leaves.length > 1 && (
        <button className="flex items-center gap-2 w-full px-2 py-1.5 rounded-sm hover:bg-accent hover:text-accent-foreground transition-colors"
          onClick={() => onMaximize(leafId)}
        >
          <Maximize2 className="w-3.5 h-3.5" /> Maximize Pane
        </button>
      )}

      {otherLeaves.length > 0 && (
        <>
          <div className="h-px bg-border my-1" />
          <div className="px-2 py-1 text-[10px] text-muted-foreground/60 uppercase tracking-wider">Move to pane</div>
          {otherLeaves.map((l) => {
            const name = l.terminals[0]?.name || 'Pane';
            return (
              <button key={l.id}
                className="flex items-center gap-2 w-full px-2 py-1.5 rounded-sm hover:bg-accent hover:text-accent-foreground transition-colors"
                onClick={() => onMove(termId, leafId, l.id)}
              >
                <ArrowRightLeft className="w-3.5 h-3.5" /> {name} ({l.terminals.length})
              </button>
            );
          })}
        </>
      )}

      <div className="h-px bg-border my-1" />
      <button className="flex items-center gap-2 w-full px-2 py-1.5 rounded-sm hover:bg-destructive/10 hover:text-destructive transition-colors"
        onClick={() => onKill(termId)}
      >
        <Trash2 className="w-3.5 h-3.5" /> Kill Terminal
      </button>
    </div>
  );
}
