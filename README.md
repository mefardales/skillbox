# Skillbox

**Mission control for small dev teams (2-12 people).**

Skillbox is a project-centered collaboration workspace that coordinates projects, AI agents, and coding skills. It is AI-agnostic and tool-agnostic — works with Claude Code, Cursor, GitHub Copilot, Windsurf, and any Agent Skills-compatible tool.

## Why Skillbox?

AI coding assistants are powerful, but they work better with context. Skillbox gives them **expert-level instructions** for specific technologies — turning a general assistant into a React specialist, a FastAPI architect, or a Docker expert. Plus a full project management workspace to coordinate it all.

- **One command install** — `npx skillbox install frontend/react-components`
- **Works everywhere** — Claude Code, Cursor, Codex, and any Agent Skills compatible tool
- **Desktop App** — Full IDE-style workspace (Electron + React + shadcn/ui)
- **Visual GUI** — VSCode/Cursor extension with a browsable skill box panel
- **Smart recommendations** — Auto-detects your project stack and suggests relevant skills
- **AI Agents** — Create agents with roles (Backend Dev, DevOps, QA, etc.) and assign skills
- **Context Sync** — Auto-generate compact context (~120 tokens) for any AI model
- **Integrated Git Client** — Full source control: stage, commit, push, pull, branch, merge, stash, diff
- **File Explorer** — Full tree with context menus, inline rename, create, delete, copy path
- **Zero config** — Auto-detects your tools and installs to the right place

## Quick Start

### CLI

```bash
# Install a skill globally (all detected tools)
npx skillbox install frontend/react-components

# Install to current project only
npx skillbox install backend/node-express-api --project

# Search for skills
npx skillbox search react

# List all available skills
npx skillbox list

# See which AI tools are detected
npx skillbox detect

# Auto-detect your stack and get skill recommendations
npx skillbox recommend
```

### Desktop App (Electron + React)

```bash
cd desktop
npm install
npm run build:ui   # build React UI
npm start          # production mode
npm run dev        # build + DevTools
npm run dev:vite   # hot reload with Vite dev server
```

## Desktop App

A multi-panel IDE-style workspace built with React 19, Vite 5, Tailwind CSS v3, and shadcn/ui:

```
┌──────┬───────────┬──────────────────────┬──────────┐
│  A   │  Project  │   Main Workspace     │  Right   │
│  c   │  Sidebar  │   (views + terminal) │  Panel   │
│  t   │ resizable │                      │ resizable│
│  i   │           │                      │  [tabs]  │
│  v   │  search   │  Dashboard / Project │  Context │
│  i   │  proj-1   │  Agents / Skills     │  SC/Git  │
│  t   │  proj-2   │  Source Control      │  Info    │
│  y   │  proj-3   │  Settings / GitHub   │          │
│ Bar  │           │──────────────────────│          │
│ 48px │  tree     │  Terminal + Logs     │          │
└──────┴───────────┴──────────────────────┴──────────┘
```

### Core Features

- **Multi-Panel Layout** — Activity bar (48px), collapsible project sidebar (resizable 120-500px), main workspace, right info panel (resizable 140-600px)
- **Resizable Panels** — Drag borders to resize, snap-to-close, drag-to-open
- **Keyboard Shortcuts** — `Ctrl+B` toggle sidebar, `Ctrl+Shift+P` command palette, `F2` rename, `Delete` key

### File Explorer (Project Sidebar)

- **Full file tree** — Lazy-loaded, expand/collapse directories on demand
- **Native context menus** — Right-click on files/folders for New File, New Folder, Rename, Delete, Copy Path, Copy Relative Path, Reveal in File Explorer
- **Inline rename** — F2 or right-click > Rename, edits name in-place with smart selection (filename without extension)
- **Create files/folders** — Via context menu, toolbar buttons, or keyboard
- **Delete with confirmation** — Modal confirmation before permanent deletion
- **Copy Path / Relative Path** — Copy to clipboard with toast notification
- **Reveal in File Explorer** — Open OS file manager at location
- **Project management** — Right-click project root: Refresh, Remove from Workspace
- **Search/filter** — Filter projects by name with clear button
- **40+ file type icons** — Color-coded by extension (JS, TS, Python, Rust, Go, etc.)

