# CLAUDE.md — Skillbox

## What is Skillbox?

Skillbox is a **mission control for small dev teams** (2-12 people). It is NOT a code editor — it's a project-centered collaboration workspace that coordinates projects, teams, tasks, and AI coding skills. AI-agnostic and tool-agnostic.

## Architecture

### Desktop App (Electron + React)

- **Main process** (`desktop/src/main.js`) — Node.js: IPC handlers, sql.js database, @lydell/node-pty terminals, GitHub API, file system operations
- **Preload** (`desktop/src/preload.js`) — Context bridge exposing `window.skillbox` to renderer
- **React UI** (`desktop/src/ui/`) — React 19 + Vite 5 + Tailwind CSS v3 + shadcn/ui components
  - `main.jsx` — Entry point (StoreProvider + ToastProvider)
  - `App.jsx` — Layout shell with resizable panels
  - `hooks/useStore.jsx` — Context-based global store (NOT Zustand — no selector pattern)
  - `hooks/useToast.jsx` — Toast notification system
  - `lib/electronAPI.js` — Bridge to `window.skillbox` preload API with null-safe fallbacks
  - `lib/utils.js` — `cn()` (clsx+twMerge), `formatDate()`, `simpleMarkdown()`
  - `layouts/ActivityBar.jsx` — VS Code-style 48px icon sidebar
  - `panels/ProjectSidebar.jsx` — Explorer with file tree, search, add project
  - `panels/RightPanel.jsx` — 4-tab panel (Context, Tasks, Activity, Info) with VS Code-style collapsible sections
  - `panels/TerminalPanel.jsx` — xterm.js terminal with split/resize
  - `views/` — DashboardView, TasksView, SkillsView, TeamsView, SettingsView, ExtensionsView, HistoryView, GitHubView
  - `components/` — TaskModal, TeamModal, SkillModal, SkillDetailPanel, EnvModal, GitImportModal
  - `components/ui/` — 16 shadcn/ui primitives (button, input, dialog, tabs, select, etc.)
- **Legacy renderer** (`desktop/src/renderer.js`) — Vanilla JS fallback (kept for backwards compatibility)
- **Launcher** (`desktop/launch.js`) — Must unset `ELECTRON_RUN_AS_NODE` env var (VSCode terminal sets it, breaks Electron init)

### Build Pipeline

```bash
cd desktop
npm run build:ui    # vite build → dist-ui/
npm run dev         # build + launch with DevTools
npm run dev:vite    # hot reload via Vite dev server
```

- Vite builds from `src/ui/` → `dist-ui/`
- Electron loads `dist-ui/index.html` (falls back to legacy `src/index.html`)
- `--vite` flag connects to `http://localhost:5173` for hot reload

### Multi-Panel Layout (v0.5.0)

```
Activity Bar (48px) | Project Sidebar (resizable) | Main Workspace (flex) | Right Panel (resizable)
```

- Activity bar: VS Code-style, icons only, left-border active indicator
- Project sidebar: collapsible (`Ctrl+B`), resizable (160-400px), search/filter, active project highlighting
- Main workspace: dashboard, tasks kanban, teams, skills views + terminal panel
- Right panel: collapsible, resizable (200-500px), 4 tabs (Context, Tasks, Activity, Info)
- Terminal panel: resizable height (100-600px), xterm.js with split support
- All panel borders are draggable resize handles (highlight blue on hover)

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
- **React 19** — UI framework (migrated from vanilla JS in v0.5.0)
- **Vite 5** — Build tool and dev server
- **Tailwind CSS v3** — Utility-first styling with PostCSS
- **shadcn/ui** — Radix UI primitives with CVA variants
- **sql.js** — SQLite in-process (no native bindings)
- **@lydell/node-pty** — Terminal emulation
- **xterm.js v5.3.0** — Terminal rendering (loaded as global script in `public/`)
- **lucide-react** — Icon library

## Design Philosophy

- Must look and feel like a **native desktop app** (VS Code, Linear, Figma)
- NOT a web dashboard — no decorative stat cards, no marketing-style layouts
- Compact, dense, functional — every pixel serves a purpose
- Tight spacing, subtle borders, information density over white space
- No hardcoded AI brand names — use generic terms ("Sync", "AI assistant")

## Theme Colors (CSS Variables)

| Variable | Dark | Light |
|----------|------|-------|
| `--background` | `#09090b` | `#ffffff` |
| `--foreground` | `#fafafa` | `#09090b` |
| `--primary` | `#3b82f6` | `#2563eb` |
| `--border` | `#27272a` | `#e4e4e7` |
| `--muted-foreground` | `#a1a1aa` | `#71717a` |

## Data Storage

SQLite database via sql.js, stored at:
- **Windows**: `%APPDATA%/skillbox-desktop/skillbox-data/skillbox.db`
- **macOS**: `~/Library/Application Support/skillbox-desktop/skillbox-data/skillbox.db`
- **Linux**: `~/.config/skillbox-desktop/skillbox-data/skillbox.db`

## Development

```bash
cd desktop
npm install
npm run build:ui   # build React UI
npm start          # production
npm run dev        # build + DevTools
npm run dev:vite   # hot reload mode
```

## Key Patterns

- IPC architecture: main.js handles all Node.js operations, renderer calls via `electronAPI.*`
- `electronAPI.js` wraps `window.skillbox` with null-safe `call()` helper
- `useStore()` returns full object — destructure what you need: `const { projects, tasks } = useStore()`
- View switching via `activeView` / `setActiveView` in store
- Panel state: `projectSidebarOpen`, `rightPanelOpen`, `activeRightTab`, `terminalPanelOpen`
- Projects are the central entity — tasks, teams, skills, envs all link to projects
- Toast notifications via `useToast()` hook
- No `prompt()` or `confirm()` in renderer — use state-based UI instead (Electron restriction)
- Radix Select requires non-empty string values — use sentinel values like `"__all"` for "all" option
