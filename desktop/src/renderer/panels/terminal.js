/* ═══════════════════════════════════════════════════════════════
   Skillbox — Terminal Panel (VS Code-style)
   ═══════════════════════════════════════════════════════════════ */

import state from '../lib/state.js';
import { $, esc } from '../lib/utils.js';

export function initTerminalListeners() {
  window.skillbox.onTerminalData(({ id, data }) => {
    const term = state.terminals.find(t => t.id === id);
    if (term?.term) term.term.write(data);
  });
  window.skillbox.onTerminalExit(({ id }) => {
    state.terminals = state.terminals.filter(t => t.id !== id);
    if (state.activeTerminalId === id) {
      state.activeTerminalId = state.terminals[0]?.id || null;
    }
    renderTerminalTabs();
    showActiveTerminal();
    if (state.terminals.length === 0) setTerminalPanel(false);
  });
}

export function toggleTerminalPanel() {
  if (state.terminalPanelOpen) {
    setTerminalPanel(false);
  } else {
    setTerminalPanel(true);
    if (state.terminals.length === 0) createTerminal({ cwd: state.activeProjectPath || undefined });
  }
}

export function fitAllVisibleTerminals() {
  setTimeout(() => {
    state.terminals.forEach(t => {
      if (t.element.style.display !== 'none' && t.fitAddon) {
        try { t.fitAddon.fit(); } catch {}
      }
    });
  }, 80);
}

