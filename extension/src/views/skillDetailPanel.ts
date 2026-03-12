/**
 * Webview panel that renders a skill's detail page.
 *
 * Shows: skill metadata header, install/remove button, tag pills,
 * and the full SKILL.md content rendered as HTML.
 *
 * Uses VSCode CSS variables so it adapts to light and dark themes automatically.
 */

import * as vscode from "vscode";
import type { Skill } from "../lib/types";
import { fetchSkillContent } from "../lib/registry";
import { isInstalled, loadInstalled } from "../lib/installer";

// ---------------------------------------------------------------------------
// Panel manager (one panel per skill, reuse if same skill)
// ---------------------------------------------------------------------------

const openPanels = new Map<string, SkillDetailPanel>();

export class SkillDetailPanel {
  private readonly panel: vscode.WebviewPanel;
  private readonly skill: Skill;
  private disposables: vscode.Disposable[] = [];

  static async show(
    skill: Skill,
    extensionUri: vscode.Uri,
    onInstall: (skill: Skill) => Promise<void>,
    onRemove: (skillId: string) => Promise<void>
  ): Promise<void> {
    const existing = openPanels.get(skill.id);
    if (existing) {
      existing.panel.reveal(vscode.ViewColumn.One);
      return;
    }

    new SkillDetailPanel(skill, extensionUri, onInstall, onRemove);
  }

  private constructor(
    skill: Skill,
    extensionUri: vscode.Uri,
    private readonly onInstall: (skill: Skill) => Promise<void>,
    private readonly onRemove: (skillId: string) => Promise<void>
  ) {
    this.skill = skill;

    this.panel = vscode.window.createWebviewPanel(
      "skillbox.detail",
      skill.name,
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [vscode.Uri.joinPath(extensionUri, "media")],
      }
    );

    openPanels.set(skill.id, this);

    // Initial render while we fetch content
    this.panel.webview.html = this.buildHtml(skill, "Loading skill content...", false);

    // Fetch content async
    this.loadContent();

