/* ═══════════════════════════════════════════════════════════════
   Skillbox Desktop — Renderer (v0.4.0 Multi-Panel IDE)
   ═══════════════════════════════════════════════════════════════ */

// ── State ────────────────────────────────────────────────────
let registry = { skills: [] };
let projects = [];
let teams = [];
let history = [];
let tasks = [];
let messages = [];
let activeView = 'projects';
let activeCategory = '';
let activeProjectPath = null;
let activeSkillId = null;
let currentEnvName = 'DEV';
let editingTeamId = null;
let teamMembers = [];
let editingSkillId = null;
let editingTaskId = null;

// Terminal state
let terminals = [];
let activeTerminalId = null;
let terminalPanelOpen = false;
let splitTerminalIds = []; // IDs of terminals shown side-by-side

// Panel state
let projectSidebarOpen = true;
let rightPanelOpen = true;
let activeRightTab = 'tasks';

// ── DOM refs ─────────────────────────────────────────────────
const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

// ── Category colors ──────────────────────────────────────────
const catColors = {
  frontend: '#f97316', backend: '#3b82f6', data: '#14b8a6',
  devops: '#22c55e', testing: '#a855f7', general: '#6b7280',
  mobile: '#ef4444', security: '#eab308',
};

// ── Init ─────────────────────────────────────────────────────
async function init() {
  // Add platform class for OS-specific styling (macOS traffic lights, etc.)
  if (window.skillbox.platform) {
    document.body.classList.add(`platform-${window.skillbox.platform}`);
  }

  // Toggle fullscreen class (removes macOS titlebar padding in fullscreen)
  if (window.skillbox.onFullscreenChange) {
    window.skillbox.onFullscreenChange((isFullscreen) => {
      document.body.classList.add('no-transition');
      document.body.classList.toggle('fullscreen', isFullscreen);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          document.body.classList.remove('no-transition');
        });
      });
    });
  }

  registry = await window.skillbox.getRegistry();
  const projResult = await window.skillbox.getProjects();
  projects = Array.isArray(projResult) ? projResult : [];
  teams = await window.skillbox.getTeams();
  history = await window.skillbox.getHistory();
  tasks = await window.skillbox.getTasks();
  messages = [];

  renderProjectSidebar();
  renderProjects();
  renderRightPanel();
  updateCounts();
  bindEvents();
  initGithubStatus();
  initAnalysisProgress();
  initTerminalListeners();
  initTerminalResize();
  _initTerminalNameSelector();
  initPanelResize();
  initSettingsEvents();
  initExtensionsEvents();

  // Apply saved settings on startup
  window.skillbox.getSettings().then(applySettings).catch(() => {});
}

function bindEvents() {
  // Nav items — views (data-view) and panels (data-panel)
  $$('.activity-bar-item').forEach(btn => {
    btn.addEventListener('click', () => {
      const view = btn.dataset.view;
      const panel = btn.dataset.panel;
      if (view) switchView(view);
      if (panel === 'projects') toggleProjectSidebar();
    });
  });

  // Project sidebar
  $('#btnAddProjectSidebar')?.addEventListener('click', addProject);
  $('#projectSidebarSearch')?.addEventListener('input', renderProjectSidebar);

  // Sidebar add project
  $('#btnAddProject').addEventListener('click', addProject);
  $('#btnAddProjectMain')?.addEventListener('click', addProject);
  $('#btnAddProjectEmpty')?.addEventListener('click', addProject);
  $('#dashBtnAddProject')?.addEventListener('click', addProject);

  // Dashboard quick actions
  $('#dashBtnViewTasks')?.addEventListener('click', () => switchView('tasks'));

  // Right panel tabs
  $$('.rp-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      activeRightTab = tab.dataset.rpTab;
      $$('.rp-tab').forEach(t => t.classList.toggle('active', t.dataset.rpTab === activeRightTab));
      $$('.rp-tab-content').forEach(c => c.classList.remove('active'));
      $(`#rp${capitalize(activeRightTab)}`)?.classList.add('active');
      renderRightPanel();
    });
  });

  // Right panel toggle
  $('#btnToggleRightPanel')?.addEventListener('click', toggleRightPanel);
  $('#rpBtnNewTask')?.addEventListener('click', () => openTaskModal());

  // Team buttons
  $('#btnCreateTeam')?.addEventListener('click', () => openTeamModal());
  $('#btnCreateTeamEmpty')?.addEventListener('click', () => openTeamModal());
  $('#btnCloseTeamModal')?.addEventListener('click', closeTeamModal);
  $('#btnCancelTeam')?.addEventListener('click', closeTeamModal);
  $('#btnSaveTeam')?.addEventListener('click', saveTeam);
  $('#btnAddMember')?.addEventListener('click', addTeamMember);

  // Env modal
  $('#btnCloseEnvModal')?.addEventListener('click', closeEnvModal);
  $('#btnAddEnvVar')?.addEventListener('click', addEnvVar);
  $('#btnSyncEnv')?.addEventListener('click', syncCurrentEnv);
  $('#btnImportEnv')?.addEventListener('click', importCurrentEnv);
  $('#envModalOverlay')?.addEventListener('click', (e) => { if (e.target === e.currentTarget) closeEnvModal(); });
  $('#teamModalOverlay')?.addEventListener('click', (e) => { if (e.target === e.currentTarget) closeTeamModal(); });

  // Task modal
  $('#btnCreateTask')?.addEventListener('click', () => openTaskModal());
  $('#btnCloseTaskModal')?.addEventListener('click', closeTaskModal);
  $('#btnCancelTask')?.addEventListener('click', closeTaskModal);
  $('#btnSaveTask')?.addEventListener('click', saveTask);
  $('#taskModalOverlay')?.addEventListener('click', (e) => { if (e.target === e.currentTarget) closeTaskModal(); });

  // Skill creation
  $('#btnCreateSkill')?.addEventListener('click', () => openSkillCreator());
  $('#btnCloseSkillModal')?.addEventListener('click', closeSkillCreator);
  $('#btnCancelSkill')?.addEventListener('click', closeSkillCreator);
  $('#btnSaveSkill')?.addEventListener('click', saveCustomSkill);
  $('#skillModalOverlay')?.addEventListener('click', (e) => { if (e.target === e.currentTarget) closeSkillCreator(); });

  // Git import
  $('#btnImportGitSkill')?.addEventListener('click', openGitImportModal);
  $('#btnCloseGitImportModal')?.addEventListener('click', closeGitImportModal);
  $('#btnCancelGitImport')?.addEventListener('click', closeGitImportModal);
  $('#btnStartGitImport')?.addEventListener('click', startGitImport);
  $('#gitImportModalOverlay')?.addEventListener('click', (e) => { if (e.target === e.currentTarget) closeGitImportModal(); });

  // GitHub
  $('#btnGithubConnect')?.addEventListener('click', connectGithub);
  $('#btnGithubDisconnect')?.addEventListener('click', disconnectGithub);
  let repoSearchTimer;
  $('#githubRepoSearch')?.addEventListener('input', () => {
    clearTimeout(repoSearchTimer);
    repoSearchTimer = setTimeout(() => searchGithubRepos($('#githubRepoSearch').value), 400);
  });

  // Search
  let searchTimer;
  $('#skillSearch')?.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(renderSkills, 120);
  });

  // Terminal panel
  $('#btnToggleTerminal')?.addEventListener('click', toggleTerminalPanel);
  $('#btnNewTerminal')?.addEventListener('click', () => createTerminal());
  $('#btnSplitTerminal')?.addEventListener('click', splitTerminal);
  $('#btnKillTerminal')?.addEventListener('click', killActiveTerminal);
  $('#btnCloseTerminalPanel')?.addEventListener('click', () => setTerminalPanel(false));
  $('#btnMaximizeTerminal')?.addEventListener('click', toggleTerminalMaximize);
  $('#btnToggleTerminalSidebar')?.addEventListener('click', toggleTerminalSidebar);

  // Task project filter
  $('#taskProjectFilter')?.addEventListener('change', () => loadAndRenderTasks());

  // Detail overlay
  $('#detailOverlay')?.addEventListener('click', closeDetail);

  // History filter
  $('#historyFilter')?.addEventListener('change', renderHistory);

  // Keyboard
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeDetail();
      closeEnvModal();
      closeTeamModal();
      closeSkillCreator();
      closeGitImportModal();
      closeTaskModal();
    }
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      switchView('skills');
      setTimeout(() => $('#skillSearch')?.focus(), 50);
    }
    if ((e.metaKey || e.ctrlKey) && e.key === '`') {
      e.preventDefault();
      toggleTerminalPanel();
    }
    if ((e.metaKey || e.ctrlKey) && e.key === ',') {
      e.preventDefault();
      switchView('settings');
    }
    if ((e.metaKey || e.ctrlKey) && e.key === 'b') {
      e.preventDefault();
      toggleProjectSidebar();
    }
    // Tab / Shift+Tab to cycle focus between split terminals
    if (e.key === 'Tab' && splitTerminalIds.length > 1 && terminalPanelOpen) {
      const terminalEl = e.target.closest('.terminal-instance, .xterm');
      if (terminalEl || document.activeElement?.closest('.terminal-panes')) {
        e.preventDefault();
        const currentIdx = splitTerminalIds.indexOf(focusedTerminalId || activeTerminalId);
        let nextIdx;
        if (e.shiftKey) {
          nextIdx = currentIdx <= 0 ? splitTerminalIds.length - 1 : currentIdx - 1;
        } else {
          nextIdx = currentIdx >= splitTerminalIds.length - 1 ? 0 : currentIdx + 1;
        }
        setFocusedTerminal(splitTerminalIds[nextIdx]);
      }
    }
  });
}

// ══════════════════════════════════════════════════════════════
//  PANEL MANAGEMENT
// ══════════════════════════════════════════════════════════════
function toggleProjectSidebar() {
  projectSidebarOpen = !projectSidebarOpen;
  const psb = $('#projectSidebar');
  const btn = $('[data-panel="projects"]');
  if (psb) psb.classList.toggle('collapsed', !projectSidebarOpen);
  if (btn) btn.classList.toggle('active', projectSidebarOpen);
}

function toggleRightPanel() {
  rightPanelOpen = !rightPanelOpen;
  const rp = $('#rightPanel');
  const btn = $('#btnToggleRightPanel');
  if (rp) rp.classList.toggle('collapsed', !rightPanelOpen);
  if (btn) btn.classList.toggle('active', rightPanelOpen);
}

// ── Native Context Menu (Electron Menu.popup) ────────────────
async function showNativeContextMenu(menuItems) {
  const template = menuItems.map(item => {
    if (item.separator) return { type: 'separator' };
    return { label: item.label, action: item.action, accelerator: item.accelerator, enabled: item.enabled };
  });
  const action = await window.skillbox.showContextMenu(template);
  if (action) {
    const item = menuItems.find(m => m.action === action);
    if (item?.handler) item.handler();
  }
  return action;
}

function _getProjectForPath(filePath) {
  return projects.find(p => filePath.startsWith(p.path));
}

function _showExplorerContextMenu(e, entryPath, isDir) {
  e.preventDefault();
  e.stopPropagation();
  const proj = _getProjectForPath(entryPath);
  const parentDir = entryPath.substring(0, entryPath.lastIndexOf('/')) || entryPath.substring(0, entryPath.lastIndexOf('\\'));
  const dirForNew = isDir ? entryPath : parentDir;

  const items = [];

  if (isDir) {
    items.push({
      label: 'New File...', action: 'new-file',
      handler: async () => {
        const name = prompt('File name:');
        if (!name?.trim()) return;
        const sep = entryPath.includes('/') ? '/' : '\\';
        await window.skillbox.createFile(dirForNew + sep + name.trim());
        _refreshSidebarDir(dirForNew);
        toast('File created');
      }
    });
    items.push({
      label: 'New Folder...', action: 'new-folder',
      handler: async () => {
        const name = prompt('Folder name:');
        if (!name?.trim()) return;
        const sep = entryPath.includes('/') ? '/' : '\\';
        await window.skillbox.createFolder(dirForNew + sep + name.trim());
        _refreshSidebarDir(dirForNew);
        toast('Folder created');
      }
    });
    items.push({ separator: true });
  }

  items.push({
    label: 'Copy Path', action: 'copy-path', accelerator: 'Alt+CmdOrCtrl+C',
    handler: () => { window.skillbox.copyPath(entryPath); toast('Path copied'); }
  });

  if (proj) {
    items.push({
      label: 'Copy Relative Path', action: 'copy-rel-path', accelerator: 'Shift+Alt+CmdOrCtrl+C',
      handler: () => { window.skillbox.copyRelativePath(entryPath, proj.path); toast('Relative path copied'); }
    });
  }

  items.push({
    label: 'Reveal in Finder', action: 'reveal',
    handler: () => window.skillbox.revealInFinder(entryPath)
  });

  if (isDir) {
    items.push({
      label: 'Open in Integrated Terminal', action: 'open-terminal',
      handler: () => { setTerminalPanel(true); createTerminal({ cwd: entryPath }); }
    });
  }

  items.push({ separator: true });

  items.push({
    label: 'Rename...', action: 'rename',
    handler: async () => {
      const oldName = entryPath.split(/[\\/]/).pop();
      const newName = prompt('Rename to:', oldName);
      if (!newName?.trim() || newName === oldName) return;
      const sep = entryPath.includes('/') ? '/' : '\\';
      const newPath = parentDir + sep + newName.trim();
      await window.skillbox.renamePath(entryPath, newPath);
      _sidebarCache.delete(parentDir);
      _refreshSidebarDir(parentDir);
      toast('Renamed');
    }
  });

  items.push({
    label: 'Delete', action: 'delete',
    handler: async () => {
      const name = entryPath.split(/[\\/]/).pop();
      if (!confirm(`Delete "${name}"?`)) return;
      await window.skillbox.deletePath(entryPath);
      _sidebarExpanded.delete(entryPath);
      _sidebarCache.delete(entryPath);
      _sidebarCache.delete(parentDir);
      _refreshSidebarDir(parentDir);
      toast('Deleted');
    }
  });

  showNativeContextMenu(items);
}

function _showProjectContextMenu(e, projectPath) {
  e.preventDefault();
  e.stopPropagation();

  const items = [
    {
      label: 'New File...', action: 'new-file',
      handler: async () => {
        const name = prompt('File name:');
        if (!name?.trim()) return;
        const sep = projectPath.includes('/') ? '/' : '\\';
        await window.skillbox.createFile(projectPath + sep + name.trim());
        _refreshSidebarDir(projectPath);
        toast('File created');
      }
    },
    {
      label: 'New Folder...', action: 'new-folder',
      handler: async () => {
        const name = prompt('Folder name:');
        if (!name?.trim()) return;
        const sep = projectPath.includes('/') ? '/' : '\\';
        await window.skillbox.createFolder(projectPath + sep + name.trim());
        _refreshSidebarDir(projectPath);
        toast('Folder created');
      }
    },
    { separator: true },
    {
      label: 'Copy Path', action: 'copy-path',
      handler: () => { window.skillbox.copyPath(projectPath); toast('Path copied'); }
    },
    {
      label: 'Reveal in Finder', action: 'reveal',
      handler: () => window.skillbox.revealInFinder(projectPath)
    },
    {
      label: 'Open in Integrated Terminal', action: 'open-terminal',
      handler: () => { setTerminalPanel(true); createTerminal({ cwd: projectPath }); }
    },
    { separator: true },
    {
      label: 'Analyze Project', action: 'analyze',
      handler: async () => {
        await window.skillbox.analyzeProject(projectPath);
        projects = await window.skillbox.getProjects();
        renderProjects(); renderProjectSidebar(); toast('Analysis complete!');
      }
    },
    {
      label: 'Generate Directives', action: 'directives',
      handler: async () => {
        const md = await window.skillbox.generateDirectives(projectPath);
        if (md) toast('DIRECTIVES.md generated!');
      }
    },
    { separator: true },
    {
      label: 'Remove Project', action: 'remove',
      handler: async () => {
        if (!confirm(`Remove project "${projectPath.split(/[\\/]/).pop()}"?`)) return;
        projects = await window.skillbox.removeProject(projectPath);
        if (activeProjectPath === projectPath) activeProjectPath = null;
        _sidebarExpanded.delete(projectPath);
        _sidebarCache.delete(projectPath);
        renderProjects(); renderProjectSidebar(); renderRightPanel(); updateCounts();
        toast('Project removed');
      }
    },
  ];

  showNativeContextMenu(items);
}

async function _refreshSidebarDir(dirPath) {
  try {
    const entries = await window.skillbox.readDirectory(dirPath, 1);
    _sidebarCache.set(dirPath, entries);
    // Find and re-render the container for this dir
    // Check if it's a project root
    for (const p of projects) {
      if (p.path === dirPath) {
        const cid = 'sbTree_' + dirPath.replace(/[^a-zA-Z0-9]/g, '_');
        const el = $(`#${cid}`);
        if (el) _renderSbTree(el, entries, 1);
        return;
      }
    }
    // Otherwise find the tree-item with this path
    const item = document.querySelector(`.tree-item[data-path="${CSS.escape(dirPath)}"]`);
    if (item) {
      const childEl = item.querySelector(':scope > .tree-children');
      if (childEl) {
        const depth = Math.round(parseInt(item.querySelector('.tree-item-content')?.style.paddingLeft || '16') / 16);
        _renderSbTree(childEl, entries, depth + 1);
      }
    }
  } catch { /* skip */ }
}

// ── Project Sidebar (VS Code Explorer Tree) ─────────────────
const _sidebarExpanded = new Map();
const _sidebarCache = new Map();

function renderProjectSidebar() {
  const container = $('#projectSidebarList');
  if (!container) return;

  if (projects.length === 0) {
    container.innerHTML = '<div class="psb-empty">No projects yet</div>';
    return;
  }

  container.innerHTML = projects.map(p => {
    const isExpanded = _sidebarExpanded.has(p.path);
    const isActive = p.path === activeProjectPath;
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
      activeProjectPath = header.dataset.path;
      container.querySelectorAll('.psb-section-header').forEach(h => h.classList.remove('active'));
      header.classList.add('active');
      renderRightPanel();
      if (activeView === 'projects') renderProjects();
      // Sync workspace with extension host
      window.skillbox.setExtensionWorkspace(activeProjectPath);
    });
    header.addEventListener('contextmenu', (e) => _showProjectContextMenu(e, header.dataset.path));
  });

  container.querySelectorAll('[data-sb-toggle]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const projectPath = btn.dataset.sbToggle;
      const cid = 'sbTree_' + projectPath.replace(/[^a-zA-Z0-9]/g, '_');
      const treeEl = $(`#${cid}`);

      activeProjectPath = projectPath;
      container.querySelectorAll('.psb-section-header').forEach(h => h.classList.remove('active'));
      btn.closest('.psb-section-header').classList.add('active');
      renderRightPanel();

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
            _renderSbTree(treeEl, entries, 1);
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
      if (el) _renderSbTree(el, cached, 1);
    }
  }

  const countEl = $('#navProjectCount');
  if (countEl) {
    countEl.textContent = projects.length;
    countEl.style.display = projects.length > 0 ? '' : 'none';
  }
}

