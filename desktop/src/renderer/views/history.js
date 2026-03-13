/* ═══════════════════════════════════════════════════════════════
   Skillbox — History View
   ═══════════════════════════════════════════════════════════════ */

import state from '../lib/state.js';
import { $, esc, isToday, isYesterday } from '../lib/utils.js';

export async function loadHistory() {
  const filterEl = $('#historyFilter');
  if (filterEl) {
    const currentVal = filterEl.value;
    filterEl.innerHTML = '<option value="">All projects</option>' +
      state.projects.map(p => `<option value="${esc(p.path)}" ${p.path === currentVal ? 'selected' : ''}>${esc(p.name)}</option>`).join('');
  }
  const filter = $('#historyFilter')?.value || '';
  state.history = await window.skillbox.getHistory(filter || undefined);
}

export function renderHistory() {
  const container = $('#historyTimeline');
  const empty = $('#historyEmpty');
  const { history } = state;

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