    // Handle messages from webview
    this.panel.webview.onDidReceiveMessage(
      async (msg: { command: string }) => {
        if (msg.command === "install") {
          await this.onInstall(this.skill);
          // Re-render with updated state
          const content = await this.fetchContent();
          this.panel.webview.html = this.buildHtml(
            this.skill,
            content,
            isInstalled(this.skill.id)
          );
        } else if (msg.command === "remove") {
          await this.onRemove(this.skill.id);
          const content = await this.fetchContent();
          this.panel.webview.html = this.buildHtml(
            this.skill,
            content,
            isInstalled(this.skill.id)
          );
        }
      },
      null,
      this.disposables
    );

    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
  }

  private async fetchContent(): Promise<string> {
    try {
      return await fetchSkillContent(this.skill);
    } catch (err) {
      return `# Error loading skill\n\n${err instanceof Error ? err.message : String(err)}`;
    }
  }

  private async loadContent(): Promise<void> {
    const content = await this.fetchContent();
    this.panel.webview.html = this.buildHtml(
      this.skill,
      content,
      isInstalled(this.skill.id)
    );
  }

  private dispose(): void {
    openPanels.delete(this.skill.id);
    this.disposables.forEach((d) => d.dispose());
  }

  // ---------------------------------------------------------------------------
  // HTML builder
  // ---------------------------------------------------------------------------

  private buildHtml(skill: Skill, rawContent: string, installed: boolean): string {
    const record = loadInstalled().find((s) => s.id === skill.id);
    const toolsList = record?.targets.join(", ") ?? "";
    const installedDate = record
      ? new Date(record.installedAt).toLocaleDateString()
      : "";

    const escapedContent = escapeHtml(rawContent);
    const renderedMd = markdownToHtml(rawContent);

    const tagPills = skill.tags
      .map((t) => `<span class="tag">${escapeHtml(t)}</span>`)
      .join("");

    const btnClass = installed ? "btn btn-remove" : "btn btn-install";
    const btnIcon = installed ? "&#xEA82;" : "&#xEB01;";  // codicon trash / cloud-download
    const btnText = installed ? "Remove Skill" : "Install Globally";
    const btnCmd = installed ? "remove" : "install";

    const scopeBadge = installed
      ? `<span class="badge badge-installed">Installed${toolsList ? ` · ${toolsList}` : ""}</span>`
      : "";

    return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(skill.name)}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    :root {
      --radius: 6px;
      --radius-lg: 10px;
      --gap: 12px;
      --gap-lg: 20px;
      --sb-primary: #7f3bff;
      --sb-primary-dark: #3c07a3;
      --sb-dark: #272727;
      --sb-light: #ffffff;
    }

    body {
      font-family: var(--vscode-font-family, system-ui, sans-serif);
      font-size: var(--vscode-font-size, 13px);
      line-height: 1.6;
      color: var(--vscode-editor-foreground);
      background: var(--vscode-editor-background);
      padding: 0;
      margin: 0;
    }

    /* ── Header ── */
    .header {
      background: var(--vscode-sideBar-background, var(--vscode-editor-background));
      border-bottom: 1px solid var(--vscode-panel-border, var(--vscode-widget-border));
      padding: 20px 24px 16px;
      position: sticky;
      top: 0;
      z-index: 10;
    }

    .header-top {
      display: flex;
      align-items: flex-start;
      gap: 16px;
      flex-wrap: wrap;
    }

    .skill-icon {
      width: 48px;
      height: 48px;
      border-radius: var(--radius-lg);
      background: linear-gradient(135deg, var(--sb-primary), var(--sb-primary-dark));
      color: var(--sb-light);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 22px;
      flex-shrink: 0;
    }

    .header-text { flex: 1; min-width: 0; }

    .skill-name {
      font-size: 18px;
      font-weight: 700;
      color: var(--vscode-editor-foreground);
      line-height: 1.3;
      margin-bottom: 2px;
    }

    .skill-meta {
      font-size: 12px;
      color: var(--vscode-descriptionForeground);
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
      margin-top: 4px;
    }

    .skill-meta .sep { opacity: 0.4; }

    .skill-description {
      margin-top: 8px;
      color: var(--vscode-editor-foreground);
      opacity: 0.85;
      font-size: 13px;
      line-height: 1.55;
    }

    .tags {
      display: flex;
      flex-wrap: wrap;
      gap: 5px;
      margin-top: 10px;
    }

    .tag {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 100px;
      font-size: 11px;
      font-weight: 500;
      background: rgba(127, 59, 255, 0.12);
      color: var(--sb-primary);
      border: 1px solid rgba(127, 59, 255, 0.25);
      letter-spacing: 0.01em;
    }

    .header-actions {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
      margin-top: 14px;
    }

    /* ── Buttons ── */
    .btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 14px;
      border-radius: var(--radius);
      font-size: 12px;
      font-weight: 600;
      font-family: inherit;
      cursor: pointer;
      border: 1px solid transparent;
      transition: opacity 0.1s, filter 0.1s;
      text-decoration: none;
      white-space: nowrap;
    }
    .btn:hover { filter: brightness(1.1); }
    .btn:active { filter: brightness(0.9); }
    .btn:disabled { opacity: 0.5; cursor: not-allowed; filter: none; }

    .btn-install {
      background: linear-gradient(135deg, var(--sb-primary), var(--sb-primary-dark));
      color: var(--sb-light);
      border-color: var(--sb-primary);
    }
    .btn-install:hover {
      background: linear-gradient(135deg, var(--sb-primary), #5a1fd6);
      border-color: var(--sb-primary);
    }

    .btn-remove {
      background: transparent;
      color: var(--vscode-errorForeground, #f48771);
      border-color: var(--vscode-errorForeground, #f48771);
    }
    .btn-remove:hover {
      background: var(--vscode-inputValidation-errorBackground, rgba(244,135,113,0.1));
    }

    .badge {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 4px 10px;
      border-radius: 100px;
      font-size: 11px;
      font-weight: 600;
    }

    .badge-installed {
      background: var(--vscode-testing-iconPassed, rgba(64,196,99,0.15));
      color: var(--vscode-testing-iconPassed, #40c463);
      border: 1px solid currentColor;
    }
    .badge-installed::before {
      content: "✓";
      font-weight: 700;
    }

    /* ── Info grid ── */
    .info-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
      gap: 1px;
      background: var(--vscode-panel-border, var(--vscode-widget-border));
      border: 1px solid var(--vscode-panel-border, var(--vscode-widget-border));
      border-radius: var(--radius);
      margin-top: 14px;
      overflow: hidden;
    }

    .info-cell {
      background: var(--vscode-sideBar-background, var(--vscode-editor-background));
      padding: 10px 12px;
    }

    .info-label {
      font-size: 10px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--vscode-descriptionForeground);
      margin-bottom: 3px;
    }

    .info-value {
      font-size: 12px;
      font-weight: 500;
      color: var(--vscode-editor-foreground);
    }

    /* ── Content area ── */
    .content {
      padding: 24px;
      max-width: 820px;
    }

    /* ── Markdown rendering ── */
    .markdown h1, .markdown h2, .markdown h3,
    .markdown h4, .markdown h5, .markdown h6 {
      color: var(--vscode-editor-foreground);
      font-weight: 700;
      line-height: 1.3;
      margin-top: 24px;
      margin-bottom: 10px;
    }
    .markdown h1 { font-size: 22px; padding-bottom: 8px;
      border-bottom: 1px solid var(--vscode-panel-border, var(--vscode-widget-border)); }
    .markdown h2 { font-size: 18px; }
    .markdown h3 { font-size: 15px; }
    .markdown h4 { font-size: 13px; }

    .markdown p {
      margin-bottom: 12px;
      color: var(--vscode-editor-foreground);
      opacity: 0.9;
    }

    .markdown ul, .markdown ol {
      padding-left: 20px;
      margin-bottom: 12px;
    }
    .markdown li { margin-bottom: 4px; }
    .markdown li > p { margin-bottom: 4px; }

    .markdown code {
      font-family: var(--vscode-editor-font-family, 'Cascadia Code', 'Fira Code', monospace);
      font-size: 0.9em;
      background: var(--vscode-textCodeBlock-background, rgba(128,128,128,0.15));
      color: var(--vscode-textPreformat-foreground, var(--vscode-editor-foreground));
      border-radius: 3px;
      padding: 1px 5px;
    }

    .markdown pre {
      background: var(--vscode-textCodeBlock-background, rgba(0,0,0,0.2));
      border: 1px solid var(--vscode-panel-border, rgba(128,128,128,0.3));
      border-radius: var(--radius);
      padding: 14px 16px;
      overflow-x: auto;
      margin-bottom: 16px;
    }

    .markdown pre code {
      background: none;
      padding: 0;
      font-size: 12.5px;
      line-height: 1.6;
    }

    .markdown blockquote {
      border-left: 3px solid var(--sb-primary);
      margin: 12px 0;
      padding: 8px 14px;
      background: var(--vscode-textBlockQuote-background, rgba(128,128,128,0.08));
      border-radius: 0 var(--radius) var(--radius) 0;
      color: var(--vscode-editor-foreground);
      opacity: 0.85;
    }

    .markdown table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 16px;
      font-size: 12.5px;
    }
    .markdown th {
      text-align: left;
      font-weight: 600;
      padding: 7px 10px;
      background: var(--vscode-sideBar-background, rgba(128,128,128,0.1));
      border-bottom: 2px solid var(--vscode-panel-border, rgba(128,128,128,0.3));
      color: var(--vscode-editor-foreground);
    }
    .markdown td {
      padding: 6px 10px;
      border-bottom: 1px solid var(--vscode-panel-border, rgba(128,128,128,0.15));
      color: var(--vscode-editor-foreground);
      opacity: 0.9;
    }
    .markdown tr:last-child td { border-bottom: none; }

    .markdown hr {
      border: none;
      border-top: 1px solid var(--vscode-panel-border, rgba(128,128,128,0.25));
      margin: 20px 0;
    }

    .markdown a {
      color: var(--vscode-textLink-foreground);
      text-decoration: none;
    }
    .markdown a:hover { text-decoration: underline; }

    .markdown strong { font-weight: 700; }
    .markdown em { font-style: italic; }

    /* YAML frontmatter: hide it */
    .frontmatter-block { display: none; }
  </style>
</head>
<body>
  <div class="header">
    <div class="header-top">
      <div class="skill-icon">${categoryEmoji(skill.category)}</div>
      <div class="header-text">
        <div class="skill-name">${escapeHtml(skill.name)}</div>
        <div class="skill-meta">
          <span>v${escapeHtml(skill.version)}</span>
          <span class="sep">·</span>
          <span>${escapeHtml(skill.author)}</span>
          <span class="sep">·</span>
          <span>${escapeHtml(skill.category)}</span>
          ${installed ? `<span class="sep">·</span><span>Installed ${escapeHtml(installedDate)}</span>` : ""}
        </div>
        <div class="skill-description">${escapeHtml(skill.description)}</div>
        ${tagPills ? `<div class="tags">${tagPills}</div>` : ""}
      </div>
    </div>

    <div class="info-grid">
      <div class="info-cell">
        <div class="info-label">Category</div>
        <div class="info-value">${escapeHtml(capitalize(skill.category))}</div>
      </div>
      <div class="info-cell">
        <div class="info-label">Version</div>
        <div class="info-value">${escapeHtml(skill.version)}</div>
      </div>
      <div class="info-cell">
        <div class="info-label">Author</div>
        <div class="info-value">${escapeHtml(skill.author)}</div>
      </div>
      <div class="info-cell">
        <div class="info-label">Compatible Tools</div>
        <div class="info-value">Claude · Cursor · Codex</div>
      </div>
      ${installed ? `
      <div class="info-cell">
        <div class="info-label">Installed To</div>
        <div class="info-value">${escapeHtml(toolsList || "—")}</div>
      </div>` : ""}
    </div>

    <div class="header-actions">
      <button class="btn ${btnClass}" id="actionBtn" onclick="handleAction('${btnCmd}')">
        ${btnText}
      </button>
      ${scopeBadge}
    </div>
  </div>

  <div class="content">
    <div class="markdown">${renderedMd}</div>
  </div>

  <script>
    const vscode = acquireVsCodeApi();

    function handleAction(cmd) {
      const btn = document.getElementById('actionBtn');
      if (btn) {
        btn.disabled = true;
        btn.textContent = cmd === 'install' ? 'Installing...' : 'Removing...';
      }
      vscode.postMessage({ command: cmd });
    }
  </script>
</body>
</html>`;
  }
}

// ---------------------------------------------------------------------------
// Minimal Markdown → HTML converter
// Handles: headings, bold, italic, code blocks, inline code,
//          blockquotes, unordered/ordered lists, hr, tables, links, images
// ---------------------------------------------------------------------------

function markdownToHtml(md: string): string {
  // Strip YAML frontmatter
  let text = md.replace(/^---[\s\S]*?---\n?/, "");

  const lines = text.split("\n");
  const out: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Fenced code block
    if (/^```/.test(line)) {
      const lang = line.slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) {
        codeLines.push(escapeHtml(lines[i]));
        i++;
      }
      const langAttr = lang ? ` class="language-${escapeHtml(lang)}"` : "";
      out.push(`<pre><code${langAttr}>${codeLines.join("\n")}</code></pre>`);
      i++;
      continue;
    }

    // Headings
    const hMatch = line.match(/^(#{1,6})\s+(.*)/);
    if (hMatch) {
      const level = hMatch[1].length;
      out.push(`<h${level}>${inlineMarkdown(hMatch[2])}</h${level}>`);
      i++;
      continue;
    }

    // Horizontal rule
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(line.trim())) {
      out.push("<hr>");
      i++;
      continue;
    }

    // Blockquote
    if (line.startsWith(">")) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].startsWith(">")) {
        quoteLines.push(lines[i].replace(/^>\s?/, ""));
        i++;
      }
      out.push(`<blockquote>${inlineMarkdown(quoteLines.join(" "))}</blockquote>`);
      continue;
    }

    // Unordered list
    if (/^[-*+]\s/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*+]\s/.test(lines[i])) {
        items.push(`<li>${inlineMarkdown(lines[i].replace(/^[-*+]\s+/, ""))}</li>`);
        i++;
      }
      out.push(`<ul>${items.join("")}</ul>`);
      continue;
    }

    // Ordered list
    if (/^\d+\.\s/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
        items.push(`<li>${inlineMarkdown(lines[i].replace(/^\d+\.\s+/, ""))}</li>`);
        i++;
      }
      out.push(`<ol>${items.join("")}</ol>`);
      continue;
    }

    // Table (detect by pipe characters)
    if (line.includes("|") && lines[i + 1]?.match(/^[\s|:-]+$/)) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].includes("|")) {
        tableLines.push(lines[i]);
        i++;
      }
      if (tableLines.length >= 2) {
        const headers = tableLines[0]
          .split("|")
          .filter((_, idx, arr) => idx > 0 && idx < arr.length - 1)
          .map((h) => `<th>${inlineMarkdown(h.trim())}</th>`)
          .join("");
        const rows = tableLines
          .slice(2)
          .map((row) => {
            const cells = row
              .split("|")
              .filter((_, idx, arr) => idx > 0 && idx < arr.length - 1)
              .map((c) => `<td>${inlineMarkdown(c.trim())}</td>`)
              .join("");
            return `<tr>${cells}</tr>`;
          })
          .join("");
        out.push(
          `<table><thead><tr>${headers}</tr></thead><tbody>${rows}</tbody></table>`
        );
      }
      continue;
    }

    // Blank line → paragraph break
    if (line.trim() === "") {
      out.push("");
      i++;
      continue;
    }

    // Regular paragraph text
    const paraLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !/^(#{1,6}\s|```|[-*+]\s|\d+\.\s|>|-{3,}|\*{3,}|_{3,})/.test(lines[i]) &&
      !lines[i].includes("|")
    ) {
      paraLines.push(lines[i]);
      i++;
    }
    if (paraLines.length > 0) {
      out.push(`<p>${inlineMarkdown(paraLines.join(" "))}</p>`);
    }
  }

  return out.join("\n");
}

function inlineMarkdown(text: string): string {
  return text
    // Inline code (before bold/italic to avoid conflicts)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    // Bold+italic
    .replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>")
    // Bold
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/__(.+?)__/g, "<strong>$1</strong>")
    // Italic
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/_(.+?)_/g, "<em>$1</em>")
    // Links
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>')
    // Images
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img alt="$1" src="$2" style="max-width:100%">');
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function categoryEmoji(category: string): string {
  switch (category.toLowerCase()) {
    case "frontend": return "🖥";
    case "backend": return "⚙";
    case "devops": return "☁";
    case "testing": return "🧪";
    case "general": return "⭐";
    default: return "📦";
  }
}