export function initTerminalResize() {
  const panel = $('#terminalPanel');
  const handle = $('#terminalResizeHandle');
  if (!handle || !panel) return;

  handle.addEventListener('mousedown', (e) => {
    e.preventDefault();
    const startY = e.clientY;
    const startHeight = panel.offsetHeight;
    document.body.classList.add('resizing-v');
    handle.classList.add('active');

    const onMove = (e) => {
      const delta = startY - e.clientY;
      const newHeight = Math.min(Math.max(startHeight + delta, 60), window.innerHeight * 0.9);
      panel.style.height = newHeight + 'px';
    };

    const onUp = () => {
      document.body.classList.remove('resizing-v');
      handle.classList.remove('active');
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      fitAllVisibleTerminals();
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });
}

export function toggleTerminalMaximize() {
  const panel = $('#terminalPanel');
  if (!panel) return;
  panel.classList.toggle('maximized');
  fitAllVisibleTerminals();
}

export function setTerminalPanel(open) {
  state.terminalPanelOpen = open;
  const panel = $('#terminalPanel');
  const toggleBtn = $('#btnToggleTerminal');
  if (panel) panel.style.display = open ? '' : 'none';
  if (toggleBtn) toggleBtn.classList.toggle('active', open);
  if (open) {
    fitAllVisibleTerminals();
    const active = state.terminals.find(t => t.id === state.activeTerminalId);
    if (active?.term) setTimeout(() => active.term.focus(), 80);
  }
}

export async function createTerminal(options = {}) {
  const XTerminal = window.Terminal;
  const XFitAddon = window.FitAddon.FitAddon;

  const term = new XTerminal({
    fontFamily: "'Cascadia Code', 'Fira Code', 'SF Mono', Menlo, monospace",
    fontSize: 13,
    lineHeight: 1.3,
    theme: {
      background: '#0f1117',
      foreground: '#e4e4e7',
      cursor: '#93c5fd',
      selectionBackground: 'rgba(59,130,246,0.3)',
      black: '#27272a', red: '#ef4444', green: '#22c55e', yellow: '#eab308',
      blue: '#3b82f6', magenta: '#a855f7', cyan: '#06b6d4', white: '#e4e4e7',
    },
    cursorBlink: true,
    scrollback: 5000,
    allowProposedApi: true,
  });

  const fitAddon = new XFitAddon();
  term.loadAddon(fitAddon);

  const termEl = document.createElement('div');
  termEl.className = 'terminal-instance';
  $('#terminalContainer').appendChild(termEl);
  term.open(termEl);

  termEl.addEventListener('mousedown', () => {
    const t = state.terminals.find(t => t.element === termEl);
    if (t) setFocusedTerminal(t.id);
  });

  await new Promise(r => setTimeout(r, 80));
  try { fitAddon.fit(); } catch {}
  const initialCols = term.cols || 120;
  const initialRows = term.rows || 30;

  const result = await window.skillbox.terminalCreate({
    ...options,
    cols: initialCols,
    rows: initialRows,
  });

  const termObj = {
    id: result.id,
    name: result.name,
    cwd: result.cwd,
    term,
    fitAddon,
    element: termEl,
  };
  state.terminals.push(termObj);
  state.activeTerminalId = result.id;
  state.focusedTerminalId = result.id;

  term.onData((data) => window.skillbox.terminalWrite(result.id, data));
  term.onResize(({ cols, rows }) => window.skillbox.terminalResize(result.id, cols, rows));

  const resizeObserver = new ResizeObserver(() => {
    try { fitAddon.fit(); } catch {}
  });
  resizeObserver.observe(termEl);

  renderTerminalUI();
  setTerminalPanel(true);
  setTimeout(() => term.focus(), 100);
}

function setFocusedTerminal(id) {
  state.focusedTerminalId = id;
  state.terminals.forEach(t => {
    t.element.classList.toggle('focused', t.id === id);
  });
  renderTerminalSidebar();
  const t = state.terminals.find(t => t.id === id);
  if (t?.term) t.term.focus();
}

// ── Split Terminal ───────────────────────────────────────────

export function splitTerminal() {
  if (!state.activeTerminalId || state.terminals.length === 0) return;
  const activeTerm = state.terminals.find(t => t.id === state.activeTerminalId);
  if (!activeTerm) return;

  if (!state.splitTerminalIds.includes(state.activeTerminalId)) {
    state.splitTerminalIds = [state.activeTerminalId];
  }

  createTerminal({ cwd: activeTerm.cwd }).then(() => {
    state.splitTerminalIds.push(state.activeTerminalId);
    renderTerminalPanes();
  });
}

function renderTerminalPanes() {
  const container = $('#terminalContainer');
  if (!container) return;

  container.querySelectorAll('.terminal-split-divider').forEach(h => h.remove());

  if (state.splitTerminalIds.length > 1) {
    state.splitTerminalIds = state.splitTerminalIds.filter(id => state.terminals.find(t => t.id === id));

    if (state.splitTerminalIds.length <= 1) {
      state.splitTerminalIds = [];
      showSingleTerminal();
      return;
    }

    state.terminals.forEach(t => {
      t.element.style.display = 'none';
      t.element.style.flex = '';
      t.element.style.width = '';
    });

    const splitTerms = state.splitTerminalIds.map(id => state.terminals.find(t => t.id === id)).filter(Boolean);
    splitTerms.forEach((t, i) => {
      t.element.style.display = '';
      t.element.style.flex = '1';
      container.appendChild(t.element);

      if (i < splitTerms.length - 1) {
        const divider = document.createElement('div');
        divider.className = 'terminal-split-divider';
        container.insertBefore(divider, splitTerms[i + 1].element);
        setupSplitDivider(divider, t, splitTerms[i + 1]);
      }
    });

    fitAllVisibleTerminals();
  } else {
    showSingleTerminal();
  }

  renderTerminalSidebar();
}

function showSingleTerminal() {
  const container = $('#terminalContainer');
  if (!container) return;
  container.querySelectorAll('.terminal-split-divider').forEach(h => h.remove());

  state.terminals.forEach(t => {
    const visible = t.id === state.activeTerminalId;
    t.element.style.display = visible ? '' : 'none';
    t.element.style.flex = '1';
    t.element.style.width = '';
  });

  const active = state.terminals.find(t => t.id === state.activeTerminalId);
  if (active) {
    state.focusedTerminalId = active.id;
    active.element.classList.add('focused');
    if (active.fitAddon) setTimeout(() => { try { active.fitAddon.fit(); } catch {} }, 50);
    if (active.term) setTimeout(() => active.term.focus(), 80);
  }
}

function setupSplitDivider(divider, leftTerm, rightTerm) {
  divider.addEventListener('mousedown', (e) => {
    e.preventDefault();
    document.body.classList.add('resizing');
    divider.classList.add('active');
    const startX = e.clientX;
    const leftW = leftTerm.element.offsetWidth;
    const rightW = rightTerm.element.offsetWidth;
    const totalW = leftW + rightW;

    const onMove = (ev) => {
      const delta = ev.clientX - startX;
      const newLeft = Math.max(80, Math.min(leftW + delta, totalW - 80));
      const newRight = totalW - newLeft;
      leftTerm.element.style.flex = 'none';
      rightTerm.element.style.flex = 'none';
      leftTerm.element.style.width = newLeft + 'px';
      rightTerm.element.style.width = newRight + 'px';
    };

    const onUp = () => {
      document.body.classList.remove('resizing');
      divider.classList.remove('active');
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      fitAllVisibleTerminals();
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });

  divider.addEventListener('dblclick', () => {
    leftTerm.element.style.flex = '1';
    rightTerm.element.style.flex = '1';
    leftTerm.element.style.width = '';
    rightTerm.element.style.width = '';
    fitAllVisibleTerminals();
  });
}

// ── Terminal UI Rendering ────────────────────────────────────

function renderTerminalUI() {
  renderTerminalTabs();
  renderTerminalSidebar();
  renderTerminalPanes();
}

function renderTerminalTabs() {
  const container = $('#terminalTabs');
  if (!container) return;

  const tabTerminals = state.splitTerminalIds.length > 1
    ? state.splitTerminalIds.map(id => state.terminals.find(t => t.id === id)).filter(Boolean)
    : [state.terminals.find(t => t.id === state.activeTerminalId)].filter(Boolean);

  container.innerHTML = tabTerminals.map(t => `
    <button class="terminal-tab ${t.id === state.focusedTerminalId ? 'focused' : ''}" data-term-id="${esc(t.id)}">
      <svg viewBox="0 0 16 16" fill="currentColor" width="10" height="10"><path fill-rule="evenodd" d="M1 3.5A1.5 1.5 0 012.5 2h11A1.5 1.5 0 0115 3.5v9a1.5 1.5 0 01-1.5 1.5h-11A1.5 1.5 0 011 12.5v-9zM3.293 5.293a1 1 0 011.414 0L6.5 7.086l-1.793 1.793a1 1 0 11-1.414-1.414L4.586 6.5 3.293 5.207a1 1 0 010-.914zM8 8a.75.75 0 000 1.5h2a.75.75 0 000-1.5H8z"/></svg>
      ${esc(t.name)}
    </button>
  `).join('');

  container.querySelectorAll('.terminal-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      setFocusedTerminal(tab.dataset.termId);
    });
  });
}