function _renderSbTree(container, entries, depth) {
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
          ${_folderIconImg(entry.name, isExpanded)}
          <span class="tree-label">${esc(entry.name)}</span>
        </div>
        <div class="tree-children" style="${isExpanded ? '' : 'display:none'}"></div>
      </div>`;
    } else {
      return `<div class="tree-item is-file" data-path="${esc(entry.path)}">
        <div class="tree-item-content" style="padding-left:${indent + 16}px">
          ${_fileIconImg(entry.name)}
          <span class="tree-label">${esc(entry.name)}</span>
        </div>
      </div>`;
    }
  }).join('');

  // Click files to open in editor
  container.querySelectorAll('.is-file').forEach(item => {
    item.addEventListener('click', () => {
      const filePath = item.dataset.path;
      if (filePath) openFileInEditor(filePath);
    });
  });

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
            _renderSbTree(childEl, entries, depth + 1);
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
      if (itemPath) _showExplorerContextMenu(e, itemPath, isDir);
    });
  });
}

// ── Right Panel ──────────────────────────────────────────────
// (context menus are added inside _renderSbTree via contextmenu event)
function renderRightPanel() {
  renderRightPanelContext();
  renderRightPanelTasks();
  renderRightPanelActivity();
  renderRightPanelInfo();
}

// ── SVG icons for right panel (VS Code codicon style) ──
const _rpIcons = {
  chevron: '<svg viewBox="0 0 16 16" fill="currentColor" width="14" height="14"><path d="M5.7 13.7L5 13l4.6-4.6L5 3.7l.7-.7 5.3 5.3-5.3 5.4z"/></svg>',
  plus: '<svg viewBox="0 0 16 16" fill="currentColor" width="14" height="14"><path d="M14 7v1H8v6H7V8H1V7h6V1h1v6h6z"/></svg>',
  edit: '<svg viewBox="0 0 16 16" fill="currentColor" width="14" height="14"><path d="M13.23 1h-1.46L3.52 9.25l-.16.22L1 13.59 2.41 15l4.12-2.36.22-.16L15 4.23V2.77L13.23 1zM2.41 13.59l1.51-3 1.45 1.45-2.96 1.55zm3.83-2.06L4.47 9.76l8-8 1.77 1.77-8 8z"/></svg>',
  trash: '<svg viewBox="0 0 16 16" fill="currentColor" width="14" height="14"><path d="M10 3h3v1h-1v9l-1 1H5l-1-1V4H3V3h3V2a1 1 0 011-1h2a1 1 0 011 1v1zM9 2H7v1h2V2zM5 4v9h6V4H5zm2 2h1v5H7V6zm2 0h1v5H9V6z"/></svg>',
  play: '<svg viewBox="0 0 16 16" fill="currentColor" width="14" height="14"><path d="M3.78 2L3 2.41v11.18l.78.41 9-5.5v-1l-9-5.5zM4 12.29V3.71L11.14 8 4 12.29z"/></svg>',
  check: '<svg viewBox="0 0 16 16" fill="currentColor" width="14" height="14"><path d="M14.431 3.323l-8.47 10-.79-.036-3.35-4.77.818-.574 2.978 4.24 8.051-9.506.764.646z"/></svg>',
  git: '<svg viewBox="0 0 16 16" fill="currentColor" width="14" height="14"><path d="M4.7 12.2a2.5 2.5 0 01-2.2-2.5V9.3A2.5 2.5 0 014.7 7h.1V5A2.5 2.5 0 017 2.5h2A2.5 2.5 0 0111.3 5v2h.1a2.5 2.5 0 012.1 2.3v.4a2.5 2.5 0 01-2.2 2.5H4.7zM4.7 8a1.5 1.5 0 00-1.2 1.3v.4a1.5 1.5 0 001.2 1.5h6.6a1.5 1.5 0 001.2-1.5v-.4A1.5 1.5 0 0011.3 8h-1.1v-1h1V5A1.5 1.5 0 009 3.5H7A1.5 1.5 0 005.8 5v2h1v1H4.7z"/></svg>',
  sync: '<svg viewBox="0 0 16 16" fill="currentColor" width="14" height="14"><path d="M2.006 8.267L.78 9.5 0 8.73l2.09-2.07.76.01 2.09 2.12-.71.71-1.34-1.36C3.21 11.68 6.26 14 9.84 14a7.16 7.16 0 004.24-1.39l.71.71A8.17 8.17 0 019.84 15c-4.13 0-7.53-2.75-7.83-6.73zM13.994 7.733l1.226-1.233.78.77-2.09 2.07-.76-.01-2.09-2.12.71-.71 1.34 1.36C12.79 4.32 9.74 2 6.16 2A7.16 7.16 0 001.92 3.39l-.71-.71A8.17 8.17 0 016.16 1c4.13 0 7.53 2.75 7.83 6.73z"/></svg>',
};

function _rpSection(id, label, count, actionsHtml, bodyHtml, collapsed) {
  return `<div class="rp-section${collapsed ? ' collapsed' : ''}" id="${id}">
    <div class="rp-section-head" data-toggle="${id}">
      <span class="rp-chevron">${_rpIcons.chevron}</span>
      <span class="rp-section-label">${label}</span>
      ${count !== null ? `<span class="rp-section-count">${count}</span>` : ''}
      <span class="rp-section-actions">${actionsHtml || ''}</span>
    </div>
    <div class="rp-section-body">${bodyHtml}</div>
  </div>`;
}

function _rpIconBtn(icon, title, cls) {
  return `<button class="rp-icon-btn ${cls || ''}" title="${title}">${_rpIcons[icon]}</button>`;
}

// ── Context Tab: .skillbox/project/context/ files ──
async function renderRightPanelContext() {
  const container = $('#rpContextContent');
  if (!container) return;
  if (!activeProjectPath) { container.innerHTML = '<div class="rp-empty">Select a project</div>'; return; }
  const project = projects.find(p => p.path === activeProjectPath);
  if (!project) { container.innerHTML = '<div class="rp-empty">Project not found</div>'; return; }

  const ctx = await window.skillbox.getProjectContext(activeProjectPath).catch(() => null);
  const initialized = ctx?.initialized;
  const projectSkills = project.skills || [];

  let h = '';

  // Project header with status dot
  h += `<div class="rp-tree-row" style="height:28px;padding-left:8px;font-weight:600;">
    <span class="rp-tree-label">${esc(project.name)}</span>
    <span style="margin-left:auto;width:8px;height:8px;border-radius:50%;background:${initialized ? 'var(--success)' : 'var(--gray-9)'};flex-shrink:0;" title="${initialized ? 'Context initialized' : 'No context files'}"></span>
  </div>`;
  h += `<div class="rp-tree-row" style="height:18px;padding-left:8px;font-size:12px;color:var(--gray-9);">
    <span class="rp-tree-label">.skillbox/project/context/</span>
  </div>`;

  if (initialized) {
    // Context files tree
    const mdIcon = '<svg viewBox="0 0 16 16" fill="currentColor" width="14" height="14"><path d="M3.5 2A1.5 1.5 0 002 3.5v9A1.5 1.5 0 003.5 14h9a1.5 1.5 0 001.5-1.5v-9A1.5 1.5 0 0012.5 2h-9zM4 5h1.5l1.5 2 1.5-2H10v6H8.5V7.5L7 9.5 5.5 7.5V11H4V5z"/></svg>';
    let filesBody = '';
    const contextFiles = ['context.md', 'stack.md', 'services.md', 'dependencies.md', 'environment.md', 'team.md', 'scripts.md', 'testing.md'];
    contextFiles.forEach(fname => {
      const hasFile = !!ctx.files[fname];
      const isMain = fname === 'context.md';
      const label = fname.replace('.md', '');
      const updated = ctx.files[fname]?.frontmatter?.updated_at;
      filesBody += `<div class="rp-tree-row rp-ctx-file" data-ctx-file="${esc(fname)}" style="height:24px;${isMain ? 'font-weight:600;' : ''}${!hasFile ? 'opacity:0.4;' : ''}">
        <span class="rp-tree-icon" style="color:#3b82f6;">${mdIcon}</span>
        <span class="rp-tree-label">${esc(label)}</span>
        <span class="rp-hover-actions">${_rpIconBtn('edit', 'Open in editor', 'rp-ctx-edit')}</span>
        ${updated ? `<span class="rp-tree-value" style="font-size:10px;">${new Date(updated).toLocaleDateString()}</span>` : ''}
      </div>`;
    });
    h += _rpSection('ctxFiles', 'Context Files', Object.keys(ctx.files).length, _rpIconBtn('sync', 'Regenerate from analysis', 'rp-ctx-regen'), filesBody);

    // Preview of context.md
    if (ctx.files['context.md']?.body) {
      const preview = ctx.files['context.md'].body.split('\n').slice(0, 12).join('\n');
      h += `<div class="rp-section"><div class="rp-section-head" data-toggle="ctxPreview"><span class="rp-chevron">${_rpIcons.chevron}</span><span class="rp-section-label">Preview</span></div>
        <div class="rp-section-body"><pre style="padding:6px 12px;font-size:12px;color:var(--gray-11);white-space:pre-wrap;word-break:break-word;line-height:1.5;margin:0;">${esc(preview)}</pre></div></div>`;
    }
  } else {
    // Not initialized
    h += `<div style="padding:12px 16px;">
      <div style="font-size:13px;color:var(--gray-11);line-height:1.5;margin-bottom:12px;">
        Initialize context files to create the project brain. These markdown files live in
        <code style="font-size:12px;background:var(--gray-3);padding:1px 4px;border-radius:2px;">.skillbox/project/context/</code>
        and are readable by AI assistants, saving tokens and keeping context always current.
      </div>
      <div style="font-size:12px;color:var(--gray-9);margin-bottom:6px;">Files that will be created:</div>`;
    ['context.md', 'stack.md', 'services.md', 'dependencies.md', 'environment.md', 'team.md', 'scripts.md', 'testing.md'].forEach(f => {
      h += `<div class="rp-tree-row" style="height:22px;opacity:0.5;cursor:default;">
        <span class="rp-tree-icon" style="color:#3b82f6;"><svg viewBox="0 0 16 16" fill="currentColor" width="14" height="14"><path d="M3.5 2A1.5 1.5 0 002 3.5v9A1.5 1.5 0 003.5 14h9a1.5 1.5 0 001.5-1.5v-9A1.5 1.5 0 0012.5 2h-9zM4 5h1.5l1.5 2 1.5-2H10v6H8.5V7.5L7 9.5 5.5 7.5V11H4V5z"/></svg></span>
        <span class="rp-tree-label">${esc(f.replace('.md', ''))}</span>
      </div>`;
    });
    h += `</div>`;
  }

  // Skills section
  let skillsBody = '';
  if (projectSkills.length) {
    skillsBody = `<div class="rp-badges">${projectSkills.map(s => `<span class="rp-badge rp-badge-skill">${esc(s.includes('/') ? s.split('/').pop() : s)}</span>`).join('')}</div>`;
  } else {
    skillsBody = '<div class="rp-empty">No skills installed</div>';
  }
  h += _rpSection('ctxSkills', 'Skills', projectSkills.length || null, '', skillsBody);

  // Action buttons
  if (!initialized) {
    h += `<button class="rp-btn-primary" id="ctxInitBtn">Initialize Context</button>`;
  }
  h += `<button class="rp-btn-primary" id="ctxSyncBtn" style="${!initialized ? 'margin-top:4px;background:var(--gray-4);border:1px solid var(--gray-6);' : ''}">Sync</button>`;
  if (!project.last_analyzed) {
    h += `<button class="rp-btn-primary" id="ctxAnalyzeBtn" style="background:var(--gray-4);border:1px solid var(--gray-6);margin-top:4px;">Analyze Project</button>`;
  }

  container.innerHTML = h;

  // ── Event handlers ──
  container.querySelectorAll('.rp-section-head').forEach(head => {
    head.addEventListener('click', (e) => {
      if (e.target.closest('.rp-icon-btn')) return;
      head.closest('.rp-section').classList.toggle('collapsed');
    });
  });

  // Open context files in editor
  container.querySelectorAll('.rp-ctx-file').forEach(row => {
    row.addEventListener('click', async () => {
      const fname = row.dataset.ctxFile;
      const filePath = await window.skillbox.getContextFilePath(activeProjectPath, fname);
      if (typeof openFileInEditor === 'function') openFileInEditor(filePath);
    });
  });

  // Init context
  $('#ctxInitBtn')?.addEventListener('click', async () => {
    _showContextProgress(container, 'Initializing context...');
    if (!project.last_analyzed) {
      _updateContextProgress(container, 'Analyzing project...');
      await window.skillbox.analyzeProject(activeProjectPath);
      projects = await window.skillbox.getProjects();
    }
    _updateContextProgress(container, 'Creating context files...');
    await window.skillbox.initProjectContext(activeProjectPath);
    toast('Context files created', 'success');
    renderRightPanelContext();
  });

  // Regenerate
  container.querySelector('.rp-ctx-regen')?.addEventListener('click', async (e) => {
    e.stopPropagation();
    _showContextProgress(container, 'Regenerating context...');
    _updateContextProgress(container, 'Analyzing project...');
    await window.skillbox.analyzeProject(activeProjectPath);
    projects = await window.skillbox.getProjects();
    _updateContextProgress(container, 'Writing context files...');
    await window.skillbox.initProjectContext(activeProjectPath);
    toast('Context files updated', 'success');
    renderRightPanelContext();
  });

  $('#ctxSyncBtn')?.addEventListener('click', () => _syncContext());
  $('#ctxAnalyzeBtn')?.addEventListener('click', async () => {
    _showContextProgress(container, 'Analyzing project...');
    await window.skillbox.analyzeProject(activeProjectPath);
    projects = await window.skillbox.getProjects();
    renderRightPanel();
    toast('Analysis complete', 'success');
  });
}

// ── Progress overlay for context operations ──
function _showContextProgress(container, label) {
  let overlay = container.querySelector('.rp-progress-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.className = 'rp-progress-overlay';
    container.prepend(overlay);
  }
  overlay.innerHTML = `
    <div class="rp-progress-card">
      <div class="rp-progress-spinner"></div>
      <div class="rp-progress-label">${esc(label)}</div>
      <div class="rp-progress-bar-track"><div class="rp-progress-bar-fill"></div></div>
    </div>`;
  overlay.style.display = 'flex';
}

function _updateContextProgress(container, label) {
  const lbl = container.querySelector('.rp-progress-label');
  if (lbl) lbl.textContent = label;
}

async function _syncContext() {
  if (!activeProjectPath) { toast('Select a project first', 'warning'); return; }
  const project = projects.find(p => p.path === activeProjectPath);
  if (!project) return;
  if (_activeExtId && _activeExtDetail?.viewIds?.[0]) {
    toast('Switching to ' + project.name + '...', 'info');
    await openExtensionWebview(_activeExtId, _activeExtDetail.viewIds[0]);
  }
  toast('Context synced', 'success');
}

// ── Tasks Tab ──
function renderRightPanelTasks() {
  const container = $('#rpTasksContent');
  if (!container) return;
  const allTasks = activeProjectPath ? tasks.filter(t => t.project_path === activeProjectPath) : tasks;
  const open = allTasks.filter(t => t.status !== 'done');
  const done = allTasks.filter(t => t.status === 'done');

  let h = '';

  // Open tasks section
  let openBody = '';
  if (open.length) {
    open.forEach(t => {
      const prioColor = { critical: '#e5484d', high: '#f97316', medium: '#ffc53d', low: 'var(--success)' }[t.priority] || 'var(--gray-9)';
      openBody += `<div class="rp-tree-row" data-task-id="${esc(t.id)}" style="height:26px;">
        <span style="width:8px;height:8px;border-radius:50%;background:${prioColor};flex-shrink:0;margin-right:6px;"></span>
        <span class="rp-tree-label">${esc(t.title)}</span>
        <span class="rp-hover-actions">
          ${_rpIconBtn('check', 'Mark done', 'rp-task-done-btn')}
        </span>
        <span class="rp-tree-value">${esc(t.status.replace('_',' '))}</span>
      </div>`;
    });
  } else {
    openBody = '<div class="rp-empty">No open tasks</div>';
  }
  h += _rpSection('rpTaskOpen', 'Open', open.length, _rpIconBtn('plus', 'New task', 'rp-new-task-btn'), openBody);

  // Done tasks section
  if (done.length) {
    let doneBody = '';
    done.slice(0, 8).forEach(t => {
      doneBody += `<div class="rp-tree-row" data-task-id="${esc(t.id)}" style="height:24px;opacity:0.5;">
        <span style="width:8px;height:8px;border-radius:50%;background:var(--success);flex-shrink:0;margin-right:6px;"></span>
        <span class="rp-tree-label" style="text-decoration:line-through;">${esc(t.title)}</span>
      </div>`;
    });
    if (done.length > 8) doneBody += `<div class="rp-empty">+${done.length - 8} more</div>`;
    h += _rpSection('rpTaskDone', 'Completed', done.length, '', doneBody, true);
  }

  container.innerHTML = h;

  // Event handlers
  container.querySelectorAll('.rp-section-head').forEach(head => {
    head.addEventListener('click', (e) => {
      if (e.target.closest('.rp-icon-btn')) return;
      head.closest('.rp-section').classList.toggle('collapsed');
    });
  });
  container.querySelectorAll('.rp-new-task-btn').forEach(btn => {
    btn.addEventListener('click', (e) => { e.stopPropagation(); openTaskModal(); });
  });
  container.querySelectorAll('.rp-tree-row[data-task-id]').forEach(row => {
    row.addEventListener('click', (e) => {
      if (e.target.closest('.rp-task-done-btn')) {
        _markTaskDone(row.dataset.taskId);
        return;
      }
      openTaskModal(row.dataset.taskId);
    });
  });
}

async function _markTaskDone(taskId) {
  await window.skillbox.updateTask?.(taskId, { status: 'done' });
  tasks = await window.skillbox.getTasks();
  renderRightPanelTasks();
}

// ── Activity Tab: git branches + commits ──
async function renderRightPanelActivity() {
  const container = $('#rpActivityContent');
  if (!container) return;
  if (!activeProjectPath) { container.innerHTML = '<div class="rp-empty">Select a project</div>'; return; }

  const gitInfo = await window.skillbox.getGitInfo?.(activeProjectPath).catch(() => null);

  let h = '';
  if (gitInfo && !gitInfo.error) {
    // Current branch info row
    h += `<div class="rp-tree-row" style="height:26px;padding-left:8px;">
      <span class="rp-tree-icon">${_rpIcons.git}</span>
      <span class="rp-tree-label" style="font-weight:600;">${esc(gitInfo.branch)}</span>
      <span class="rp-tree-value">${gitInfo.totalCommits || 0} commits</span>
    </div>`;

    if (gitInfo.remoteUrl) {
      const short = gitInfo.remoteUrl.replace(/^https?:\/\/github\.com\//, '').replace(/\.git$/, '');
      h += `<div class="rp-tree-row" style="height:22px;padding-left:8px;font-size:12px;color:var(--gray-9);" title="${esc(gitInfo.remoteUrl)}">
        <span class="rp-tree-label">${esc(short)}</span>
      </div>`;
    }

    // Local branches
    const localBranches = gitInfo.branches?.local || [];
    if (localBranches.length > 0) {
      let branchBody = '';
      localBranches.slice(0, 15).forEach(b => {
        const active = b === gitInfo.branch;
        branchBody += `<div class="rp-tree-row" style="height:22px;${active ? 'color:var(--gray-12);font-weight:600;' : ''}">
          <span style="width:6px;height:6px;border-radius:50%;background:${active ? 'var(--success)' : 'var(--gray-9)'};flex-shrink:0;margin-right:6px;"></span>
          <span class="rp-tree-label" style="font-family:var(--font-mono,'SF Mono',monospace);font-size:12px;">${esc(b)}</span>
        </div>`;
      });
      if (localBranches.length > 15) branchBody += `<div class="rp-empty">+${localBranches.length - 15} more</div>`;
      h += _rpSection('rpBranches', 'Branches', localBranches.length, '', branchBody);
    }

    // Remote branches
    const remoteBranches = gitInfo.branches?.remote || [];
    if (remoteBranches.length > 0) {
      let remoteBody = '';
      remoteBranches.slice(0, 8).forEach(b => {
        remoteBody += `<div class="rp-tree-row" style="height:22px;opacity:0.7;">
          <span style="width:6px;height:6px;border-radius:50%;background:var(--gray-8);flex-shrink:0;margin-right:6px;"></span>
          <span class="rp-tree-label" style="font-family:var(--font-mono,'SF Mono',monospace);font-size:12px;">${esc(b)}</span>
        </div>`;
      });
      if (remoteBranches.length > 8) remoteBody += `<div class="rp-empty">+${remoteBranches.length - 8} more</div>`;
      h += _rpSection('rpRemote', 'Remote', remoteBranches.length, '', remoteBody, true);
    }

    // Commits
    if (gitInfo.commits?.length > 0) {
      let commitBody = '';
      gitInfo.commits.slice(0, 20).forEach(c => {
        const d = new Date(c.date);
        const dateStr = `${d.getMonth()+1}/${d.getDate()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
        commitBody += `<div class="rp-commit-row">
          <div class="rp-commit-msg">${esc(c.message.substring(0, 72))}</div>
          <div class="rp-commit-meta">
            <span>${esc(c.author)}</span>
            <span>${dateStr}</span>
            ${c.insertions || c.deletions ? `<span style="margin-left:auto;"><span class="rp-ins">+${c.insertions||0}</span> <span class="rp-del">-${c.deletions||0}</span></span>` : ''}
          </div>
        </div>`;
      });
      h += _rpSection('rpCommits', 'Recent Commits', gitInfo.commits.length, '', commitBody);
    }
  } else {
    h = '<div class="rp-empty">No git repository detected</div>';
  }
  container.innerHTML = h;

  // Section toggles
  container.querySelectorAll('.rp-section-head').forEach(head => {
    head.addEventListener('click', () => head.closest('.rp-section').classList.toggle('collapsed'));
  });
}

