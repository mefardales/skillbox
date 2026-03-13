import { useRef, useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
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
import { Separator } from '@/components/ui/separator';
import {
  Terminal as TerminalIcon,
  Plus,
  Split,
  X,
  Maximize2,
  Minimize2,
  Trash2,
} from 'lucide-react';
import { useStore } from '@/hooks/useStore';
import { electronAPI } from '@/lib/electronAPI';

const XTERM_OPTIONS = {
  fontSize: 13,
  fontFamily: "'JetBrains Mono', 'SF Mono', monospace",
  lineHeight: 1.3,
  theme: {
    background: '#0f1117',
    foreground: '#e4e4e7',
    cursor: '#93c5fd',
    selectionBackground: 'rgba(59,130,246,0.3)',
    black: '#27272a',
    red: '#ef4444',
    green: '#22c55e',
    yellow: '#eab308',
    blue: '#3b82f6',
    magenta: '#a855f7',
    cyan: '#06b6d4',
    white: '#e4e4e7',
  },
  cursorBlink: true,
  scrollback: 5000,
  allowProposedApi: true,
};

const DEFAULT_HEIGHT = 300;
const MIN_HEIGHT = 120;
const MAX_HEIGHT = 800;

export default function TerminalPanel() {
  const [terminals, setTerminals] = useState([]);
  const [activeTerminalId, setActiveTerminalId] = useState(null);
  const [splitTerminalIds, setSplitTerminalIds] = useState([]);
  const [panelHeight, setPanelHeight] = useState(DEFAULT_HEIGHT);
  const [isMaximized, setIsMaximized] = useState(false);

  const terminalsRef = useRef([]);
  const containerRef = useRef(null);
  const resizeHandleRef = useRef(null);
  const panelRef = useRef(null);
  const preMaximizeHeight = useRef(DEFAULT_HEIGHT);

  // Keep ref in sync with state for use in callbacks
  useEffect(() => {
    terminalsRef.current = terminals;
  }, [terminals]);

  // Listen for terminal data and exit events
  useEffect(() => {
    const cleanupData = electronAPI.onTerminalData(({ id, data }) => {
      const t = terminalsRef.current.find((t) => t.id === id);
      if (t?.term) t.term.write(data);
    });

    const cleanupExit = electronAPI.onTerminalExit(({ id }) => {
      setTerminals((prev) => {
        const next = prev.filter((t) => t.id !== id);
        // Clean up xterm instance
        const dying = prev.find((t) => t.id === id);
        if (dying?.term) dying.term.dispose();
        return next;
      });
      setSplitTerminalIds((prev) => prev.filter((sid) => sid !== id));
      setActiveTerminalId((prev) => {
        if (prev === id) {
          const remaining = terminalsRef.current.filter((t) => t.id !== id);
          return remaining[0]?.id || null;
        }
        return prev;
      });
    });

    return () => {
      cleanupData?.();
      cleanupExit?.();
    };
  }, []);

  // Create a new terminal
  const createTerminal = useCallback(
    async (options = {}) => {
      const term = new window.Terminal(XTERM_OPTIONS);
      const fitAddon = new window.FitAddon.FitAddon();
      term.loadAddon(fitAddon);

      const result = await electronAPI.terminalCreate({
        ...options,
        cols: 120,
        rows: 30,
      });

      const termObj = {
        id: result.id,
        name: result.name || `Terminal ${result.id}`,
        cwd: result.cwd,
        term,
        fitAddon,
        containerEl: null,
      };

      term.onData((data) => electronAPI.terminalWrite(result.id, data));
      term.onResize(({ cols, rows }) =>
        electronAPI.terminalResize(result.id, cols, rows)
      );

      setTerminals((prev) => [...prev, termObj]);
      setActiveTerminalId(result.id);
      setSplitTerminalIds([]);

      return termObj;
    },
    []
  );

  // Kill a terminal
  const killTerminal = useCallback(
    (id) => {
      const targetId = id || activeTerminalId;
      if (!targetId) return;
      electronAPI.terminalKill(targetId);
    },
    [activeTerminalId]
  );

  // Split terminal
  const splitTerminal = useCallback(() => {
    if (!activeTerminalId || terminals.length === 0) return;
    const activeTerm = terminals.find((t) => t.id === activeTerminalId);
    if (!activeTerm) return;

    const currentSplits =
      splitTerminalIds.length > 0
        ? splitTerminalIds
        : [activeTerminalId];

    createTerminal({ cwd: activeTerm.cwd }).then((newTerm) => {
      setSplitTerminalIds([...currentSplits, newTerm.id]);
    });
  }, [activeTerminalId, terminals, splitTerminalIds, createTerminal]);

  // Toggle maximize
  const toggleMaximize = useCallback(() => {
    if (isMaximized) {
      setPanelHeight(preMaximizeHeight.current);
      setIsMaximized(false);
    } else {
      preMaximizeHeight.current = panelHeight;
      setPanelHeight(window.innerHeight - 48); // leave room for activity bar
      setIsMaximized(true);
    }
  }, [isMaximized, panelHeight]);

  // Resize handle drag
  useEffect(() => {
    const handle = resizeHandleRef.current;
    if (!handle) return;

    let startY = 0;
    let startHeight = 0;

    const onMouseMove = (e) => {
      const delta = startY - e.clientY;
      const newHeight = Math.min(
        MAX_HEIGHT,
        Math.max(MIN_HEIGHT, startHeight + delta)
      );
      setPanelHeight(newHeight);
      setIsMaximized(false);
    };

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      // Re-fit all terminals after resize
      terminalsRef.current.forEach((t) => {
        try {
          t.fitAddon?.fit();
        } catch {}
      });
    };

    const onMouseDown = (e) => {
      e.preventDefault();
      startY = e.clientY;
      startHeight = panelRef.current?.offsetHeight || panelHeight;
      document.body.style.cursor = 'row-resize';
      document.body.style.userSelect = 'none';
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    };

    handle.addEventListener('mousedown', onMouseDown);
    return () => handle.removeEventListener('mousedown', onMouseDown);
  }, [panelHeight]);

  // Determine which terminals to show
  const visibleTerminalIds =
    splitTerminalIds.length > 1
      ? splitTerminalIds
      : activeTerminalId
        ? [activeTerminalId]
        : [];

  return (
    <div
      ref={panelRef}
      className="flex flex-col border-t border-border bg-[oklch(0.14_0.017_292.6)]"
      style={{ height: isMaximized ? '100%' : `${panelHeight}px` }}
    >
      {/* Resize handle */}
      <div
        ref={resizeHandleRef}
        className="h-[3px] cursor-row-resize hover:bg-primary/50 active:bg-primary/70 transition-colors shrink-0"
      />

      {/* Header bar */}
      <div className="flex items-center h-9 px-2 gap-1 border-b border-border shrink-0 bg-[oklch(0.17_0.017_292.6)]">
        <div className="flex items-center gap-1.5 mr-auto">
          <TerminalIcon className="w-3.5 h-3.5 text-muted-foreground" />

          <Select
            value={activeTerminalId || ''}
            onValueChange={(val) => {
              setActiveTerminalId(val);
              setSplitTerminalIds([]);
            }}
          >
            <SelectTrigger className="h-6 w-[140px] text-xs border-none bg-transparent hover:bg-accent/50 px-1.5">
              <SelectValue placeholder="Terminal" />
            </SelectTrigger>
            <SelectContent>
              {terminals.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-0.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() =>
                  createTerminal({ cwd: undefined })
                }
              >
                <Plus className="w-3.5 h-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">New Terminal</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={splitTerminal}
                disabled={terminals.length === 0}
              >
                <Split className="w-3.5 h-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Split Terminal</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => killTerminal()}
                disabled={!activeTerminalId}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Kill Terminal</TooltipContent>
          </Tooltip>

          <Separator orientation="vertical" className="h-4 mx-0.5" />

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={toggleMaximize}
              >
                {isMaximized ? (
                  <Minimize2 className="w-3.5 h-3.5" />
                ) : (
                  <Maximize2 className="w-3.5 h-3.5" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              {isMaximized ? 'Restore' : 'Maximize'}
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => {
                  // Close panel — caller should handle visibility
                }}
              >
                <X className="w-3.5 h-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Close Panel</TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* Terminal panes area */}
      <div
        ref={containerRef}
        className="flex flex-1 min-h-0 overflow-hidden"
      >
        {visibleTerminalIds.map((id) => {
          const t = terminals.find((term) => term.id === id);
          if (!t) return null;
          return (
            <TerminalPane
              key={id}
              termObj={t}
              isActive={id === activeTerminalId}
              isSplit={visibleTerminalIds.length > 1}
              onFocus={() => setActiveTerminalId(id)}
            />
          );
        })}

        {terminals.length === 0 && (
          <div className="flex items-center justify-center flex-1 text-muted-foreground text-sm">
            <button
              className="flex items-center gap-2 px-3 py-1.5 rounded hover:bg-accent/50 transition-colors text-muted-foreground hover:text-foreground"
              onClick={() => createTerminal({ cwd: undefined })}
            >
              <Plus className="w-4 h-4" />
              Create Terminal
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/** Individual terminal pane — mounts xterm.js into a DOM node */
function TerminalPane({ termObj, isActive, isSplit, onFocus }) {
  const mountRef = useRef(null);
  const mountedRef = useRef(false);

  useEffect(() => {
    const el = mountRef.current;
    if (!el || !termObj.term || mountedRef.current) return;

    mountedRef.current = true;
    termObj.term.open(el);
    termObj.containerEl = el;

    // Small delay before initial fit to let layout settle
    const timer = setTimeout(() => {
      try {
        termObj.fitAddon.fit();
      } catch {}
      termObj.term.focus();
    }, 80);

    // ResizeObserver for auto-fit
    const ro = new ResizeObserver(() => {
      try {
        termObj.fitAddon.fit();
      } catch {}
    });
    ro.observe(el);

    return () => {
      clearTimeout(timer);
      ro.disconnect();
      mountedRef.current = false;
    };
  }, [termObj]);

  // Focus the xterm when this pane becomes active
  useEffect(() => {
    if (isActive && termObj.term) {
      termObj.term.focus();
    }
  }, [isActive, termObj]);

  return (
    <div
      className={`flex-1 min-w-0 min-h-0 overflow-hidden ${
        isSplit ? 'border-r border-border last:border-r-0' : ''
      } ${isActive ? 'ring-1 ring-primary/30 ring-inset' : ''}`}
      onMouseDown={onFocus}
    >
      <div ref={mountRef} className="w-full h-full" />
    </div>
  );
}
