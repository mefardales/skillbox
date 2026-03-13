/* ═══════════════════════════════════════════════════════════════
   Skillbox — Projects View (VS Code Tree Explorer)
   ═══════════════════════════════════════════════════════════════ */

import state from '../lib/state.js';
import { $, $$, esc, toast } from '../lib/utils.js';

// Track expanded folders per project
const expandedPaths = new Map();
// Cache loaded children
const childrenCache = new Map();

// File extension → icon color mapping
const extColors = {
  '.js': '#f0db4f', '.ts': '#3178c6', '.tsx': '#3178c6', '.jsx': '#61dafb',
  '.py': '#3776ab', '.rb': '#cc342d', '.go': '#00add8', '.rs': '#dea584',
  '.java': '#b07219', '.kt': '#a97bff', '.swift': '#f05138',
  '.html': '#e34c26', '.css': '#563d7c', '.scss': '#c6538c',
  '.json': '#a8b1c0', '.yaml': '#a8b1c0', '.yml': '#a8b1c0', '.toml': '#a8b1c0',
  '.md': '#519aba', '.txt': '#a8b1c0',
  '.sh': '#89e051', '.bash': '#89e051', '.zsh': '#89e051',
  '.sql': '#e38c00', '.graphql': '#e535ab',
  '.env': '#ecd53f', '.gitignore': '#f05033',
  '.vue': '#42b883', '.svelte': '#ff3e00',
};

function getFileColor(name) {
  const ext = '.' + name.split('.').pop().toLowerCase();
  return extColors[ext] || 'var(--muted-foreground)';
}

export async function addProject(callbacks) {
  const dirPath = await window.skillbox.browseFolder();
  if (!dirPath) return;
  const result = await window.skillbox.addProject(dirPath);
  state.projects = result.projects || [];
  state.activeProjectPath = dirPath;
  callbacks.renderProjectSidebar();
  callbacks.renderRightPanel();
  callbacks.updateCounts();
  callbacks.switchView('projects');
  toast(`Project loaded: ${dirPath.split(/[\\/]/).pop()}`);
}

