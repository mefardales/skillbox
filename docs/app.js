/* =============================================================
   Skillbox — app.js
   Shared functionality: nav, toast, copy, scroll animations,
   terminal animation, skills browser.

   Skills data is loaded dynamically from registry.json.
   To add new skills, just update registry.json — no code changes.
   ============================================================= */

'use strict';

/* ── Skills Registry — loaded dynamically ─────────────────── */
let SKILLS = [];
let CATEGORIES = ['all'];
let CATEGORY_LABELS = { all: 'All' };
let registryLoaded = false;

const CATEGORY_LABEL_MAP = {
  backend: 'Backend',
  data: 'Data',
  devops: 'DevOps',
  frontend: 'Frontend',
  general: 'General',
  testing: 'Testing',
  mobile: 'Mobile',
  security: 'Security'
};

/**
 * Load skills from registry.json (same file the CLI uses).
 * Falls back gracefully — the site works even if the fetch fails.
 * Builds CATEGORIES and CATEGORY_LABELS dynamically from data.
 */
async function loadRegistry() {
  if (registryLoaded) return;

  // Use paths from config.js or fallback defaults
  const paths = (typeof SKILLBOX_CONFIG !== 'undefined' && SKILLBOX_CONFIG.registry)
    ? SKILLBOX_CONFIG.registry.paths
    : ['./registry.json', '../skills/registry.json', '/skills/registry.json'];

  for (const url of paths) {
    try {
      const res = await fetch(url, { cache: 'default' });
      if (!res.ok) continue;
      const data = await res.json();
      if (data && Array.isArray(data.skills)) {
        SKILLS = data.skills.map(s => ({
          id: s.id,
          name: s.name,
          category: s.category,
          description: s.description,
          tags: Array.isArray(s.tags) ? s.tags : [],
          version: s.version || '1.0',
          author: s.author || 'skillbox',
          skillUrl: s.skillUrl || ''
        }));

        // Build categories dynamically from data
        const cats = new Set(SKILLS.map(s => s.category));
        const sorted = Array.from(cats).sort();
        CATEGORIES = ['all', ...sorted];
        CATEGORY_LABELS = { all: `All (${SKILLS.length})` };
        sorted.forEach(cat => {
          const label = CATEGORY_LABEL_MAP[cat] || cat.charAt(0).toUpperCase() + cat.slice(1);
          CATEGORY_LABELS[cat] = label;
        });

        registryLoaded = true;

        // Update dynamic stat counters
        updateDynamicStats();
        return;
      }
    } catch (e) {
      // Try next path
    }
  }

  console.warn('Skillbox: Could not load registry.json — skills browser will be empty.');
}

/** Update stat numbers from actual data */
function updateDynamicStats() {
  const se = document.getElementById('statSkills');
  const ce = document.getElementById('statCategories');
  if (se) se.setAttribute('data-target', String(SKILLS.length));
  if (ce) ce.setAttribute('data-target', String(CATEGORIES.length - 1)); // minus 'all'
}

/* ── State ──────────────────────────────────────────────────── */
let activeCategory = 'all';
let searchQuery = '';

/* ── Pagination for scale (100k+ skills) ────────────────────── */
const PAGE_SIZE = 60;
let currentPage = 1;

/* ── Utility ─────────────────────────────────────────────────── */
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* ── Toast ───────────────────────────────────────────────────── */
let toastTimer = null;

function showToast(message) {
  const toast = document.getElementById('toast');
  const msg   = document.getElementById('toastMsg');
  if (!toast || !msg) return;
  msg.textContent = message;
  toast.classList.add('show');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2200);
}

/* ── Clipboard ──────────────────────────────────────────────── */
function copyToClipboard(text, btnEl, successLabel) {
  const label = successLabel || 'Copied!';
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(text)
      .then(() => handleCopied(btnEl, label))
      .catch(() => fallbackCopy(text, btnEl, label));
  } else {
    fallbackCopy(text, btnEl, label);
  }
}

function fallbackCopy(text, btnEl, label) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.cssText = 'position:fixed;top:-999px;left:-999px;opacity:0';
  document.body.appendChild(ta);
  ta.focus();
  ta.select();
  try {
    document.execCommand('copy');
    handleCopied(btnEl, label);
  } catch (e) {
    showToast('Copy failed — please copy manually.');
  }
  document.body.removeChild(ta);
}