// ── Info Tab: env vars (CRUD), services, deps, testing, scripts, files ──
async function renderRightPanelInfo() {
  const container = $('#rpInfoContent');
  if (!container) return;
  if (!activeProjectPath) { container.innerHTML = '<div class="rp-empty">Select a project</div>'; return; }
  const project = projects.find(p => p.path === activeProjectPath);
  if (!project) { container.innerHTML = '<div class="rp-empty">Project not found</div>'; return; }

  const analysis = project.analysis || {};
  const deps = analysis.dependencies || {};
  const services = analysis.services || [];
  const sysReqs = analysis.systemRequirements || [];
  const scripts = analysis.scripts || {};
  const envData = project.environments || {};
  const activeEnv = project.activeEnv || 'DEV';
  const envVars = envData[activeEnv] || {};
  const envNames = Object.keys(envData);

  const [portsInfo, testInfo] = await Promise.all([
    window.skillbox.getProjectPorts?.(activeProjectPath).catch(() => null),
    window.skillbox.detectTests?.(activeProjectPath).catch(() => null),
  ]);

  let h = '';

  // ── Environment Variables (with CRUD) ──
  const envEntries = Object.entries(envVars);
  let envBody = '';
  if (envNames.length > 1) {
    envBody += `<div class="rp-env-tabs">${envNames.map(n => `<span class="rp-env-tab${n===activeEnv?' active':''}" data-env="${esc(n)}">${esc(n)}</span>`).join('')}</div>`;
  }
  envEntries.forEach(([k, v]) => {
    const sensitive = /secret|password|token|key|api_key|auth/i.test(k);
    const displayVal = sensitive ? '********' : String(v);
    envBody += `<div class="rp-tree-row" data-env-key="${esc(k)}" style="height:24px;">
      <span class="rp-tree-label" style="font-family:var(--font-mono,'SF Mono',monospace);color:var(--accent-11);font-size:12px;">${esc(k)}</span>
      <span class="rp-hover-actions">
        ${_rpIconBtn('edit', 'Edit', 'rp-env-edit')}
        ${_rpIconBtn('trash', 'Delete', 'rp-env-delete')}
      </span>
      <span class="rp-tree-value" style="color:var(--success);font-size:12px;" title="${esc(String(v))}">${esc(displayVal)}</span>
    </div>`;
  });
  if (envEntries.length === 0) {
    envBody += `<div class="rp-empty">No variables in ${esc(activeEnv)}</div>`;
  }
  // Inline add row
  envBody += `<div class="rp-inline-input" id="rpEnvAddRow" style="display:none;">
    <input type="text" placeholder="KEY" id="rpEnvNewKey" style="max-width:90px;">
    <input type="text" placeholder="value" id="rpEnvNewVal">
    <button class="rp-icon-btn" id="rpEnvAddConfirm" title="Add">${_rpIcons.check}</button>
  </div>`;
  // Import/Export
  envBody += `<div style="display:flex;gap:4px;padding:4px 20px;">
    <button class="rp-btn-secondary" id="rpEnvImport" style="flex:1;">Import .env</button>
    <button class="rp-btn-secondary" id="rpEnvExport" style="flex:1;">Export .env</button>
  </div>`;

  const envActions = _rpIconBtn('plus', 'Add variable', 'rp-env-add-btn');
  h += _rpSection('rpEnvSection', 'Environment', envEntries.length, envActions, envBody);

  // ── Services ──
  let svcBody = '';
  if (services.length > 0) {
    const svcUrls = portsInfo?.serviceUrls || {};
    services.forEach(s => {
      const urlKey = Object.keys(svcUrls).find(k => k.toLowerCase().includes(s.name.toLowerCase().replace('postgresql','postgres')));
      svcBody += `<div class="rp-svc-card">
        <div style="display:flex;align-items:center;gap:6px;">
          <span style="width:7px;height:7px;border-radius:50%;background:var(--success);flex-shrink:0;"></span>
          <span class="rp-svc-name">${esc(s.name)}</span>
          <span style="color:var(--gray-9);font-size:12px;margin-left:auto;">${esc(s.type)}</span>
        </div>
        ${s.source ? `<div class="rp-svc-detail">Source: ${esc(s.source)}</div>` : ''}
        ${urlKey ? `<div class="rp-svc-detail" title="${esc(svcUrls[urlKey])}">${esc(urlKey)}: ${esc(svcUrls[urlKey])}</div>` : ''}
      </div>`;
    });
  } else {
    svcBody = '<div class="rp-empty">No services detected</div>';
  }
  h += _rpSection('rpSvcSection', 'Services', services.length, '', svcBody);

  // ── Dependencies ──
  const depSections = Object.entries(deps).filter(([, l]) => l?.length > 0);
  const totalDeps = depSections.reduce((s, [, l]) => s + l.length, 0);
  let depBody = '';
  if (depSections.length > 0) {
    depSections.forEach(([mgr, list]) => {
      const label = { npm: 'npm', python: 'pip', ruby: 'gem', java: 'maven' }[mgr] || mgr;
      depBody += `<div class="rp-tree-row" style="height:22px;padding-left:12px;font-weight:600;font-size:12px;text-transform:uppercase;color:var(--gray-10);">${esc(label)} (${list.length})</div>`;
      list.slice(0, 20).forEach(d => {
        depBody += `<div class="rp-tree-row" style="height:22px;">
          <span class="rp-tree-label" style="font-size:12px;">${esc(d.name)}</span>
          <span class="rp-tree-value" style="font-size:11px;">${esc(d.version || 'latest')}</span>
        </div>`;
      });
      if (list.length > 20) depBody += `<div class="rp-empty">+${list.length - 20} more</div>`;
    });
  } else {
    depBody = '<div class="rp-empty">Run analysis to detect</div>';
  }
  h += _rpSection('rpDepSection', 'Dependencies', totalDeps, '', depBody, totalDeps > 30);

  // ── Testing ──
  let testBody = '';
  if (testInfo?.frameworks?.length > 0) {
    testBody += `<div class="rp-badges">${testInfo.frameworks.map(f => `<span class="rp-badge">${esc(f)}</span>`).join('')}</div>`;
    testBody += `<div class="rp-tree-row" style="height:22px;"><span class="rp-tree-label">Test files</span><span class="rp-tree-value">${testInfo.testFileCount || 0}</span></div>`;
    if (testInfo.hasTestScript) {
      testBody += `<button class="rp-run-btn" id="rpRunTests">${_rpIcons.play} Run Tests</button>`;
    }
  } else {
    testBody = '<div class="rp-empty">No test frameworks detected</div>';
  }
  h += _rpSection('rpTestSection', 'Testing', testInfo?.frameworks?.length || null, '', testBody);

  // ── Runtime ──
  if (sysReqs.length > 0) {
    let rtBody = `<div class="rp-badges">${sysReqs.map(r => `<span class="rp-badge">${esc(r.name)}</span>`).join('')}</div>`;
    h += _rpSection('rpRuntimeSection', 'Runtime', sysReqs.length, '', rtBody);
  }

  // ── Scripts ──
  const scriptEntries = Object.entries(scripts);
  if (scriptEntries.length > 0) {
    let scriptBody = '';
    scriptEntries.slice(0, 15).forEach(([name, cmd]) => {
      scriptBody += `<div class="rp-tree-row" style="height:24px;" data-script="${esc(name)}">
        <span class="rp-tree-label" style="font-family:var(--font-mono,'SF Mono',monospace);font-size:12px;">${esc(name)}</span>
        <span class="rp-hover-actions">
          ${_rpIconBtn('play', 'Run script', 'rp-run-script')}
        </span>
        <span class="rp-tree-value" style="font-size:11px;" title="${esc(String(cmd))}">${esc(String(cmd).substring(0, 30))}</span>
      </div>`;
    });
    h += _rpSection('rpScriptSection', 'Scripts', scriptEntries.length, '', scriptBody);
  }

  // ── File Stats ──
  if (analysis.fileStats) {
    const topExts = Object.entries(analysis.fileStats.byExt || {}).sort((a, b) => b[1] - a[1]).slice(0, 8);
    let fileBody = '';
    topExts.forEach(([ext, count]) => {
      const pct = Math.round((count / analysis.fileStats.total) * 100);
      fileBody += `<div class="rp-bar-row">
        <span class="rp-bar-label">${esc(ext)}</span>
        <div class="rp-bar"><div class="rp-bar-fill" style="width:${pct}%"></div></div>
        <span class="rp-bar-val">${count}</span>
      </div>`;
    });
    h += _rpSection('rpFileSection', 'Files', analysis.fileStats.total, '', fileBody, true);
  }

  container.innerHTML = h;

  // ── Event handlers ──
  // Section toggles
  container.querySelectorAll('.rp-section-head').forEach(head => {
    head.addEventListener('click', (e) => {
      if (e.target.closest('.rp-icon-btn')) return;
      head.closest('.rp-section').classList.toggle('collapsed');
    });
  });

  // Env add button
  container.querySelector('.rp-env-add-btn')?.addEventListener('click', (e) => {
    e.stopPropagation();
    const addRow = $('#rpEnvAddRow');
    if (addRow) { addRow.style.display = addRow.style.display === 'none' ? 'flex' : 'none'; }
    $('#rpEnvNewKey')?.focus();
  });

  // Env add confirm
  $('#rpEnvAddConfirm')?.addEventListener('click', async () => {
    const key = $('#rpEnvNewKey')?.value?.trim();
    const val = $('#rpEnvNewVal')?.value?.trim();
    if (!key) return;
    await window.skillbox.setEnvVariable?.(activeProjectPath, activeEnv, key, val || '');
    projects = await window.skillbox.getProjects();
    renderRightPanelInfo();
    toast(`Added ${key}`, 'success');
  });

  // Env edit
  container.querySelectorAll('.rp-env-edit').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const row = btn.closest('.rp-tree-row');
      const key = row?.dataset.envKey;
      if (!key) return;
      const currentVal = envVars[key] || '';
      const newVal = prompt(`Edit ${key}:`, String(currentVal));
      if (newVal !== null) {
        window.skillbox.setEnvVariable?.(activeProjectPath, activeEnv, key, newVal).then(async () => {
          projects = await window.skillbox.getProjects();
          renderRightPanelInfo();
          toast(`Updated ${key}`, 'success');
        });
      }
    });
  });

  // Env delete
  container.querySelectorAll('.rp-env-delete').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const row = btn.closest('.rp-tree-row');
      const key = row?.dataset.envKey;
      if (!key) return;
      if (confirm(`Delete ${key}?`)) {
        window.skillbox.deleteEnvVariable?.(activeProjectPath, activeEnv, key).then(async () => {
          projects = await window.skillbox.getProjects();
          renderRightPanelInfo();
          toast(`Deleted ${key}`, 'success');
        });
      }
    });
  });

  // Env tabs
  container.querySelectorAll('.rp-env-tab').forEach(tab => {
    tab.addEventListener('click', async () => {
      await window.skillbox.setActiveEnvironment(activeProjectPath, tab.dataset.env);
      projects = await window.skillbox.getProjects();
      renderRightPanelInfo();
    });
  });

  // Import/Export
  $('#rpEnvImport')?.addEventListener('click', async () => {
    await window.skillbox.importEnvFile(activeProjectPath, activeEnv);
    projects = await window.skillbox.getProjects();
    renderRightPanelInfo();
    toast('Imported .env', 'success');
  });
  $('#rpEnvExport')?.addEventListener('click', async () => {
    await window.skillbox.syncEnvFile(activeProjectPath, activeEnv);
    toast('Exported to .env', 'success');
  });

  // Run tests
  $('#rpRunTests')?.addEventListener('click', () => { toast('Running tests...', 'info'); });

  // Run script
  container.querySelectorAll('.rp-run-script').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const row = btn.closest('.rp-tree-row');
      const name = row?.dataset.script;
      if (name) toast(`Running ${name}...`, 'info');
    });
  });
}

// ── View Switching ───────────────────────────────────────────
function switchView(view) {
  activeView = view;
  $$('.view').forEach(v => v.style.display = 'none');
  const viewEl = $(`#view${capitalize(view)}`);
  if (viewEl) viewEl.style.display = '';

  // Update activity bar — only data-view items
  $$('.activity-bar-item[data-view]').forEach(b => b.classList.toggle('active', b.dataset.view === view));

  if (view === 'dashboard') renderDashboard();
  if (view === 'projects') renderProjects();
  if (view === 'tasks') loadAndRenderTasks();
  if (view === 'teams') renderTeams();
  if (view === 'skills') renderSkills();
  if (view === 'history') { loadHistory(); renderHistory(); }
  if (view === 'github') refreshGithubView();
  if (view === 'settings') renderSettings();
  if (view === 'extensions') renderExtensions();
  if (view === 'extensionDetail') renderExtensionDetail();
  if (view === 'extensionWebview') {} // managed separately
  if (view === 'editor') {
    const editorEl = $('#viewEditor');
    if (editorEl) { editorEl.style.display = 'flex'; editorEl.style.flexDirection = 'column'; editorEl.style.padding = '0'; editorEl.style.overflow = 'hidden'; }
    _layoutMonacoEditor();
  }
}

function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

// ══════════════════════════════════════════════════════════════
//  DASHBOARD
// ══════════════════════════════════════════════════════════════
async function renderDashboard() {
  const openTasks = tasks.filter(t => t.status !== 'done');
  const allMembers = teams.reduce((acc, t) => {
    const members = typeof t.members === 'string' ? JSON.parse(t.members) : (t.members || []);
    return acc + members.length;
  }, 0);

  $('#dashProjectCount').textContent = projects.length;
  $('#dashTaskCount').textContent = openTasks.length;
  $('#dashTeamCount').textContent = allMembers;
  $('#dashSkillCount').textContent = projects.reduce((acc, p) => acc + (p.skills?.length || 0), 0);

  // Recent projects
  const projContainer = $('#dashRecentProjects');
  if (projects.length === 0) {
    projContainer.innerHTML = '<div class="dash-empty"><p>No projects yet. Add a project folder to get started.</p></div>';
  } else {
    projContainer.innerHTML = projects.slice(0, 5).map(p => {
      const stack = p.analysis?.stack?.map(s => s.name).join(', ') || 'Not analyzed';
      const taskCount = tasks.filter(t => t.project_path === p.path && t.status !== 'done').length;
      return `<div class="dash-project-row" data-path="${esc(p.path)}">
        <div class="dash-project-icon">
          <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16"><path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z"/></svg>
        </div>
        <div class="dash-project-info">
          <div class="dash-project-name">${esc(p.name)}</div>
          <div class="dash-project-stack">${esc(stack)}</div>
        </div>
        <div class="dash-project-tasks">${taskCount} tasks</div>
      </div>`;
    }).join('');
    projContainer.querySelectorAll('.dash-project-row').forEach(row => {
      row.addEventListener('click', () => {
        activeProjectPath = row.dataset.path;
        renderProjectSidebar();
        renderRightPanel();
        switchView('projects');
      });
    });
  }

  // Open tasks
  const taskContainer = $('#dashOpenTasks');
  if (openTasks.length === 0) {
    taskContainer.innerHTML = '<div class="dash-empty"><p>No open tasks.</p></div>';
  } else {
    taskContainer.innerHTML = openTasks.slice(0, 8).map(t => {
      const proj = projects.find(p => p.path === t.project_path);
      return `<div class="dash-task-row">
        <div class="dash-task-priority p-${t.priority}"></div>
        <div class="dash-task-title">${esc(t.title)}</div>
        ${proj ? `<span class="dash-task-project-tag">${esc(proj.name)}</span>` : ''}
        <span class="dash-task-status">${t.status.replace('_', ' ')}</span>
      </div>`;
    }).join('');
  }

  // Activity feed
  const feedContainer = $('#dashActivityFeed');
  if (!history || history.length === 0) {
    feedContainer.innerHTML = '<div class="dash-empty"><p>No recent activity</p></div>';
  } else {
    feedContainer.innerHTML = history.slice(0, 15).map(h => {
      const date = new Date(h.timestamp);
      const time = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const day = isToday(date) ? 'Today' : isYesterday(date) ? 'Yesterday' : date.toLocaleDateString();
      return `<div class="dash-activity-item">
        <div class="dash-activity-dot"></div>
        <div class="dash-activity-text">${esc(h.detail)}</div>
        <div class="dash-activity-time">${day} ${time}</div>
      </div>`;
    }).join('');
  }
}

function isToday(d) {
  const t = new Date();
  return d.getDate() === t.getDate() && d.getMonth() === t.getMonth() && d.getFullYear() === t.getFullYear();
}
function isYesterday(d) {
  const y = new Date();
  y.setDate(y.getDate() - 1);
  return d.getDate() === y.getDate() && d.getMonth() === y.getMonth() && d.getFullYear() === y.getFullYear();
}

// ══════════════════════════════════════════════════════════════
//  TASKS (KANBAN)
// ══════════════════════════════════════════════════════════════
async function loadAndRenderTasks() {
  const filterProject = $('#taskProjectFilter')?.value || '';
  tasks = await window.skillbox.getTasks(filterProject || undefined);

  const filterEl = $('#taskProjectFilter');
  if (filterEl) {
    const currentVal = filterEl.value;
    const options = '<option value="">All projects</option>' +
      projects.map(p => `<option value="${esc(p.path)}" ${p.path === currentVal ? 'selected' : ''}>${esc(p.name)}</option>`).join('');
    filterEl.innerHTML = options;
  }

  renderTaskList();
  renderRightPanel();
}

const statusLabels = { todo: 'To Do', in_progress: 'In Progress', review: 'In Review', done: 'Done' };
const statusOrder = { todo: 0, in_progress: 1, review: 2, done: 3 };
const priorityOrder = { high: 0, medium: 1, low: 2 };

function renderTaskList() {
  const container = $('#taskList');
  const emptyEl = $('#taskListEmpty');
  if (!container) return;

  if (tasks.length === 0) {
    container.innerHTML = '';
    if (emptyEl) { container.appendChild(emptyEl); emptyEl.style.display = ''; }
    return;
  }
  if (emptyEl) emptyEl.style.display = 'none';

  const sorted = [...tasks].sort((a, b) => {
    const s = statusOrder[a.status] - statusOrder[b.status];
    if (s !== 0) return s;
    return (priorityOrder[a.priority] || 1) - (priorityOrder[b.priority] || 1);
  });

  const groups = {};
  for (const t of sorted) {
    const s = t.status || 'todo';
    if (!groups[s]) groups[s] = [];
    groups[s].push(t);
  }

  const statusColors = { todo: '#94a3b8', in_progress: '#3b82f6', review: '#f59e0b', done: '#22c55e' };

  container.innerHTML = Object.entries(groups).map(([status, items]) => {
    const rows = items.map(t => {
      const proj = projects.find(p => p.path === t.project_path);
      const nextStatus = { todo: 'in_progress', in_progress: 'review', review: 'done' };
      const next = nextStatus[t.status];
      return `<div class="task-row" data-task-id="${esc(t.id)}">
        <div class="task-row-priority p-${t.priority}" title="${t.priority}"></div>
        <div class="task-row-title">${esc(t.title)}</div>
        ${t.assignee ? `<span class="task-row-assignee">${esc(t.assignee)}</span>` : ''}
        ${proj ? `<span class="task-row-project">${esc(proj.name)}</span>` : ''}
        <div class="task-row-actions">
          ${next ? `<button class="task-action-btn" data-move-right="${esc(t.id)}" title="Move to ${statusLabels[next]}">
            <svg viewBox="0 0 16 16" fill="currentColor" width="12" height="12"><path d="M6.22 3.22a.75.75 0 011.06 0l4.25 4.25a.75.75 0 010 1.06l-4.25 4.25a.75.75 0 01-1.06-1.06L9.94 8 6.22 4.28a.75.75 0 010-1.06z"/></svg>
          </button>` : ''}
          <button class="task-action-btn task-action-delete" data-delete-task="${esc(t.id)}" title="Delete">
            <svg viewBox="0 0 16 16" fill="currentColor" width="12" height="12"><path d="M4.646 4.646a.5.5 0 01.708 0L8 7.293l2.646-2.647a.5.5 0 01.708.708L8.707 8l2.647 2.646a.5.5 0 01-.708.708L8 8.707l-2.646 2.647a.5.5 0 01-.708-.708L7.293 8 4.646 5.354a.5.5 0 010-.708z"/></svg>
          </button>
        </div>
      </div>`;
    }).join('');

    return `<div class="task-group">
      <div class="task-group-header">
        <span class="task-group-dot" style="background:${statusColors[status] || '#94a3b8'}"></span>
        <span class="task-group-title">${statusLabels[status] || status}</span>
        <span class="task-group-count">${items.length}</span>
      </div>
      ${rows}
    </div>`;
  }).join('');

  container.querySelectorAll('.task-row').forEach(row => {
    row.addEventListener('click', (e) => {
      if (e.target.closest('[data-move-right]') || e.target.closest('[data-delete-task]')) return;
      openTaskModal(row.dataset.taskId);
    });
  });
  container.querySelectorAll('[data-move-right]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const task = tasks.find(t => t.id === btn.dataset.moveRight);
      if (!task) return;
      const nextStatus = { todo: 'in_progress', in_progress: 'review', review: 'done' };
      const next = nextStatus[task.status];
      if (next) {
        await window.skillbox.updateTask(btn.dataset.moveRight, { status: next });
        await loadAndRenderTasks();
        toast(`Moved to ${statusLabels[next]}`);
      }
    });
  });
  container.querySelectorAll('[data-delete-task]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      await window.skillbox.deleteTask(btn.dataset.deleteTask);
      await loadAndRenderTasks();
      toast('Task deleted');
    });
  });

  const openCount = tasks.filter(t => t.status !== 'done').length;
  const countEl = $('#navTaskCount');
  if (countEl) {
    countEl.textContent = openCount;
    countEl.style.display = openCount > 0 ? '' : 'none';
  }
}

// ── Task Modal ───────────────────────────────────────────────
function openTaskModal(taskId) {
  editingTaskId = taskId || null;
  const modal = $('#taskModalOverlay');
  modal.style.display = '';

  const projSelect = $('#taskProjectInput');
  projSelect.innerHTML = projects.map(p =>
    `<option value="${esc(p.path)}" ${p.path === activeProjectPath ? 'selected' : ''}>${esc(p.name)}</option>`
  ).join('');
  if (projects.length === 0) {
    projSelect.innerHTML = '<option value="">No projects</option>';
  }

  if (taskId) {
    const task = tasks.find(t => t.id === taskId);
    if (task) {
      $('#taskModalTitle').textContent = 'Edit Task';
      $('#taskTitleInput').value = task.title;
      $('#taskDescInput').value = task.description || '';
      $('#taskProjectInput').value = task.project_path;
      $('#taskPriorityInput').value = task.priority;
      $('#taskStatusInput').value = task.status;
      $('#taskAssigneeInput').value = task.assignee || '';
    }
  } else {
    $('#taskModalTitle').textContent = 'New Task';
    $('#taskTitleInput').value = '';
    $('#taskDescInput').value = '';
    $('#taskPriorityInput').value = 'medium';
    $('#taskStatusInput').value = 'todo';
    $('#taskAssigneeInput').value = '';
  }

  // Populate assignee dropdown from team members
  const assigneeInput = $('#taskAssigneeInput');
  if (assigneeInput) {
    const allMembers = teams.reduce((acc, t) => {
      const members = typeof t.members === 'string' ? JSON.parse(t.members) : (t.members || []);
      return acc.concat(members.filter(m => m.name).map(m => ({ name: m.name, role: m.role, team: t.name })));
    }, []);
    if (allMembers.length > 0) {
      const task = taskId ? tasks.find(t => t.id === taskId) : null;
      const select = document.createElement('select');
      select.className = 'form-input';
      select.id = 'taskAssigneeInput';
      select.innerHTML = '<option value="">Unassigned</option>' +
        allMembers.map(m => `<option value="${esc(m.name)}" ${(task?.assignee === m.name) ? 'selected' : ''}>${esc(m.name)} — ${esc(m.role || 'No role')} (${esc(m.team)})</option>`).join('');
      assigneeInput.replaceWith(select);
    }
  }

  setTimeout(() => $('#taskTitleInput').focus(), 50);
}