export function renderProjects(callbacks) {
  const container = $('#projectsList');
  const empty = $('#projectsEmpty');
  const { projects } = state;

  if (projects.length === 0) {
    container.innerHTML = '';
    empty.style.display = '';
    return;
  }
  empty.style.display = 'none';

  container.innerHTML = projects.map(p => {
    const isActive = p.path === state.activeProjectPath;
    const isExpanded = expandedPaths.has(p.path);
    const taskCount = state.tasks.filter(t => t.project_path === p.path && t.status !== 'done').length;
    const stackNames = (p.analysis?.stack || []).map(s => s.name).join(', ');
    const envClass = (p.activeEnv || 'DEV').toLowerCase();
    const envClassMap = { dev: 'env-dev', qa: 'env-qa', prod: 'env-prod', staging: 'env-staging' };

    return `<div class="tree-project ${isActive ? 'active' : ''}" data-path="${esc(p.path)}">
      <div class="tree-project-header" data-path="${esc(p.path)}">
        <button class="tree-chevron ${isExpanded ? 'expanded' : ''}" data-toggle-project="${esc(p.path)}">
          <svg viewBox="0 0 16 16" fill="currentColor" width="16" height="16"><path d="M6.22 3.22a.75.75 0 011.06 0l4.25 4.25a.75.75 0 010 1.06l-4.25 4.25a.75.75 0 01-1.06-1.06L9.94 8 6.22 4.28a.75.75 0 010-1.06z"/></svg>
        </button>
        <svg class="tree-project-icon" viewBox="0 0 20 20" fill="currentColor" width="16" height="16"><path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z"/></svg>
        <span class="tree-project-name">${esc(p.name)}</span>
        ${taskCount > 0 ? `<span class="tree-badge">${taskCount}</span>` : ''}
        ${stackNames ? `<span class="tree-stack-hint">${esc(stackNames)}</span>` : ''}
        <div class="tree-project-actions">
          <span class="project-env-badge ${envClassMap[envClass] || 'env-default'}" data-env-path="${esc(p.path)}">${p.activeEnv || 'DEV'}</span>
          <button class="tree-action-btn" data-analyze="${esc(p.path)}" title="Analyze">
            <svg viewBox="0 0 16 16" fill="currentColor" width="14" height="14"><path d="M8 3.5a.5.5 0 00-1 0V9a.5.5 0 00.252.434l3.5 2a.5.5 0 00.496-.868L8 8.71V3.5z"/><path d="M8 16A8 8 0 108 0a8 8 0 000 16zm7-8A7 7 0 111 8a7 7 0 0114 0z"/></svg>
          </button>
          <button class="tree-action-btn" data-directives="${esc(p.path)}" title="Generate Directives">
            <svg viewBox="0 0 16 16" fill="currentColor" width="14" height="14"><path d="M4 0a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2V2a2 2 0 00-2-2H4zm0 1h8a1 1 0 011 1v12a1 1 0 01-1 1H4a1 1 0 01-1-1V2a1 1 0 011-1z"/><path d="M4.5 10.5A.5.5 0 015 10h3a.5.5 0 010 1H5a.5.5 0 01-.5-.5zm0-2A.5.5 0 015 8h6a.5.5 0 010 1H5a.5.5 0 01-.5-.5zm0-2A.5.5 0 015 6h6a.5.5 0 010 1H5a.5.5 0 01-.5-.5zm0-2A.5.5 0 015 4h6a.5.5 0 010 1H5a.5.5 0 01-.5-.5z"/></svg>
          </button>
          <button class="tree-action-btn" data-terminal="${esc(p.path)}" title="Open Terminal">
            <svg viewBox="0 0 16 16" fill="currentColor" width="14" height="14"><path d="M0 3a2 2 0 012-2h12a2 2 0 012 2v10a2 2 0 01-2 2H2a2 2 0 01-2-2V3zm9.5 5.5h-3a.5.5 0 000 1h3a.5.5 0 000-1zm-6.354-.354a.5.5 0 01.708-.708l2 2a.5.5 0 010 .708l-2 2a.5.5 0 01-.708-.708L4.793 10l-1.647-1.646a.5.5 0 010-.708z"/></svg>
          </button>
          <button class="tree-action-btn tree-action-danger" data-remove="${esc(p.path)}" title="Remove Project">
            <svg viewBox="0 0 16 16" fill="currentColor" width="12" height="12"><path d="M4.646 4.646a.5.5 0 01.708 0L8 7.293l2.646-2.647a.5.5 0 01.708.708L8.707 8l2.647 2.646a.5.5 0 01-.708.708L8 8.707l-2.646 2.647a.5.5 0 01-.708-.708L7.293 8 4.646 5.354a.5.5 0 010-.708z"/></svg>
          </button>
        </div>
      </div>
      <div class="tree-project-path">${esc(p.path)}</div>
      <div class="tree-children" id="treeChildren_${esc(p.path.replace(/[^a-zA-Z0-9]/g, '_'))}" style="${isExpanded ? '' : 'display:none'}"></div>
      <div class="project-analysis-progress" data-analysis-path="${esc(p.path)}" style="display:none">
        <div class="analysis-progress-bar-wrap"><div class="analysis-progress-fill" style="width:0%"></div></div>
        <div class="analysis-progress-label">Starting analysis...</div>
      </div>
    </div>`;
  }).join('');

  // Bind events
  bindProjectEvents(container, callbacks);

  // Re-render already expanded trees
  for (const [projectPath] of expandedPaths) {
    const cached = childrenCache.get(projectPath);
    if (cached) {
      const containerId = 'treeChildren_' + projectPath.replace(/[^a-zA-Z0-9]/g, '_');
      const childContainer = $(`#${containerId}`);
      if (childContainer) renderTreeItems(childContainer, cached, 1, callbacks);
    }
  }
}

