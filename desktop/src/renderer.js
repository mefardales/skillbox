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
let activeView = 'dashboard';
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
  registry = await window.skillbox.getRegistry();
  const projResult = await window.skillbox.getProjects();
  projects = Array.isArray(projResult) ? projResult : [];
  teams = await window.skillbox.getTeams();
  history = await window.skillbox.getHistory();
  tasks = await window.skillbox.getTasks();
  messages = [];

  renderProjectSidebar();
  renderDashboard();
  renderRightPanel();
  updateCounts();
  bindEvents();
  initGithubStatus();
  initAnalysisProgress();
  initTerminalListeners();
  initTerminalResize();
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
  $('#btnDuplicateTerminal')?.addEventListener('click', duplicateTerminal);
  $('#btnKillTerminal')?.addEventListener('click', killActiveTerminal);
  $('#btnCloseTerminalPanel')?.addEventListener('click', () => setTerminalPanel(false));
  $('#btnMaximizeTerminal')?.addEventListener('click', toggleTerminalMaximize);

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
    if ((e.metaKey || e.ctrlKey) && e.key === 'b') {
      e.preventDefault();
      toggleProjectSidebar();
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

// ── Project Sidebar ──────────────────────────────────────────
function renderProjectSidebar() {
  const container = $('#projectSidebarList');
  if (!container) return;

  const searchVal = ($('#projectSidebarSearch')?.value || '').toLowerCase();
  let filtered = projects;
  if (searchVal) {
    filtered = projects.filter(p =>
      p.name.toLowerCase().includes(searchVal) ||
      p.path.toLowerCase().includes(searchVal)
    );
  }

  if (filtered.length === 0) {
    container.innerHTML = `<div class="psb-empty">${searchVal ? 'No matches' : 'No projects yet'}</div>`;
    return;
  }

  container.innerHTML = filtered.map(p => {
    const stack = (p.analysis?.stack || []).map(s => s.name).join(', ') || '';
    const taskCount = tasks.filter(t => t.project_path === p.path && t.status !== 'done').length;
    const initial = (p.name || 'P').charAt(0).toUpperCase();
    return `<div class="psb-project ${p.path === activeProjectPath ? 'active' : ''}" data-path="${esc(p.path)}">
      <div class="psb-project-icon">${initial}</div>
      <div class="psb-project-info">
        <span class="psb-project-name">${esc(p.name)}</span>
        ${stack ? `<span class="psb-project-stack">${esc(stack)}</span>` : ''}
      </div>
      ${taskCount > 0 ? `<span class="psb-project-badge">${taskCount}</span>` : ''}
    </div>`;
  }).join('');

  container.querySelectorAll('.psb-project').forEach(row => {
    row.addEventListener('click', () => {
      activeProjectPath = row.dataset.path;
      renderProjectSidebar();
      renderRightPanel();
      if (activeView === 'projects') renderProjects();
    });
  });

  // Update nav badge
  const countEl = $('#navProjectCount');
  if (countEl) {
    countEl.textContent = projects.length;
    countEl.style.display = projects.length > 0 ? '' : 'none';
  }
}

// ── Right Panel ──────────────────────────────────────────────
function renderRightPanel() {
  renderRightPanelTasks();
  renderRightPanelActivity();
  renderRightPanelInfo();
}

function renderRightPanelTasks() {
  const container = $('#rpTaskList');
  if (!container) return;

  const openTasks = tasks.filter(t => t.status !== 'done');
  const filtered = activeProjectPath
    ? openTasks.filter(t => t.project_path === activeProjectPath)
    : openTasks;

  if (filtered.length === 0) {
    container.innerHTML = '<div class="rp-empty">No open tasks</div>';
    return;
  }

  container.innerHTML = filtered.slice(0, 20).map(t => {
    const proj = projects.find(p => p.path === t.project_path);
    return `<div class="rp-task-item" data-task-id="${esc(t.id)}">
      <div class="rp-task-dot p-${t.priority}"></div>
      <div class="rp-task-info">
        <span class="rp-task-title">${esc(t.title)}</span>
        <span class="rp-task-meta">${proj ? esc(proj.name) : ''} · ${t.status.replace('_', ' ')}</span>
      </div>
    </div>`;
  }).join('');

  container.querySelectorAll('.rp-task-item').forEach(item => {
    item.addEventListener('click', () => openTaskModal(item.dataset.taskId));
  });
}

function renderRightPanelActivity() {
  const container = $('#rpActivityList');
  if (!container) return;

  if (!history || history.length === 0) {
    container.innerHTML = '<div class="rp-empty">No recent activity</div>';
    return;
  }

  container.innerHTML = history.slice(0, 20).map(h => {
    const date = new Date(h.timestamp);
    const time = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return `<div class="rp-activity-item">
      <div class="rp-activity-dot"></div>
      <div class="rp-activity-text">${esc(h.detail)}</div>
      <div class="rp-activity-time">${time}</div>
    </div>`;
  }).join('');
}

function renderRightPanelInfo() {
  const container = $('#rpInfoContent');
  if (!container) return;

  if (!activeProjectPath) {
    container.innerHTML = '<div class="rp-empty">Select a project to see details</div>';
    return;
  }

  const project = projects.find(p => p.path === activeProjectPath);
  if (!project) {
    container.innerHTML = '<div class="rp-empty">Project not found</div>';
    return;
  }

  const stack = (project.analysis?.stack || []).map(s => s.name);
  const taskCount = tasks.filter(t => t.project_path === project.path && t.status !== 'done').length;
  const envName = project.activeEnv || 'DEV';

  let html = `
    <div class="rp-info-row">
      <span class="rp-info-label">Name</span>
      <span class="rp-info-value">${esc(project.name)}</span>
    </div>
    <div class="rp-info-row">
      <span class="rp-info-label">Open Tasks</span>
      <span class="rp-info-value">${taskCount}</span>
    </div>
    <div class="rp-info-row">
      <span class="rp-info-label">Environment</span>
      <span class="rp-info-value">${esc(envName)}</span>
    </div>
  `;

  if (stack.length > 0) {
    html += `<div class="rp-info-stack">
      <div class="rp-info-stack-title">Stack</div>
      <div class="rp-info-badges">${stack.map(s => `<span class="rp-info-badge">${esc(s)}</span>`).join('')}</div>
    </div>`;
  }

  const projectSkills = project.skills || [];
  if (projectSkills.length > 0) {
    html += `<div class="rp-info-stack" style="margin-top:12px">
      <div class="rp-info-stack-title">Skills</div>
      <div class="rp-info-badges">${projectSkills.map(sid => {
        const sk = (registry.skills || []).find(s => s.id === sid);
        return `<span class="rp-info-badge">${esc(sk?.name || sid.split('/').pop())}</span>`;
      }).join('')}</div>
    </div>`;
  }

  container.innerHTML = html;
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

  renderKanban();
  renderRightPanel();
}

function renderKanban() {
  const columns = { todo: [], in_progress: [], review: [], done: [] };
  for (const t of tasks) {
    const col = columns[t.status] || columns.todo;
    col.push(t);
  }

  for (const [status, items] of Object.entries(columns)) {
    const containerId = status === 'in_progress' ? 'kanbanInProgress' : `kanban${capitalize(status)}`;
    const countId = status === 'in_progress' ? 'countInProgress' : `count${capitalize(status)}`;
    const container = $(`#${containerId}`);
    const count = $(`#${countId}`);
    if (count) count.textContent = items.length;
    if (!container) continue;

    if (items.length === 0) {
      container.innerHTML = '<div style="padding:20px;text-align:center;color:var(--muted-foreground);font-size:11px;">No tasks</div>';
      continue;
    }

    container.innerHTML = items.map(t => {
      const proj = projects.find(p => p.path === t.project_path);
      return `<div class="kanban-card" data-task-id="${esc(t.id)}">
        <div class="kanban-card-title">${esc(t.title)}</div>
        ${t.description ? `<div class="kanban-card-desc">${esc(t.description)}</div>` : ''}
        <div class="kanban-card-footer">
          <span class="kanban-card-priority p-${t.priority}">${t.priority}</span>
          ${proj ? `<span class="kanban-card-project">${esc(proj.name)}</span>` : ''}
          ${t.assignee ? `<span class="kanban-card-assignee">${esc(t.assignee)}</span>` : ''}
          <div class="kanban-card-actions">
            ${status !== 'done' ? `<button title="Move right" data-move-right="${esc(t.id)}">
              <svg viewBox="0 0 16 16" fill="currentColor" width="12" height="12"><path d="M6 3.5a.5.5 0 01.5.5v8a.5.5 0 01-1 0V4a.5.5 0 01.5-.5zm4 0a.5.5 0 01.354.146l3 3a.5.5 0 010 .708l-3 3a.5.5 0 01-.708-.708L12.293 8 9.646 5.354A.5.5 0 0110 3.5z"/></svg>
            </button>` : ''}
            <button title="Delete" data-delete-task="${esc(t.id)}">
              <svg viewBox="0 0 16 16" fill="currentColor" width="12" height="12"><path d="M5.5 5.5A.5.5 0 016 6v6a.5.5 0 01-1 0V6a.5.5 0 01.5-.5zm2.5 0a.5.5 0 01.5.5v6a.5.5 0 01-1 0V6a.5.5 0 01.5-.5zm3 .5a.5.5 0 00-1 0v6a.5.5 0 001 0V6z"/><path fill-rule="evenodd" d="M14.5 3a1 1 0 01-1 1H13v9a2 2 0 01-2 2H5a2 2 0 01-2-2V4h-.5a1 1 0 010-2H6a1 1 0 011-1h2a1 1 0 011 1h3.5a1 1 0 011 1zM4.118 4L4 4.059V13a1 1 0 001 1h6a1 1 0 001-1V4.059L11.882 4H4.118z"/></svg>
            </button>
          </div>
        </div>
      </div>`;
    }).join('');

    container.querySelectorAll('.kanban-card').forEach(card => {
      card.addEventListener('click', (e) => {
        if (e.target.closest('[data-move-right]') || e.target.closest('[data-delete-task]')) return;
        openTaskModal(card.dataset.taskId);
      });
    });
    container.querySelectorAll('[data-move-right]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const taskId = btn.dataset.moveRight;
        const task = tasks.find(t => t.id === taskId);
        if (!task) return;
        const nextStatus = { todo: 'in_progress', in_progress: 'review', review: 'done' };
        const next = nextStatus[task.status];
        if (next) {
          await window.skillbox.updateTask(taskId, { status: next });
          await loadAndRenderTasks();
          toast(`Moved to ${next.replace('_', ' ')}`);
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
  }

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
  if (activeView === 'tasks') renderKanban();
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

// ── Projects View ────────────────────────────────────────────
function renderProjects() {
  const container = $('#projectsList');
  const empty = $('#projectsEmpty');
  if (projects.length === 0) {
    empty.style.display = '';
    return;
  }
  empty.style.display = 'none';

  container.innerHTML = `<div class="project-table">
    <div class="project-table-header">
      <span class="pt-col-name">Name</span>
      <span class="pt-col-stack">Stack</span>
      <span class="pt-col-tasks">Tasks</span>
      <span class="pt-col-env">Env</span>
      <span class="pt-col-actions"></span>
    </div>
    ${projects.map(p => {
      const stackNames = (p.analysis?.stack || []).map(s => s.name).join(', ') || '—';
      const taskCount = tasks.filter(t => t.project_path === p.path && t.status !== 'done').length;
      const envClass = (p.activeEnv || 'DEV').toLowerCase();
      const envClassMap = { dev: 'env-dev', qa: 'env-qa', prod: 'env-prod', staging: 'env-staging' };
      return `<div class="project-table-row ${p.path === activeProjectPath ? 'active' : ''}" data-path="${esc(p.path)}">
        <div class="pt-col-name">
          <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14" style="flex-shrink:0;opacity:0.5"><path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z"/></svg>
          <div class="pt-name-wrap">
            <span class="pt-name">${esc(p.name)}</span>
            <span class="pt-path">${esc(p.path)}</span>
          </div>
        </div>
        <span class="pt-col-stack">${esc(stackNames)}</span>
        <span class="pt-col-tasks">${taskCount > 0 ? `<span class="pt-task-count">${taskCount}</span>` : '<span style="opacity:0.3">0</span>'}</span>
        <span class="pt-col-env"><span class="project-env-badge ${envClassMap[envClass] || 'env-default'}" data-env-path="${esc(p.path)}">${p.activeEnv || 'DEV'}</span></span>
        <div class="pt-col-actions">
          <button class="btn-icon" data-analyze="${esc(p.path)}" title="Analyze">
            <svg viewBox="0 0 16 16" fill="currentColor" width="13" height="13"><path d="M8 3.5a.5.5 0 00-1 0V9a.5.5 0 00.252.434l3.5 2a.5.5 0 00.496-.868L8 8.71V3.5z"/><path d="M8 16A8 8 0 108 0a8 8 0 000 16zm7-8A7 7 0 111 8a7 7 0 0114 0z"/></svg>
          </button>
          <button class="btn-icon" data-directives="${esc(p.path)}" title="Generate Directives">
            <svg viewBox="0 0 16 16" fill="currentColor" width="13" height="13"><path d="M4 0a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2V2a2 2 0 00-2-2H4zm0 1h8a1 1 0 011 1v12a1 1 0 01-1 1H4a1 1 0 01-1-1V2a1 1 0 011-1z"/><path d="M4.5 10.5A.5.5 0 015 10h3a.5.5 0 010 1H5a.5.5 0 01-.5-.5zm0-2A.5.5 0 015 8h6a.5.5 0 010 1H5a.5.5 0 01-.5-.5zm0-2A.5.5 0 015 6h6a.5.5 0 010 1H5a.5.5 0 01-.5-.5zm0-2A.5.5 0 015 4h6a.5.5 0 010 1H5a.5.5 0 01-.5-.5z"/></svg>
          </button>
          <button class="btn-icon" data-terminal="${esc(p.path)}" title="Open Terminal">
            <svg viewBox="0 0 16 16" fill="currentColor" width="13" height="13"><path d="M0 3a2 2 0 012-2h12a2 2 0 012 2v10a2 2 0 01-2 2H2a2 2 0 01-2-2V3zm9.5 5.5h-3a.5.5 0 000 1h3a.5.5 0 000-1zm-6.354-.354a.5.5 0 01.708-.708l2 2a.5.5 0 010 .708l-2 2a.5.5 0 01-.708-.708L4.793 10l-1.647-1.646a.5.5 0 010-.708z"/></svg>
          </button>
          <button class="btn-icon btn-danger" data-remove="${esc(p.path)}" title="Remove">
            <svg viewBox="0 0 16 16" fill="currentColor" width="12" height="12"><path d="M4.646 4.646a.5.5 0 01.708 0L8 7.293l2.646-2.647a.5.5 0 01.708.708L8.707 8l2.647 2.646a.5.5 0 01-.708.708L8 8.707l-2.646 2.647a.5.5 0 01-.708-.708L7.293 8 4.646 5.354a.5.5 0 010-.708z"/></svg>
          </button>
        </div>
        <div class="project-analysis-progress" data-analysis-path="${esc(p.path)}" style="display:none">
          <div class="analysis-progress-bar-wrap"><div class="analysis-progress-fill" style="width:0%"></div></div>
          <div class="analysis-progress-label">Starting analysis...</div>
        </div>
      </div>`;
    }).join('')}
  </div>`;

  // Events
  container.querySelectorAll('.project-table-row').forEach(row => {
    row.addEventListener('click', (e) => {
      if (e.target.closest('button') || e.target.closest('.project-env-badge')) return;
      activeProjectPath = row.dataset.path;
      container.querySelectorAll('.project-table-row').forEach(r => r.classList.remove('active'));
      row.classList.add('active');
      renderProjectSidebar();
      renderRightPanel();
    });
  });
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
      projects = await window.skillbox.getProjects();
      renderProjects();
      renderProjectSidebar();
      renderRightPanel();
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
      projects = await window.skillbox.removeProject(btn.dataset.remove);
      if (activeProjectPath === btn.dataset.remove) activeProjectPath = null;
      renderProjects();
      renderProjectSidebar();
      renderRightPanel();
      updateCounts();
      toast('Project removed');
    });
  });
  container.querySelectorAll('[data-env-path]').forEach(badge => {
    badge.addEventListener('click', (e) => {
      e.stopPropagation();
      openEnvModal(badge.dataset.envPath);
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
    renderTerminalTabs();
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

function initTerminalResize() {
  const panel = $('#terminalPanel');
  const handle = $('#terminalResizeHandle');
  if (!handle || !panel) return;

  let startY, startHeight;

  handle.addEventListener('mousedown', (e) => {
    startY = e.clientY;
    startHeight = panel.offsetHeight;

    const onMouseMove = (e) => {
      const delta = startY - e.clientY;
      const newHeight = Math.min(Math.max(startHeight + delta, 120), window.innerHeight * 0.8);
      panel.style.height = newHeight + 'px';
    };

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      const term = terminals.find(t => t.id === activeTerminalId);
      if (term?.fitAddon) try { term.fitAddon.fit(); } catch {}
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  });
}

function toggleTerminalMaximize() {
  const panel = $('#terminalPanel');
  if (!panel) return;
  panel.classList.toggle('maximized');
  const term = terminals.find(t => t.id === activeTerminalId);
  if (term?.fitAddon) setTimeout(() => { try { term.fitAddon.fit(); } catch {} }, 50);
}

function setTerminalPanel(open) {
  terminalPanelOpen = open;
  const panel = $('#terminalPanel');
  const toggleBtn = $('#btnToggleTerminal');
  if (panel) panel.style.display = open ? '' : 'none';
  if (toggleBtn) toggleBtn.classList.toggle('active', open);
  if (open) {
    const term = terminals.find(t => t.id === activeTerminalId);
    if (term?.fitAddon) {
      setTimeout(() => {
        try { term.fitAddon.fit(); } catch {}
        term.term?.focus();
      }, 50);
    }
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
      background: '#0d0a14',
      foreground: '#e4e4e7',
      cursor: '#a78bfa',
      selectionBackground: 'rgba(124,58,237,0.3)',
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
  terminals.push(termObj);
  activeTerminalId = result.id;

  term.onData((data) => window.skillbox.terminalWrite(result.id, data));
  term.onResize(({ cols, rows }) => window.skillbox.terminalResize(result.id, cols, rows));

  const resizeObserver = new ResizeObserver(() => {
    try { fitAddon.fit(); } catch {}
  });
  resizeObserver.observe(termEl);

  renderTerminalTabs();
  showActiveTerminal();
  setTerminalPanel(true);
  setTimeout(() => term.focus(), 100);
}

function renderTerminalTabs() {
  const container = $('#terminalTabs');
  if (!container) return;
  container.innerHTML = terminals.map(t => `
    <button class="terminal-tab ${t.id === activeTerminalId ? 'active' : ''}" data-term-id="${esc(t.id)}">
      <svg viewBox="0 0 16 16" fill="currentColor" width="10" height="10"><path fill-rule="evenodd" d="M1 3.5A1.5 1.5 0 012.5 2h11A1.5 1.5 0 0115 3.5v9a1.5 1.5 0 01-1.5 1.5h-11A1.5 1.5 0 011 12.5v-9zM3.293 5.293a1 1 0 011.414 0L6.5 7.086l-1.793 1.793a1 1 0 11-1.414-1.414L4.586 6.5 3.293 5.207a1 1 0 010-.914zM8 8a.75.75 0 000 1.5h2a.75.75 0 000-1.5H8z"/></svg>
      ${esc(t.name)}
      <span class="terminal-tab-close" data-close-term="${esc(t.id)}">
        <svg viewBox="0 0 12 12" fill="currentColor" width="10" height="10"><path d="M3.354 3.354a.5.5 0 01.707 0L6 5.293l1.939-1.94a.5.5 0 01.707.708L6.707 6l1.94 1.939a.5.5 0 01-.708.707L6 6.707l-1.939 1.94a.5.5 0 01-.707-.708L5.293 6 3.354 4.061a.5.5 0 010-.707z"/></svg>
      </span>
    </button>
  `).join('');

  container.querySelectorAll('.terminal-tab').forEach(tab => {
    tab.addEventListener('click', (e) => {
      if (e.target.closest('.terminal-tab-close')) return;
      activeTerminalId = tab.dataset.termId;
      renderTerminalTabs();
      showActiveTerminal();
    });
  });
  container.querySelectorAll('.terminal-tab-close').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      killTerminal(btn.dataset.closeTerm);
    });
  });
}

function showActiveTerminal() {
  terminals.forEach(t => {
    t.element.style.display = t.id === activeTerminalId ? '' : 'none';
  });
  const active = terminals.find(t => t.id === activeTerminalId);
  if (active?.fitAddon) {
    setTimeout(() => {
      try { active.fitAddon.fit(); } catch {}
      active.term.focus();
    }, 50);
  }
}

async function duplicateTerminal() {
  const active = terminals.find(t => t.id === activeTerminalId);
  if (!active) return createTerminal();
  createTerminal({ cwd: active.cwd, name: `${active.name} (copy)` });
}

async function killActiveTerminal() {
  if (!activeTerminalId) return;
  killTerminal(activeTerminalId);
}

async function killTerminal(id) {
  const term = terminals.find(t => t.id === id);
  if (term) {
    term.term.dispose();
    term.element.remove();
    await window.skillbox.terminalKill(id);
    terminals = terminals.filter(t => t.id !== id);
    if (activeTerminalId === id) {
      activeTerminalId = terminals[0]?.id || null;
    }
  }
  renderTerminalTabs();
  showActiveTerminal();
  if (terminals.length === 0) setTerminalPanel(false);
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

// ── Boot ─────────────────────────────────────────────────────
init();