function closeTaskModal() {
  $('#taskModalOverlay').style.display = 'none';
  editingTaskId = null;
  const el = $('#taskAssigneeInput');
  if (el && el.tagName === 'SELECT') {
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'form-input';
    input.id = 'taskAssigneeInput';
    input.placeholder = 'Name or @handle';
    el.replaceWith(input);
  }
}

async function saveTask() {
  const title = $('#taskTitleInput').value.trim();
  if (!title) return toast('Title is required');
  const projectPath = $('#taskProjectInput').value;
  if (!projectPath) return toast('Select a project');

  const data = {
    title,
    description: $('#taskDescInput').value.trim(),
    projectPath,
    priority: $('#taskPriorityInput').value,
    status: $('#taskStatusInput').value,
    assignee: ($('#taskAssigneeInput').value || '').trim() || null,
  };

  if (editingTaskId) {
    await window.skillbox.updateTask(editingTaskId, data);
    toast('Task updated');
  } else {
    await window.skillbox.createTask(data);
    toast('Task created');
  }

  closeTaskModal();
  tasks = await window.skillbox.getTasks();
  if (activeView === 'tasks') renderTaskList();
  if (activeView === 'dashboard') renderDashboard();
  renderRightPanel();
}

// ── Analysis Progress ────────────────────────────────────────
const _analysisProgress = {};

function initAnalysisProgress() {
  window.skillbox.onAnalysisProgress((data) => {
    const { projectPath, step, total, label } = data;
    const pct = Math.round((step / total) * 100);
    _analysisProgress[projectPath] = { pct, label };

    document.querySelectorAll('.project-analysis-progress').forEach(bar => {
      if (bar.dataset.analysisPath === projectPath) {
        bar.style.display = '';
        const fill = bar.querySelector('.analysis-progress-fill');
        const text = bar.querySelector('.analysis-progress-label');
        if (fill) {
          fill.style.transition = 'width 0.3s ease';
          fill.style.width = `${pct}%`;
        }
        if (text) text.textContent = `${label} (${pct}%)`;
        if (step >= total) {
          setTimeout(() => { bar.style.display = 'none'; }, 1200);
        }
      }
    });
  });
}

// ── Add Project ──────────────────────────────────────────────
async function addProject() {
  const dirPath = await window.skillbox.browseFolder();
  if (!dirPath) return;
  const result = await window.skillbox.addProject(dirPath);
  projects = result.projects || [];
  activeProjectPath = dirPath;
  renderProjectSidebar();
  renderRightPanel();
  updateCounts();
  switchView('projects');
  toast(`Project loaded: ${dirPath.split(/[\\/]/).pop()}`);
}

// ── Projects View (Tree Explorer) ────────────────────────────
const _expandedPaths = new Map();
const _childrenCache = new Map();

// ── Material Icon Theme (vscode-material-icon-theme) ─────────
const ICON_PATH = 'icons/';

// Filename → icon file mapping
const _fileNameIcons = {
  'package.json': 'npm', 'package-lock.json': 'npm',
  'tsconfig.json': 'typescript', 'tsconfig.base.json': 'typescript',
  '.gitignore': 'git', '.gitmodules': 'git', '.gitattributes': 'git',
  '.env': 'tune', '.env.local': 'tune', '.env.development': 'tune', '.env.production': 'tune',
  'dockerfile': 'docker', 'docker-compose.yml': 'docker', 'docker-compose.yaml': 'docker',
  'docker-compose.dev.yml': 'docker', 'docker-compose.prod.yml': 'docker',
  'makefile': 'settings', 'cmakelists.txt': 'settings',
  'readme.md': 'readme', 'readme': 'readme',
  'license': 'certificate', 'license.md': 'certificate', 'licence': 'certificate',
  'changelog.md': 'changelog', 'changelog': 'changelog',
  '.eslintrc': 'eslint', '.eslintrc.js': 'eslint', '.eslintrc.json': 'eslint', 'eslint.config.js': 'eslint', 'eslint.config.mjs': 'eslint',
  '.prettierrc': 'prettier', '.prettierrc.js': 'prettier', '.prettierrc.json': 'prettier', 'prettier.config.js': 'prettier',
  'yarn.lock': 'lock', 'pnpm-lock.yaml': 'lock', 'composer.lock': 'lock', 'gemfile.lock': 'lock',
};

// Extension → icon file mapping
const _extIconFiles = {
  '.js': 'javascript', '.mjs': 'javascript', '.cjs': 'javascript',
  '.ts': 'typescript', '.d.ts': 'typescript-def',
  '.tsx': 'react_ts', '.jsx': 'react',
  '.py': 'python', '.pyw': 'python', '.pyx': 'python',
  '.rb': 'ruby', '.erb': 'ruby',
  '.go': 'go',
  '.rs': 'rust',
  '.java': 'java', '.jar': 'java',
  '.kt': 'kotlin', '.kts': 'kotlin',
  '.swift': 'swift',
  '.c': 'c', '.h': 'c',
  '.cpp': 'cpp', '.cc': 'cpp', '.cxx': 'cpp', '.hpp': 'cpp',
  '.cs': 'csharp',
  '.html': 'html', '.htm': 'html',
  '.css': 'css',
  '.scss': 'sass', '.sass': 'sass', '.less': 'sass',
  '.json': 'json', '.jsonc': 'json',
  '.yaml': 'yaml', '.yml': 'yaml',
  '.toml': 'toml',
  '.xml': 'xml', '.xsl': 'xml', '.xslt': 'xml',
  '.md': 'markdown', '.mdx': 'markdown',
  '.sh': 'console', '.bash': 'console', '.zsh': 'console', '.fish': 'console',
  '.sql': 'database',
  '.graphql': 'graphql', '.gql': 'graphql',
  '.vue': 'vue',
  '.svelte': 'svelte',
  '.png': 'image', '.jpg': 'image', '.jpeg': 'image', '.gif': 'image', '.webp': 'image', '.bmp': 'image', '.ico': 'image',
  '.svg': 'svg',
  '.pdf': 'pdf',
  '.zip': 'zip', '.tar': 'zip', '.gz': 'zip', '.rar': 'zip', '.7z': 'zip',
  '.lock': 'lock',
  '.log': 'log',
  '.env': 'tune',
  '.gitignore': 'git',
};

// Folder name → icon file mapping
const _folderIconNames = {
  'src': 'src', 'source': 'src', 'lib': 'src',
  'test': 'test', 'tests': 'test', '__tests__': 'test', 'spec': 'test', 'specs': 'test',
  'docs': 'docs', 'doc': 'docs', 'documentation': 'docs',
  'public': 'public', 'static': 'public', 'staticfiles': 'public', 'assets': 'public',
  'components': 'components', 'widgets': 'components',
  'views': 'views', 'pages': 'views', 'screens': 'views',
  'utils': 'utils', 'helpers': 'utils', 'tools': 'utils', 'utilities': 'utils',
  'config': 'config', 'configs': 'config', 'settings': 'config', 'configuration': 'config',
  'scripts': 'scripts', 'bin': 'scripts',
  'api': 'api', 'routes': 'api', 'endpoints': 'api',
  'models': 'database', 'schemas': 'database', 'entities': 'database', 'migrations': 'database',
  'templates': 'template', 'layouts': 'layout',
  'styles': 'styles', 'css': 'styles', 'scss': 'styles',
  'hooks': 'hook', 'middleware': 'middleware',
  'dist': 'dist', 'build': 'dist', 'out': 'dist', 'output': 'dist',
  'images': 'images', 'img': 'images', 'media': 'images', 'uploads': 'images',
  'core': 'core',
};

function _getFileIcon(name) {
  const lower = name.toLowerCase();
  // Check special filenames first
  if (_fileNameIcons[lower]) return ICON_PATH + _fileNameIcons[lower] + '.svg';
  // Check double extensions (e.g. .d.ts)
  const parts = lower.split('.');
  if (parts.length > 2) {
    const dblExt = '.' + parts.slice(-2).join('.');
    if (_extIconFiles[dblExt]) return ICON_PATH + _extIconFiles[dblExt] + '.svg';
  }
  // Check extension
  const ext = '.' + parts.pop();
  if (_extIconFiles[ext]) return ICON_PATH + _extIconFiles[ext] + '.svg';
  // Default
  return ICON_PATH + 'settings.svg';
}

function _getFolderIcon(name, isExpanded) {
  const lower = name.toLowerCase();
  const iconName = _folderIconNames[lower];
  if (iconName) {
    return ICON_PATH + 'folder-' + iconName + (isExpanded ? '-open' : '') + '.svg';
  }
  return ICON_PATH + (isExpanded ? 'folder-open' : 'folder') + '.svg';
}

function _fileIconImg(name) {
  return `<img class="tree-icon" src="${_getFileIcon(name)}" width="16" height="16" draggable="false" alt="">`;
}

function _folderIconImg(name, isExpanded) {
  return `<img class="tree-icon tree-icon-folder" src="${_getFolderIcon(name, isExpanded)}" width="16" height="16" draggable="false" alt="">`;
}

function renderProjects() {
  const container = $('#projectsList');
  const empty = $('#projectsEmpty');
  if (projects.length === 0) { empty.style.display = ''; return; }
  empty.style.display = 'none';

  container.innerHTML = projects.map(p => {
    const isActive = p.path === activeProjectPath;
    const isExpanded = _expandedPaths.has(p.path);
    const taskCount = tasks.filter(t => t.project_path === p.path && t.status !== 'done').length;
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

  _bindProjectTreeEvents(container);

  for (const [projectPath] of _expandedPaths) {
    const cached = _childrenCache.get(projectPath);
    if (cached) {
      const cid = 'treeChildren_' + projectPath.replace(/[^a-zA-Z0-9]/g, '_');
      const el = $(`#${cid}`);
      if (el) _renderTreeItems(el, cached, 1);
    }
  }
}

function _bindProjectTreeEvents(container) {
  container.querySelectorAll('.tree-project-header').forEach(header => {
    header.addEventListener('click', (e) => {
      if (e.target.closest('button') || e.target.closest('.project-env-badge')) return;
      activeProjectPath = header.dataset.path;
      container.querySelectorAll('.tree-project').forEach(p => p.classList.remove('active'));
      header.closest('.tree-project').classList.add('active');
      renderProjectSidebar();
      renderRightPanel();
    });
  });
  container.querySelectorAll('[data-toggle-project]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      await _toggleProjectTree(btn.dataset.toggleProject);
    });
  });
  container.querySelectorAll('[data-analyze]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const p = btn.dataset.analyze;
      document.querySelectorAll('.project-analysis-progress').forEach(bar => {
        if (bar.dataset.analysisPath === p) { bar.style.display = ''; }
      });
      await window.skillbox.analyzeProject(p);
      projects = await window.skillbox.getProjects();
      renderProjects(); renderProjectSidebar(); renderRightPanel();
      toast('Analysis complete!');
    });
  });
  container.querySelectorAll('[data-directives]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const md = await window.skillbox.generateDirectives(btn.dataset.directives);
      if (md) toast('DIRECTIVES.md generated!');
    });
  });
  container.querySelectorAll('[data-terminal]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      setTerminalPanel(true);
      createTerminal({ cwd: btn.dataset.terminal });
    });
  });
  container.querySelectorAll('[data-remove]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const removePath = btn.dataset.remove;
      projects = await window.skillbox.removeProject(removePath);
      if (activeProjectPath === removePath) activeProjectPath = null;
      _expandedPaths.delete(removePath);
      _childrenCache.delete(removePath);
      renderProjects(); renderProjectSidebar(); renderRightPanel(); updateCounts();
      toast('Project removed');
    });
  });
  container.querySelectorAll('[data-env-path]').forEach(badge => {
    badge.addEventListener('click', (e) => { e.stopPropagation(); openEnvModal(badge.dataset.envPath); });
  });
}

async function _toggleProjectTree(projectPath) {
  const cid = 'treeChildren_' + projectPath.replace(/[^a-zA-Z0-9]/g, '_');
  const childContainer = $(`#${cid}`);
  const chevron = document.querySelector(`[data-toggle-project="${CSS.escape(projectPath)}"]`);

  if (_expandedPaths.has(projectPath)) {
    _expandedPaths.delete(projectPath);
    if (childContainer) childContainer.style.display = 'none';
    if (chevron) chevron.classList.remove('expanded');
  } else {
    _expandedPaths.set(projectPath, true);
    if (chevron) chevron.classList.add('expanded');
    if (childContainer) {
      childContainer.style.display = '';
      childContainer.innerHTML = '<div class="tree-loading">Loading...</div>';
      try {
        const entries = await window.skillbox.readDirectory(projectPath, 1);
        _childrenCache.set(projectPath, entries);
        _renderTreeItems(childContainer, entries, 1);
      } catch {
        childContainer.innerHTML = '<div class="tree-loading">Could not read directory</div>';
      }
    }
  }
}

function _renderTreeItems(container, entries, depth) {
  if (!entries || entries.length === 0) {
    container.innerHTML = `<div class="tree-empty-dir" style="padding-left:${depth * 20 + 24}px">Empty folder</div>`;
    return;
  }
  container.innerHTML = entries.map(entry => {
    const indent = depth * 20;
    const isExpanded = _expandedPaths.has(entry.path);
    if (entry.isDir) {
      return `<div class="tree-item is-folder ${isExpanded ? 'expanded' : ''}" data-path="${esc(entry.path)}">
        <div class="tree-item-content" style="padding-left:${indent}px" data-tree-path="${esc(entry.path)}">
          <button class="tree-chevron ${isExpanded ? 'expanded' : ''}" data-toggle-dir="${esc(entry.path)}">
            <svg viewBox="0 0 16 16" fill="currentColor" width="16" height="16"><path d="M6.22 3.22a.75.75 0 011.06 0l4.25 4.25a.75.75 0 010 1.06l-4.25 4.25a.75.75 0 01-1.06-1.06L9.94 8 6.22 4.28a.75.75 0 010-1.06z"/></svg>
          </button>
          ${_folderIconImg(entry.name, isExpanded)}
          <span class="tree-label">${esc(entry.name)}</span>
        </div>
        <div class="tree-children" style="${isExpanded ? '' : 'display:none'}"></div>
      </div>`;
    } else {
      return `<div class="tree-item is-file" data-path="${esc(entry.path)}">
        <div class="tree-item-content" style="padding-left:${indent + 20}px">
          ${_fileIconImg(entry.name)}
          <span class="tree-label">${esc(entry.name)}</span>
        </div>
      </div>`;
    }
  }).join('');

  container.querySelectorAll('[data-toggle-dir]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const dirPath = btn.dataset.toggleDir;
      const item = btn.closest('.tree-item');
      const childContainer = item.querySelector(':scope > .tree-children');
      if (_expandedPaths.has(dirPath)) {
        _expandedPaths.delete(dirPath);
        item.classList.remove('expanded');
        btn.classList.remove('expanded');
        if (childContainer) childContainer.style.display = 'none';
      } else {
        _expandedPaths.set(dirPath, true);
        item.classList.add('expanded');
        btn.classList.add('expanded');
        if (childContainer) {
          childContainer.style.display = '';
          childContainer.innerHTML = '<div class="tree-loading">Loading...</div>';
          try {
            const entries = await window.skillbox.readDirectory(dirPath, 1);
            _childrenCache.set(dirPath, entries);
            _renderTreeItems(childContainer, entries, depth + 1);
          } catch {
            childContainer.innerHTML = '<div class="tree-loading">Could not read directory</div>';
          }
        }
      }
    });
  });

  // Open files in Monaco editor on click
  container.querySelectorAll('.is-file').forEach(item => {
    item.addEventListener('click', () => {
      const filePath = item.dataset.path;
      if (filePath) openFileInEditor(filePath);
    });
  });

  container.querySelectorAll('.is-folder > .tree-item-content').forEach(row => {
    row.addEventListener('dblclick', (e) => {
      if (e.target.closest('button')) return;
      setTerminalPanel(true);
      createTerminal({ cwd: row.dataset.treePath });
    });
  });
}

// ── Env Modal ────────────────────────────────────────────────
let currentEnvProjectPath = null;

async function openEnvModal(projectPath) {
  currentEnvProjectPath = projectPath;
  const project = projects.find(p => p.path === projectPath);
  if (!project) return;
  $('#envModalProject').textContent = project.name;
  $('#envModalOverlay').style.display = '';

  const data = await window.skillbox.getEnvironments(projectPath);
  const envs = data.environments || {};
  currentEnvName = data.activeEnv || Object.keys(envs)[0] || 'DEV';

  renderEnvTabs(envs, currentEnvName);
  renderEnvVars(envs[currentEnvName] || {});
}

function renderEnvTabs(envs, active) {
  const tabsEl = $('#envTabs');
  tabsEl.innerHTML = Object.keys(envs).map(name =>
    `<button class="env-tab ${name === active ? 'active' : ''}" data-env="${esc(name)}">${esc(name)}</button>`
  ).join('') + `<button class="env-tab-add" title="Add environment">+</button>`;

  tabsEl.querySelectorAll('.env-tab').forEach(tab => {
    tab.addEventListener('click', async () => {
      currentEnvName = tab.dataset.env;
      await window.skillbox.setActiveEnvironment(currentEnvProjectPath, currentEnvName);
      const data = await window.skillbox.getEnvironments(currentEnvProjectPath);
      renderEnvTabs(data.environments, currentEnvName);
      renderEnvVars(data.environments[currentEnvName] || {});
    });
  });
  tabsEl.querySelector('.env-tab-add')?.addEventListener('click', async () => {
    const name = prompt('Environment name (e.g. STAGING):');
    if (!name?.trim()) return;
    projects = await window.skillbox.addEnvironment(currentEnvProjectPath, name.trim().toUpperCase());
    const data = await window.skillbox.getEnvironments(currentEnvProjectPath);
    currentEnvName = name.trim().toUpperCase();
    renderEnvTabs(data.environments, currentEnvName);
    renderEnvVars(data.environments[currentEnvName] || {});
  });
}

function renderEnvVars(vars) {
  const body = $('#envModalBody');
  const entries = Object.entries(vars);
  if (entries.length === 0) {
    body.innerHTML = '<p style="color:var(--muted-foreground);font-size:12px;padding:12px 0">No variables set. Click "+ Add variable" to start.</p>';
    return;
  }
  body.innerHTML = entries.map(([k, v]) => `
    <div class="env-row">
      <input type="text" class="env-key-input" value="${esc(k)}" placeholder="KEY" data-old-key="${esc(k)}">
      <input type="text" class="env-val-input" value="${esc(v)}" placeholder="value">
      <button class="env-remove-btn" title="Remove">
        <svg viewBox="0 0 16 16" fill="currentColor" width="14" height="14"><path d="M4.646 4.646a.5.5 0 01.708 0L8 7.293l2.646-2.647a.5.5 0 01.708.708L8.707 8l2.647 2.646a.5.5 0 01-.708.708L8 8.707l-2.646 2.647a.5.5 0 01-.708-.708L7.293 8 4.646 5.354a.5.5 0 010-.708z"/></svg>
      </button>
    </div>
  `).join('');

  body.querySelectorAll('.env-remove-btn').forEach(btn => {
    btn.addEventListener('click', () => btn.parentElement.remove());
  });
}

function addEnvVar() {
  const body = $('#envModalBody');
  const noVarsMsg = body.querySelector('p');
  if (noVarsMsg) noVarsMsg.remove();
  const row = document.createElement('div');
  row.className = 'env-row';
  row.innerHTML = `
    <input type="text" class="env-key-input" placeholder="KEY">
    <input type="text" class="env-val-input" placeholder="value">
    <button class="env-remove-btn" title="Remove">
      <svg viewBox="0 0 16 16" fill="currentColor" width="14" height="14"><path d="M4.646 4.646a.5.5 0 01.708 0L8 7.293l2.646-2.647a.5.5 0 01.708.708L8.707 8l2.647 2.646a.5.5 0 01-.708.708L8 8.707l-2.646 2.647a.5.5 0 01-.708-.708L7.293 8 4.646 5.354a.5.5 0 010-.708z"/></svg>
    </button>
  `;
  body.appendChild(row);
  row.querySelector('.env-remove-btn').addEventListener('click', () => row.remove());
  row.querySelector('.env-key-input').focus();
}

async function syncCurrentEnv() {
  const vars = {};
  $$('#envModalBody .env-row').forEach(row => {
    const key = row.querySelector('.env-key-input')?.value?.trim();
    const val = row.querySelector('.env-val-input')?.value || '';
    if (key) vars[key] = val;
  });
  projects = await window.skillbox.saveEnvironment(currentEnvProjectPath, currentEnvName, vars);
  await window.skillbox.syncEnvFile(currentEnvProjectPath, currentEnvName);
  toast('Synced to .env file');
}

async function importCurrentEnv() {
  const vars = await window.skillbox.importEnvFile(currentEnvProjectPath, currentEnvName);
  if (Object.keys(vars).length > 0) {
    renderEnvVars(vars);
    toast('Imported .env file');
  } else {
    toast('No .env file found');
  }
}

function closeEnvModal() {
  if (currentEnvProjectPath) {
    const vars = {};
    $$('#envModalBody .env-row').forEach(row => {
      const key = row.querySelector('.env-key-input')?.value?.trim();
      const val = row.querySelector('.env-val-input')?.value || '';
      if (key) vars[key] = val;
    });
    window.skillbox.saveEnvironment(currentEnvProjectPath, currentEnvName, vars).then(p => {
      projects = p;
      if (activeView === 'projects') renderProjects();
    });
  }
  $('#envModalOverlay').style.display = 'none';
  currentEnvProjectPath = null;
}