function bindProjectEvents(container, callbacks) {
  // Select project (click header)
  container.querySelectorAll('.tree-project-header').forEach(header => {
    header.addEventListener('click', (e) => {
      if (e.target.closest('button') || e.target.closest('.project-env-badge')) return;
      state.activeProjectPath = header.dataset.path;
      container.querySelectorAll('.tree-project').forEach(p => p.classList.remove('active'));
      header.closest('.tree-project').classList.add('active');
      callbacks.renderProjectSidebar();
      callbacks.renderRightPanel();
    });
  });

  // Toggle expand/collapse
  container.querySelectorAll('[data-toggle-project]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const projectPath = btn.dataset.toggleProject;
      await toggleProjectTree(projectPath, callbacks);
    });
  });

  // Analyze
  container.querySelectorAll('[data-analyze]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const p = btn.dataset.analyze;
      document.querySelectorAll('.project-analysis-progress').forEach(bar => {
        if (bar.dataset.analysisPath === p) {
          bar.style.display = '';
          const fill = bar.querySelector('.analysis-progress-fill');
          if (fill) fill.style.width = '0%';
          const label = bar.querySelector('.analysis-progress-label');
          if (label) label.textContent = 'Starting analysis...';
        }
      });
      await window.skillbox.analyzeProject(p);
      state.projects = await window.skillbox.getProjects();
      renderProjects(callbacks);
      callbacks.renderProjectSidebar();
      callbacks.renderRightPanel();
      toast('Analysis complete!');
    });
  });

  // Directives
  container.querySelectorAll('[data-directives]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const md = await window.skillbox.generateDirectives(btn.dataset.directives);
      if (md) toast('DIRECTIVES.md generated!');
    });
  });

  // Terminal
  container.querySelectorAll('[data-terminal]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      callbacks.setTerminalPanel(true);
      callbacks.createTerminal({ cwd: btn.dataset.terminal });
    });
  });

  // Remove
  container.querySelectorAll('[data-remove]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const removePath = btn.dataset.remove;
      state.projects = await window.skillbox.removeProject(removePath);
      if (state.activeProjectPath === removePath) state.activeProjectPath = null;
      expandedPaths.delete(removePath);
      childrenCache.delete(removePath);
      renderProjects(callbacks);
      callbacks.renderProjectSidebar();
      callbacks.renderRightPanel();
      callbacks.updateCounts();
      toast('Project removed');
    });
  });

  // Env badges
  container.querySelectorAll('[data-env-path]').forEach(badge => {
    badge.addEventListener('click', (e) => {
      e.stopPropagation();
      callbacks.openEnvModal(badge.dataset.envPath);
    });
  });
}

async function toggleProjectTree(projectPath, callbacks) {
  const containerId = 'treeChildren_' + projectPath.replace(/[^a-zA-Z0-9]/g, '_');
  const childContainer = $(`#${containerId}`);
  const chevron = document.querySelector(`[data-toggle-project="${CSS.escape(projectPath)}"]`);

  if (expandedPaths.has(projectPath)) {
    // Collapse
    expandedPaths.delete(projectPath);
    if (childContainer) childContainer.style.display = 'none';
    if (chevron) chevron.classList.remove('expanded');
  } else {
    // Expand
    expandedPaths.set(projectPath, true);
    if (chevron) chevron.classList.add('expanded');
    if (childContainer) {
      childContainer.style.display = '';
      childContainer.innerHTML = '<div class="tree-loading">Loading...</div>';
      try {
        const entries = await window.skillbox.readDirectory(projectPath, 1);
        childrenCache.set(projectPath, entries);
        renderTreeItems(childContainer, entries, 1, callbacks);
      } catch {
        childContainer.innerHTML = '<div class="tree-loading">Could not read directory</div>';
      }
    }
  }
}