### Integrated Git Client (Source Control)

Full GitHub Desktop-style git integration accessible from Activity Bar and Right Panel:

- **Branch management** — Switch branches, create new branches (from any base), delete branches (with force option)
- **Staging** — Stage/unstage individual files or all at once
- **Commit** — Commit with message, view commit history with hashes
- **Push / Pull / Fetch** — Sync with remote repositories
- **Merge** — Merge branches with conflict detection and abort capability
- **Stash** — Push/pop/list/drop stash entries
- **Diff viewer** — Color-coded diff display for staged and unstaged changes
- **Discard changes** — Revert individual files with confirmation
- **Detached HEAD support** — Graceful handling of detached HEAD state

### AI Agents

- Create agents with predefined roles: Backend Developer, Frontend Developer, Full-Stack Developer, DevOps Engineer, QA/Testing, Data Engineer, Code Reviewer, Security Analyst, General Assistant
- Assign skills from the registry to each agent
- Assign multiple agents to each project, forming a team
- Agent cards with role badges, skills list, and linked projects

### Context Sync (AI-Agnostic)

Auto-generate compact context (~120 tokens) for any AI model:

```
Source: SQLite DB (projects, agents, skills)
    → context.json (structured, internal)
    → CLAUDE.md / .cursorrules / copilot.md / AGENTS.md (per AI tool)
```

Supported tools: Claude Code, Cursor, GitHub Copilot, Windsurf, Generic (AGENTS.md)

### Skill Registry

- Browse, search, and install skills from the built-in registry
- Create custom skills with markdown editor
- Import skills from Git repositories
- Categories: frontend, backend, data, devops, testing, general

### Multi-Model Chat

Native chat interface with multi-provider LLM support:

- **5 providers** — Anthropic (Claude), OpenAI (GPT-4o), Google (Gemini), xAI (Grok), Ollama (local)
- **Custom models** — Add any model ID to any provider, persisted across sessions
- **Agent mode** — Select an agent from the dropdown to chat with it — context-aware responses (knows projects, skills, role)
- **MCP tool integration** — "List my MCP tools" renders available tools with read-only / approval badges
- **Multi-model compare** — Send same prompt to two models in parallel, compare responses side-by-side
- **Dynamic quick replies** — Context-aware suggestions based on active project, git branch, MCP connections
- **Tool approval flow** — Sensitive operations require explicit approval before execution
- **Conversation management** — Create, switch, delete conversations with message persistence in SQLite

### MCP Server Presets (Discover)

Curated collection of recommended MCP servers with one-click connect:

- **8 presets** — GitHub, Supabase, Playwright, Vercel, Notion, Stripe, Slack, Tavily
- **Discover tab** — Browse presets with search, category filters, and detail panel
- **Auth guides** — Step-by-step instructions for each server's authentication
- **Tool discovery** — See available tools before connecting
- **One-click connect** — Pre-fills connection form and switches to Server tab

### Other Features

- **GitHub Integration** — Connect with PAT, browse repos, clone, import skills
- **Integrated Terminal** — Resizable bottom panel with xterm.js, split support, project context detection
- **Right Panel** — 3 tabs: Context preview (with token count), Source Control (full git), Info (env vars, services, deps, scripts)
- **Toast Notifications** — Auto-logged to platform activity log
- **Status Bar** — CPU, memory, git branch, GitHub status, DB size, uptime, clock
- **Command Palette** — Quick access to all actions
- **Extensions** — Install VSIX extensions, activate/deactivate, webview support
- **Local SQLite Database** — All data persisted locally via sql.js (no cloud dependency)
- **Storage Management** — Per-project storage stats, clean cache/context, stale cleanup (>30 days)
- **Real-time Analysis** — Progress bar during project analysis with step-by-step feedback
- **Cross-platform** — Windows, macOS, Linux

### VSCode / Cursor Extension

