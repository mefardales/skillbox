# CLAUDE.md — Skillbox

## What is Skillbox?

Skillbox is a **mission control for small dev teams** (2-12 people). It is NOT a code editor — it's a project-centered collaboration workspace that coordinates projects, AI agents, and coding skills. AI-agnostic and tool-agnostic.

## Architecture

### Desktop App (Electron + React)

- **Main process** (`desktop/src/main.js`) — Node.js: IPC handlers, sql.js database, @lydell/node-pty terminals, GitHub API, file system operations, context generation
- **Preload** (`desktop/src/preload.js`) — Context bridge exposing `window.skillbox` to renderer
- **React UI** (`desktop/src/ui/`) — React 19 + Vite 5 + Tailwind CSS v3 + shadcn/ui components
  - `main.jsx` — Entry point (StoreProvider + ToastProvider)
  - `App.jsx` — Layout shell with resizable panels, shows ProjectDetailView when project selected
  - `hooks/useStore.jsx` — Context-based global store (NOT Zustand — no selector pattern)
  - `hooks/useToast.jsx` — Toast notification system
  - `lib/electronAPI.js` — Bridge to `window.skillbox` preload API with null-safe fallbacks
  - `lib/utils.js` — `cn()` (clsx+twMerge), `formatDate()`, `simpleMarkdown()`
  - `layouts/ActivityBar.jsx` — VS Code-style 48px icon sidebar (toggle on re-click)
  - `layouts/TitleBar.jsx` — Custom title bar
  - `layouts/StatusBar.jsx` — Status bar (CPU, memory, git branch, GitHub, DB stats, uptime, clock)
  - `panels/ProjectSidebar.jsx` — Full file explorer with tree, context menus, inline rename, create/delete, copy path
  - `panels/RightPanel.jsx` — 3-tab panel (Context, Source Control, Info) with VS Code-style collapsible sections
  - `panels/TerminalPanel.jsx` — xterm.js terminal with split/resize
  - `views/` — DashboardView, ProjectDetailView, SkillsView, TeamsView, SettingsView, ExtensionsView, GitView, GitHubView, ChatView, McpView
  - `components/` — AgentModal, SkillDetailPanel, CommandPalette, MarkdownPreview, MonacoViewer
  - `components/ui/` — shadcn/ui primitives (button, input, dialog, tabs, select, etc.)
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

- Activity bar: VS Code-style, icons only, left-border active indicator, re-click toggles sidebar
- Project sidebar: collapsible (`Ctrl+B`), resizable (120-500px), full file explorer with context menus, inline rename, create/delete, copy path
- Main workspace: dashboard (no project selected) or ProjectDetailView (project selected) + other views + terminal panel
- Right panel: collapsible, resizable (140-600px), 3 tabs (Context preview, Source Control, Info/env/deps)
- Terminal panel: resizable height, xterm.js with split support
- All panel borders are draggable resize handles (snap-to-close, drag-to-open)

### File Explorer (Project Sidebar)

- Full file tree with lazy-loaded directories (expand on demand via `read-directory` IPC)
- Native OS context menus via `show-context-menu` IPC: New File, New Folder, Rename, Delete, Copy Path, Copy Relative Path, Reveal in File Explorer
- Inline rename (F2 or context menu) — edits name in-place, smart selection (filename without extension)
- Create files/folders — inline input appears in target directory
- Delete with modal confirmation overlay
- Project-level context menu: Refresh, Remove from Workspace
- Toolbar buttons: Refresh Explorer, New File, New Folder, Add Project
- 40+ file type icon colors mapped by extension
- IPC handlers: `read-directory`, `create-file`, `create-folder`, `rename-path`, `delete-path`, `copy-path`, `copy-relative-path`, `reveal-in-finder`

### Integrated Git Client (Source Control)

- **GitView.jsx** — Full-page source control (Activity Bar > Source Control)
- **RightPanel.jsx** — Source Control tab with feature parity to GitView
- Git operations via `execSync` in main.js with project `cwd`
- IPC handlers: `get-git-info`, `get-git-status-detailed`, `git-stage`, `git-stage-all`, `git-unstage`, `git-unstage-all`, `git-commit`, `git-push`, `git-pull`, `git-fetch`, `git-diff`, `git-stash`, `git-discard`, `git-checkout`, `git-create-branch`, `git-merge`, `git-merge-abort`, `git-delete-branch`
- Detached HEAD handling: separates `displayBranch` (UI) from actual git ref, skips upstream tracking when detached
- `get-git-status-detailed` parses `git status --porcelain` X/Y columns into staged/unstaged/untracked arrays
- StatusBar syncs git branch from store's `gitInfo` (not system stats)
- Standardized Sync button style: `rounded-full bg-primary text-primary-foreground text-[10px] font-bold uppercase`

