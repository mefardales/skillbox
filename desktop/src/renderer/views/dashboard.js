/* ═══════════════════════════════════════════════════════════════
   Skillbox — Dashboard View
   ═══════════════════════════════════════════════════════════════ */

import state from '../lib/state.js';
import { $, esc, isToday, isYesterday } from '../lib/utils.js';

export function renderDashboard(callbacks) {
  const { tasks, projects, teams, history } = state;
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
        state.activeProjectPath = row.dataset.path;
        callbacks.onProjectSelect();
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
