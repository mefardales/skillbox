/* ═══════════════════════════════════════════════════════════════
   Skillbox — Environment Modal
   ═══════════════════════════════════════════════════════════════ */

import state from '../lib/state.js';
import { $, $$, esc, toast } from '../lib/utils.js';

let currentEnvProjectPath = null;
let currentEnvName = 'DEV';

export async function openEnvModal(projectPath) {
  currentEnvProjectPath = projectPath;
  const project = state.projects.find(p => p.path === projectPath);
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
    state.projects = await window.skillbox.addEnvironment(currentEnvProjectPath, name.trim().toUpperCase());
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

export function addEnvVar() {
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

export async function syncCurrentEnv() {
  const vars = {};
  $$('#envModalBody .env-row').forEach(row => {
    const key = row.querySelector('.env-key-input')?.value?.trim();
    const val = row.querySelector('.env-val-input')?.value || '';
    if (key) vars[key] = val;
  });
  state.projects = await window.skillbox.saveEnvironment(currentEnvProjectPath, currentEnvName, vars);
  await window.skillbox.syncEnvFile(currentEnvProjectPath, currentEnvName);
  toast('Synced to .env file');
}

export async function importCurrentEnv() {
  const vars = await window.skillbox.importEnvFile(currentEnvProjectPath, currentEnvName);
  if (Object.keys(vars).length > 0) {
    renderEnvVars(vars);
    toast('Imported .env file');
  } else {
    toast('No .env file found');
  }
}

export function closeEnvModal(callbacks) {
  if (currentEnvProjectPath) {
    const vars = {};
    $$('#envModalBody .env-row').forEach(row => {
      const key = row.querySelector('.env-key-input')?.value?.trim();
      const val = row.querySelector('.env-val-input')?.value || '';
      if (key) vars[key] = val;
    });
    window.skillbox.saveEnvironment(currentEnvProjectPath, currentEnvName, vars).then(p => {
      state.projects = p;
      if (state.activeView === 'projects') callbacks.renderProjects();
    });
  }
  $('#envModalOverlay').style.display = 'none';
  currentEnvProjectPath = null;
}