### Auto-Logging

- Every toast notification automatically logs to platform activity via `useToast` → `addLog`
- Log levels: `error`, `success`, `info` (mapped from toast type)
- No need to manually call `addLog` — just use `toast()` and it gets logged

### Agents (AI Agents, not people)

- **Teams table** stores individual AI agents (not human teams)
- Each agent has: `name`, `description` (role), `members` (JSON array of skills)
- Predefined roles: Backend Developer, Frontend Developer, Full-Stack Developer, DevOps Engineer, QA/Testing, Data Engineer, Code Reviewer, Security Analyst, General Assistant
- Agents are assigned to projects via `project.teams` JSON array of agent IDs
- `AgentModal.jsx` — Create/edit agents: name, role picker, skill search from registry
- `TeamsView.jsx` — Grid of agent cards with role badges, skills, linked projects
- IPC: `assign-team-to-project`, `unassign-team-from-project`

### Context Sync (AI-Agnostic)

Skillbox generates compact context for any AI model (~120 tokens):

```
Source: SQLite DB (projects, agents, skills)
    → context.json (structured, internal)
    → CLAUDE.md / .cursorrules / copilot.md / AGENTS.md (per AI tool)
```

- **`generate-context-sync`** IPC handler: reads project + agents + skills from DB, generates compact markdown, writes to configured AI tool files
- **`get-context-preview`** IPC handler: returns markdown preview + token estimate + file status
- **Settings**: `context.aiTools` (array of enabled tools), `context.autoSync` (boolean)
- **Supported tools**: Claude Code (`CLAUDE.md`), Cursor (`.cursorrules`), GitHub Copilot (`.github/copilot-instructions.md`), Windsurf (`.windsurfrules`), Generic (`AGENTS.md`)
- **Storage management**: per-project storage stats, clean cache/context, stale cleanup (>30 days)

### Multi-Model Chat (ChatView)

Native chat interface supporting multiple LLM providers:

- **Providers**: Anthropic (Claude Sonnet 4, Opus 4, Haiku 3.5), OpenAI (GPT-4o, GPT-4o Mini, o3-mini), Google (Gemini 2.5 Pro/Flash), xAI (Grok 3/Mini), Ollama (local models)
- **Custom models**: Users can add any model ID to any provider via "Add custom model" in selector — persisted in `settings['chat.customModels']`
- **Model selector**: Search bar, capability badges (Fast, Best, Code, Multimodal, Reasoning, Local), grouped by provider
- **Agent mode**: Select an agent from model dropdown to chat with it — responses are context-aware (knows assigned projects, skills, role)
- **MCP tool integration**: "List my MCP tools" triggers `mcpClientAllTools()` and renders tool list with badges (read-only / approval required)
- **Tool approval flow**: Sensitive tools (query_database, run_service, delete_*, write_file) trigger approval modal before execution
- **Multi-model compare**: Toggle compare mode to send same prompt to two models in parallel, responses tagged with "compare" badge
- **Dynamic quick replies**: Context-aware suggestions based on active project, git branch, MCP connections, and configured agents
- **Input toolbar**: Attach file, image, and code snippet buttons above textarea
- **Conversation management**: Sidebar with conversation list, create/delete, message persistence via existing `messages` SQLite table
- **MCP status indicator**: Shows "MCP disconnected" (clickable → navigates to MCP panel) or "MCP :port" in footer
- **API keys**: Per-provider key management stored in settings, accessible via key icon in header

### MCP Integration (Model Context Protocol)

Skillbox acts as both an MCP **server** and **client** for bidirectional tool connectivity.

#### MCP Server (`desktop/src/mcp-server.js`)

Exposes Skillbox capabilities as MCP tools on a local HTTP server:

- **Transport**: `StreamableHTTPServerTransport` from `@modelcontextprotocol/sdk` on `http://127.0.0.1:<port>/mcp`
- **Tools exposed** (7 total):
  - `get_project_env_vars` — Query project environment variables by path
  - `list_agents` — List all AI agents with roles and skills
  - `list_projects` — List all registered projects
  - `git_status` — Get detailed git status for a project
  - `query_database` — Run read-only SQL SELECT (requires human approval)
  - `run_service` — Start/stop/logs for project services (requires human approval)
  - `get_skill_content` — Read a skill's SKILL.md content
