/* ═══════════════════════════════════════════════════════════════
   Skillbox — Right Panel
   ═══════════════════════════════════════════════════════════════ */

import state from '../lib/state.js';
import { $, esc } from '../lib/utils.js';

export function renderRightPanel(callbacks) {
  renderRightPanelTasks(callbacks);
  renderRightPanelActivity();
  renderRightPanelInfo();
}

function renderRightPanelTasks(callbacks) {
  const container = $('#rpTaskList');
  if (!container) return;

  const openTasks = state.tasks.filter(t => t.status !== 'done');
  const filtered = state.activeProjectPath
    ? openTasks.filter(t => t.project_path === state.activeProjectPath)
    : openTasks;

  if (filtered.length === 0) {
    container.innerHTML = '<div class="rp-empty">No open tasks</div>';
    return;
  }

  container.innerHTML = filtered.slice(0, 20).map(t => {
    const proj = state.projects.find(p => p.path === t.project_path);
    return `<div class="rp-task-item" data-task-id="${esc(t.id)}">
      <div class="rp-task-dot p-${t.priority}"></div>
      <div class="rp-task-info">
        <span class="rp-task-title">${esc(t.title)}</span>
        <span class="rp-task-meta">${proj ? esc(proj.name) : ''} · ${t.status.replace('_', ' ')}</span>
      </div>
    </div>`;
  }).join('');

  container.querySelectorAll('.rp-task-item').forEach(item => {
    item.addEventListener('click', () => callbacks.openTaskModal(item.dataset.taskId));
  });
}

function renderRightPanelActivity() {
  const container = $('#rpActivityList');
  if (!container) return;

  if (!state.history || state.history.length === 0) {
    container.innerHTML = '<div class="rp-empty">No recent activity</div>';
    return;
  }

  container.innerHTML = state.history.slice(0, 20).map(h => {
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

  if (!state.activeProjectPath) {
    container.innerHTML = '<div class="rp-empty">Select a project to see details</div>';
    return;
  }

  const project = state.projects.find(p => p.path === state.activeProjectPath);
  if (!project) {
    container.innerHTML = '<div class="rp-empty">Project not found</div>';
    return;
  }

  const stack = (project.analysis?.stack || []).map(s => s.name);
  const taskCount = state.tasks.filter(t => t.project_path === project.path && t.status !== 'done').length;
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
        const sk = (state.registry.skills || []).find(s => s.id === sid);
        return `<span class="rp-info-badge">${esc(sk?.name || sid.split('/').pop())}</span>`;
      }).join('')}</div>
    </div>`;
  }

  container.innerHTML = html;
}

export function toggleRightPanel() {
  state.rightPanelOpen = !state.rightPanelOpen;
  const rp = $('#rightPanel');
  const handle = $('#resizeRightPanel');
  if (rp) rp.style.display = state.rightPanelOpen ? '' : 'none';
  if (handle) handle.style.display = state.rightPanelOpen ? '' : 'none';
}
