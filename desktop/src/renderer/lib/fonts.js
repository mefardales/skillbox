/* ═══════════════════════════════════════════════════════════════
   Skillbox — Platform-Specific Font System (VS Code-style)
   ═══════════════════════════════════════════════════════════════ */

const fontStacks = {
  darwin: {
    ui: '-apple-system, BlinkMacSystemFont, sans-serif',
    mono: "'SF Mono', Monaco, Menlo, Courier, monospace",
  },
  win32: {
    ui: "'Segoe WPC', 'Segoe UI', sans-serif",
    mono: "Consolas, 'Courier New', monospace",
  },
  linux: {
    ui: "system-ui, 'Ubuntu', 'Droid Sans', sans-serif",
    mono: "'Ubuntu Mono', 'Liberation Mono', 'DejaVu Sans Mono', 'Courier New', monospace",
  },
};

export function applyPlatformFonts(platform) {
  const fonts = fontStacks[platform] || fontStacks.linux;
  const root = document.documentElement;
  root.style.setProperty('--font-ui', fonts.ui);
  root.style.setProperty('--font-mono', fonts.mono);
}

export function getTerminalFontFamily(platform) {
  const fonts = fontStacks[platform] || fontStacks.linux;
  // Terminal gets a nicer stack with coding fonts first
  const codingFonts = "'Cascadia Code', 'Fira Code', ";
  return codingFonts + fonts.mono;
}
