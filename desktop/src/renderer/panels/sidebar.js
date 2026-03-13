/* ═══════════════════════════════════════════════════════════════
   Skillbox — Project Sidebar Panel (VS Code Explorer Tree)
   ═══════════════════════════════════════════════════════════════ */

import state from '../lib/state.js';
import { $, esc } from '../lib/utils.js';

// Track expanded folders and cache directory contents
const _sidebarExpanded = new Map();
const _sidebarCache = new Map();

// File extension → icon color mapping
const _extColors = {
  '.js': '#f0db4f', '.ts': '#3178c6', '.tsx': '#3178c6', '.jsx': '#61dafb',
  '.py': '#3776ab', '.rb': '#cc342d', '.go': '#00add8', '.rs': '#dea584',
  '.java': '#b07219', '.html': '#e34c26', '.css': '#563d7c', '.scss': '#c6538c',
  '.json': '#a8b1c0', '.yaml': '#a8b1c0', '.yml': '#a8b1c0', '.md': '#519aba',
  '.sh': '#89e051', '.sql': '#e38c00', '.vue': '#42b883', '.svelte': '#ff3e00',
  '.env': '#ecd53f', '.gitignore': '#f05033',
};

function _getFileColor(name) {
  const ext = '.' + name.split('.').pop().toLowerCase();
  return _extColors[ext] || 'var(--muted-foreground)';
}

export function renderProjectSidebar(callbacks) {
  const container = $('#projectSidebarList');
  if (!container) return;

  if (state.projects.length === 0) {
    container.innerHTML = '<div class="psb-empty">No projects yet</div>';
    return;
  }

  container.innerHTML = state.projects.map(p => {
    const isExpanded = _sidebarExpanded.has(p.path);
    const isActive = p.path === state.activeProjectPath;
    return `<div class="psb-section" data-path="${esc(p.path)}">
      <div class="psb-section-header ${isActive ? 'active' : ''}" data-path="${esc(p.path)}">
        <button class="tree-chevron ${isExpanded ? 'expanded' : ''}" data-sb-toggle="${esc(p.path)}">
          <svg viewBox="0 0 16 16" fill="currentColor" width="16" height="16"><path d="M6.22 3.22a.75.75 0 011.06 0l4.25 4.25a.75.75 0 010 1.06l-4.25 4.25a.75.75 0 01-1.06-1.06L9.94 8 6.22 4.28a.75.75 0 010-1.06z"/></svg>
        </button>
        <span class="psb-section-name">${esc(p.name.toUpperCase())}</span>
      </div>
      <div class="psb-tree" id="sbTree_${esc(p.path.replace(/[^a-zA-Z0-9]/g, '_'))}" style="${isExpanded ? '' : 'display:none'}"></div>
    </div>`;
  }).join('');

  container.querySelectorAll('.psb-section-header').forEach(header => {
    header.addEventListener('click', (e) => {
      if (e.target.closest('button')) return;
      state.activeProjectPath = header.dataset.path;
      container.querySelectorAll('.psb-section-header').forEach(h => h.classList.remove('active'));
      header.classList.add('active');
      callbacks.renderRightPanel();
      if (state.activeView === 'projects') callbacks.renderProjects();
    });
    header.addEventListener('contextmenu', (e) => callbacks.showProjectContextMenu(e, header.dataset.path));
  });

  container.querySelectorAll('[data-sb-toggle]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const projectPath = btn.dataset.sbToggle;
      const cid = 'sbTree_' + projectPath.replace(/[^a-zA-Z0-9]/g, '_');
      const treeEl = $(`#${cid}`);

      state.activeProjectPath = projectPath;
      container.querySelectorAll('.psb-section-header').forEach(h => h.classList.remove('active'));
      btn.closest('.psb-section-header').classList.add('active');
      callbacks.renderRightPanel();

      if (_sidebarExpanded.has(projectPath)) {
        _sidebarExpanded.delete(projectPath);
        if (treeEl) treeEl.style.display = 'none';
        btn.classList.remove('expanded');
      } else {
        _sidebarExpanded.set(projectPath, true);
        btn.classList.add('expanded');
        if (treeEl) {
          treeEl.style.display = '';
          treeEl.innerHTML = '<div class="tree-loading">Loading...</div>';
          try {
            const entries = await window.skillbox.readDirectory(projectPath, 1);
            _sidebarCache.set(projectPath, entries);
            _renderSbTree(treeEl, entries, 1, callbacks);
          } catch {
            treeEl.innerHTML = '<div class="tree-loading">Could not read directory</div>';
          }
        }
      }
    });
  });

  // Re-render already expanded
  for (const [pp] of _sidebarExpanded) {
    const cached = _sidebarCache.get(pp);
    if (cached) {
      const cid = 'sbTree_' + pp.replace(/[^a-zA-Z0-9]/g, '_');
      const el = $(`#${cid}`);
      if (el) _renderSbTree(el, cached, 1, callbacks);
    }
  }

  const countEl = $('#navProjectCount');
  if (countEl) {
    countEl.textContent = state.projects.length;
    countEl.style.display = state.projects.length > 0 ? '' : 'none';
  }
}

