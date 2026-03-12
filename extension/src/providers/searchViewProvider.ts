/**
 * WebviewViewProvider for the "Skillbox Search" panel in the sidebar.
 *
 * Renders a persistent search bar with live results inside the sidebar.
 * Users can type to search and click results to preview/install skills.
 */

import * as vscode from "vscode";
import type { Skill } from "../lib/types";
import { fetchRegistry, searchSkills } from "../lib/registry";
import { isInstalled } from "../lib/installer";

export class SearchViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "skillbox.search";

  private _view?: vscode.WebviewView;
  private skills: Skill[] = [];

  constructor(private readonly extensionUri: vscode.Uri) {}

  async resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): Promise<void> {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.extensionUri],
    };

    // Load skills
    try {
      const registry = await fetchRegistry();
      this.skills = registry.skills;
    } catch {
      this.skills = [];
    }

    webviewView.webview.html = this.getHtml(webviewView.webview);

    // Handle messages from webview
    webviewView.webview.onDidReceiveMessage(async (msg) => {
      if (msg.command === "search") {
        const results = searchSkills(this.skills, msg.query);
        const enriched = results.slice(0, 20).map((s) => ({
          ...s,
          installed: isInstalled(s.id),
        }));
        webviewView.webview.postMessage({
          command: "results",
          skills: enriched,
          total: results.length,
        });
      } else if (msg.command === "preview") {
        const skill = this.skills.find((s) => s.id === msg.skillId);
        if (skill) {
          // Create a temporary SkillItem-like object for the preview command
          vscode.commands.executeCommand("skillbox.previewById", skill);
        }
      } else if (msg.command === "install") {
        const skill = this.skills.find((s) => s.id === msg.skillId);
        if (skill) {
          vscode.commands.executeCommand("skillbox.installById", skill);
        }
      }
    });
  }

  /** Refresh the search view after registry changes */
  async refresh(): Promise<void> {
    try {
      const registry = await fetchRegistry();
      this.skills = registry.skills;
    } catch {
      // keep existing
    }
    if (this._view) {
      this._view.webview.html = this.getHtml(this._view.webview);
    }
  }

  private getHtml(_webview: vscode.Webview): string {
    return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: var(--vscode-font-family, system-ui, sans-serif);
      font-size: var(--vscode-font-size, 13px);
      color: var(--vscode-foreground);
      background: var(--vscode-sideBar-background);
      padding: 8px;
    }

    .search-container {
      position: relative;
      margin-bottom: 8px;
    }

    .search-icon {
      position: absolute;
      left: 8px;
      top: 50%;
      transform: translateY(-50%);
      color: var(--vscode-input-placeholderForeground);
      font-size: 14px;
      pointer-events: none;
    }

    .search-input {
      width: 100%;
      padding: 6px 8px 6px 28px;
      border: 1px solid var(--vscode-input-border, transparent);
      background: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      font-family: inherit;
      font-size: 12px;
      border-radius: 4px;
      outline: none;
    }

    .search-input:focus {
      border-color: var(--vscode-focusBorder);
    }

    .search-input::placeholder {
      color: var(--vscode-input-placeholderForeground);
    }

    .results-count {
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
      margin-bottom: 6px;
      padding: 0 2px;
    }

    .skill-list {
      list-style: none;
    }

    .skill-item {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 5px 6px;
      border-radius: 4px;
      cursor: pointer;
      transition: background 0.1s;
    }

    .skill-item:hover {
      background: var(--vscode-list-hoverBackground);
    }

    .skill-icon {
      width: 24px;
      height: 24px;
      border-radius: 4px;
      background: linear-gradient(135deg, #7f3bff, #3c07a3);
      color: #fff;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 11px;
      flex-shrink: 0;
    }

    .skill-info {
      flex: 1;
      min-width: 0;
      overflow: hidden;
    }

    .skill-name {
      font-size: 12px;
      font-weight: 600;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .skill-desc {
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .skill-badge {
      font-size: 10px;
      padding: 1px 5px;
      border-radius: 8px;
      flex-shrink: 0;
    }

    .badge-installed {
      background: rgba(64, 196, 99, 0.15);
      color: #40c463;
    }

    .badge-category {
      background: rgba(127, 59, 255, 0.12);
      color: #7f3bff;
    }

    .empty-state {
      text-align: center;
      padding: 20px 8px;
      color: var(--vscode-descriptionForeground);
      font-size: 12px;
      line-height: 1.5;
    }

    .empty-state .icon {
      font-size: 24px;
      margin-bottom: 8px;
      opacity: 0.5;
    }

    .install-btn {
      background: none;
      border: none;
      color: #7f3bff;
      cursor: pointer;
      font-size: 14px;
      padding: 2px;
      border-radius: 3px;
      flex-shrink: 0;
      display: flex;
      align-items: center;
    }

    .install-btn:hover {
      background: rgba(127, 59, 255, 0.15);
    }
  </style>
</head>
<body>
  <div class="search-container">
    <span class="search-icon">&#x1F50D;</span>
    <input
      type="text"
      class="search-input"
      id="searchInput"
      placeholder="Search skills by name, tag, category..."
      autofocus
    >
  </div>

  <div id="resultsCount" class="results-count" style="display:none;"></div>
  <ul id="resultsList" class="skill-list"></ul>

  <div id="emptyState" class="empty-state">
    <div class="icon">&#x1F50E;</div>
    <div>Type to search across all skills</div>
    <div style="margin-top: 4px; font-size: 11px;">Search by name, category, or tag</div>
  </div>

  <script>
    const vscode = acquireVsCodeApi();
    const input = document.getElementById('searchInput');
    const resultsList = document.getElementById('resultsList');
    const resultsCount = document.getElementById('resultsCount');
    const emptyState = document.getElementById('emptyState');

    let debounceTimer;

    input.addEventListener('input', () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        const query = input.value.trim();
        if (query.length === 0) {
          resultsList.innerHTML = '';
          resultsCount.style.display = 'none';
          emptyState.style.display = 'block';
          return;
        }
        vscode.postMessage({ command: 'search', query });
      }, 200);
    });

    window.addEventListener('message', (event) => {
      const msg = event.data;
      if (msg.command === 'results') {
        renderResults(msg.skills, msg.total);
      }
    });

    function renderResults(skills, total) {
      emptyState.style.display = 'none';

      if (skills.length === 0) {
        resultsCount.style.display = 'none';
        resultsList.innerHTML = '<div class="empty-state"><div class="icon">&#x1F6AB;</div><div>No skills found</div></div>';
        return;
      }

      resultsCount.textContent = total > 20 ? 'Showing 20 of ' + total + ' results' : total + ' result' + (total !== 1 ? 's' : '');
      resultsCount.style.display = 'block';

      resultsList.innerHTML = skills.map(skill => {
        const badge = skill.installed
          ? '<span class="skill-badge badge-installed">installed</span>'
          : '<button class="install-btn" onclick="installSkill(\\''+skill.id+'\\', event)" title="Install">&#x2B07;</button>';

        return '<li class="skill-item" onclick="previewSkill(\\''+skill.id+'\\')">' +
          '<div class="skill-icon">' + categoryAbbr(skill.category) + '</div>' +
          '<div class="skill-info">' +
            '<div class="skill-name">' + escapeHtml(skill.name) + '</div>' +
            '<div class="skill-desc">' + escapeHtml(skill.description).substring(0, 80) + '</div>' +
          '</div>' +
          '<span class="skill-badge badge-category">' + escapeHtml(skill.category) + '</span>' +
          badge +
        '</li>';
      }).join('');
    }

    function previewSkill(id) {
      vscode.postMessage({ command: 'preview', skillId: id });
    }

    function installSkill(id, event) {
      event.stopPropagation();
      vscode.postMessage({ command: 'install', skillId: id });
    }

    function categoryAbbr(cat) {
      const map = { frontend: 'FE', backend: 'BE', devops: 'DO', testing: 'QA', general: 'GN', data: 'DB' };
      return map[cat] || cat.substring(0, 2).toUpperCase();
    }

    function escapeHtml(s) {
      return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }
  </script>
</body>
</html>`;
  }
}