function handleCopied(btnEl, label) {
  showToast(label);
  if (!btnEl) return;
  const originalHtml = btnEl.innerHTML;
  btnEl.classList.add('copied');
  btnEl.innerHTML = btnEl.innerHTML.replace(/(Copy|Install)/g, 'Copied!');
  setTimeout(() => {
    btnEl.classList.remove('copied');
    btnEl.innerHTML = originalHtml;
  }, 1800);
}

/* ── Navigation ─────────────────────────────────────────────── */
function initNav() {
  const nav      = document.getElementById('nav');
  const menuBtn  = document.getElementById('menuBtn');
  const mobileNav = document.getElementById('mobileNav');
  if (!nav) return;

  // Scroll — glass effect
  const onScroll = () => {
    nav.classList.toggle('scrolled', window.scrollY > 20);
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // Highlight active page link
  const currentPage = window.location.pathname.split('/').pop() || 'index.html';
  nav.querySelectorAll('.nav-link').forEach(link => {
    const href = link.getAttribute('href');
    if (href === currentPage || (currentPage === '' && href === 'index.html')) {
      link.classList.add('active');
    }
  });

  // Mobile menu
  if (menuBtn && mobileNav) {
    menuBtn.addEventListener('click', () => {
      const isOpen = mobileNav.classList.toggle('open');
      menuBtn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    });

    mobileNav.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        mobileNav.classList.remove('open');
        menuBtn.setAttribute('aria-expanded', 'false');
      });
    });

    document.addEventListener('click', (e) => {
      if (!nav.contains(e.target) && !mobileNav.contains(e.target)) {
        mobileNav.classList.remove('open');
        menuBtn.setAttribute('aria-expanded', 'false');
      }
    });
  }
}

/* ── Scroll Animations ──────────────────────────────────────── */
function initScrollAnimations() {
  const els = document.querySelectorAll('.reveal');
  if (!els.length) return;

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.1, rootMargin: '0px 0px -40px 0px' }
  );

  els.forEach(el => observer.observe(el));
}