1. Install the **Skillbox** extension from the marketplace
2. Click the Skillbox icon in the activity bar
3. Use the **Search bar** at the top to find any skill instantly
4. Check **Recommended for You** — auto-detects your project stack
5. Browse all skills by category, preview content, and install with one click

## Available Skills

### Frontend (11 skills)
| Skill | Description |
|-------|-------------|
| `frontend/react-components` | React component patterns with hooks and TypeScript |
| `frontend/react-patterns` | Advanced React patterns and performance optimization |
| `frontend/nextjs-app-router` | Next.js App Router, server components, data fetching |
| `frontend/tailwind-css` | Tailwind CSS best practices and responsive design |
| `frontend/vercel-deployment` | Vercel deployment and edge functions |
| `frontend/ionic-framework` | Ionic cross-platform mobile development |
| `frontend/alpine-js` | Alpine.js lightweight reactive framework |
| `frontend/htmx` | HTMX hypermedia-driven web applications |
| `frontend/ajax-patterns` | AJAX patterns and async data loading |
| `frontend/jquery` | jQuery DOM manipulation and plugins |
| `frontend/django-templates` | Django template engine patterns |

### Backend (9 skills)
| Skill | Description |
|-------|-------------|
| `backend/node-express-api` | Express.js API design, middleware, error handling |
| `backend/python-fastapi` | FastAPI with Pydantic, async patterns, dependency injection |
| `backend/django` | Django web framework best practices |
| `backend/ruby-on-rails` | Ruby on Rails conventions and patterns |
| `backend/spring-boot` | Spring Boot Java microservices |
| `backend/api-design` | RESTful API design principles and standards |
| `backend/microservices` | Microservices architecture patterns |
| `backend/monolithic-architecture` | Monolithic application design and scaling |
| `backend/database-design` | Schema design, migrations, query optimization |

### Data (6 skills)
| Skill | Description |
|-------|-------------|
| `data/postgresql` | PostgreSQL advanced queries and optimization |
| `data/mongodb` | MongoDB document modeling and aggregation |
| `data/redis` | Redis caching, pub/sub, and data structures |
| `data/elasticsearch` | Elasticsearch indexing and search queries |
| `data/vector-databases` | Vector database operations and embeddings |
| `data/timeseries-databases` | Time-series data modeling and queries |

### DevOps (7 skills)
| Skill | Description |
|-------|-------------|
| `devops/docker-compose` | Docker Compose for development and production |
| `devops/kubernetes` | Kubernetes orchestration and deployment |
| `devops/terraform` | Terraform infrastructure as code |
| `devops/github-actions` | GitHub Actions CI/CD pipelines |
| `devops/gitlab-ci` | GitLab CI/CD configuration |
| `devops/nginx` | Nginx configuration and reverse proxy |
| `devops/aws-infrastructure` | AWS cloud infrastructure and services |

### Testing (2 skills)
| Skill | Description |
|-------|-------------|
| `testing/unit-testing` | Unit testing best practices with Jest, Vitest, pytest |
| `testing/e2e-playwright` | Playwright E2E testing patterns |

### General (2 skills)
| Skill | Description |
|-------|-------------|
| `general/code-review` | Code review checklist and best practices |
| `general/git-workflow` | Git branching, commits, and workflow conventions |

## How It Works

