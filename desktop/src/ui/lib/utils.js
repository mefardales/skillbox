import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export function esc(s) {
  if (!s) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function capitalize(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
}

export function formatDate(d) {
  const date = new Date(d);
  const now = new Date();
  const diff = now - date;
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
  return date.toLocaleDateString();
}

export function simpleMarkdown(md) {
  if (!md) return '';
  return md
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\n/g, '<br>');
}

// Apply theme settings to the document
export function applyTheme(settings) {
  const root = document.documentElement;
  const mode = settings['workbench.mode'] || 'dark';
  const accent = settings['workbench.accent'] || 'blue';
  const gray = settings['workbench.gray'] || 'slate';

  // Toggle dark/light class (Tailwind uses 'class' strategy)
  root.classList.toggle('dark', mode === 'dark');
  root.classList.toggle('light', mode === 'light');

  // Set data attributes for CSS variable overrides
  if (accent.startsWith('#')) {
    // Custom hex color — set CSS variables directly
    root.removeAttribute('data-accent');
    root.style.setProperty('--primary', accent);
    root.style.setProperty('--ring', accent);
  } else {
    // Predefined accent — use data attribute (CSS handles the mapping)
    root.style.removeProperty('--primary');
    root.style.removeProperty('--ring');
    root.setAttribute('data-accent', accent);
  }
  root.setAttribute('data-gray', gray);

  // Global font size and family
  const fontSize = settings['ui.fontSize'] || 13;
  const fontFamily = settings['ui.fontFamily'] || 'Inter';
  document.body.style.fontSize = `${fontSize}px`;
  document.body.style.fontFamily = `'${fontFamily}', -apple-system, BlinkMacSystemFont, system-ui, sans-serif`;
}

// Category colors for skills
export const catColors = {
  frontend: '#f97316',
  backend: '#3b82f6',
  data: '#14b8a6',
  devops: '#22c55e',
  testing: '#a855f7',
  general: '#6b7280',
  mobile: '#ef4444',
  security: '#eab308',
};
