/* ═══════════════════════════════════════════════════════════════
   Skillbox — Tasks View (List)
   ═══════════════════════════════════════════════════════════════ */

import state from '../lib/state.js';
import { $, $$, esc, toast } from '../lib/utils.js';

const statusLabels = { todo: 'To Do', in_progress: 'In Progress', review: 'In Review', done: 'Done' };
const statusOrder = { todo: 0, in_progress: 1, review: 2, done: 3 };
const priorityOrder = { high: 0, medium: 1, low: 2 };

export async function loadAndRenderTasks(callbacks) {
  const filterProject = $('#taskProjectFilter')?.value || '';
  state.tasks = await window.skillbox.getTasks(filterProject || undefined);

  const filterEl = $('#taskProjectFilter');
  if (filterEl) {
    const currentVal = filterEl.value;
    const options = '<option value="">All projects</option>' +
      state.projects.map(p => `<option value="${esc(p.path)}" ${p.path === currentVal ? 'selected' : ''}>${esc(p.name)}</option>`).join('');
    filterEl.innerHTML = options;
  }

  renderTaskList(callbacks);
  callbacks.renderRightPanel();
}

export function renderTaskList(callbacks) {
  const { tasks, projects } = state;
  const container = $('#taskList');
  const emptyEl = $('#taskListEmpty');
  if (!container) return;

  if (tasks.length === 0) {
    container.innerHTML = '';
    container.appendChild(emptyEl);
    emptyEl.style.display = '';
    return;
  }
  emptyEl.style.display = 'none';

  const sorted = [...tasks].sort((a, b) => {
    const s = statusOrder[a.status] - statusOrder[b.status];
    if (s !== 0) return s;
    return (priorityOrder[a.priority] || 1) - (priorityOrder[b.priority] || 1);
  });

  // Group by status
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

  // Event listeners
  container.querySelectorAll('.task-row').forEach(row => {
    row.addEventListener('click', (e) => {
      if (e.target.closest('[data-move-right]') || e.target.closest('[data-delete-task]')) return;
      openTaskModal(row.dataset.taskId, callbacks);
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
        await loadAndRenderTasks(callbacks);
        toast(`Moved to ${statusLabels[next]}`);
      }
    });
  });
  container.querySelectorAll('[data-delete-task]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      await window.skillbox.deleteTask(btn.dataset.deleteTask);
      await loadAndRenderTasks(callbacks);
      toast('Task deleted');
    });
  });

  // Update nav badge
  const openCount = tasks.filter(t => t.status !== 'done').length;
  const countEl = $('#navTaskCount');
  if (countEl) {
    countEl.textContent = openCount;
    countEl.style.display = openCount > 0 ? '' : 'none';
  }
}

export function openTaskModal(taskId, callbacks) {
  state.editingTaskId = taskId || null;
  const modal = $('#taskModalOverlay');
  modal.style.display = '';

  const projSelect = $('#taskProjectInput');
  projSelect.innerHTML = state.projects.map(p =>
    `<option value="${esc(p.path)}" ${p.path === state.activeProjectPath ? 'selected' : ''}>${esc(p.name)}</option>`
  ).join('');
  if (state.projects.length === 0) {
    projSelect.innerHTML = '<option value="">No projects</option>';
  }

  if (taskId) {
    const task = state.tasks.find(t => t.id === taskId);
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

  // Populate assignee dropdown
  const assigneeInput = $('#taskAssigneeInput');
  if (assigneeInput) {
    const allMembers = state.teams.reduce((acc, t) => {
      const members = typeof t.members === 'string' ? JSON.parse(t.members) : (t.members || []);
      return acc.concat(members.filter(m => m.name).map(m => ({ name: m.name, role: m.role, team: t.name })));
    }, []);
    if (allMembers.length > 0) {
      const task = taskId ? state.tasks.find(t => t.id === taskId) : null;
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

export function closeTaskModal() {
  $('#taskModalOverlay').style.display = 'none';
  state.editingTaskId = null;
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

export async function saveTask(callbacks) {
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

  if (state.editingTaskId) {
    await window.skillbox.updateTask(state.editingTaskId, data);
    toast('Task updated');
  } else {
    await window.skillbox.createTask(data);
    toast('Task created');
  }

  closeTaskModal();
  state.tasks = await window.skillbox.getTasks();
  if (state.activeView === 'tasks') renderTaskList(callbacks);
  if (state.activeView === 'dashboard') callbacks.renderDashboard();
  callbacks.renderRightPanel();
}
