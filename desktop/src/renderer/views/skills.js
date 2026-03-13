/* ═══════════════════════════════════════════════════════════════
   Skillbox — Skills View
   ═══════════════════════════════════════════════════════════════ */

import state from '../lib/state.js';
import { $, $$, esc, capitalize, toast, simpleMarkdown } from '../lib/utils.js';

export function renderSkills(callbacks) {
  const grid = $('#skillsGrid');
  const searchVal = ($('#skillSearch')?.value || '').toLowerCase();
  const emptyEl = $('#skillsEmpty');
  const skills = state.registry.skills || [];

  let filtered = skills;
  if (state.activeCategory) filtered = filtered.filter(s => s.category === state.activeCategory);
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
    card.addEventListener('click', () => openSkillDetail(card.dataset.id, callbacks));
  });

  renderCategoryPills(callbacks);
}

function renderCategoryPills(callbacks) {
  const pills = $('#categoryPills');
  if (!pills) return;
  const categories = [...new Set((state.registry.skills || []).map(s => s.category))].filter(Boolean);
  pills.innerHTML = `<button class="pill ${!state.activeCategory ? 'active' : ''}" data-cat="">All</button>` +
    categories.map(c => `<button class="pill ${c === state.activeCategory ? 'active' : ''}" data-cat="${esc(c)}">${capitalize(c)}</button>`).join('');
  pills.querySelectorAll('.pill').forEach(p => {
    p.addEventListener('click', () => {
      state.activeCategory = p.dataset.cat;
      renderSkills(callbacks);
    });
  });
}

export function clearSearch(callbacks) {
  const input = $('#skillSearch');
  if (input) input.value = '';
  renderSkills(callbacks);
}

async function openSkillDetail(id, callbacks) {
  state.activeSkillId = id;
  const skill = (state.registry.skills || []).find(s => s.id === id);
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
      ${state.activeProjectPath ? `<button class="btn-primary btn-sm" id="detailInstallBtn">Install to Project</button>` : ''}
      ${state.activeProjectPath ? `<button class="btn-ghost btn-sm" id="detailToggleBtn">Toggle Active</button>` : ''}
    </div>
  `;

  body.innerHTML = `<div class="md-content">${simpleMarkdown(content || 'No content available.')}</div>`;

  $('#detailCloseBtn')?.addEventListener('click', closeDetail);
  $('#detailInstallBtn')?.addEventListener('click', async () => {
    if (!state.activeProjectPath || !state.activeSkillId) return;
    const r = await window.skillbox.installSkillToProject(state.activeProjectPath, state.activeSkillId);
    state.projects = r.projects || state.projects;
    toast(`Installed to ${r.installed} tool locations`);
  });
  $('#detailToggleBtn')?.addEventListener('click', async () => {
    if (!state.activeProjectPath || !state.activeSkillId) return;
    state.projects = await window.skillbox.toggleProjectSkill(state.activeProjectPath, state.activeSkillId);
    callbacks.renderProjects();
    callbacks.renderProjectSidebar();
    toast('Skill toggled');
  });

  $('#detailOverlay').classList.add('open');
  $('#detailPanel').classList.add('open');
}

export function closeDetail() {
  $('#detailOverlay')?.classList.remove('open');
  $('#detailPanel')?.classList.remove('open');
  state.activeSkillId = null;
}

export function openSkillCreator(skillId) {
  state.editingSkillId = skillId || null;
  $('#skillModalOverlay').style.display = '';
  if (!skillId) {
    $('#skillModalTitle').textContent = 'New Skill';
    $('#skillNameInput').value = '';
    $('#skillCategoryInput').value = 'general';
    $('#skillVersionInput').value = '1.0';
    $('#skillDescInput').value = '';
    $('#skillTagsInput').value = '';
    $('#skillContentInput').value = '';
  }
}

export function closeSkillCreator() {
  $('#skillModalOverlay').style.display = 'none';
  state.editingSkillId = null;
}

export async function saveCustomSkill(callbacks) {
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
  if (state.editingSkillId) {
    await window.skillbox.updateSkill(state.editingSkillId, data);
    toast('Skill updated');
  } else {
    await window.skillbox.createSkill(data);
    toast('Skill created');
  }
  closeSkillCreator();
  state.registry = await window.skillbox.getRegistry();
  renderSkills(callbacks);
}

export function openGitImportModal() {
  $('#gitImportModalOverlay').style.display = '';
  $('#gitRepoUrlInput').value = '';
  $('#gitImportStatus').style.display = 'none';
}

export function closeGitImportModal() {
  $('#gitImportModalOverlay').style.display = 'none';
}

export async function startGitImport(callbacks) {
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
    state.registry = await window.skillbox.getRegistry();
    renderSkills(callbacks);
  } else {
    status.className = 'import-error';
    status.textContent = result.error || 'Import failed';
  }
}