// ── Teams ────────────────────────────────────────────────────
function renderTeams() {
  const container = $('#teamsList');
  const empty = $('#teamsEmpty');
  if (teams.length === 0) {
    container.innerHTML = '';
    container.appendChild(empty);
    empty.style.display = '';
    return;
  }
  empty.style.display = 'none';

  container.innerHTML = teams.map(t => {
    const members = typeof t.members === 'string' ? JSON.parse(t.members) : (t.members || []);
    const membersHtml = members.map(m => {
      const initials = (m.name || '?').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
      const skills = (m.skills || []).map(s => {
        const skill = registry.skills?.find(sk => sk.id === s);
        return `<span class="member-skill-tag">${esc(skill?.name || s.split('/').pop())}</span>`;
      }).join('');
      return `<div class="team-member">
        <div class="member-avatar">${initials}</div>
        <div class="member-info">
          <div class="member-name">${esc(m.name)}</div>
          <div class="member-role">${esc(m.role || 'Member')}</div>
          ${skills ? `<div class="member-skills">${skills}</div>` : ''}
        </div>
      </div>`;
    }).join('');

    return `<div class="team-card" data-team-id="${esc(t.id)}">
      <div class="team-card-header">
        <div class="team-card-name">${esc(t.name)}</div>
        <div style="display:flex;gap:6px">
          <button class="btn-ghost btn-sm" data-edit-team="${esc(t.id)}">Edit</button>
          <button class="btn-ghost btn-sm btn-danger" data-delete-team="${esc(t.id)}">Delete</button>
        </div>
      </div>
      ${t.description ? `<div class="team-card-desc">${esc(t.description)}</div>` : ''}
      <div class="team-members">${membersHtml || '<span style="font-size:12px;color:var(--muted-foreground)">No members yet</span>'}</div>
    </div>`;
  }).join('');

  container.querySelectorAll('[data-edit-team]').forEach(btn => {
    btn.addEventListener('click', () => openTeamModal(btn.dataset.editTeam));
  });
  container.querySelectorAll('[data-delete-team]').forEach(btn => {
    btn.addEventListener('click', async () => {
      teams = await window.skillbox.deleteTeam(btn.dataset.deleteTeam);
      renderTeams();
      toast('Team deleted');
    });
  });
}

function openTeamModal(teamId) {
  editingTeamId = teamId || null;
  const modal = $('#teamModalOverlay');
  modal.style.display = '';
  if (teamId) {
    const team = teams.find(t => t.id === teamId);
    if (team) {
      $('#teamModalTitle').textContent = 'Edit Team';
      $('#teamNameInput').value = team.name;
      $('#teamDescInput').value = team.description || '';
      teamMembers = typeof team.members === 'string' ? JSON.parse(team.members) : [...(team.members || [])];
    }
  } else {
    $('#teamModalTitle').textContent = 'New Team';
    $('#teamNameInput').value = '';
    $('#teamDescInput').value = '';
    teamMembers = [];
  }
  renderTeamMemberRows();
}

function closeTeamModal() {
  $('#teamModalOverlay').style.display = 'none';
  editingTeamId = null;
  teamMembers = [];
}

function renderTeamMemberRows() {
  const list = $('#teamMembersList');
  const allSkills = (registry.skills || []);

  list.innerHTML = teamMembers.map((m, i) => {
    const memberSkills = m.skills || [];
    const skillChips = memberSkills.map(sid => {
      const sk = allSkills.find(s => s.id === sid);
      return `<span class="member-skill-chip" data-idx="${i}" data-skill="${esc(sid)}">${esc(sk?.name || sid.split('/').pop())} <span class="chip-x">&times;</span></span>`;
    }).join('');

    return `<div class="team-member-row" data-idx="${i}">
      <div class="member-row-fields">
        <input type="text" class="form-input" placeholder="Name" value="${esc(m.name || '')}" data-field="name" style="flex:1">
        <input type="text" class="form-input" placeholder="Role (e.g. Frontend Dev)" value="${esc(m.role || '')}" data-field="role" style="flex:1">
        <input type="text" class="form-input" placeholder="Email" value="${esc(m.email || '')}" data-field="email" style="flex:1">
        <button class="btn-icon btn-danger" data-remove-member="${i}" title="Remove">
          <svg viewBox="0 0 16 16" fill="currentColor" width="14" height="14"><path d="M4.646 4.646a.5.5 0 01.708 0L8 7.293l2.646-2.647a.5.5 0 01.708.708L8.707 8l2.647 2.646a.5.5 0 01-.708.708L8 8.707l-2.646 2.647a.5.5 0 01-.708-.708L7.293 8 4.646 5.354a.5.5 0 010-.708z"/></svg>
        </button>
      </div>
      <div class="member-row-skills">
        <div class="member-skill-chips">${skillChips || '<span style="color:var(--muted-foreground);font-size:11px">No skills assigned</span>'}</div>
        <select class="member-skill-select" data-idx="${i}">
          <option value="">+ Add skill...</option>
          ${allSkills.filter(s => !memberSkills.includes(s.id)).map(s =>
            `<option value="${esc(s.id)}">${esc(s.name)} (${s.category})</option>`
          ).join('')}
        </select>
      </div>
    </div>`;
  }).join('');

  list.querySelectorAll('[data-remove-member]').forEach(btn => {
    btn.addEventListener('click', () => {
      teamMembers.splice(parseInt(btn.dataset.removeMember), 1);
      renderTeamMemberRows();
    });
  });
  list.querySelectorAll('.form-input').forEach(input => {
    input.addEventListener('input', () => {
      const row = input.closest('.team-member-row');
      const idx = parseInt(row.dataset.idx);
      teamMembers[idx][input.dataset.field] = input.value;
    });
  });
  list.querySelectorAll('.member-skill-select').forEach(sel => {
    sel.addEventListener('change', () => {
      const idx = parseInt(sel.dataset.idx);
      const skillId = sel.value;
      if (!skillId) return;
      if (!teamMembers[idx].skills) teamMembers[idx].skills = [];
      if (!teamMembers[idx].skills.includes(skillId)) {
        teamMembers[idx].skills.push(skillId);
        renderTeamMemberRows();
      }
    });
  });
  list.querySelectorAll('.member-skill-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const idx = parseInt(chip.dataset.idx);
      const sid = chip.dataset.skill;
      teamMembers[idx].skills = (teamMembers[idx].skills || []).filter(s => s !== sid);
      renderTeamMemberRows();
    });
  });
}

function addTeamMember() {
  teamMembers.push({ name: '', role: '', skills: [] });
  renderTeamMemberRows();
  const lastInput = $$('#teamMembersList .form-input');
  if (lastInput.length) lastInput[lastInput.length - 2]?.focus();
}

async function saveTeam() {
  const name = $('#teamNameInput').value.trim();
  if (!name) return toast('Team name is required');

  const data = {
    name,
    description: $('#teamDescInput').value.trim(),
    members: teamMembers.filter(m => m.name.trim()),
  };

  if (editingTeamId) {
    teams = await window.skillbox.updateTeam(editingTeamId, data);
    toast('Team updated');
  } else {
    teams = await window.skillbox.createTeam(data);
    toast('Team created');
  }

  closeTeamModal();
  renderTeams();
  if (activeView === 'dashboard') renderDashboard();
}

// ── Skills ───────────────────────────────────────────────────
function renderSkills() {
  const grid = $('#skillsGrid');
  const searchVal = ($('#skillSearch')?.value || '').toLowerCase();
  const emptyEl = $('#skillsEmpty');
  const skills = registry.skills || [];

  let filtered = skills;
  if (activeCategory) filtered = filtered.filter(s => s.category === activeCategory);
  if (searchVal) filtered = filtered.filter(s =>
    s.name?.toLowerCase().includes(searchVal) ||
    s.description?.toLowerCase().includes(searchVal) ||
    (s.tags || []).some(t => t.toLowerCase().includes(searchVal))
  );

  if (filtered.length === 0) {
    grid.innerHTML = '';
    emptyEl.style.display = '';
    return;
  }
  emptyEl.style.display = 'none';

  grid.innerHTML = filtered.map(s => {
    const cat = s.category || 'general';
    const initial = (cat[0] || 'G').toUpperCase();
    const tags = (s.tags || []).slice(0, 3).map(t => `<span class="skill-tag">${esc(t)}</span>`).join('');
    const isCustom = s.isCustom ? '<span class="custom-badge">Custom</span>' : '';
    return `<div class="skill-card ${s.isCustom ? 'skill-card-custom' : ''}" data-id="${esc(s.id)}">
      <div class="skill-card-top">
        <div class="skill-icon cat-${cat}">${initial}</div>
        <div class="skill-meta">
          <div class="skill-name">${esc(s.name)}${isCustom}</div>
          <div class="skill-category">${esc(cat)}</div>
        </div>
      </div>
      <div class="skill-desc">${esc(s.description || '')}</div>
      ${tags ? `<div class="skill-tags">${tags}</div>` : ''}
    </div>`;
  }).join('');

  grid.querySelectorAll('.skill-card').forEach(card => {
    card.addEventListener('click', () => openSkillDetail(card.dataset.id));
  });

  renderCategoryPills();
}

function renderCategoryPills() {
  const pills = $('#categoryPills');
  if (!pills) return;
  const categories = [...new Set((registry.skills || []).map(s => s.category))].filter(Boolean);
  pills.innerHTML = `<button class="pill ${!activeCategory ? 'active' : ''}" data-cat="">All</button>` +
    categories.map(c => `<button class="pill ${c === activeCategory ? 'active' : ''}" data-cat="${esc(c)}">${capitalize(c)}</button>`).join('');
  pills.querySelectorAll('.pill').forEach(p => {
    p.addEventListener('click', () => {
      activeCategory = p.dataset.cat;
      renderSkills();
    });
  });
}

function clearSearch() {
  const input = $('#skillSearch');
  if (input) input.value = '';
  renderSkills();
}

// ── Skill Detail ─────────────────────────────────────────────
async function openSkillDetail(id) {
  activeSkillId = id;
  const skill = (registry.skills || []).find(s => s.id === id);
  if (!skill) return;

  const content = await window.skillbox.getSkillContent(id);

  const header = $('#detailHeader');
  const body = $('#detailBody');

  header.innerHTML = `
    <div class="detail-header-top">
      <div class="detail-skill-name">${esc(skill.name)}</div>
      <button class="detail-close" id="detailCloseBtn">
        <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/></svg>
      </button>
    </div>
    <div class="detail-skill-meta">
      <span class="stack-badge">${esc(skill.category || 'general')}</span>
      ${skill.version ? `<span class="stack-badge">v${esc(skill.version)}</span>` : ''}
      ${skill.isCustom ? '<span class="custom-badge">Custom</span>' : ''}
    </div>
    <div class="detail-actions">
      ${activeProjectPath ? `<button class="btn-primary btn-sm" id="detailInstallBtn">Install to Project</button>` : ''}
      ${activeProjectPath ? `<button class="btn-ghost btn-sm" id="detailToggleBtn">Toggle Active</button>` : ''}
    </div>
  `;

  body.innerHTML = `<div class="md-content">${simpleMarkdown(content || 'No content available.')}</div>`;

  $('#detailCloseBtn')?.addEventListener('click', closeDetail);
  $('#detailInstallBtn')?.addEventListener('click', async () => {
    if (!activeProjectPath || !activeSkillId) return;
    const r = await window.skillbox.installSkillToProject(activeProjectPath, activeSkillId);
    projects = r.projects || projects;
    toast(`Installed to ${r.installed} tool locations`);
  });
  $('#detailToggleBtn')?.addEventListener('click', async () => {
    if (!activeProjectPath || !activeSkillId) return;
    projects = await window.skillbox.toggleProjectSkill(activeProjectPath, activeSkillId);
    renderProjects();
    renderProjectSidebar();
    toast('Skill toggled');
  });

  $('#detailOverlay').classList.add('open');
  $('#detailPanel').classList.add('open');
}

function closeDetail() {
  $('#detailOverlay')?.classList.remove('open');
  $('#detailPanel')?.classList.remove('open');
  activeSkillId = null;
}

// ── Skill Creator ────────────────────────────────────────────
function openSkillCreator(skillId) {
  editingSkillId = skillId || null;
  $('#skillModalOverlay').style.display = '';
  if (skillId) {
    // load existing... (TBD)
  } else {
    $('#skillModalTitle').textContent = 'New Skill';
    $('#skillNameInput').value = '';
    $('#skillCategoryInput').value = 'general';
    $('#skillVersionInput').value = '1.0';
    $('#skillDescInput').value = '';
    $('#skillTagsInput').value = '';
    $('#skillContentInput').value = '';
  }
}

function closeSkillCreator() {
  $('#skillModalOverlay').style.display = 'none';
  editingSkillId = null;
}

async function saveCustomSkill() {
  const name = $('#skillNameInput').value.trim();
  if (!name) return toast('Skill name is required');
  const data = {
    name,
    category: $('#skillCategoryInput').value,
    version: $('#skillVersionInput').value || '1.0',
    description: $('#skillDescInput').value.trim(),
    tags: $('#skillTagsInput').value.split(',').map(t => t.trim()).filter(Boolean),
    content: $('#skillContentInput').value,
  };
  if (editingSkillId) {
    await window.skillbox.updateSkill(editingSkillId, data);
    toast('Skill updated');
  } else {
    await window.skillbox.createSkill(data);
    toast('Skill created');
  }
  closeSkillCreator();
  registry = await window.skillbox.getRegistry();
  renderSkills();
}

// ── Git Import ───────────────────────────────────────────────
function openGitImportModal() {
  $('#gitImportModalOverlay').style.display = '';
  $('#gitRepoUrlInput').value = '';
  $('#gitImportStatus').style.display = 'none';
}
function closeGitImportModal() {
  $('#gitImportModalOverlay').style.display = 'none';
}
async function startGitImport() {
  const url = $('#gitRepoUrlInput').value.trim();
  if (!url) return toast('Enter a repository URL');
  const status = $('#gitImportStatus');
  status.style.display = '';
  status.className = 'import-loading';
  status.innerHTML = '<div class="spinner"></div> Cloning and scanning for skills...';

  const result = await window.skillbox.cloneSkillFromGit(url);
  if (result.success) {
    status.className = 'import-success';
    status.textContent = `Imported ${result.imported.length} skill(s): ${result.imported.map(s => s.name).join(', ')}`;
    registry = await window.skillbox.getRegistry();
    renderSkills();
  } else {
    status.className = 'import-error';
    status.textContent = result.error || 'Import failed';
  }
}

// ── GitHub ───────────────────────────────────────────────────
async function initGithubStatus() {
  const status = await window.skillbox.githubGetStatus();
  updateGithubUI(status);
}

function updateGithubUI(status) {
  // Status shown in GitHub view only
}

async function refreshGithubView() {
  const status = await window.skillbox.githubGetStatus();
  updateGithubUI(status);
  if (status.connected) {
    $('#githubConnectCard').style.display = 'none';
    $('#githubConnected').style.display = '';
    $('#githubUsername').textContent = status.username;
    $('#githubAvatar').src = status.avatarUrl || '';
    searchGithubRepos('');
  } else {
    $('#githubConnectCard').style.display = '';
    $('#githubConnected').style.display = 'none';
  }
}

async function connectGithub() {
  const token = $('#githubTokenInput').value.trim();
  if (!token) return toast('Enter a token');
  const result = await window.skillbox.githubConnect(token);
  if (result.success) {
    toast(`Connected as ${result.username}`);
    refreshGithubView();
  } else {
    toast(result.error || 'Connection failed');
  }
}

async function disconnectGithub() {
  await window.skillbox.githubDisconnect();
  refreshGithubView();
  toast('Disconnected');
}

async function searchGithubRepos(query) {
  const result = await window.skillbox.githubListRepos(query);
  if (!result.success) return;
  const list = $('#githubReposList');
  list.innerHTML = (result.repos || []).map(r => `
    <div class="github-repo-card">
      <div class="github-repo-info">
        <div class="github-repo-name">${esc(r.name)}</div>
        <div class="github-repo-desc">${esc(r.description || '')}</div>
        <div class="github-repo-meta">
          ${r.language ? `<span class="github-repo-lang">${esc(r.language)}</span>` : ''}
          <span>${r.stars || 0} stars</span>
        </div>
      </div>
      <div class="github-repo-actions">
        <button class="btn-ghost btn-sm" data-clone-repo="${esc(r.url)}">Clone</button>
        <button class="btn-ghost btn-sm" data-import-skills="${esc(r.url)}">Import Skills</button>
      </div>
    </div>
  `).join('');

  list.querySelectorAll('[data-clone-repo]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const r = await window.skillbox.githubCloneRepo(btn.dataset.cloneRepo);
      if (r.success) {
        toast('Cloned successfully');
        const addResult = await window.skillbox.addProject(r.path);
        projects = addResult.projects || [];
        renderProjectSidebar();
      } else {
        toast(r.error || 'Clone failed');
      }
    });
  });
  list.querySelectorAll('[data-import-skills]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const result = await window.skillbox.cloneSkillFromGit(btn.dataset.importSkills);
      if (result.success) {
        toast(`Imported ${result.imported.length} skill(s)`);
        registry = await window.skillbox.getRegistry();
        renderSkills();
      } else {
        toast(result.error || 'Import failed');
      }
    });
  });
}

// ── History ──────────────────────────────────────────────────
async function loadHistory() {
  const filterEl = $('#historyFilter');
  if (filterEl) {
    const currentVal = filterEl.value;
    filterEl.innerHTML = '<option value="">All projects</option>' +
      projects.map(p => `<option value="${esc(p.path)}" ${p.path === currentVal ? 'selected' : ''}>${esc(p.name)}</option>`).join('');
  }
  const filter = $('#historyFilter')?.value || '';
  history = await window.skillbox.getHistory(filter || undefined);
}

function renderHistory() {
  const container = $('#historyTimeline');
  const empty = $('#historyEmpty');
  if (!history || history.length === 0) {
    container.innerHTML = '';
    container.appendChild(empty);
    empty.style.display = '';
    return;
  }
  empty.style.display = 'none';

  let currentDay = '';
  let html = '';
  for (const h of history) {
    const date = new Date(h.timestamp);
    const day = date.toLocaleDateString();
    if (day !== currentDay) {
      currentDay = day;
      const label = isToday(date) ? 'Today' : isYesterday(date) ? 'Yesterday' : day;
      html += `<div class="history-day-header">${label}</div>`;
    }
    html += `<div class="history-item">
      <div class="history-dot type-${h.type}"></div>
      <div style="flex:1">
        <div class="history-detail">${esc(h.detail)}</div>
        ${h.project ? `<div class="history-project-tag">${esc(h.project)}</div>` : ''}
      </div>
      <div class="history-time">${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
    </div>`;
  }
  container.innerHTML = html;
}

// ══════════════════════════════════════════════════════════════
//  TERMINAL (bottom panel)
// ══════════════════════════════════════════════════════════════
function initTerminalListeners() {
  window.skillbox.onTerminalData(({ id, data }) => {
    const term = terminals.find(t => t.id === id);
    if (term?.term) term.term.write(data);
  });
  window.skillbox.onTerminalExit(({ id }) => {
    terminals = terminals.filter(t => t.id !== id);
    if (activeTerminalId === id) {
      activeTerminalId = terminals[0]?.id || null;
    }
    updateTerminalNameSelector();
    showActiveTerminal();
    if (terminals.length === 0) setTerminalPanel(false);
  });
}

function toggleTerminalPanel() {
  if (terminalPanelOpen) {
    setTerminalPanel(false);
  } else {
    setTerminalPanel(true);
    if (terminals.length === 0) createTerminal({ cwd: activeProjectPath || undefined });
  }
}

// ── Panel Resize (drag handles) ──────────────────────────────
// ── Panel Resize System (VS Code-style sash) ────────────────
// Remembers last width so collapsing/expanding restores properly
let _sidebarLastWidth = 220;
let _rightPanelLastWidth = 260;
const COLLAPSE_THRESHOLD = 50; // px — drag below this to collapse
const PANEL_MIN = 120;         // px — minimum visible width

function initPanelResize() {
  _setupSash('resizeSidebar', 'projectSidebar', {
    side: 'left',
    getLastWidth: () => _sidebarLastWidth,
    setLastWidth: (w) => { _sidebarLastWidth = w; },
    isOpen: () => projectSidebarOpen,
    toggle: () => toggleProjectSidebar(),
    setOpen: (open) => {
      projectSidebarOpen = open;
      const btn = $('[data-panel="projects"]');
      if (btn) btn.classList.toggle('active', open);
    },
  });

  _setupSash('resizeRightPanel', 'rightPanel', {
    side: 'right',
    getLastWidth: () => _rightPanelLastWidth,
    setLastWidth: (w) => { _rightPanelLastWidth = w; },
    isOpen: () => rightPanelOpen,
    toggle: () => toggleRightPanel(),
    setOpen: (open) => {
      rightPanelOpen = open;
      const btn = $('#btnToggleRightPanel');
      if (btn) btn.classList.toggle('active', open);
    },
  });
}