/* ── Stats Counter ──────────────────────────────────────────── */
function animateCounter(el, target, duration) {
  const start = performance.now();
  function step(ts) {
    const progress = Math.min((ts - start) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    el.textContent = Math.round(target * eased);
    if (progress < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

function initStats() {
  const bar = document.querySelector('.stats-bar');
  if (!bar) return;
  const observer = new IntersectionObserver(
    (entries) => {
      if (entries[0].isIntersecting) {
        const se = document.getElementById('statSkills');
        const ce = document.getElementById('statCategories');
        const skillCount = se ? parseInt(se.getAttribute('data-target') || se.textContent) || SKILLS.length : 0;
        const catCount = ce ? parseInt(ce.getAttribute('data-target') || ce.textContent) || (CATEGORIES.length - 1) : 0;
        if (se) animateCounter(se, skillCount, 900);
        if (ce) animateCounter(ce, catCount, 700);
        observer.disconnect();
      }
    },
    { threshold: 0.5 }
  );
  observer.observe(bar);
}

/* ── Terminal Animation ──────────────────────────────────────── */
const TERMINAL_SEQUENCE = [
  { type: 'command', prompt: '$', text: 'npx skillbox install ', highlight: 'frontend/react-components' },
  { type: 'output',  text: 'Detecting AI tools...' },
  { type: 'output',  text: 'Found: Claude Code, Cursor' },
  { type: 'success', text: 'Installed react-components to 2 tools' },
  { type: 'gap' },
  { type: 'command', prompt: '$', text: 'npx skillbox list ' },
  { type: 'output',  text: '37 skills in 6 categories' },
  { type: 'output',  text: 'frontend/react-components  [installed]' },
  { type: 'output',  text: 'frontend/nextjs-app-router' },
  { type: 'output',  text: 'backend/python-fastapi' },
  { type: 'output',  text: 'devops/docker-compose' },
  { type: 'cursor' }
];

function buildTerminalLine(item) {
  const div = document.createElement('div');
  div.className = 'terminal-line';

  if (item.type === 'command') {
    div.innerHTML =
      `<span class="terminal-prompt">${item.prompt}</span>` +
      `<span class="terminal-cmd"><span class="cmd-dim">${escapeHtml(item.text)}</span>` +
      (item.highlight ? `<span class="cmd-path">${escapeHtml(item.highlight)}</span>` : '') +
      `</span>`;
  } else if (item.type === 'output') {
    div.innerHTML = `<span class="terminal-output">${escapeHtml(item.text)}</span>`;
  } else if (item.type === 'success') {
    div.innerHTML = `<span class="terminal-success">${SVG_CHECK_SMALL} ${escapeHtml(item.text)}</span>`;
  } else if (item.type === 'gap') {
    div.style.height = '8px';
  } else if (item.type === 'cursor') {
    div.innerHTML = `<span class="terminal-prompt">$</span><span class="terminal-cursor" aria-hidden="true"></span>`;
  }

  return div;
}

const SVG_CHECK_SMALL = `<svg style="display:inline;width:12px;height:12px;vertical-align:middle;margin-right:4px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>`;

function initTerminal() {
  const body = document.getElementById('terminalBody');
  if (!body) return;

  let index = 0;

  function showNext() {
    if (index >= TERMINAL_SEQUENCE.length) {
      setTimeout(() => { body.innerHTML = ''; index = 0; showNext(); }, 4000);
      return;
    }

    const item = TERMINAL_SEQUENCE[index++];

    if (item.type === 'gap') {
      body.appendChild(buildTerminalLine(item));
      setTimeout(showNext, 120);
      return;
    }

    const lineEl = buildTerminalLine(item);
    body.appendChild(lineEl);
    requestAnimationFrame(() => requestAnimationFrame(() => lineEl.classList.add('visible')));

    const delay = item.type === 'command' ? 700
      : item.type === 'success' ? 500
      : item.type === 'cursor' ? 99999
      : 280;

    setTimeout(showNext, delay);
  }

  setTimeout(showNext, 800);
}

/* ── Skills Browser ─────────────────────────────────────────── */
function getFilteredSkills() {
  const q = searchQuery.toLowerCase().trim();
  return SKILLS.filter(skill => {
    if (activeCategory !== 'all' && skill.category !== activeCategory) return false;
    if (q) {
      const haystack = [skill.name, skill.category, skill.description, ...skill.tags].join(' ').toLowerCase();
      return haystack.includes(q);
    }
    return true;
  });
}

function renderSkillCard(skill) {
  const cmd = `npx skillbox install ${skill.id}`;
  return `
    <article class="skill-card" role="listitem" aria-label="${escapeHtml(skill.name)} skill" data-skill-id="${escapeHtml(skill.id)}" style="cursor:pointer;">
      <div class="skill-card-header">
        <div class="skill-name">${escapeHtml(skill.name)}</div>
        <div class="skill-category-badge ${escapeHtml(skill.category)}">${escapeHtml(CATEGORY_LABELS[skill.category] || skill.category)}</div>
      </div>
      <p class="skill-desc">${escapeHtml(skill.description)}</p>
      <div class="skill-tags" aria-label="Tags">
        ${skill.tags.map(t => `<span class="skill-tag">${escapeHtml(t)}</span>`).join('')}
      </div>
      <div class="skill-card-footer">
        <div class="skill-install-cmd" aria-hidden="true">${escapeHtml(cmd)}</div>
        <button class="skill-copy-btn" data-cmd="${escapeHtml(cmd)}" aria-label="Copy install command for ${escapeHtml(skill.name)}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
          Copy
        </button>
      </div>
    </article>`;
}

function renderSkillsGrid() {
  const grid = document.getElementById('skillsGrid');
  const meta = document.getElementById('skillsMeta');
  const paginationEl = document.getElementById('skillsPagination');
  if (!grid) return;

  const filtered = getFilteredSkills();
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);

  // Clamp current page
  if (currentPage > totalPages) currentPage = totalPages || 1;

  // Paginate — only render current page for performance at scale
  const start = (currentPage - 1) * PAGE_SIZE;
  const pageSkills = filtered.slice(start, start + PAGE_SIZE);

  if (filtered.length === 0) {
    grid.innerHTML = `
      <div class="skills-empty">
        <div class="skills-empty-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
        </div>
        <div class="skills-empty-text">No skills found</div>
        <div class="skills-empty-sub">Try a different search term or category</div>
      </div>`;
    if (meta) meta.textContent = '';
    if (paginationEl) paginationEl.innerHTML = '';
    return;
  }

  grid.innerHTML = pageSkills.map(renderSkillCard).join('');

  if (meta) {
    const showing = filtered.length <= PAGE_SIZE
      ? `Showing ${filtered.length} skill${filtered.length !== 1 ? 's' : ''}`
      : `Showing ${start + 1}-${Math.min(start + PAGE_SIZE, filtered.length)} of ${filtered.length.toLocaleString()} skills`;
    meta.textContent = searchQuery.trim()
      ? `${filtered.length.toLocaleString()} result${filtered.length !== 1 ? 's' : ''} for "${searchQuery}"`
      : showing;
  }

  // Render pagination if needed
  if (paginationEl) {
    if (totalPages <= 1) {
      paginationEl.innerHTML = '';
    } else {
      paginationEl.innerHTML = buildPagination(currentPage, totalPages);
      paginationEl.querySelectorAll('[data-page]').forEach(btn => {
        btn.addEventListener('click', () => {
          currentPage = parseInt(btn.getAttribute('data-page'));
          renderSkillsGrid();
          grid.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
      });
    }
  }

  grid.querySelectorAll('.skill-copy-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      copyToClipboard(btn.getAttribute('data-cmd'), btn, 'Command copied!');
    });
  });

  // Wire click-to-detail on each card
  grid.querySelectorAll('.skill-card[data-skill-id]').forEach(card => {
    card.addEventListener('click', (e) => {
      // Don't open modal when clicking copy button
      if (e.target.closest('.skill-copy-btn')) return;
      const id = card.getAttribute('data-skill-id');
      const skill = SKILLS.find(s => s.id === id);
      if (skill) openSkillModal(skill);
    });
  });
}

/** Build pagination controls — scales to any number of pages */
function buildPagination(current, total) {
  const pages = [];
  const maxVisible = 7;

  if (total <= maxVisible) {
    for (let i = 1; i <= total; i++) pages.push(i);
  } else {
    pages.push(1);
    if (current > 3) pages.push('...');
    const start = Math.max(2, current - 1);
    const end = Math.min(total - 1, current + 1);
    for (let i = start; i <= end; i++) pages.push(i);
    if (current < total - 2) pages.push('...');
    pages.push(total);
  }

  const prevDisabled = current <= 1 ? 'disabled' : '';
  const nextDisabled = current >= total ? 'disabled' : '';

  let html = `<button class="page-btn" data-page="${current - 1}" ${prevDisabled} aria-label="Previous page">
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
  </button>`;

  pages.forEach(p => {
    if (p === '...') {
      html += `<span class="page-ellipsis">...</span>`;
    } else {
      html += `<button class="page-btn ${p === current ? 'active' : ''}" data-page="${p}" aria-label="Page ${p}">${p}</button>`;
    }
  });

  html += `<button class="page-btn" data-page="${current + 1}" ${nextDisabled} aria-label="Next page">
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
  </button>`;

  return html;
}

function renderTabs() {
  const container = document.getElementById('skillTabs');
  if (!container) return;

  const counts = {};
  CATEGORIES.forEach(cat => {
    counts[cat] = cat === 'all' ? SKILLS.length : SKILLS.filter(s => s.category === cat).length;
  });

  container.innerHTML = CATEGORIES.map(cat => `
    <button
      class="skill-tab ${cat === activeCategory ? 'active' : ''}"
      data-category="${escapeHtml(cat)}"
      role="tab"
      aria-selected="${cat === activeCategory}"
      aria-label="Filter by ${CATEGORY_LABELS[cat] || cat}, ${counts[cat]} skills"
    >
      ${escapeHtml(CATEGORY_LABELS[cat] || cat)}
      <span class="skill-tab-count">${counts[cat]}</span>
    </button>`
  ).join('');

  container.querySelectorAll('.skill-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      activeCategory = btn.getAttribute('data-category');
      currentPage = 1;
      renderTabs();
      renderSkillsGrid();
    });
  });
}