- **Security**: Bearer token auth (configurable), rate limiting (60 req/min), human approval for sensitive ops
- **Settings**: `mcp.serverEnabled`, `mcp.serverPort` (0=auto), `mcp.serverToken`
- **IPC handlers**: `mcp-server-start`, `mcp-server-stop`, `mcp-server-status`, `mcp-resolve-approval`, `mcp-get-pending-approvals`
- Auto-starts on app launch if `mcp.serverEnabled` is true

#### MCP Client (`desktop/src/mcp-client.js`)

Connects to external MCP servers so agents can call external tools:

- **HTTP connections**: `StreamableHTTPClientTransport` with optional Bearer auth
- **Stdio connections**: `StdioClientTransport` for local process-based MCP servers (e.g., `npx`, `python -m`)
- Auto-discovers available tools via `client.listTools()`
- **IPC handlers**: `mcp-client-connect-http`, `mcp-client-connect-stdio`, `mcp-client-disconnect`, `mcp-client-call-tool`, `mcp-client-refresh-tools`, `mcp-client-list`, `mcp-client-all-tools`
- Event: `mcp-connections-changed` sent to renderer on connect/disconnect

#### MCP UI (McpView — Tabbed)

- **Server tab**: Server toggle, port, auth token, pending approvals, external connections form (HTTP or stdio), tool invocation log
- **Discover tab**: Curated MCP server presets (GitHub, Supabase, Playwright, Vercel, Notion, Stripe, Slack, Tavily) with SkillsView-matching design (search, category pills, card grid, detail panel with auth guide + tools list)
- **Store state**: `mcpServerStatus`, `mcpConnections`, `mcpApprovals`, `mcpToolEvents` in `useStore()`
- Real-time events: `onMcpServerStatus`, `onMcpConnectionsChanged`, `onMcpApprovalRequest`, `onMcpToolInvoked`

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
- **@modelcontextprotocol/sdk** — MCP server and client (v1.27.1)
- **zod** — Schema validation for MCP tool parameters

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

Generated context files stored in each project:
- `.skillbox/context.json` — Structured project summary
- AI tool files (CLAUDE.md, .cursorrules, etc.) — In project root

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
- `useStore()` returns full object — destructure what you need: `const { projects, teams } = useStore()`
- View switching via `activeView` / `setActiveView` in store
- Panel state: `projectSidebarOpen`, `rightPanelOpen`, `activeRightTab`, `terminalPanelOpen`
- Git state: `gitInfo` and `gitStatus` in store, polled via `refreshGit` using `getGitStatusDetailed`
- Projects are the central entity — agents, skills, envs all link to projects
- When `activeProjectPath` is set and view is `projects`, shows `ProjectDetailView` instead of `DashboardView`
- Toast notifications via `useToast()` hook
- No `prompt()` or `confirm()` in renderer — use state-based UI instead (Electron restriction)
- Radix Select requires non-empty string values — use sentinel values like `"__all"` for "all" option
- Tasks feature was removed — no tasks table, no TasksView, no task-related code
- Teams are AI agents — `teams` table stores agents with role in `description` field and skills in `members` JSON field
- File explorer uses native context menus (`show-context-menu` IPC returns action string or null)
- All file operations (rename, delete, create) refresh parent directory cache after completion
- Cross-platform: no Unix shell commands (`find`, `wc`) — use Node.js fs APIs instead
- MCP server runs in main process alongside Electron; uses `McpServer` high-level API (not deprecated `Server`)
- MCP client connections tracked in `mcpConnections` store state; tools available via `mcpClientAllTools`
- Sensitive MCP operations (query_database, run_service) require UI approval before executing
- ChatView manages its own state internally (not in global store) — conversations, messages, model selection, agent mode
- Chat API keys stored in settings: `chat.anthropicKey`, `chat.openaiKey`, `chat.googleKey`, `chat.xaiKey`
- Custom models stored in `settings['chat.customModels']` as array of `{ id, name, providerId }`
- Agent chat uses `getAgentProjects()` to resolve assigned projects from `project.teams` JSON field
- McpView uses tabbed layout matching GitView pattern (Server + Discover tabs)
- MCP Discover tab replicates SkillsView design system: same header, search, category pills, card grid, detail panel
