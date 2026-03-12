# CLAUDE.md — Skillbox

## What is Skillbox?

Skillbox is a **mission control for small dev teams** (2-12 people). It is NOT a code editor — it's a project-centered collaboration workspace that coordinates projects, teams, tasks, and AI coding skills. AI-agnostic and tool-agnostic.

## Architecture

### Desktop App (Electron)

- **Main process** (`desktop/src/main.js`) — Node.js: IPC handlers, sql.js database, @lydell/node-pty terminals, GitHub API, file system operations
- **Preload** (`desktop/src/preload.js`) — Context bridge exposing `electronAPI` to renderer
- **Renderer** (`desktop/src/renderer.js`) — Frontend logic, multi-panel state management, view switching
- **HTML** (`desktop/src/index.html`) — IDE-style layout: activity bar + project sidebar + main workspace + right panel
- **Styles** (`desktop/src/styles.css`) — oklch color system, dark theme, shadcn-inspired design tokens
- **Launcher** (`desktop/launch.js`) — Must unset `ELECTRON_RUN_AS_NODE` env var (VSCode terminal sets it, breaks Electron init)

### Multi-Panel Layout (v0.4.0)

```
Activity Bar (48px) | Project Sidebar (220px) | Main Workspace (flex) | Right Panel (260px)
```

- Activity bar: VS Code-style, icons only, left-border active indicator
- Project sidebar: collapsible (`Ctrl+B`), search/filter, active project highlighting
- Main workspace: dashboard, tasks kanban, teams, skills views + terminal panel
- Right panel: collapsible, tabbed (Tasks, Activity, Info) — contextual to active project
- Responsive: right panel collapses at 1200px, sidebar at 1000px

### Skill Registry

- Skills live in `skills/<category>/<name>/SKILL.md` with YAML frontmatter
- Registry index: `skills/registry.json` (auto-generated)
- Categories: frontend, backend, data, devops, testing, general

### VSCode/Cursor Extension

- Extension source: `extension/`
- Tree view providers in `extension/src/providers/`
- Stack detection in `extension/src/lib/stackDetector.ts`

### CLI

- Source: `cli/`
- Stack detection: `cli/src/lib/stackDetector.ts`

## Tech Stack

- **Electron** — Desktop shell
- **sql.js** — SQLite in-process (no native bindings)
- **@lydell/node-pty** — Terminal emulation
- **xterm.js v5.3.0** — Terminal rendering
- **oklch** — Color system (dark theme)
- No frontend framework — vanilla JS, single-file renderer

## Design Philosophy

- Must look and feel like a **native desktop app** (VS Code, Linear, Figma)
- NOT a web dashboard — no decorative stat cards, no marketing-style layouts
- Compact, dense, functional — every pixel serves a purpose
- Tight spacing, subtle borders, information density over white space

## Brand Colors

| Color | Hex | oklch |
|-------|-----|-------|
| Primary | `#7c3aed` | `oklch(0.54 0.24 292.6)` |
| Background | — | `oklch(0.14 0.017 292.6)` |
| Surface | — | `oklch(0.19 0.017 292.6)` |
| Border | — | `oklch(0.28 0.015 292.6)` |
| Text | — | `oklch(0.93 0.005 292.6)` |
| Muted text | — | `oklch(0.60 0.015 292.6)` |

## Data Storage

SQLite database via sql.js, stored at:
- **Windows**: `%APPDATA%/skillbox-desktop/skillbox-data/skillbox.db`
- **macOS**: `~/Library/Application Support/skillbox-desktop/skillbox-data/skillbox.db`
- **Linux**: `~/.config/skillbox-desktop/skillbox-data/skillbox.db`

## Development

```bash
cd desktop
npm install
npm start        # production
npm run dev      # with DevTools
```

## Key Patterns

- IPC architecture: main.js handles all Node.js operations, renderer calls via `electronAPI.*`
- All views share a single renderer.js — view switching via `switchView(viewName)`
- Panel state: `projectSidebarOpen`, `rightPanelOpen`, `activeRightTab`
- Projects are the central entity — tasks, teams, skills, envs all link to projects
- Toast notifications via `toast(message, type)` function