function initSkillsBrowser() {
  if (!document.getElementById('skillsGrid')) return;

  // Check URL param for initial category
  const params = new URLSearchParams(window.location.search);
  const cat = params.get('cat');
  if (cat && CATEGORIES.includes(cat)) activeCategory = cat;

  renderTabs();
  renderSkillsGrid();

  const searchInput = document.getElementById('skillSearch');
  if (searchInput) {
    let debounceTimer;
    searchInput.addEventListener('input', () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        searchQuery = searchInput.value;
        currentPage = 1;
        renderSkillsGrid();
      }, 180);
    });
  }
}

/* ── Skill Detail Modal ────────────────────────────────────── */

const CATEGORY_ICONS_SVG = {
  frontend: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>',
  backend:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="8" rx="2"/><rect x="2" y="14" width="20" height="8" rx="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/></svg>',
  devops:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/></svg>',
  testing:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v11"/></svg>',
  general:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>',
  data:     '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>'
};

/**
 * Open the skill detail modal — populated entirely from registry.json data.
 * The SKILL.md content is fetched from skillUrl and rendered as HTML.
 * Adding a new skill to registry.json automatically makes it work here.
 */
function openSkillModal(skill) {
  const overlay = document.getElementById('skillModalOverlay');
  if (!overlay) return;

  const cmd = `npx skillbox install ${skill.id}`;

  // Populate header
  document.getElementById('skillModalIcon').innerHTML = CATEGORY_ICONS_SVG[skill.category] || CATEGORY_ICONS_SVG.general;
  document.getElementById('skillModalTitle').textContent = skill.name;
  document.getElementById('skillModalMeta').innerHTML = `
    <span>v${escapeHtml(skill.version)}</span>
    <span class="sep">&middot;</span>
    <span>${escapeHtml(skill.author)}</span>
    <span class="sep">&middot;</span>
    <span>${escapeHtml(CATEGORY_LABELS[skill.category] || skill.category)}</span>
  `;
  document.getElementById('skillModalDesc').textContent = skill.description;
  document.getElementById('skillModalTags').innerHTML = skill.tags.map(t =>
    `<span class="skill-tag">${escapeHtml(t)}</span>`
  ).join('');

  document.getElementById('skillModalInfo').innerHTML = `
    <div class="skill-modal-info-cell">
      <div class="skill-modal-info-label">Category</div>
      <div class="skill-modal-info-value">${escapeHtml(CATEGORY_LABELS[skill.category] || skill.category)}</div>
    </div>
    <div class="skill-modal-info-cell">
      <div class="skill-modal-info-label">Version</div>
      <div class="skill-modal-info-value">${escapeHtml(skill.version)}</div>
    </div>
    <div class="skill-modal-info-cell">
      <div class="skill-modal-info-label">Author</div>
      <div class="skill-modal-info-value">${escapeHtml(skill.author)}</div>
    </div>
    <div class="skill-modal-info-cell">
      <div class="skill-modal-info-label">Compatible Tools</div>
      <div class="skill-modal-info-value">Claude &middot; Cursor &middot; Codex</div>
    </div>
  `;

  document.getElementById('skillModalActions').innerHTML = `
    <button class="skill-modal-install-btn" onclick="copyToClipboard('${cmd.replace(/'/g, "\\'")}', this, 'Command copied!')">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
      Copy Install Command
    </button>
  `;

  // Show loading state for content
  const body = document.getElementById('skillModalBody');
  body.innerHTML = '<div class="skill-modal-loading"><div class="spinner"></div> Loading skill content...</div>';

  // Open modal
  overlay.classList.add('open');
  document.body.style.overflow = 'hidden';

  // Fetch SKILL.md content from skillUrl
  fetchSkillContent(skill);
}

