/* ═══════════════════════════════════════════════════════════════
   Skillbox — Panel Resize System
   ═══════════════════════════════════════════════════════════════ */

import state from '../lib/state.js';
import { $ } from '../lib/utils.js';

export function initPanelResize() {
  setupHorizontalResize('resizeSidebar', 'projectSidebar', {
    min: 80, maxFn: () => window.innerWidth * 0.6, side: 'left',
    onResize(w) {
      const psb = $('#projectSidebar');
      if (psb) { psb.style.width = w + 'px'; psb.style.minWidth = w + 'px'; }
    }
  });

  setupHorizontalResize('resizeRightPanel', 'rightPanel', {
    min: 80, maxFn: () => window.innerWidth * 0.6, side: 'right',
    onResize(w) {
      const rp = $('#rightPanel');
      if (rp) { rp.style.width = w + 'px'; rp.style.minWidth = w + 'px'; }
    }
  });
}

function setupHorizontalResize(handleId, panelId, opts) {
  const handle = $(`#${handleId}`);
  const panel = $(`#${panelId}`);
  if (!handle || !panel) return;

  handle.addEventListener('mousedown', (e) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = panel.offsetWidth;
    document.body.classList.add('resizing');
    handle.classList.add('active');

    const onMove = (e) => {
      const delta = opts.side === 'left' ? e.clientX - startX : startX - e.clientX;
      const max = opts.maxFn ? opts.maxFn() : opts.max;
      const w = Math.min(Math.max(startWidth + delta, opts.min), max);
      opts.onResize(w);
    };

    const onUp = () => {
      document.body.classList.remove('resizing');
      handle.classList.remove('active');
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      const term = state.terminals.find(t => t.id === state.activeTerminalId);
      if (term?.fitAddon) try { term.fitAddon.fit(); } catch {}
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });

  handle.addEventListener('dblclick', () => {
    panel.style.width = '';
    panel.style.minWidth = '';
  });
}
