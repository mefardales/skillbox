/* =============================================================
   Skillbox — config.js
   Centralized configuration for links, URLs, and settings.

   When a link changes, update it here ONLY.
   All pages read from this file automatically.
   ============================================================= */

'use strict';

const SKILLBOX_CONFIG = {
  // ── Links ────────────────────────────────────────────────
  links: {
    github:       'https://github.com/skillbox/skillbox',
    npm:          'https://www.npmjs.com/package/skillbox',
    vscodeExt:    'https://marketplace.visualstudio.com/items?itemName=skillbox.skillbox',
    discord:      'https://discord.com/invite/J7X6gmWk3',
    agentSkills:  'https://agentskills.io',
    agentSpec:    'https://agentskills.io/spec',
    contributing: 'https://github.com/skillbox/skillbox/blob/main/CONTRIBUTING.md',
    license:      'https://github.com/skillbox/skillbox/blob/main/LICENSE',
    website:      'https://skillbox.github.io'
  },

  // ── Registry ─────────────────────────────────────────────
  registry: {
    paths: [
      './registry.json',
      '../skills/registry.json',
      '/skills/registry.json'
    ]
  },

  // ── Brand ────────────────────────────────────────────────
  brand: {
    name:    'Skillbox',
    tagline: 'Skill Pack for your development environment'
  }
};

/**
 * Inject Discord + GitHub buttons into nav-actions on every page.
 * Call this from app.js init() — no need to manually add HTML to each page.
 */
function injectNavCommunityLinks() {
  const actions = document.querySelector('.nav-actions');
  if (!actions) return;

  const githubBtn = actions.querySelector('.nav-github');
  if (!githubBtn) return;

  // Only inject if not already present
  if (actions.querySelector('.nav-discord')) return;

  const discordEl = document.createElement('a');
  discordEl.href = SKILLBOX_CONFIG.links.discord;
  discordEl.className = 'nav-discord';
  discordEl.target = '_blank';
  discordEl.rel = 'noopener noreferrer';
  discordEl.setAttribute('aria-label', 'Join Discord');
  discordEl.innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M20.317 4.37a19.791 19.791 0 00-4.885-1.515.074.074 0 00-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 00-5.487 0 12.64 12.64 0 00-.617-1.25.077.077 0 00-.079-.037A19.736 19.736 0 003.677 4.37a.07.07 0 00-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 00.031.057 19.9 19.9 0 005.993 3.03.078.078 0 00.084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 00-.041-.106 13.107 13.107 0 01-1.872-.892.077.077 0 01-.008-.128 10.2 10.2 0 00.372-.292.074.074 0 01.077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 01.078.01c.12.098.246.198.373.292a.077.077 0 01-.006.127 12.299 12.299 0 01-1.873.892.077.077 0 00-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 00.084.028 19.839 19.839 0 006.002-3.03.077.077 0 00.032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 00-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/></svg> Discord`;

  actions.insertBefore(discordEl, githubBtn);

  // Also inject into mobile nav
  const mobileNav = document.getElementById('mobileNav');
  if (mobileNav && !mobileNav.querySelector('[href*="discord.com"]')) {
    const githubMobile = mobileNav.querySelector('[href*="github.com"]');
    if (githubMobile) {
      const discordMobile = document.createElement('a');
      discordMobile.href = SKILLBOX_CONFIG.links.discord;
      discordMobile.className = 'nav-mobile-link';
      discordMobile.target = '_blank';
      discordMobile.rel = 'noopener noreferrer';
      discordMobile.textContent = 'Discord';
      mobileNav.insertBefore(discordMobile, githubMobile);
    }
  }
}

/**
 * Update all footer links to use config values.
 * This ensures footer links stay in sync with config.js.
 */
function injectFooterLinks() {
  // Update GitHub links
  document.querySelectorAll('.footer-link[href*="github.com/skillbox"]').forEach(el => {
    if (el.textContent.trim() === 'GitHub') el.href = SKILLBOX_CONFIG.links.github;
    if (el.textContent.trim() === 'Contributing Guide') el.href = SKILLBOX_CONFIG.links.contributing;
    if (el.textContent.trim() === 'License') el.href = SKILLBOX_CONFIG.links.license;
  });

  // Update npm link
  document.querySelectorAll('.footer-link[href*="npmjs.com"]').forEach(el => {
    el.href = SKILLBOX_CONFIG.links.npm;
  });

  // Update VSCode link
  document.querySelectorAll('.footer-link[href*="marketplace.visualstudio"]').forEach(el => {
    el.href = SKILLBOX_CONFIG.links.vscodeExt;
  });

  // Update Agent Skills links
  document.querySelectorAll('.footer-link[href*="agentskills.io"]').forEach(el => {
    if (el.textContent.trim() === 'Agent Skills') el.href = SKILLBOX_CONFIG.links.agentSkills;
    if (el.textContent.trim() === 'Specification') el.href = SKILLBOX_CONFIG.links.agentSpec;
  });
}