function closeSkillModal() {
  const overlay = document.getElementById('skillModalOverlay');
  if (overlay) {
    overlay.classList.remove('open');
    document.body.style.overflow = '';
  }
}

/**
 * Fetch and render the SKILL.md content inside the modal.
 * Tries the skillUrl from registry.json — works for any skill
 * without any code changes.
 */
async function fetchSkillContent(skill) {
  const body = document.getElementById('skillModalBody');
  if (!body) return;

  try {
    const res = await fetch(skill.skillUrl || '', { cache: 'default' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const markdown = await res.text();
    body.innerHTML = '<div class="skill-modal-content">' + renderMarkdown(markdown) + '</div>';
  } catch (err) {
    // If remote fetch fails, show metadata-only view
    body.innerHTML = `
      <div class="skill-modal-content">
        <h2>${escapeHtml(skill.name)}</h2>
        <p>${escapeHtml(skill.description)}</p>
        <h3>Install</h3>
        <pre><code>npx skillbox install ${escapeHtml(skill.id)}</code></pre>
        <h3>Tags</h3>
        <p>${skill.tags.map(t => '<code>' + escapeHtml(t) + '</code>').join(' ')}</p>
        <p style="color:var(--color-text-faint);margin-top:24px;font-size:13px;">
          Full skill content will be available once the repository is published.
          Install the skill to see the complete instructions locally.
        </p>
      </div>
    `;
  }
}

/**
 * Minimal Markdown to HTML renderer.
 * Handles headings, code blocks, inline code, lists, blockquotes, tables, links, bold, italic, hr.
 * Strips YAML frontmatter automatically.
 */
function renderMarkdown(md) {
  // Strip YAML frontmatter
  let text = md.replace(/^---[\s\S]*?---\n?/, '');
  const lines = text.split('\n');
  const out = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Fenced code block
    if (/^```/.test(line)) {
      const lang = line.slice(3).trim();
      const codeLines = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) {
        codeLines.push(escapeHtml(lines[i]));
        i++;
      }
      out.push(`<pre><code${lang ? ' class="language-' + escapeHtml(lang) + '"' : ''}>${codeLines.join('\n')}</code></pre>`);
      i++;
      continue;
    }

    // Headings
    const hMatch = line.match(/^(#{1,6})\s+(.*)/);
    if (hMatch) {
      const level = hMatch[1].length;
      out.push(`<h${level}>${inlineMd(hMatch[2])}</h${level}>`);
      i++;
      continue;
    }

    // HR
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(line.trim())) {
      out.push('<hr>');
      i++;
      continue;
    }

    // Blockquote
    if (line.startsWith('>')) {
      const quoteLines = [];
      while (i < lines.length && lines[i].startsWith('>')) {
        quoteLines.push(lines[i].replace(/^>\s?/, ''));
        i++;
      }
      out.push(`<blockquote>${inlineMd(quoteLines.join(' '))}</blockquote>`);
      continue;
    }

    // Unordered list
    if (/^[-*+]\s/.test(line)) {
      const items = [];
      while (i < lines.length && /^[-*+]\s/.test(lines[i])) {
        items.push(`<li>${inlineMd(lines[i].replace(/^[-*+]\s+/, ''))}</li>`);
        i++;
      }
      out.push(`<ul>${items.join('')}</ul>`);
      continue;
    }

    // Ordered list
    if (/^\d+\.\s/.test(line)) {
      const items = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
        items.push(`<li>${inlineMd(lines[i].replace(/^\d+\.\s+/, ''))}</li>`);
        i++;
      }
      out.push(`<ol>${items.join('')}</ol>`);
      continue;
    }

    // Table
    if (line.includes('|') && lines[i + 1] && /^[\s|:-]+$/.test(lines[i + 1])) {
      const tableLines = [];
      while (i < lines.length && lines[i].includes('|')) {
        tableLines.push(lines[i]);
        i++;
      }
      if (tableLines.length >= 2) {
        const headers = tableLines[0].split('|').filter((_, idx, arr) => idx > 0 && idx < arr.length - 1)
          .map(h => `<th>${inlineMd(h.trim())}</th>`).join('');
        const rows = tableLines.slice(2).map(row => {
          const cells = row.split('|').filter((_, idx, arr) => idx > 0 && idx < arr.length - 1)
            .map(c => `<td>${inlineMd(c.trim())}</td>`).join('');
          return `<tr>${cells}</tr>`;
        }).join('');
        out.push(`<table><thead><tr>${headers}</tr></thead><tbody>${rows}</tbody></table>`);
      }
      continue;
    }

    // Blank line
    if (line.trim() === '') { out.push(''); i++; continue; }

    // Paragraph
    const paraLines = [];
    while (i < lines.length && lines[i].trim() !== '' &&
      !/^(#{1,6}\s|```|[-*+]\s|\d+\.\s|>|-{3,}|\*{3,}|_{3,})/.test(lines[i]) &&
      !lines[i].includes('|')) {
      paraLines.push(lines[i]);
      i++;
    }
    if (paraLines.length > 0) {
      out.push(`<p>${inlineMd(paraLines.join(' '))}</p>`);
    }
  }

  return out.join('\n');
}

