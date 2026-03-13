/* ═══════════════════════════════════════════════════════════════
   Skillbox — Teams View
   ═══════════════════════════════════════════════════════════════ */

import state from '../lib/state.js';
import { $, $$, esc, toast } from '../lib/utils.js';

export function renderTeams(callbacks) {
  const { teams, registry } = state;
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
    btn.addEventListener('click', () => openTeamModal(btn.dataset.editTeam, callbacks));
  });
  container.querySelectorAll('[data-delete-team]').forEach(btn => {
    btn.addEventListener('click', async () => {
      state.teams = await window.skillbox.deleteTeam(btn.dataset.deleteTeam);
      renderTeams(callbacks);
      toast('Team deleted');
    });
  });
}

export function openTeamModal(teamId, callbacks) {
  state.editingTeamId = teamId || null;
  const modal = $('#teamModalOverlay');
  modal.style.display = '';
  if (teamId) {
    const team = state.teams.find(t => t.id === teamId);
    if (team) {
      $('#teamModalTitle').textContent = 'Edit Team';
      $('#teamNameInput').value = team.name;
      $('#teamDescInput').value = team.description || '';
      state.teamMembers = typeof team.members === 'string' ? JSON.parse(team.members) : [...(team.members || [])];
    }
  } else {
    $('#teamModalTitle').textContent = 'New Team';
    $('#teamNameInput').value = '';
    $('#teamDescInput').value = '';
    state.teamMembers = [];
  }
  renderTeamMemberRows();
}

export function closeTeamModal() {
  $('#teamModalOverlay').style.display = 'none';
  state.editingTeamId = null;
  state.teamMembers = [];
}

export function renderTeamMemberRows() {
  const list = $('#teamMembersList');
  const allSkills = (state.registry.skills || []);
  const { teamMembers } = state;

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
      const idx = parseInt(input.closest('.team-member-row').dataset.idx);
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
      teamMembers[idx].skills = (teamMembers[idx].skills || []).filter(s => s !== chip.dataset.skill);
      renderTeamMemberRows();
    });
  });
}

export function addTeamMember() {
  state.teamMembers.push({ name: '', role: '', skills: [] });
  renderTeamMemberRows();
  const lastInput = $$('#teamMembersList .form-input');
  if (lastInput.length) lastInput[lastInput.length - 2]?.focus();
}

export async function saveTeam(callbacks) {
  const name = $('#teamNameInput').value.trim();
  if (!name) return toast('Team name is required');

  const data = {
    name,
    description: $('#teamDescInput').value.trim(),
    members: state.teamMembers.filter(m => m.name.trim()),
  };

  if (state.editingTeamId) {
    state.teams = await window.skillbox.updateTeam(state.editingTeamId, data);
    toast('Team updated');
  } else {
    state.teams = await window.skillbox.createTeam(data);
    toast('Team created');
  }

  closeTeamModal();
  renderTeams(callbacks);
  if (state.activeView === 'dashboard') callbacks.renderDashboard();
}