function _renderSbTree(container, entries, depth, callbacks) {
  if (!entries || entries.length === 0) {
    container.innerHTML = `<div class="tree-empty-dir" style="padding-left:${depth * 16 + 8}px">Empty</div>`;
    return;
  }
  container.innerHTML = entries.map(entry => {
    const indent = depth * 16;
    const isExpanded = _sidebarExpanded.has(entry.path);
    if (entry.isDir) {
      return `<div class="tree-item is-folder ${isExpanded ? 'expanded' : ''}" data-path="${esc(entry.path)}">
        <div class="tree-item-content" style="padding-left:${indent}px">
          <button class="tree-chevron ${isExpanded ? 'expanded' : ''}" data-sb-dir="${esc(entry.path)}">
            <svg viewBox="0 0 16 16" fill="currentColor" width="16" height="16"><path d="M6.22 3.22a.75.75 0 011.06 0l4.25 4.25a.75.75 0 010 1.06l-4.25 4.25a.75.75 0 01-1.06-1.06L9.94 8 6.22 4.28a.75.75 0 010-1.06z"/></svg>
          </button>
          <svg class="tree-icon tree-icon-folder" viewBox="0 0 20 20" fill="currentColor" width="14" height="14"><path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z"/></svg>
          <span class="tree-label">${esc(entry.name)}</span>
        </div>
        <div class="tree-children" style="${isExpanded ? '' : 'display:none'}"></div>
      </div>`;
    } else {
      const color = _getFileColor(entry.name);
      return `<div class="tree-item is-file">
        <div class="tree-item-content" style="padding-left:${indent + 16}px">
          <svg class="tree-icon tree-icon-file" viewBox="0 0 16 16" fill="${color}" width="12" height="12"><path d="M4 0a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2V4.5L9.5 0H4zM9 1v3.5A1.5 1.5 0 0010.5 6H14v8a1 1 0 01-1 1H4a1 1 0 01-1-1V2a1 1 0 011-1h5z"/></svg>
          <span class="tree-label">${esc(entry.name)}</span>
        </div>
      </div>`;
    }
  }).join('');

  container.querySelectorAll('[data-sb-dir]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const dirPath = btn.dataset.sbDir;
      const item = btn.closest('.tree-item');
      const childEl = item.querySelector(':scope > .tree-children');

      if (_sidebarExpanded.has(dirPath)) {
        _sidebarExpanded.delete(dirPath);
        item.classList.remove('expanded');
        btn.classList.remove('expanded');
        if (childEl) childEl.style.display = 'none';
      } else {
        _sidebarExpanded.set(dirPath, true);
        item.classList.add('expanded');
        btn.classList.add('expanded');
        if (childEl) {
          childEl.style.display = '';
          childEl.innerHTML = '<div class="tree-loading">Loading...</div>';
          try {
            const entries = await window.skillbox.readDirectory(dirPath, 1);
            _sidebarCache.set(dirPath, entries);
            _renderSbTree(childEl, entries, depth + 1, callbacks);
          } catch {
            childEl.innerHTML = '<div class="tree-loading">Could not read</div>';
          }
        }
      }
    });
  });

  // Right-click context menu on tree items
  container.querySelectorAll('.tree-item-content').forEach(row => {
    row.addEventListener('contextmenu', (e) => {
      const item = row.closest('.tree-item');
      if (!item) return;
      const isDir = item.classList.contains('is-folder');
      const itemPath = item.dataset.path;
      if (itemPath) callbacks.showExplorerContextMenu(e, itemPath, isDir);
    });
  });
}

export async function refreshSidebarDir(dirPath) {
  try {
    const entries = await window.skillbox.readDirectory(dirPath, 1);
    _sidebarCache.set(dirPath, entries);
    // Check if it's a project root
    for (const p of state.projects) {
      if (p.path === dirPath) {
        const cid = 'sbTree_' + dirPath.replace(/[^a-zA-Z0-9]/g, '_');
        const el = $(`#${cid}`);
        if (el) _renderSbTree(el, entries, 1, {});
        return;
      }
    }
    // Otherwise find the tree-item with this path
    const item = document.querySelector(`.tree-item[data-path="${CSS.escape(dirPath)}"]`);
    if (item) {
      const childEl = item.querySelector(':scope > .tree-children');
      if (childEl) {
        const depth = Math.round(parseInt(item.querySelector('.tree-item-content')?.style.paddingLeft || '16') / 16);
        _renderSbTree(childEl, entries, depth + 1, {});
      }
    }
  } catch { /* skip */ }
}

export function clearSidebarCache(path) {
  _sidebarExpanded.delete(path);
  _sidebarCache.delete(path);
}

export function toggleProjectSidebar() {
  state.projectSidebarOpen = !state.projectSidebarOpen;
  const sidebar = $('#projectSidebar');
  const handle = $('#resizeSidebar');
  if (sidebar) sidebar.style.display = state.projectSidebarOpen ? '' : 'none';
  if (handle) handle.style.display = state.projectSidebarOpen ? '' : 'none';
}