function inlineMd(text) {
  return text
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/__(.+?)__/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/_(.+?)_/g, '<em>$1</em>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
}

function initSkillModal() {
  const overlay = document.getElementById('skillModalOverlay');
  const closeBtn = document.getElementById('skillModalClose');
  if (!overlay) return;

  // Close on overlay click
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeSkillModal();
  });

  // Close button
  if (closeBtn) closeBtn.addEventListener('click', closeSkillModal);

  // Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && overlay.classList.contains('open')) {
      closeSkillModal();
    }
  });
}

/* ── Code Copy Buttons ──────────────────────────────────────── */
function initCodeCopyButtons() {
  document.querySelectorAll('.code-copy-btn[data-copy]').forEach(btn => {
    btn.addEventListener('click', () => {
      copyToClipboard(btn.getAttribute('data-copy'), btn, 'Copied!');
    });
  });
}

/* ── Smooth Scroll ───────────────────────────────────────────── */
function initSmoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', (e) => {
      const target = document.querySelector(anchor.getAttribute('href'));
      if (!target) return;
      e.preventDefault();
      const navH = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--nav-height')) || 64;
      window.scrollTo({ top: target.getBoundingClientRect().top + window.scrollY - navH - 8, behavior: 'smooth' });
    });
  });
}

/* ── Doc Sidebar Active Tracking ────────────────────────────── */
function initDocSidebar() {
  const links = document.querySelectorAll('.doc-nav-link[href^="#"]');
  if (!links.length) return;

  const sections = Array.from(links).map(l => document.querySelector(l.getAttribute('href'))).filter(Boolean);

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          links.forEach(l => l.classList.remove('active'));
          const active = document.querySelector(`.doc-nav-link[href="#${entry.target.id}"]`);
          if (active) active.classList.add('active');
        }
      });
    },
    { rootMargin: '-20% 0px -70% 0px' }
  );

  sections.forEach(s => observer.observe(s));
}