function renderTerminalSidebar() {
  const container = $('#terminalSidebarList');
  if (!container) return;

  container.innerHTML = state.terminals.map(t => `
    <button class="terminal-sidebar-item ${t.id === state.activeTerminalId ? 'active' : ''} ${t.id === state.focusedTerminalId ? 'focused' : ''}" data-term-id="${esc(t.id)}">
      <svg class="terminal-sidebar-icon" viewBox="0 0 16 16" fill="currentColor"><path fill-rule="evenodd" d="M1 3.5A1.5 1.5 0 012.5 2h11A1.5 1.5 0 0115 3.5v9a1.5 1.5 0 01-1.5 1.5h-11A1.5 1.5 0 011 12.5v-9zM3.293 5.293a1 1 0 011.414 0L6.5 7.086l-1.793 1.793a1 1 0 11-1.414-1.414L4.586 6.5 3.293 5.207a1 1 0 010-.914zM8 8a.75.75 0 000 1.5h2a.75.75 0 000-1.5H8z"/></svg>
      <span class="terminal-sidebar-name">${esc(t.name)}</span>
      <button class="terminal-sidebar-close" data-close-term="${esc(t.id)}" title="Kill terminal">
        <svg viewBox="0 0 12 12" fill="currentColor" width="10" height="10"><path d="M3.354 3.354a.5.5 0 01.707 0L6 5.293l1.939-1.94a.5.5 0 01.707.708L6.707 6l1.94 1.939a.5.5 0 01-.708.707L6 6.707l-1.939 1.94a.5.5 0 01-.707-.708L5.293 6 3.354 4.061a.5.5 0 010-.707z"/></svg>
      </button>
    </button>
  `).join('');

  container.querySelectorAll('.terminal-sidebar-item').forEach(item => {
    item.addEventListener('click', (e) => {
      if (e.target.closest('.terminal-sidebar-close')) return;
      const id = item.dataset.termId;
      if (state.splitTerminalIds.includes(id)) {
        setFocusedTerminal(id);
        return;
      }
      state.activeTerminalId = id;
      state.splitTerminalIds = [];
      renderTerminalUI();
      showSingleTerminal();
    });
  });

  container.querySelectorAll('.terminal-sidebar-close').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      killTerminal(btn.dataset.closeTerm);
    });
  });
}

function showActiveTerminal() {
  if (state.splitTerminalIds.length > 1) {
    renderTerminalPanes();
    return;
  }
  showSingleTerminal();
  renderTerminalSidebar();
}

export async function duplicateTerminal() {
  const active = state.terminals.find(t => t.id === state.activeTerminalId);
  if (!active) return createTerminal();
  createTerminal({ cwd: active.cwd });
}

export async function killActiveTerminal() {
  const id = state.focusedTerminalId || state.activeTerminalId;
  if (!id) return;
  killTerminal(id);
}

export async function killTerminal(id) {
  const term = state.terminals.find(t => t.id === id);
  if (term) {
    term.term.dispose();
    term.element.remove();
    await window.skillbox.terminalKill(id);
    state.terminals = state.terminals.filter(t => t.id !== id);
    state.splitTerminalIds = state.splitTerminalIds.filter(sid => sid !== id);
    if (state.activeTerminalId === id) {
      state.activeTerminalId = state.splitTerminalIds[0] || state.terminals[0]?.id || null;
    }
    if (state.focusedTerminalId === id) {
      state.focusedTerminalId = state.activeTerminalId;
    }
  }
  if (state.terminals.length === 0) {
    setTerminalPanel(false);
    return;
  }
  renderTerminalUI();
  showActiveTerminal();
}