function renderTreeItems(container, entries, depth, callbacks) {
  if (!entries || entries.length === 0) {
    container.innerHTML = '<div class="tree-empty-dir" style="padding-left:' + (depth * 20 + 24) + 'px">Empty folder</div>';
    return;
  }

  container.innerHTML = entries.map(entry => {
    const indent = depth * 20;
    const isExpanded = expandedPaths.has(entry.path);

    if (entry.isDir) {
      return `<div class="tree-item is-folder ${isExpanded ? 'expanded' : ''}" data-path="${esc(entry.path)}">
        <div class="tree-item-content" style="padding-left:${indent}px" data-tree-path="${esc(entry.path)}">
          <button class="tree-chevron ${isExpanded ? 'expanded' : ''}" data-toggle-dir="${esc(entry.path)}">
            <svg viewBox="0 0 16 16" fill="currentColor" width="16" height="16"><path d="M6.22 3.22a.75.75 0 011.06 0l4.25 4.25a.75.75 0 010 1.06l-4.25 4.25a.75.75 0 01-1.06-1.06L9.94 8 6.22 4.28a.75.75 0 010-1.06z"/></svg>
          </button>
          <svg class="tree-icon tree-icon-folder" viewBox="0 0 20 20" fill="currentColor" width="16" height="16"><path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z"/></svg>
          <span class="tree-label">${esc(entry.name)}</span>
        </div>
        <div class="tree-children" style="${isExpanded ? '' : 'display:none'}"></div>
      </div>`;
    } else {
      const color = getFileColor(entry.name);
      return `<div class="tree-item is-file" data-path="${esc(entry.path)}">
        <div class="tree-item-content" style="padding-left:${indent + 20}px" data-tree-path="${esc(entry.path)}">
          <svg class="tree-icon tree-icon-file" viewBox="0 0 16 16" fill="${color}" width="14" height="14"><path d="M4 0a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2V4.5L9.5 0H4zM9 1v3.5A1.5 1.5 0 0010.5 6H14v8a1 1 0 01-1 1H4a1 1 0 01-1-1V2a1 1 0 011-1h5z"/></svg>
          <span class="tree-label">${esc(entry.name)}</span>
        </div>
      </div>`;
    }
  }).join('');

  // Bind folder toggle events
  container.querySelectorAll('[data-toggle-dir]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const dirPath = btn.dataset.toggleDir;
      const item = btn.closest('.tree-item');
      const childContainer = item.querySelector(':scope > .tree-children');

      if (expandedPaths.has(dirPath)) {
        expandedPaths.delete(dirPath);
        item.classList.remove('expanded');
        btn.classList.remove('expanded');
        if (childContainer) childContainer.style.display = 'none';
      } else {
        expandedPaths.set(dirPath, true);
        item.classList.add('expanded');
        btn.classList.add('expanded');
        if (childContainer) {
          childContainer.style.display = '';
          childContainer.innerHTML = '<div class="tree-loading">Loading...</div>';
          try {
            const entries = await window.skillbox.readDirectory(dirPath, 1);
            childrenCache.set(dirPath, entries);
            renderTreeItems(childContainer, entries, depth + 1, callbacks);
          } catch {
            childContainer.innerHTML = '<div class="tree-loading">Could not read directory</div>';
          }
        }
      }
    });
  });

  // Terminal on folder double-click
  container.querySelectorAll('.is-folder > .tree-item-content').forEach(row => {
    row.addEventListener('dblclick', (e) => {
      if (e.target.closest('button')) return;
      callbacks.setTerminalPanel(true);
      callbacks.createTerminal({ cwd: row.dataset.treePath });
    });
  });

  // Re-render already expanded subdirs
  for (const [dirPath] of expandedPaths) {
    const cached = childrenCache.get(dirPath);
    if (cached) {
      const item = container.querySelector(`.tree-item[data-path="${CSS.escape(dirPath)}"]`);
      if (item) {
        const childEl = item.querySelector(':scope > .tree-children');
        if (childEl && childEl.innerHTML.includes('tree-loading')) {
          renderTreeItems(childEl, cached, depth + 1, callbacks);
        }
      }
    }
  }
}