/* ── Featured Skills (home page) ─────────────────────────────── */
function initFeaturedSkills() {
  const grid = document.getElementById('featuredSkillsGrid');
  if (!grid) return;

  const featured = [
    'frontend/react-components',
    'backend/python-fastapi',
    'devops/docker-compose',
    'frontend/nextjs-app-router',
    'data/postgresql',
    'devops/kubernetes'
  ];

  const skills = featured
    .map(id => SKILLS.find(s => s.id === id))
    .filter(Boolean);

  grid.innerHTML = skills.map(renderSkillCard).join('');

  grid.querySelectorAll('.skill-copy-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      copyToClipboard(btn.getAttribute('data-cmd'), btn, 'Command copied!');
    });
  });

  grid.querySelectorAll('.skill-card[data-skill-id]').forEach(card => {
    card.addEventListener('click', (e) => {
      if (e.target.closest('.skill-copy-btn')) return;
      const id = card.getAttribute('data-skill-id');
      const skill = SKILLS.find(s => s.id === id);
      if (skill) openSkillModal(skill);
    });
  });
}

/* ── Init ───────────────────────────────────────────────────── */
async function init() {
  // Inject community links from config.js (Discord, GitHub, etc.)
  if (typeof injectNavCommunityLinks === 'function') injectNavCommunityLinks();
  if (typeof injectFooterLinks === 'function') injectFooterLinks();

  initNav();
  initScrollAnimations();
  initTerminal();
  initCodeCopyButtons();
  initSmoothScroll();
  initDocSidebar();

  // Load registry dynamically, then init data-dependent modules
  await loadRegistry();
  initStats();
  initSkillsBrowser();
  initFeaturedSkills();
  initSkillModal();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