Skillbox uses the [Agent Skills](https://agentskills.io) open standard. Each skill is a `SKILL.md` file with YAML frontmatter that any compatible tool can read.

When you install a skill, Skillbox copies it to the right location for each detected tool:

| Tool | Install Path |
|------|-------------|
| Claude Code | `~/.claude/skills/<name>/SKILL.md` |
| Cursor | `~/.cursor/skills/<name>/SKILL.md` |
| Codex | `~/.codex/skills/<name>/SKILL.md` |

For project-local installs (`--project`), skills go into `.claude/skills/`, `.cursor/skills/`, etc. in your project root.

## Tech Stack

| Technology | Purpose |
|-----------|---------|
| **Electron** | Desktop shell |
| **React 19** | UI framework |
| **Vite 5** | Build tool and dev server |
| **Tailwind CSS v3** | Utility-first styling with PostCSS |
| **shadcn/ui** | Radix UI primitives with CVA variants |
| **sql.js** | SQLite in-process (no native bindings) |
| **@lydell/node-pty** | Terminal emulation |
| **xterm.js v5** | Terminal rendering |
| **lucide-react** | Icon library |
| **Monaco Editor** | Code viewer / diff |

## Project Structure

```
skillbox/
  skills/                    # The skill registry
    frontend/                # Skills by category (11)
    backend/                 # (9)
    data/                    # (6)
    devops/                  # (7)
    testing/                 # (2)
    general/                 # (2)
    registry.json            # Auto-generated index
  desktop/                   # Electron desktop app
    src/main.js              # Main process (IPC, SQLite, Git, terminal, GitHub, file ops)
    src/preload.js           # Context bridge (window.skillbox)
    src/ui/                  # React UI (Vite + Tailwind + shadcn/ui)
      main.jsx               # Entry point (StoreProvider + ToastProvider)
      App.jsx                # Layout shell with resizable panels
      hooks/                 # useStore (context-based global state), useToast
      lib/                   # electronAPI bridge, utils (cn, formatDate, simpleMarkdown)
      layouts/               # ActivityBar (48px icon sidebar), TitleBar, StatusBar
      panels/                # ProjectSidebar (file explorer), RightPanel (3-tab), TerminalPanel
      views/                 # Dashboard, ProjectDetail, Skills, Teams/Agents, Git, GitHub, Settings, Extensions, Chat, MCP
      components/            # AgentModal, SkillDetailPanel, CommandPalette, MarkdownPreview, MonacoViewer
      components/ui/         # shadcn/ui primitives (button, input, dialog, tabs, select, etc.)
    dist-ui/                 # Vite build output
    vite.config.js           # Vite config (root: src/ui, output: dist-ui)
    tailwind.config.js       # Tailwind v3 + shadcn/ui color system
    launch.js                # Launcher (ELECTRON_RUN_AS_NODE fix)
  cli/                       # CLI tool (npm: skillbox)
    src/lib/stackDetector.ts # Project stack auto-detection
  extension/                 # VSCode/Cursor extension
    src/providers/           # Tree views: search, recommended, available, installed
    src/lib/stackDetector.ts # Workspace stack auto-detection
  scripts/                   # Build and validation tools
  docs/                      # GitHub Pages landing site
```

## Data Storage

The desktop app stores all user data locally in SQLite:
- **Windows**: `%APPDATA%/skillbox-desktop/skillbox-data/skillbox.db`
- **macOS**: `~/Library/Application Support/skillbox-desktop/skillbox-data/skillbox.db`
- **Linux**: `~/.config/skillbox-desktop/skillbox-data/skillbox.db`

## CLI Reference

```
skillbox install <category/skill>       Install a skill
skillbox install <skill> --project      Install to current project only
skillbox install <skill> --tool cursor  Install to a specific tool
skillbox remove <category/skill>        Remove an installed skill
skillbox list [category]                List available skills
skillbox search <query>                 Search skills by name, tag, or description
skillbox info <category/skill>          Show full skill details
skillbox detect                         Detect installed AI tools
skillbox recommend                      Auto-detect stack and recommend skills
skillbox recommend --dir ./my-project   Scan a specific directory
```

## Roadmap

- **Skillbox Cloud** — Remote access service for syncing skills, projects, and team configurations across machines
- **Skill Marketplace** — Community-driven skill sharing and discovery platform
- **Real-time Collaboration** — Multi-user team editing with live sync
- **CI/CD Integration** — Auto-deploy skills to projects on push
- **Skill Analytics** — Track which skills are most effective across projects
- **Mobile Companion** — Monitor projects and manage skills from your phone

## Contributing

We welcome skill contributions! See [CONTRIBUTING.md](CONTRIBUTING.md) for the full guide.

The short version:

1. Create `skills/<category>/<skill-name>/SKILL.md`
2. Add YAML frontmatter with name, description, and metadata
3. Write actionable, example-driven instructions
4. Run `npx tsx scripts/validate-skills.ts` to validate
5. Submit a PR

## License

MIT