function _setupSash(handleId, panelId, opts) {
  const handle = $(`#${handleId}`);
  const panel = $(`#${panelId}`);
  if (!handle || !panel) return;

  function setPanelWidth(w) {
    panel.style.width = w + 'px';
    panel.style.minWidth = w + 'px';
  }

  handle.addEventListener('mousedown', (e) => {
    e.preventDefault();
    const startX = e.clientX;
    const wasOpen = opts.isOpen();
    const startWidth = wasOpen ? panel.offsetWidth : 0;

    // Disable transitions during drag for smooth feel
    panel.style.transition = 'none';
    document.body.classList.add('resizing');
    handle.classList.add('active');

    // If panel was collapsed, immediately make it visible for the drag
    if (!wasOpen) {
      panel.classList.remove('collapsed');
      panel.style.opacity = '1';
      panel.style.borderRight = opts.side === 'left' ? '1px solid var(--border)' : '';
      panel.style.borderLeft = opts.side === 'right' ? '1px solid var(--border)' : '';
      setPanelWidth(0);
    }

    let lastW = startWidth;

    const onMove = (ev) => {
      const delta = opts.side === 'left' ? ev.clientX - startX : startX - ev.clientX;
      const maxW = window.innerWidth * 0.5;
      const rawW = startWidth + delta;

      if (rawW < COLLAPSE_THRESHOLD) {
        // Below threshold — show collapse hint
        setPanelWidth(0);
        panel.style.opacity = '0';
        lastW = 0;
      } else {
        const w = Math.min(Math.max(rawW, PANEL_MIN), maxW);
        setPanelWidth(w);
        panel.style.opacity = '1';
        lastW = w;
      }
    };

    const onUp = () => {
      document.body.classList.remove('resizing');
      handle.classList.remove('active');
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);

      // Restore transitions
      panel.style.transition = '';
      panel.style.borderRight = '';
      panel.style.borderLeft = '';

      if (lastW < COLLAPSE_THRESHOLD) {
        // Collapsed — force closed state directly
        panel.style.transition = 'none';
        panel.classList.add('collapsed');
        panel.style.width = '';
        panel.style.minWidth = '';
        panel.style.opacity = '';
        opts.setOpen(false);
        // Re-enable transitions after a frame
        requestAnimationFrame(() => { panel.style.transition = ''; });
      } else {
        // Open at new width
        opts.setLastWidth(lastW);
        panel.classList.remove('collapsed');
        panel.style.opacity = '';
        opts.setOpen(true);
        setPanelWidth(lastW);
      }

      // Refit terminals
      const term = terminals.find(t => t.id === activeTerminalId);
      if (term?.fitAddon) try { term.fitAddon.fit(); } catch {}
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });

  // Double-click to toggle collapse/expand
  handle.addEventListener('dblclick', () => {
    if (opts.isOpen()) {
      opts.setLastWidth(panel.offsetWidth || opts.getLastWidth());
      opts.toggle();
    } else {
      opts.toggle();
      setPanelWidth(opts.getLastWidth());
    }
  });
}

// ── Terminal System (VS Code-style) ─────────────────────────
let focusedTerminalId = null; // which pane has focus in split

function fitAllVisibleTerminals() {
  setTimeout(() => {
    terminals.forEach(t => {
      if (t.element.style.display !== 'none' && t.fitAddon) {
        try { t.fitAddon.fit(); } catch {}
      }
    });
  }, 80);
}

let _terminalLastHeight = 280;
let _terminalSidebarWidth = 160;
let _terminalSidebarVisible = true;
const TERMINAL_COLLAPSE_H = 40;
const TERMINAL_MIN_H = 100;

function _updateTerminalTallClass(panel) {
  if (!panel) panel = $('#terminalPanel');
  if (!panel) return;
  const threshold = window.innerHeight * 0.5;
  panel.classList.toggle('tall', panel.offsetHeight > threshold);
}

function initTerminalResize() {
  const panel = $('#terminalPanel');
  const handle = $('#terminalResizeHandle');
  const edgeSash = $('#terminalEdgeSash');

  // ── Top resize handle (drag to resize terminal panel height) ──
  if (handle && panel) {
    handle.addEventListener('mousedown', (e) => {
      e.preventDefault();
      // If maximized, exit maximize mode first
      if (panel.classList.contains('maximized')) {
        panel.classList.remove('maximized');
        panel.style.height = (_terminalLastHeight || 280) + 'px';
        _terminalWasMaximized = false;
        _updateMaximizeButton(false);
      }
      const startY = e.clientY;
      const startHeight = panel.offsetHeight;
      document.body.classList.add('resizing');
      handle.classList.add('active');
      panel.style.transition = 'none';

      let lastH = startHeight;

      // Calculate max height: parent height minus min space for titlebar
      const mainArea = panel.closest('.main-area');
      const maxH = mainArea ? mainArea.offsetHeight - 38 : window.innerHeight - 80;

      const onMove = (ev) => {
        const delta = startY - ev.clientY;
        const rawH = startHeight + delta;

        if (rawH < TERMINAL_COLLAPSE_H) {
          panel.style.height = '0px';
          lastH = 0;
        } else {
          const h = Math.min(Math.max(rawH, TERMINAL_MIN_H), maxH);
          panel.style.height = h + 'px';
          lastH = h;
          panel.classList.toggle('tall', h > window.innerHeight * 0.5);
        }
      };

      const onUp = () => {
        document.body.classList.remove('resizing');
        handle.classList.remove('active');
        panel.style.transition = '';
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);

        if (lastH < TERMINAL_COLLAPSE_H) {
          setTerminalPanel(false);
          panel.style.height = '';
        } else {
          _terminalLastHeight = lastH;
        }
        _updateTerminalTallClass(panel);
        fitAllVisibleTerminals();
      };

      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });
  }

  // ── Bottom edge sash: drag up to reveal terminal ──
  if (edgeSash) {
    edgeSash.addEventListener('mousedown', (e) => {
      e.preventDefault();
      const startY = e.clientY;
      const wasOpen = terminalPanelOpen;

      // If terminal is closed, open it at 0 height and let user drag up
      if (!wasOpen) {
        if (terminals.length === 0) createTerminal({ cwd: activeProjectPath || undefined });
        const panel = $('#terminalPanel');
        if (panel) {
          panel.style.display = '';
          panel.style.height = '0px';
          panel.style.transition = 'none';
        }
      }

      document.body.classList.add('resizing');
      const startHeight = wasOpen ? ($('#terminalPanel')?.offsetHeight || 0) : 0;
      let lastH = startHeight;

      const onMove = (ev) => {
        const panel = $('#terminalPanel');
        if (!panel) return;
        const mainArea = panel.closest('.main-area');
        const maxH = mainArea ? mainArea.offsetHeight - 38 : window.innerHeight - 80;
        const delta = startY - ev.clientY;
        const h = Math.min(Math.max(startHeight + delta, 0), maxH);
        panel.style.height = h + 'px';
        lastH = h;
      };

      const onUp = () => {
        document.body.classList.remove('resizing');
        const panel = $('#terminalPanel');
        if (panel) panel.style.transition = '';
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);

        if (lastH < TERMINAL_COLLAPSE_H) {
          setTerminalPanel(false);
          if (panel) panel.style.height = '';
        } else {
          terminalPanelOpen = true;
          _terminalLastHeight = lastH;
          const toggleBtn = $('#btnToggleTerminal');
          if (toggleBtn) toggleBtn.classList.add('active');
          _updateTerminalTallClass(panel);
          fitAllVisibleTerminals();
        }
      };

      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });
  }

  // ── Terminal sidebar sash resize ──
  _initTerminalSidebarResize();
}

function _initTerminalSidebarResize() {
  const sash = $('#terminalSidebarSash');
  const sidebar = $('#terminalSidebar');
  if (!sash || !sidebar) return;

  sash.addEventListener('mousedown', (e) => {
    e.preventDefault();
    const startX = e.clientX;
    const startW = sidebar.offsetWidth;
    document.body.classList.add('resizing');
    sash.classList.add('active');
    sidebar.style.transition = 'none';

    let lastW = startW;

    const onMove = (ev) => {
      const delta = startX - ev.clientX; // dragging left = bigger sidebar
      const rawW = startW + delta;

      if (rawW < 40) {
        sidebar.style.width = '0px';
        sidebar.style.opacity = '0';
        sidebar.style.borderLeft = 'none';
        lastW = 0;
      } else {
        const w = Math.min(Math.max(rawW, 80), 400);
        sidebar.style.width = w + 'px';
        sidebar.style.opacity = '';
        sidebar.style.borderLeft = '';
        lastW = w;
      }
    };

    const onUp = () => {
      document.body.classList.remove('resizing');
      sash.classList.remove('active');
      sidebar.style.transition = '';
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);

      if (lastW < 40) {
        _terminalSidebarVisible = false;
        sidebar.classList.add('collapsed');
        sidebar.style.width = '';
        sidebar.style.opacity = '';
        sidebar.style.borderLeft = '';
      } else {
        _terminalSidebarVisible = true;
        _terminalSidebarWidth = lastW;
        sidebar.classList.remove('collapsed');
      }
      fitAllVisibleTerminals();
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });
}

function toggleTerminalSidebar() {
  const sidebar = $('#terminalSidebar');
  if (!sidebar) return;
  _terminalSidebarVisible = !_terminalSidebarVisible;
  if (_terminalSidebarVisible) {
    sidebar.classList.remove('collapsed');
    sidebar.style.width = _terminalSidebarWidth + 'px';
  } else {
    sidebar.classList.add('collapsed');
  }
  fitAllVisibleTerminals();
}

let _terminalWasMaximized = false;

function toggleTerminalMaximize() {
  const panel = $('#terminalPanel');
  if (!panel) return;
  const wasMaximized = panel.classList.contains('maximized');

  if (wasMaximized) {
    // Restore to previous size
    panel.classList.remove('maximized');
    panel.style.height = (_terminalLastHeight || 280) + 'px';
  } else {
    // Save height, then maximize
    _terminalLastHeight = panel.offsetHeight || _terminalLastHeight || 280;
    panel.classList.add('maximized');
    panel.style.height = '';  // Let CSS flex: 1 handle it
  }

  _terminalWasMaximized = !wasMaximized;
  _updateMaximizeButton(!wasMaximized);
  setTimeout(() => fitAllVisibleTerminals(), 50);
}

function _updateMaximizeButton(isMaximized) {
  const btn = $('#btnMaximizeTerminal');
  if (!btn) return;
  btn.title = isMaximized ? 'Restore Panel Size' : 'Maximize Panel';
  // VS Code uses chevron-down for restore, expand icon for maximize
  btn.innerHTML = isMaximized
    ? '<svg viewBox="0 0 16 16" fill="currentColor" width="14" height="14"><path d="M8 11.4L2.6 6 4 4.6l4 4 4-4L13.4 6 8 11.4z"/></svg>'
    : '<svg viewBox="0 0 16 16" fill="currentColor" width="14" height="14"><path d="M8 4.6L13.4 10 12 11.4l-4-4-4 4L2.6 10 8 4.6z"/></svg>';
}

function setTerminalPanel(open) {
  terminalPanelOpen = open;
  const panel = $('#terminalPanel');
  const toggleBtn = $('#btnToggleTerminal');
  if (panel) {
    panel.style.display = open ? '' : 'none';
    if (open && _terminalLastHeight) panel.style.height = _terminalLastHeight + 'px';
  }
  if (toggleBtn) toggleBtn.classList.toggle('active', open);
  if (open) {
    fitAllVisibleTerminals();
    const active = terminals.find(t => t.id === activeTerminalId);
    if (active?.term) setTimeout(() => active.term.focus(), 80);
  }
}

async function createTerminal(options = {}) {
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

  // Click to focus this pane
  termEl.addEventListener('mousedown', () => {
    const t = terminals.find(t => t.element === termEl);
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
    group: options.group || null,
    term,
    fitAddon,
    element: termEl,
  };
  terminals.push(termObj);
  activeTerminalId = result.id;
  focusedTerminalId = result.id;

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
  focusedTerminalId = id;
  // Update focus visual on all panes
  terminals.forEach(t => {
    t.element.classList.toggle('focused', t.id === id);
  });
  renderTerminalSidebar();
  // Focus the xterm instance
  const t = terminals.find(t => t.id === id);
  if (t?.term) t.term.focus();
}

// ── Split Terminal ───────────────────────────────────────────
function splitTerminal() {
  if (!activeTerminalId || terminals.length === 0) return;
  const activeTerm = terminals.find(t => t.id === activeTerminalId);
  if (!activeTerm) return;

  // Ensure active terminal has a group (create one if standalone)
  if (!activeTerm.group) {
    const existingGroups = new Set(terminals.filter(t => t.group).map(t => t.group));
    let idx = 1;
    let name = 'Group 1';
    while (existingGroups.has(name)) { idx++; name = `Group ${idx}`; }
    activeTerm.group = name;
  }

  // Add to split view
  if (!splitTerminalIds.includes(activeTerminalId)) {
    splitTerminalIds = [activeTerminalId];
  }

  createTerminal({ cwd: activeTerm.cwd, group: activeTerm.group }).then(() => {
    splitTerminalIds.push(activeTerminalId);
    renderTerminalPanes();
  });
}

function renderTerminalPanes() {
  const container = $('#terminalContainer');
  if (!container) return;

  // Clear old layout
  container.querySelectorAll('.terminal-split-divider, .terminal-grid-row, .terminal-grid-divider-h').forEach(h => h.remove());
  container.style.flexDirection = '';
  container.style.flexWrap = '';

  if (splitTerminalIds.length > 1) {
    splitTerminalIds = splitTerminalIds.filter(id => terminals.find(t => t.id === id));

    if (splitTerminalIds.length <= 1) {
      splitTerminalIds = [];
      showSingleTerminal();
      renderTerminalSidebar();
      return;
    }

    // Hide all terminals first
    terminals.forEach(t => {
      t.element.style.display = 'none';
      t.element.style.flex = '';
      t.element.style.width = '';
      t.element.style.height = '';
    });

    const splitTerms = splitTerminalIds.map(id => terminals.find(t => t.id === id)).filter(Boolean);
    const count = splitTerms.length;

    if (count <= 3) {
      // 2-3 terminals: horizontal row with vertical dividers
      container.style.flexDirection = 'row';
      splitTerms.forEach((t, i) => {
        t.element.style.display = '';
        t.element.style.flex = '1';
        container.appendChild(t.element);
        if (i < count - 1) {
          const divider = document.createElement('div');
          divider.className = 'terminal-split-divider';
          container.insertBefore(divider, null);
          container.appendChild(t.element);
          // Re-append in order
        }
      });
      // Re-do properly: clear and rebuild
      const frag = document.createDocumentFragment();
      splitTerms.forEach((t, i) => {
        t.element.style.display = '';
        t.element.style.flex = '1';
        t.element.style.width = '';
        t.element.style.height = '';
        frag.appendChild(t.element);
        if (i < count - 1) {
          const divider = document.createElement('div');
          divider.className = 'terminal-split-divider';
          frag.appendChild(divider);
          setupSplitDivider(divider, t, splitTerms[i + 1]);
        }
      });
      container.appendChild(frag);
    } else {
      // 4+ terminals: grid layout (2 columns, N rows)
      container.style.flexDirection = 'column';
      const cols = 2;
      const rows = Math.ceil(count / cols);

      for (let r = 0; r < rows; r++) {
        if (r > 0) {
          const hDivider = document.createElement('div');
          hDivider.className = 'terminal-grid-divider-h';
          container.appendChild(hDivider);
        }

        const row = document.createElement('div');
        row.className = 'terminal-grid-row';
        container.appendChild(row);

        for (let c = 0; c < cols; c++) {
          const idx = r * cols + c;
          if (idx >= count) break;

          if (c > 0) {
            const vDivider = document.createElement('div');
            vDivider.className = 'terminal-split-divider';
            row.appendChild(vDivider);
            setupSplitDivider(vDivider, splitTerms[idx - 1], splitTerms[idx]);
          }

          const t = splitTerms[idx];
          t.element.style.display = '';
          t.element.style.flex = '1';
          t.element.style.width = '';
          t.element.style.height = '';
          row.appendChild(t.element);
        }
      }

      // Setup horizontal divider resize
      container.querySelectorAll('.terminal-grid-divider-h').forEach((hDiv, i) => {
        const topRow = container.querySelectorAll('.terminal-grid-row')[i];
        const bottomRow = container.querySelectorAll('.terminal-grid-row')[i + 1];
        if (topRow && bottomRow) {
          setupGridHDivider(hDiv, topRow, bottomRow);
        }
      });
    }

    fitAllVisibleTerminals();
  } else {
    showSingleTerminal();
  }

  renderTerminalSidebar();
}

function setupGridHDivider(divider, topRow, bottomRow) {
  divider.addEventListener('mousedown', (e) => {
    e.preventDefault();
    document.body.classList.add('resizing');
    divider.classList.add('active');
    const startY = e.clientY;
    const topH = topRow.offsetHeight;
    const bottomH = bottomRow.offsetHeight;
    const totalH = topH + bottomH;

    const onMove = (ev) => {
      const delta = ev.clientY - startY;
      const newTop = Math.max(60, Math.min(topH + delta, totalH - 60));
      const newBottom = totalH - newTop;
      topRow.style.flex = 'none';
      bottomRow.style.flex = 'none';
      topRow.style.height = newTop + 'px';
      bottomRow.style.height = newBottom + 'px';
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
    topRow.style.flex = '1';
    bottomRow.style.flex = '1';
    topRow.style.height = '';
    bottomRow.style.height = '';
    fitAllVisibleTerminals();
  });
}

function showSingleTerminal() {
  const container = $('#terminalContainer');
  if (!container) return;
  container.querySelectorAll('.terminal-split-divider').forEach(h => h.remove());

  terminals.forEach(t => {
    const visible = t.id === activeTerminalId;
    t.element.style.display = visible ? '' : 'none';
    t.element.style.flex = '1';
    t.element.style.width = '';
  });

  const active = terminals.find(t => t.id === activeTerminalId);
  if (active) {
    focusedTerminalId = active.id;
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

  // Double-click to reset equal sizes
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
  updateTerminalNameSelector();
  renderTerminalSidebar();
  renderTerminalPanes();
}

function updateTerminalNameSelector() {
  const nameText = $('#terminalNameText');
  if (!nameText) return;
  const active = terminals.find(t => t.id === (focusedTerminalId || activeTerminalId));
  nameText.textContent = active ? active.name : 'Terminal';
}

// Terminal name selector click — show native menu to pick terminal
function _initTerminalNameSelector() {
  const btn = $('#terminalNameSelector');
  if (!btn) return;
  btn.addEventListener('click', async () => {
    if (terminals.length === 0) return;
    const menuItems = terminals.map(t => ({
      label: `${t.id === activeTerminalId ? '● ' : '  '}${t.name}`,
      action: t.id,
    }));
    const action = await showNativeContextMenu(menuItems);
    if (action) {
      const t = terminals.find(x => x.id === action);
      if (t) {
        if (splitTerminalIds.includes(action)) {
          setFocusedTerminal(action);
        } else {
          activeTerminalId = action;
          splitTerminalIds = [];
          renderTerminalUI();
          showActiveTerminal();
        }
      }
    }
  });
}

function renderTerminalSidebar() {
  const container = $('#terminalSidebarList');
  if (!container) return;

  // Separate standalone terminals (no group) from grouped ones
  const groups = new Map();
  const standalone = [];
  terminals.forEach(t => {
    if (t.group) {
      if (!groups.has(t.group)) groups.set(t.group, []);
      groups.get(t.group).push(t);
    } else {
      standalone.push(t);
    }
  });

  const termIcon = '<svg class="terminal-sidebar-icon" viewBox="0 0 16 16" fill="currentColor"><path fill-rule="evenodd" d="M1 3.5A1.5 1.5 0 012.5 2h11A1.5 1.5 0 0115 3.5v9a1.5 1.5 0 01-1.5 1.5h-11A1.5 1.5 0 011 12.5v-9zM3.293 5.293a1 1 0 011.414 0L6.5 7.086l-1.793 1.793a1 1 0 11-1.414-1.414L4.586 6.5 3.293 5.207a1 1 0 010-.914zM8 8a.75.75 0 000 1.5h2a.75.75 0 000-1.5H8z"/></svg>';
  // No close button in sidebar — use trash icon in header toolbar

  let html = '';

  // Render groups with headers and tree connectors
  for (const [groupName, groupTerms] of groups) {
    const isGroupActive = splitTerminalIds.length > 1 && groupTerms.every(t => splitTerminalIds.includes(t.id));
    html += `<div class="terminal-sidebar-group" data-group="${esc(groupName)}">`;
    html += `<div class="terminal-sidebar-group-header ${isGroupActive ? 'active' : ''}" data-group="${esc(groupName)}">
      <svg class="terminal-sidebar-icon" viewBox="0 0 16 16" fill="currentColor" width="12" height="12"><path d="M1.5 1h5l.5.5V4h6.5l.5.5v10l-.5.5h-12l-.5-.5v-13l.5-.5zM2 14h12V5H7V2H2v12z"/></svg>
      <span class="terminal-sidebar-group-name">${esc(groupName)}</span>
      <span class="terminal-sidebar-group-count">${groupTerms.length}</span>
    </div>`;
    html += groupTerms.map((t, i) => {
      let connector = '';
      if (i === groupTerms.length - 1) connector = '<span class="terminal-sidebar-connector">└</span>';
      else connector = '<span class="terminal-sidebar-connector">├</span>';
      const isActive = isGroupActive || t.id === activeTerminalId;
      const isFocused = t.id === focusedTerminalId;
      return `<button class="terminal-sidebar-item grouped ${isActive ? 'active' : ''} ${isFocused ? 'focused' : ''}" data-term-id="${esc(t.id)}">
        ${connector}${termIcon}
        <span class="terminal-sidebar-name">${esc(t.name)}</span>
      </button>`;
    }).join('');
    html += '</div>';
  }

  // Render standalone terminals (no connectors, no group)
  standalone.forEach(t => {
    html += `<button class="terminal-sidebar-item ${t.id === activeTerminalId ? 'active' : ''} ${t.id === focusedTerminalId ? 'focused' : ''}" data-term-id="${esc(t.id)}">
      ${termIcon}
      <span class="terminal-sidebar-name">${esc(t.name)}</span>
    </button>`;
  });
  container.innerHTML = html;

  // Click on group header — single click: show split, double click: rename
  container.querySelectorAll('.terminal-sidebar-group-header').forEach(header => {
    let clickTimer = null;

    header.addEventListener('click', (e) => {
      if (clickTimer) { clearTimeout(clickTimer); clickTimer = null; return; }
      clickTimer = setTimeout(() => {
        clickTimer = null;
        const groupName = header.dataset.group;
        const groupTerms = terminals.filter(t => t.group === groupName);
        if (groupTerms.length === 0) return;
        splitTerminalIds = groupTerms.map(t => t.id);
        activeTerminalId = groupTerms[0].id;
        focusedTerminalId = groupTerms[0].id;
        renderTerminalPanes();
        renderTerminalSidebar();
        updateTerminalNameSelector();
      }, 250);
    });

    header.addEventListener('dblclick', (e) => {
      if (clickTimer) { clearTimeout(clickTimer); clickTimer = null; }
      const groupName = header.dataset.group;
      const nameEl = header.querySelector('.terminal-sidebar-group-name');
      if (!nameEl) return;
      const input = document.createElement('input');
      input.className = 'terminal-sidebar-rename';
      input.value = groupName;
      nameEl.replaceWith(input);
      input.focus();
      input.select();
      const finish = () => {
        const val = input.value.trim();
        if (val && val !== groupName) {
          terminals.forEach(t => { if (t.group === groupName) t.group = val; });
        }
        renderTerminalSidebar();
      };
      input.addEventListener('blur', finish);
      input.addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter') input.blur();
        if (ev.key === 'Escape') { input.value = groupName; input.blur(); }
      });
    });
  });

  container.querySelectorAll('.terminal-sidebar-item').forEach(item => {
    item.addEventListener('click', (e) => {
      if (e.target.closest('.terminal-sidebar-close')) return;
      const id = item.dataset.termId;
      if (splitTerminalIds.includes(id)) {
        setFocusedTerminal(id);
        return;
      }
      activeTerminalId = id;
      splitTerminalIds = [];
      renderTerminalUI();
      showSingleTerminal();
    });
    item.addEventListener('dblclick', (e) => {
      if (e.target.closest('.terminal-sidebar-close')) return;
      const id = item.dataset.termId;
      const t = terminals.find(x => x.id === id);
      if (!t) return;
      const nameEl = item.querySelector('.terminal-sidebar-name');
      const input = document.createElement('input');
      input.className = 'terminal-sidebar-rename';
      input.value = t.name;
      nameEl.replaceWith(input);
      input.focus();
      input.select();
      const finish = () => {
        const val = input.value.trim();
        if (val) t.name = val;
        updateTerminalNameSelector();
        renderTerminalSidebar();
      };
      input.addEventListener('blur', finish);
      input.addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter') input.blur();
        if (ev.key === 'Escape') { input.value = t.name; input.blur(); }
      });
    });
  });

  // Right-click on terminal sidebar items for grouping/rename
  container.querySelectorAll('.terminal-sidebar-item').forEach(item => {
    item.addEventListener('contextmenu', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      const id = item.dataset.termId;
      const t = terminals.find(x => x.id === id);
      if (!t) return;
      const existingGroups = [...new Set(terminals.filter(x => x.group).map(x => x.group))];
      const menuItems = [
        { label: 'Rename', action: 'rename' },
        { type: 'separator' },
        { label: 'New Group...', action: 'new-group' },
      ];
      if (t.group) {
        menuItems.push({ label: 'Remove from Group', action: 'ungroup' });
      }
      existingGroups.forEach(g => {
        if (g !== t.group) menuItems.push({ label: `Move to "${g}"`, action: `move:${g}` });
      });
      const action = await showNativeContextMenu(menuItems);
      if (action === 'rename') item.dispatchEvent(new MouseEvent('dblclick'));
      else if (action === 'new-group') {
        const existingGroups = new Set(terminals.filter(x => x.group).map(x => x.group));
        let idx = 1;
        let name = 'Group 1';
        while (existingGroups.has(name)) { idx++; name = `Group ${idx}`; }
        t.group = name;
        renderTerminalSidebar();
      } else if (action === 'ungroup') {
        t.group = null;
        renderTerminalSidebar();
      } else if (action?.startsWith('move:')) {
        t.group = action.slice(5);
        renderTerminalSidebar();
      }
    });
  });

  // ── Drag-and-drop grouping ──
  container.querySelectorAll('.terminal-sidebar-item').forEach(item => {
    item.setAttribute('draggable', 'true');

    item.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/plain', item.dataset.termId);
      e.dataTransfer.effectAllowed = 'move';
      item.classList.add('dragging');
    });

    item.addEventListener('dragend', () => {
      item.classList.remove('dragging');
      container.querySelectorAll('.drag-over, .drag-over-group').forEach(el => {
        el.classList.remove('drag-over', 'drag-over-group');
      });
    });

    item.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      item.classList.add('drag-over');
    });

    item.addEventListener('dragleave', () => {
      item.classList.remove('drag-over');
    });

    item.addEventListener('drop', (e) => {
      e.preventDefault();
      item.classList.remove('drag-over');
      const draggedId = e.dataTransfer.getData('text/plain');
      const targetId = item.dataset.termId;
      if (draggedId === targetId) return;

      const dragged = terminals.find(x => x.id === draggedId);
      const target = terminals.find(x => x.id === targetId);
      if (!dragged || !target) return;

      // Move dragged terminal into target's group
      dragged.group = target.group;
      renderTerminalSidebar();
    });
  });

  // Allow dropping on group headers to move into that group
  container.querySelectorAll('.terminal-sidebar-group').forEach(groupEl => {
    groupEl.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      if (!e.target.closest('.terminal-sidebar-item')) {
        groupEl.classList.add('drag-over-group');
      }
    });

    groupEl.addEventListener('dragleave', (e) => {
      if (!groupEl.contains(e.relatedTarget)) {
        groupEl.classList.remove('drag-over-group');
      }
    });

    groupEl.addEventListener('drop', (e) => {
      e.preventDefault();
      groupEl.classList.remove('drag-over-group');
      if (e.target.closest('.terminal-sidebar-item')) return; // handled by item drop
      const draggedId = e.dataTransfer.getData('text/plain');
      const dragged = terminals.find(x => x.id === draggedId);
      if (!dragged) return;
      dragged.group = groupEl.dataset.group;
      renderTerminalSidebar();
    });
  });
}

