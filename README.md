# Skillbox

**Skill Pack for your development environment.**

Skillbox is a curated registry of AI coding skills that work across Claude Code, Cursor, Codex, and 30+ tools that support the [Agent Skills](https://agentskills.io) open standard. Install skills with one command and make your AI assistant an expert in any technology.

## Why Skillbox?

AI coding assistants are powerful, but they work better with context. Skills give them **expert-level instructions** for specific technologies — turning a general assistant into a React specialist, a FastAPI architect, or a Docker expert.

- **One command install** — `npx skillbox install frontend/react-components`
- **Works everywhere** — Claude Code, Cursor, Codex, and any Agent Skills compatible tool
- **Visual GUI** — VSCode/Cursor extension with a browsable skill box panel
- **Smart recommendations** — Auto-detects your project stack and suggests relevant skills
- **Search bar** — Find any skill instantly from the sidebar or CLI
- **Community-driven** — Open source registry anyone can contribute to
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

A multi-panel IDE-style workspace built with React, Tailwind CSS, and shadcn/ui:

```
┌──────┬───────────┬──────────────────────┬──────────┐
│  A   │  Project  │   Main Workspace     │  Right   │
│  c   │  Sidebar  │   (views + terminal) │  Panel   │
│  t   │ resizable │                      │ resizable│
│  i   │           │                      │  [tabs]  │
│  v   │  search   │  Dashboard / Tasks   │  Context │
│  i   │  proj-1   │  Teams / Skills      │  Tasks   │
│  t   │  proj-2   │  Settings / GitHub   │  Activity│
│  y   │  proj-3   │──────────────────────│  Info    │
│ Bar  │           │  Terminal Panel      │          │
│ 48px │           │  (resize/maximize)   │          │
└──────┴───────────┴──────────────────────┴──────────┘
```

Features:
- **React + shadcn/ui** — Modern component architecture with Radix UI primitives
- **Resizable Panels** — Drag borders to resize sidebar, right panel, and terminal
- **Multi-Panel Layout** — Activity bar, collapsible project sidebar, main workspace, right info panel
- **Skill Registry** — Browse, create custom skills, import from Git repos
- **Project Management** — Connect folders, auto-detect stack, multi-environment (DEV/QA/PROD)
- **Kanban Tasks** — Drag-and-drop task board with priority levels and project assignment
- **GitHub Integration** — Connect with PAT, browse repos, clone, import skills
- **Integrated Terminal** — Resizable bottom panel with xterm.js and project context detection
- **Agent Teams** — Create teams with specialized skill sets, assign to projects
- **Right Panel** — VS Code-style collapsible sections: Context files, Tasks (CRUD), Activity (git), Info (env vars, services, deps, scripts)
- **Keyboard Shortcuts** — `Ctrl+B` toggle sidebar, panel collapse at responsive breakpoints
- **Local SQLite Database** — All data persisted locally via sql.js (no cloud dependency)
- **Real-time Analysis** — Progress bar during project analysis with step-by-step feedback
- **Auto-generated Context** — AI-readable context files in `.skillbox/project/context/`

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
  desktop/                   # Electron desktop app (v0.5.0)
    src/main.js              # Main process (IPC, SQLite, terminal, GitHub)
    src/preload.js           # Context bridge (window.skillbox)
    src/ui/                  # React UI (Vite + Tailwind + shadcn/ui)
      main.jsx               # Entry point
      App.jsx                # Layout shell with resizable panels
      hooks/                 # useStore (context-based), useToast
      lib/                   # electronAPI bridge, utils
      layouts/               # ActivityBar
      panels/                # ProjectSidebar, RightPanel, TerminalPanel
      views/                 # Dashboard, Tasks, Skills, Teams, Settings, etc.
      components/            # Modals (Task, Team, Skill, Env, GitImport)
      components/ui/         # shadcn/ui primitives (16 components)
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

## Roadmap

- **Skillbox Cloud** — Remote access service for syncing skills, projects, and team configurations across machines. Access your workspace from anywhere via web browser with real-time collaboration.
- **Skill Marketplace** — Community-driven skill sharing and discovery platform.
- **Real-time Collaboration** — Multi-user team editing with live sync.
- **CI/CD Integration** — Auto-deploy skills to projects on push.
- **Skill Analytics** — Track which skills are most effective across projects.
- **Mobile Companion** — Monitor projects and manage skills from your phone.

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
