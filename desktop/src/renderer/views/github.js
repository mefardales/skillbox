/* ═══════════════════════════════════════════════════════════════
   Skillbox — GitHub View
   ═══════════════════════════════════════════════════════════════ */

import state from '../lib/state.js';
import { $, esc, toast } from '../lib/utils.js';

export async function initGithubStatus() {
  const status = await window.skillbox.githubGetStatus();
  updateGithubUI(status);
}

function updateGithubUI(status) {
  // Status shown in GitHub view only
}

export async function refreshGithubView(callbacks) {
  const status = await window.skillbox.githubGetStatus();
  updateGithubUI(status);
  if (status.connected) {
    $('#githubConnectCard').style.display = 'none';
    $('#githubConnected').style.display = '';
    $('#githubUsername').textContent = status.username;
    $('#githubAvatar').src = status.avatarUrl || '';
    searchGithubRepos('', callbacks);
  } else {
    $('#githubConnectCard').style.display = '';
    $('#githubConnected').style.display = 'none';
  }
}

export async function connectGithub(callbacks) {
  const token = $('#githubTokenInput').value.trim();
  if (!token) return toast('Enter a token');
  const result = await window.skillbox.githubConnect(token);
  if (result.success) {
    toast(`Connected as ${result.username}`);
    refreshGithubView(callbacks);
  } else {
    toast(result.error || 'Connection failed');
  }
}

export async function disconnectGithub(callbacks) {
  await window.skillbox.githubDisconnect();
  refreshGithubView(callbacks);
  toast('Disconnected');
}

export async function searchGithubRepos(query, callbacks) {
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
        state.projects = addResult.projects || [];
        callbacks.renderProjectSidebar();
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
        state.registry = await window.skillbox.getRegistry();
        callbacks.renderSkills();
      } else {
        toast(result.error || 'Import failed');
      }
    });
  });
}