function showActiveTerminal() {
  if (splitTerminalIds.length > 1) {
    renderTerminalPanes();
    return;
  }
  showSingleTerminal();
  renderTerminalSidebar();
}

async function duplicateTerminal() {
  const active = terminals.find(t => t.id === activeTerminalId);
  if (!active) return createTerminal();
  createTerminal({ cwd: active.cwd });
}

async function killActiveTerminal() {
  const id = focusedTerminalId || activeTerminalId;
  if (!id) return;
  killTerminal(id);
}

async function killTerminal(id) {
  const term = terminals.find(t => t.id === id);
  if (term) {
    term.term.dispose();
    term.element.remove();
    await window.skillbox.terminalKill(id);
    terminals = terminals.filter(t => t.id !== id);
    splitTerminalIds = splitTerminalIds.filter(sid => sid !== id);
    if (activeTerminalId === id) {
      activeTerminalId = splitTerminalIds[0] || terminals[0]?.id || null;
    }
    if (focusedTerminalId === id) {
      focusedTerminalId = activeTerminalId;
    }
  }
  if (terminals.length === 0) {
    setTerminalPanel(false);
    return;
  }
  renderTerminalUI();
  showActiveTerminal();
}

// ── Counts & Misc ────────────────────────────────────────────
function updateCounts() {
  const countEl = $('#navProjectCount');
  if (countEl) {
    countEl.textContent = projects.length;
    countEl.style.display = projects.length > 0 ? '' : 'none';
  }
  const subtitle = $('#skillsSubtitle');
  if (subtitle) {
    const cats = [...new Set((registry.skills || []).map(s => s.category))];
    subtitle.textContent = `${(registry.skills || []).length} skills in ${cats.length} categories`;
  }
}

// ── Helpers ──────────────────────────────────────────────────
function esc(s) {
  if (s == null) return '';
  const div = document.createElement('div');
  div.textContent = String(s);
  return div.innerHTML;
}

function toast(msg) {
  const t = $('#toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._timeout);
  t._timeout = setTimeout(() => t.classList.remove('show'), 2500);
}

function simpleMarkdown(md) {
  return md
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/^\* (.+)$/gm, '<li>$1</li>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>[\s\S]*?<\/li>)/g, '<ul>$1</ul>')
    .replace(/<\/ul>\s*<ul>/g, '')
    .replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/^(?!<[huplo])(.+)$/gm, '<p>$1</p>')
    .replace(/<p><\/p>/g, '');
}

// ══════════════════════════════════════════════════════════════
//  SETTINGS (VS Code-style JSON editor)
// ══════════════════════════════════════════════════════════════
let _settingsOriginal = '';
let _settingsFilter = 'all';

async function renderSettings() {
  const settings = await window.skillbox.getSettings();
  const editor = $('#settingsJsonEditor');
  if (!editor) return;

  const filtered = _settingsFilter === 'all'
    ? settings
    : Object.fromEntries(Object.entries(settings).filter(([k]) => k.startsWith(_settingsFilter + '.')));

  const json = JSON.stringify(filtered, null, 2);
  editor.value = json;
  _settingsOriginal = json;
  $('#settingsModified').style.display = 'none';

  // Category buttons
  $$('.settings-cat').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.cat === _settingsFilter);
    btn.onclick = () => {
      _settingsFilter = btn.dataset.cat;
      renderSettings();
    };
  });
}

function initSettingsEvents() {
  const editor = $('#settingsJsonEditor');
  if (!editor) return;

  // Track modifications
  editor.addEventListener('input', () => {
    const modified = editor.value !== _settingsOriginal;
    $('#settingsModified').style.display = modified ? '' : 'none';
  });

  // Tab inserts spaces
  editor.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const start = editor.selectionStart;
      editor.value = editor.value.substring(0, start) + '  ' + editor.value.substring(editor.selectionEnd);
      editor.selectionStart = editor.selectionEnd = start + 2;
      editor.dispatchEvent(new Event('input'));
    }
    // Ctrl+S to save
    if ((e.metaKey || e.ctrlKey) && e.key === 's' && activeView === 'settings') {
      e.preventDefault();
      saveSettings();
    }
  });

  $('#btnSaveSettings')?.addEventListener('click', saveSettings);

  $('#btnResetSettings')?.addEventListener('click', async () => {
    const defaults = await window.skillbox.getDefaultSettings();
    await window.skillbox.saveSettings(defaults);
    toast('Settings reset to defaults', 'success');
    renderSettings();
    applySettings(defaults);
  });

  $('#btnOpenSettingsFile')?.addEventListener('click', () => {
    window.skillbox.openExternal('file://' + '');
  });

  // Radix theme selectors
  const modeSelect = $('#themeModeSelect');
  const graySelect = $('#themeGraySelect');
  const accentPicker = $('#accentPicker');

  if (modeSelect) {
    window.skillbox.getSettings().then(s => {
      modeSelect.value = s['workbench.mode'] || 'dark';
      if (graySelect) graySelect.value = s['workbench.gray'] || 'slate';
      // Set active accent swatch
      const accent = s['workbench.accent'] || 'blue';
      accentPicker?.querySelectorAll('.accent-swatch').forEach(sw => {
        sw.classList.toggle('active', sw.dataset.accent === accent);
      });
    });

    const applyTheme = async () => {
      const root = document.documentElement;
      const settings = await window.skillbox.getSettings();
      const mode = modeSelect.value;
      const gray = graySelect?.value || 'slate';
      const accent = accentPicker?.querySelector('.accent-swatch.active')?.dataset.accent || 'blue';

      root.setAttribute('data-mode', mode);
      root.setAttribute('data-gray', gray);
      root.setAttribute('data-accent', accent);

      settings['workbench.mode'] = mode;
      settings['workbench.gray'] = gray;
      settings['workbench.accent'] = accent;
      await window.skillbox.saveSettings(settings);
      renderSettings();
      toast(`Theme updated`, 'success');
    };

    modeSelect.addEventListener('change', applyTheme);
    if (graySelect) graySelect.addEventListener('change', applyTheme);

    accentPicker?.addEventListener('click', (e) => {
      const swatch = e.target.closest('.accent-swatch');
      if (!swatch) return;
      accentPicker.querySelectorAll('.accent-swatch').forEach(s => s.classList.remove('active'));
      swatch.classList.add('active');
      applyTheme();
    });
  }
}

async function saveSettings() {
  const editor = $('#settingsJsonEditor');
  try {
    let parsed;
    if (_settingsFilter === 'all') {
      parsed = JSON.parse(editor.value);
    } else {
      // Merge filtered changes back into full settings
      const full = await window.skillbox.getSettings();
      const filtered = JSON.parse(editor.value);
      // Remove old keys for this category
      for (const key of Object.keys(full)) {
        if (key.startsWith(_settingsFilter + '.')) delete full[key];
      }
      parsed = { ...full, ...filtered };
    }
    const result = await window.skillbox.saveSettings(parsed);
    toast('Settings saved', 'success');
    _settingsOriginal = editor.value;
    $('#settingsModified').style.display = 'none';
    applySettings(result);
  } catch (e) {
    toast('Invalid JSON: ' + e.message, 'error');
  }
}

function applySettings(settings) {
  // Cache settings for Monaco and other uses
  window._cachedSettings = settings;

  // Apply terminal settings to existing terminals
  terminals.forEach(t => {
    if (t.term) {
      t.term.options.fontFamily = settings['terminal.fontFamily'];
      t.term.options.fontSize = settings['terminal.fontSize'];
      t.term.options.lineHeight = settings['terminal.lineHeight'];
      t.term.options.cursorBlink = settings['terminal.cursorBlink'];
      t.term.options.scrollback = settings['terminal.scrollback'];
      if (t.fitAddon) try { t.fitAddon.fit(); } catch {}
    }
  });

  // Apply Monaco editor settings
  if (_monacoEditor) {
    _monacoEditor.updateOptions({
      fontFamily: settings['editor.fontFamily'] || "'SF Mono', monospace",
      fontSize: settings['editor.fontSize'] || 14,
      tabSize: settings['editor.tabSize'] || 2,
      lineHeight: settings['editor.lineHeight'] || 22,
      minimap: { enabled: settings['editor.minimap'] !== false },
      wordWrap: settings['editor.wordWrap'] || 'off',
      lineNumbers: settings['editor.lineNumbers'] || 'on',
      bracketPairColorization: { enabled: settings['editor.bracketPairColorization'] !== false },
      fontLigatures: settings['editor.fontLigatures'] !== false,
      renderWhitespace: settings['editor.renderWhitespace'] || 'selection',
      cursorBlinking: settings['editor.cursorBlinking'] || 'smooth',
      smoothScrolling: settings['editor.smoothScrolling'] !== false,
    });
  }

  // Apply CSS custom properties
  const root = document.documentElement;
  if (settings['workbench.primaryColor']) {
    root.style.setProperty('--primary', settings['workbench.primaryColor']);
  }
  // Sync right panel font size from editor settings
  const rpFontSize = (settings['editor.fontSize'] || 14) - 2;
  root.style.setProperty('--rp-font-size', rpFontSize + 'px');
  root.style.setProperty('--font-mono', settings['editor.fontFamily'] || "'SF Mono', monospace");

  // Apply Radix theme
  root.setAttribute('data-mode', settings['workbench.mode'] || 'dark');
  root.setAttribute('data-gray', settings['workbench.gray'] || 'slate');
  root.setAttribute('data-accent', settings['workbench.accent'] || 'blue');
}

// ══════════════════════════════════════════════════════════════
//  EXTENSIONS
// ══════════════════════════════════════════════════════════════
let installedExtensions = [];
let _extTab = 'installed';

async function renderExtensions() {
  installedExtensions = await window.skillbox.getInstalledExtensions();
  const list = $('#extensionsList');
  const empty = $('#extensionsEmpty');
  const count = $('#extensionsCount');
  if (!list) return;

  count.textContent = `${installedExtensions.length} installed`;
  $$('.ext-tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === _extTab));

  const search = ($('#extensionsSearch')?.value || '').toLowerCase();
  list.querySelectorAll('.ext-card').forEach(c => c.remove());

  if (_extTab === 'installed') {
    const filtered = search
      ? installedExtensions.filter(e => e.name.toLowerCase().includes(search) || e.description.toLowerCase().includes(search))
      : installedExtensions;

    if (filtered.length === 0) {
      empty.style.display = '';
      empty.querySelector('p').textContent = search ? 'No matching extensions' : 'No extensions installed';
      return;
    }
    empty.style.display = 'none';

    filtered.forEach(ext => {
      const card = document.createElement('div');
      card.className = 'ext-card';
      card.dataset.extId = ext.id;
      card.innerHTML = `
        <div class="ext-icon">${ext.icon ? `<img src="file://${ext.icon}" width="48" height="48" />` : '🧩'}</div>
        <div class="ext-info">
          <div><span class="ext-name">${esc(ext.name)}</span><span class="ext-publisher">${esc(ext.publisher)}</span></div>
          <div class="ext-desc">${esc(ext.description)}</div>
          <div class="ext-meta">
            <span>v${esc(ext.version)}</span>
            ${ext.categories.length ? `<span>${ext.categories.map(esc).join(', ')}</span>` : ''}
          </div>
        </div>
        <div class="ext-actions">
          <button class="ext-btn-uninstall" data-ext-id="${esc(ext.id)}">Uninstall</button>
        </div>
      `;
      list.appendChild(card);
    });

    list.querySelectorAll('.ext-btn-uninstall').forEach(btn => {
      btn.addEventListener('click', async () => {
        const result = await window.skillbox.uninstallExtension(btn.dataset.extId);
        if (result.success) { toast('Extension uninstalled', 'success'); renderExtensions(); }
        else toast(result.error, 'error');
      });
    });

  } else {
    // Available tab — VS Code / Cursor extensions
    let available = [];
    try { available = await window.skillbox.listVscodeExtensions(); } catch {}

    const filtered = search
      ? available.filter(e => e.name.toLowerCase().includes(search) || e.id.toLowerCase().includes(search))
      : available;

    if (filtered.length === 0) {
      empty.style.display = '';
      empty.querySelector('p').textContent = search ? 'No matching extensions' : 'No VS Code or Cursor extensions detected';
      return;
    }
    empty.style.display = 'none';

    filtered.forEach(ext => {
      const card = document.createElement('div');
      card.className = 'ext-card';
      card.innerHTML = `
        <div class="ext-icon">🧩</div>
        <div class="ext-info">
          <div><span class="ext-name">${esc(ext.name)}</span><span class="ext-publisher">${esc(ext.publisher)}</span></div>
          <div class="ext-desc">${esc(ext.description)}</div>
          <div class="ext-meta">
            <span>v${esc(ext.version)}</span>
            <span>from ${esc(ext.source)}</span>
          </div>
        </div>
        <div class="ext-actions">
          ${ext.installed
            ? '<span style="font-size:11px;color:var(--muted-foreground)">Installed</span>'
            : `<button class="sb-btn-primary" style="padding:4px 12px;font-size:11px" data-ext-path="${esc(ext.path)}">Install</button>`
          }
        </div>
      `;
      list.appendChild(card);
    });

    list.querySelectorAll('[data-ext-path]').forEach(btn => {
      btn.addEventListener('click', async () => {
        btn.disabled = true;
        btn.textContent = 'Installing...';
        const result = await window.skillbox.installExtensionFromDir(btn.dataset.extPath);
        if (result.success) { toast(`Installed: ${result.name}`, 'success'); renderExtensions(); }
        else { toast(result.error, 'error'); btn.disabled = false; btn.textContent = 'Install'; }
      });
    });
  }
}

function initExtensionsEvents() {
  $('#btnInstallVsix')?.addEventListener('click', async () => {
    const vsixPath = await window.skillbox.browseVsix();
    if (!vsixPath) return;
    const result = await window.skillbox.installExtensionVsix(vsixPath);
    if (result.success) { toast(`Installed: ${result.name}`, 'success'); renderExtensions(); }
    else toast(result.error || 'Install failed', 'error');
  });

  $('#btnOpenExtDir')?.addEventListener('click', () => window.skillbox.openExtensionsDir());
  $('#extensionsSearch')?.addEventListener('input', renderExtensions);

  // Tab switching
  $$('.ext-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      _extTab = btn.dataset.tab;
      renderExtensions();
    });
  });
}

// ══════════════════════════════════════════════════════════════
//  EXTENSION DETAIL & WEBVIEW
// ══════════════════════════════════════════════════════════════
let _activeExtId = null;
let _activeExtDetail = null;
let _activatedExtensions = new Set();
let _extWebviewIframe = null;

async function openExtensionDetail(extId) {
  _activeExtId = extId;
  _activeExtDetail = await window.skillbox.getExtensionDetail(extId);
  switchView('extensionDetail');
}

async function renderExtensionDetail() {
  const ext = _activeExtDetail;
  if (!ext) return;

  $('#extDetailName').textContent = ext.name;
  $('#extDetailVersion').textContent = `v${ext.version}`;

  const isActive = _activatedExtensions.has(ext.id);
  $('#btnExtActivate').style.display = isActive ? 'none' : '';
  $('#btnExtDeactivate').style.display = isActive ? '' : 'none';
  $('#btnExtOpenWebview').style.display = (isActive && ext.hasWebview) ? '' : 'none';

  const content = $('#extDetailContent');
  content.innerHTML = '';

  // Header with icon
  const header = document.createElement('div');
  header.className = 'ext-detail-header';
  header.innerHTML = `
    <div class="ext-detail-icon">
      ${ext.icon ? `<img src="file://${esc(ext.icon)}" />` : '<span class="ext-detail-icon-placeholder">🧩</span>'}
    </div>
    <div class="ext-detail-meta">
      <h2>${esc(ext.name)}</h2>
      <span class="ext-publisher">${esc(ext.publisher)}</span>
      <div class="ext-desc">${esc(ext.description)}</div>
      <div class="ext-detail-status">
        <span class="status-badge ${isActive ? 'status-active' : 'status-inactive'}">${isActive ? 'Active' : 'Inactive'}</span>
      </div>
    </div>
  `;
  content.appendChild(header);

  // Configuration section
  if (ext.configProperties.length > 0) {
    const section = document.createElement('div');
    section.className = 'ext-detail-section';
    section.innerHTML = `<h3>Configuration (${ext.configProperties.length})</h3>`;
    const list = document.createElement('div');
    list.className = 'ext-config-list';

    for (const prop of ext.configProperties) {
      const item = document.createElement('div');
      item.className = 'ext-config-item';
      let inputHtml = '';
      if (prop.type === 'boolean') {
        inputHtml = `<input type="checkbox" class="ext-config-input" data-key="${esc(prop.key)}" ${prop.default ? 'checked' : ''} />`;
      } else if (prop.enum) {
        inputHtml = `<select class="ext-config-input" data-key="${esc(prop.key)}">${prop.enum.map((v, i) => `<option value="${esc(v)}" ${v === prop.default ? 'selected' : ''}>${esc(v)}${prop.enumDescriptions?.[i] ? ' — ' + esc(prop.enumDescriptions[i]) : ''}</option>`).join('')}</select>`;
      } else if (prop.type === 'array') {
        inputHtml = `<input type="text" class="ext-config-input" data-key="${esc(prop.key)}" value="${esc(JSON.stringify(prop.default || []))}" placeholder="JSON array" />`;
      } else {
        inputHtml = `<input type="text" class="ext-config-input" data-key="${esc(prop.key)}" value="${esc(String(prop.default ?? ''))}" />`;
      }
      item.innerHTML = `
        <div class="ext-config-key">${esc(prop.key)}</div>
        <div class="ext-config-value">
          <div class="ext-config-desc">${esc(prop.description)}</div>
          ${inputHtml}
        </div>
      `;
      list.appendChild(item);
    }
    section.appendChild(list);
    content.appendChild(section);

    // Config change handlers
    list.querySelectorAll('.ext-config-input').forEach(input => {
      const handler = () => {
        const key = input.dataset.key;
        const parts = key.split('.');
        const sectionName = parts[0];
        const propName = parts.slice(1).join('.');
        let value;
        if (input.type === 'checkbox') value = input.checked;
        else if (input.type === 'text' && input.value.startsWith('[')) {
          try { value = JSON.parse(input.value); } catch { value = input.value; }
        } else value = input.value;
        window.skillbox.updateExtensionConfig(_activeExtId, sectionName, propName, value);
      };
      input.addEventListener(input.type === 'checkbox' ? 'change' : 'change', handler);
    });
  }

  // Commands section
  if (ext.commands.length > 0) {
    const section = document.createElement('div');
    section.className = 'ext-detail-section';
    section.innerHTML = `<h3>Commands (${ext.commands.length})</h3>`;
    const list = document.createElement('div');
    list.className = 'ext-cmd-list';
    for (const cmd of ext.commands) {
      const item = document.createElement('div');
      item.className = 'ext-cmd-item';
      item.innerHTML = `<span class="ext-cmd-title">${esc(cmd.title)}</span><span class="ext-cmd-id">${esc(cmd.id)}</span>`;
      item.style.cursor = isActive ? 'pointer' : 'default';
      if (isActive) {
        item.addEventListener('click', () => {
          window.skillbox.executeExtensionCommand(_activeExtId, cmd.id);
          toast(`Executed: ${cmd.title}`, 'info');
        });
      }
      list.appendChild(item);
    }
    section.appendChild(list);
    content.appendChild(section);
  }

  // Keybindings section
  if (ext.keybindings.length > 0) {
    const section = document.createElement('div');
    section.className = 'ext-detail-section';
    section.innerHTML = `<h3>Keybindings</h3>`;
    const list = document.createElement('div');
    list.className = 'ext-cmd-list';
    for (const kb of ext.keybindings) {
      const item = document.createElement('div');
      item.className = 'ext-cmd-item';
      const key = window.skillbox.platform === 'darwin' ? (kb.mac || kb.key) : kb.key;
      item.innerHTML = `<span class="ext-cmd-title"><kbd style="font-size:11px;padding:2px 6px;border-radius:3px;background:var(--surface);border:1px solid var(--border)">${esc(key || '')}</kbd></span><span class="ext-cmd-id">${esc(kb.command)}</span>`;
      list.appendChild(item);
    }
    section.appendChild(list);
    content.appendChild(section);
  }

  // Activation events
  if (ext.activationEvents.length > 0) {
    const section = document.createElement('div');
    section.className = 'ext-detail-section';
    section.innerHTML = `<h3>Activation Events</h3><div style="font-size:12px;color:var(--muted-foreground)">${ext.activationEvents.map(esc).join(', ')}</div>`;
    content.appendChild(section);
  }
}

function initExtensionDetailEvents() {
  $('#btnExtDetailBack')?.addEventListener('click', () => switchView('extensions'));

  $('#btnExtActivate')?.addEventListener('click', async () => {
    if (!_activeExtId) return;
    // Set workspace before activating so extension has project context
    const projectPath = activeProjectPath || (projects.length > 0 ? projects[0].path : null);
    if (projectPath) {
      await window.skillbox.setExtensionWorkspace(projectPath);
    }
    const btn = $('#btnExtActivate');
    btn.textContent = 'Activating...';
    btn.disabled = true;
    const result = await window.skillbox.activateExtension(_activeExtId);
    btn.disabled = false;
    btn.textContent = 'Activate';
    if (result.success) {
      _activatedExtensions.add(_activeExtId);
      toast(`${_activeExtDetail?.name || 'Extension'} activated`, 'success');
      renderExtensionDetail();
      addExtensionToActivityBar(_activeExtId, _activeExtDetail);
    } else {
      toast(`Activation failed: ${result.error}`, 'error');
    }
  });

  $('#btnExtDeactivate')?.addEventListener('click', async () => {
    if (!_activeExtId) return;
    const result = await window.skillbox.deactivateExtension(_activeExtId);
    if (result.success) {
      _activatedExtensions.delete(_activeExtId);
      toast('Extension deactivated', 'success');
      renderExtensionDetail();
      removeExtensionFromActivityBar(_activeExtId);
    } else toast(result.error, 'error');
  });

  $('#btnExtOpenWebview')?.addEventListener('click', () => {
    if (_activeExtDetail?.viewIds?.length) {
      openExtensionWebview(_activeExtId, _activeExtDetail.viewIds[0]);
    }
  });

  // Listen for extension toast messages
  window.skillbox.onExtensionToast?.((data) => {
    toast(data.message, data.type === 'error' ? 'error' : data.type === 'warning' ? 'warning' : 'info');
  });
}

async function openExtensionWebview(extId, viewId) {
  // Set workspace to active project so the extension knows the context
  const projectPath = activeProjectPath || (projects.length > 0 ? projects[0].path : null);
  if (projectPath) {
    if (!activeProjectPath) activeProjectPath = projectPath;
    await window.skillbox.setExtensionWorkspace(projectPath);
  }

  // Resolve webview HTML from the extension
  const result = await window.skillbox.resolveExtensionWebview(extId, viewId);
  if (!result.success) {
    toast(`Failed to open webview: ${result.error}`, 'error');
    return;
  }

  // Switch to webview view
  $$('.view').forEach(v => v.style.display = 'none');
  const viewEl = $('#viewExtensionWebview');
  viewEl.style.display = '';

  const container = $('#extWebviewContainer');
  container.innerHTML = '';

  // Use iframe — the injected acquireVsCodeApi shim uses postMessage for IPC
  const iframe = document.createElement('iframe');
  iframe.src = `file://${result.htmlPath}`;
  iframe.style.cssText = 'width:100%;height:100%;border:none;background:transparent;display:flex;flex:1;';
  iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms allow-popups');

  // Clean up old message listener if any
  if (window._extWebviewMsgHandler) {
    window.removeEventListener('message', window._extWebviewMsgHandler);
  }
  // Listen for messages from the iframe (webview shim posts via postMessage)
  window._extWebviewMsgHandler = function(event) {
    if (event.data?.type === 'webview-message') {
      window.skillbox.extensionWebviewMsg(extId, viewId, event.data.data);
    }
  };
  window.addEventListener('message', window._extWebviewMsgHandler);

  // Forward extension->webview messages into the iframe (replaces previous listener)
  window.skillbox.onExtensionWebviewMessage((data) => {
    if (iframe.contentWindow) {
      iframe.contentWindow.postMessage({ type: 'extension-to-webview', data: data.message }, '*');
    }
  });

  container.appendChild(iframe);
  _extWebviewIframe = iframe;

  // Highlight the extension's activity bar button
  $$('.activity-bar-item[data-view]').forEach(b => b.classList.remove('active'));
  const extBtn = $(`.activity-bar-item[data-ext-id="${extId}"]`);
  if (extBtn) extBtn.classList.add('active');
}

function addExtensionToActivityBar(extId, detail) {
  if (!detail?.hasWebview) return;
  if ($(`.activity-bar-item[data-ext-id="${extId}"]`)) return; // already exists

  const nav = $('.activity-bar-nav');
  if (!nav) return;

  const btn = document.createElement('button');
  btn.className = 'activity-bar-item ext-dynamic';
  btn.dataset.extId = extId;
  btn.title = detail.name;

  if (detail.icon) {
    btn.innerHTML = `<img src="file://${detail.icon}" width="20" height="20" />`;
  } else {
    btn.innerHTML = `<svg viewBox="0 0 20 20" fill="currentColor" width="20" height="20"><path d="M10 3.5a1.5 1.5 0 013 0V4a1 1 0 001 1h1.5a1 1 0 011 1v1.5a1.5 1.5 0 010 3H15a1 1 0 00-1 1V13a1 1 0 01-1 1h-1.5a1.5 1.5 0 01-3 0V13a1 1 0 00-1-1H6a1 1 0 01-1-1v-1.5a1.5 1.5 0 010-3H6a1 1 0 001-1V5a1 1 0 011-1h1.5a1 1 0 001-1v-.5z"/></svg>`;
  }

  btn.addEventListener('click', () => {
    if (detail.viewIds?.length) {
      openExtensionWebview(extId, detail.viewIds[0]);
    }
  });

  // Insert before the separator or at end
  const separator = nav.querySelector('.activity-bar-separator');
  if (separator) {
    nav.insertBefore(btn, separator);
  } else {
    nav.appendChild(btn);
  }
}

function removeExtensionFromActivityBar(extId) {
  const btn = $(`.activity-bar-item[data-ext-id="${extId}"]`);
  if (btn) btn.remove();
}

// Make extension cards clickable for detail view
function _patchExtCards() {
  $$('.ext-card').forEach(card => {
    if (card._detailPatched) return;
    card._detailPatched = true;
    card.style.cursor = 'pointer';
    card.addEventListener('click', (e) => {
      if (e.target.closest('button')) return;
      const extId = card.dataset.extId;
      if (extId) openExtensionDetail(extId);
    });
  });
}

// Patch the original renderExtensions to make cards clickable
const _origRenderExtensions = renderExtensions;
renderExtensions = async function() {
  await _origRenderExtensions();
  _patchExtCards();
};

// ══════════════════════════════════════════════════════════════
//  MONACO EDITOR
// ══════════════════════════════════════════════════════════════
let _monacoReady = false;
let _monacoEditor = null;
const _openTabs = []; // { filePath, model, modified }
let _activeTabIndex = -1;

function _initMonaco() {
  if (_monacoReady) return Promise.resolve();
  return new Promise((resolve) => {
    require.config({ paths: { vs: '../node_modules/monaco-editor/min/vs' } });
    require(['vs/editor/editor.main'], function () {
      // Define Skillbox dark theme
      monaco.editor.defineTheme('skillbox-dark', {
        base: 'vs-dark',
        inherit: true,
        rules: [
          { token: 'comment', foreground: '6b6560', fontStyle: 'italic' },
          { token: 'keyword', foreground: '93c5fd' },
          { token: 'string', foreground: 'fb923c' },
          { token: 'number', foreground: '34d399' },
          { token: 'type', foreground: 'fbbf24' },
          { token: 'function', foreground: '60a5fa' },
          { token: 'variable', foreground: '7dd3fc' },
        ],
        colors: {
          'editor.background': '#0f1117',
          'editor.foreground': '#e0e0e5',
          'editor.lineHighlightBackground': '#ffffff08',
          'editor.selectionBackground': '#3b82f644',
          'editor.inactiveSelectionBackground': '#3b82f622',
          'editorCursor.foreground': '#3b82f6',
          'editorLineNumber.foreground': '#3b3f4a',
          'editorLineNumber.activeForeground': '#9a9da6',
          'editorIndentGuide.background': '#252830',
          'editorIndentGuide.activeBackground': '#3b3f4a',
          'editorWidget.background': '#181a20',
          'editorWidget.border': '#252830',
          'editorSuggestWidget.background': '#181a20',
          'editorSuggestWidget.border': '#252830',
          'editorSuggestWidget.selectedBackground': '#3b82f633',
          'editorHoverWidget.background': '#181a20',
          'editorHoverWidget.border': '#252830',
          'input.background': '#181a20',
          'input.border': '#252830',
          'input.foreground': '#e0e0e5',
          'scrollbar.shadow': '#00000044',
          'scrollbarSlider.background': '#ffffff15',
          'scrollbarSlider.hoverBackground': '#ffffff25',
          'scrollbarSlider.activeBackground': '#ffffff35',
          'list.hoverBackground': '#ffffff0a',
          'list.activeSelectionBackground': '#3b82f633',
          'minimap.background': '#0f1117',
          'minimapSlider.background': '#ffffff10',
        },
      });
      monaco.editor.setTheme('skillbox-dark');
      _monacoReady = true;
      resolve();
    });
  });
}

function _getLang(filePath) {
  const ext = filePath.split('.').pop().toLowerCase();
  const map = {
    js: 'javascript', jsx: 'javascript', mjs: 'javascript', cjs: 'javascript',
    ts: 'typescript', tsx: 'typescript',
    py: 'python', rb: 'ruby', rs: 'rust', go: 'go', java: 'java',
    c: 'c', cpp: 'cpp', h: 'c', hpp: 'cpp',
    cs: 'csharp', swift: 'swift', kt: 'kotlin',
    html: 'html', htm: 'html', vue: 'html', svelte: 'html',
    css: 'css', scss: 'scss', less: 'less',
    json: 'json', yaml: 'yaml', yml: 'yaml', toml: 'toml',
    xml: 'xml', svg: 'xml',
    md: 'markdown', mdx: 'markdown',
    sh: 'shell', bash: 'shell', zsh: 'shell',
    sql: 'sql', graphql: 'graphql',
    dockerfile: 'dockerfile',
    php: 'php', r: 'r', lua: 'lua', dart: 'dart',
  };
  return map[ext] || 'plaintext';
}

async function openFileInEditor(filePath) {
  await _initMonaco();

  // Check if already open
  const existing = _openTabs.findIndex(t => t.filePath === filePath);
  if (existing >= 0) {
    _switchTab(existing);
    return;
  }

  // Read file content
  let content;
  try {
    content = await window.skillbox.readFile(filePath);
  } catch (e) {
    toast(`Cannot open file: ${e.message}`, 'error');
    return;
  }

  // Create Monaco model
  const lang = _getLang(filePath);
  const uri = monaco.Uri.file(filePath);
  let model = monaco.editor.getModel(uri);
  if (model) {
    model.setValue(content);
  } else {
    model = monaco.editor.createModel(content, lang, uri);
  }

  const tab = { filePath, model, modified: false, savedVersion: model.getAlternativeVersionId(), _ignoreNextChange: false };
  _openTabs.push(tab);

  // Track modifications
  model.onDidChangeContent(() => {
    if (tab._ignoreNextChange) { tab._ignoreNextChange = false; return; }
    tab.modified = model.getAlternativeVersionId() !== tab.savedVersion;
    _renderTabs();
  });

  // Watch file for external changes (e.g., from Claude Code editing it)
  window.skillbox.watchFile(filePath);

  _switchTab(_openTabs.length - 1);
  // Switch to editor view
  switchView('editor');
}

function _switchTab(index) {
  if (index < 0 || index >= _openTabs.length) return;
  _activeTabIndex = index;
  const tab = _openTabs[index];

  if (!_monacoEditor) {
    // Read user settings for editor config
    const s = window._cachedSettings || {};
    _monacoEditor = monaco.editor.create($('#editorContainer'), {
      model: tab.model,
      theme: 'skillbox-dark',
      fontSize: s['editor.fontSize'] || 14,
      fontFamily: s['editor.fontFamily'] || "'SF Mono', 'Fira Code', 'Cascadia Code', 'JetBrains Mono', monospace",
      fontLigatures: s['editor.fontLigatures'] !== false,
      lineHeight: s['editor.lineHeight'] || 22,
      tabSize: s['editor.tabSize'] || 2,
      wordWrap: s['editor.wordWrap'] || 'off',
      lineNumbers: s['editor.lineNumbers'] || 'on',
      renderWhitespace: s['editor.renderWhitespace'] || 'selection',
      cursorBlinking: s['editor.cursorBlinking'] || 'smooth',
      smoothScrolling: s['editor.smoothScrolling'] !== false,
      bracketPairColorization: { enabled: s['editor.bracketPairColorization'] !== false },
      minimap: { enabled: s['editor.minimap'] !== false, size: 'proportional', maxColumn: 80 },
      padding: { top: 12, bottom: 12 },
      scrollbar: { verticalScrollbarSize: 8, horizontalScrollbarSize: 8 },
      cursorSmoothCaretAnimation: 'on',
      renderLineHighlight: 'all',
      roundedSelection: true,
      automaticLayout: true,
    });

    // Ctrl/Cmd+S to save
    _monacoEditor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      _saveCurrentTab();
    });
  } else {
    _monacoEditor.setModel(tab.model);
  }

  _renderTabs();
}

function _renderTabs() {
  const bar = $('#editorTabsBar');
  bar.innerHTML = '';
  _openTabs.forEach((tab, i) => {
    const name = tab.filePath.split('/').pop();
    const el = document.createElement('div');
    el.className = 'editor-tab' + (i === _activeTabIndex ? ' active' : '');
    el.innerHTML = `<span>${name}</span>${tab.modified ? '<span class="tab-modified">●</span>' : ''}<span class="tab-close">×</span>`;
    el.addEventListener('click', (e) => {
      if (e.target.classList.contains('tab-close')) {
        _closeTab(i);
      } else {
        _switchTab(i);
      }
    });
    bar.appendChild(el);
  });
}

async function _saveCurrentTab() {
  const tab = _openTabs[_activeTabIndex];
  if (!tab) return;
  try {
    await window.skillbox.writeFile(tab.filePath, tab.model.getValue());
    tab.savedVersion = tab.model.getAlternativeVersionId();
    tab.modified = false;
    _renderTabs();
    toast('File saved', 'info');
  } catch (e) {
    toast(`Save failed: ${e.message}`, 'error');
  }
}

function _closeTab(index) {
  const tab = _openTabs[index];
  if (tab.modified) {
    if (!confirm(`${tab.filePath.split('/').pop()} has unsaved changes. Close anyway?`)) return;
  }
  window.skillbox.unwatchFile(tab.filePath);
  tab.model.dispose();
  _openTabs.splice(index, 1);

  if (_openTabs.length === 0) {
    if (_monacoEditor) { _monacoEditor.dispose(); _monacoEditor = null; }
    _activeTabIndex = -1;
    switchView('dashboard');
    return;
  }

  if (_activeTabIndex >= _openTabs.length) _activeTabIndex = _openTabs.length - 1;
  _switchTab(_activeTabIndex);
}

function _layoutMonacoEditor() {
  if (_monacoEditor) _monacoEditor.layout();
}

// Expose globally so extension webview / explorer can open files
window._openFileInEditor = openFileInEditor;

// ── Boot ─────────────────────────────────────────────────────
init();
initExtensionDetailEvents();

// Listen for file-open requests from extension host
window.skillbox.onOpenFileInEditor?.((data) => {
  if (data.filePath) openFileInEditor(data.filePath);
});

// Listen for external file changes (e.g., Claude Code editing files)
window.skillbox.onFileChanged?.((data) => {
  const tab = _openTabs.find(t => t.filePath === data.filePath);
  if (tab && tab.model) {
    const currentValue = tab.model.getValue();
    if (data.content !== currentValue) {
      // Preserve cursor position
      const pos = _monacoEditor?.getPosition();
      tab._ignoreNextChange = true;
      tab.model.setValue(data.content);
      tab.savedVersion = tab.model.getAlternativeVersionId();
      tab.modified = false;
      if (pos && _activeTabIndex >= 0 && _openTabs[_activeTabIndex] === tab) {
        _monacoEditor?.setPosition(pos);
      }
      _renderTabs();
    }
  }
});
