# Contributing to Skillbox

Thank you for contributing to Skillbox! This guide covers everything you need to create high-quality skills and submit them to the registry.

## What is a Skill?

A skill is a focused, actionable instruction set written in Markdown that AI coding assistants (Claude Code, Cursor, Codex, and 30+ tools) follow when working on your code. Skills use the [Agent Skills](https://agentskills.io) open standard.

Think of skills as **expert playbooks** — each one teaches AI how to work like a specialist in a specific technology or pattern.

## Skill Quality Standards

Great skills share these traits:

- **Actionable** — Every section tells the AI what to do, not just what exists
- **Opinionated** — Pick the best approach and state it clearly; avoid "you could do X or Y"
- **Example-driven** — Every pattern includes a code example
- **Focused** — One technology or pattern per skill, done deeply
- **Current** — Use modern, actively maintained patterns and APIs

## Directory Structure

```
skills/
  <category>/
    <skill-name>/
      SKILL.md          # Required: instructions + frontmatter
      scripts/          # Optional: helper scripts
      references/       # Optional: detailed docs
      assets/           # Optional: templates, configs
```

### Categories

| Category   | What belongs here                                    |
|------------|------------------------------------------------------|
| `frontend` | UI frameworks, styling, client-side patterns         |
| `backend`  | Server frameworks, APIs, databases, auth             |
| `devops`   | Infrastructure, CI/CD, containers, deployment        |
| `testing`  | Testing frameworks, strategies, patterns             |
| `general`  | Cross-cutting: code review, git, architecture, docs  |
| `mobile`   | React Native, Flutter, Swift, Kotlin                 |
| `data`     | Data engineering, ML pipelines, analytics            |
| `security` | Security practices, auditing, compliance             |

Propose a new category in your PR description if none fits.

### Naming Rules

- **Skill directories**: lowercase with hyphens, max 64 characters
- Directory name **must match** the `name` field in SKILL.md frontmatter
- Use descriptive names: `react-components` not `react`, `node-express-api` not `express`

## SKILL.md Format

### Frontmatter (Required)

```yaml
---
name: react-components
description: >
  Best practices for building React components with hooks, TypeScript,
  and modern patterns. Use when creating new React components or
  refactoring existing ones.
license: MIT
metadata:
  author: your-github-username
  version: "1.0"
  category: frontend
  tags: react, components, hooks, typescript
---
```

| Field               | Required | Description                                              |
|---------------------|----------|----------------------------------------------------------|
| `name`              | Yes      | Must match directory name. Lowercase with hyphens.       |
| `description`       | Yes      | 2-4 sentences. Explain what it does AND when to use it.  |
| `license`           | No       | Use `MIT` unless you have a reason not to.               |
| `metadata.author`   | Yes      | Your GitHub username.                                    |
| `metadata.version`  | Yes      | Semantic version in quotes (e.g., `"1.0"`, `"2.1"`).    |
| `metadata.category` | Yes      | Must match parent directory name.                        |
| `metadata.tags`     | Yes      | 3-7 comma-separated keywords for search.                |

### Content Structure

After the frontmatter, structure your skill like this:

```markdown
# Skill Title

Brief intro paragraph (1-2 sentences) stating what this skill covers.

## Project Structure

Show the recommended file/folder organization.

## Core Patterns

The main patterns and best practices. This is the largest section.

## Error Handling

How to handle errors in this context.

## Testing

Testing patterns specific to this technology.

## Security

Security considerations (if applicable).

## Common Pitfalls

What to avoid and why.
```

## Writing Guidelines

### 1. Be Prescriptive, Not Descriptive

```markdown
# Bad — descriptive
React components can be written as class components or function components.
Some developers prefer one over the other.

# Good — prescriptive
Always use function components with hooks. Do not use class components.
```

### 2. Show Code for Every Pattern

Every recommendation should include a concrete code example:

```markdown
## State Management

Use `useState` for local state. For complex state logic, use `useReducer`:

\`\`\`typescript
interface State {
  count: number;
  error: string | null;
}

type Action = { type: 'increment' } | { type: 'error'; message: string };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'increment':
      return { ...state, count: state.count + 1 };
    case 'error':
      return { ...state, error: action.message };
  }
}
\`\`\`
```

### 3. Explain the Why

Don't just say what — explain why it matters:

```markdown
# Bad
Use `useMemo` for expensive calculations.

# Good
Use `useMemo` for expensive calculations to prevent re-computation on every
render. This is critical in lists and data-heavy components where a single
parent re-render can cascade into hundreds of child recalculations.
```

### 4. Use Do/Don't Patterns

Pair correct patterns with what to avoid:

```markdown
## File Naming

Use kebab-case for file names:

- `user-profile.tsx` — correct
- `UserProfile.tsx` — avoid (inconsistent with URL conventions)
- `userProfile.tsx` — avoid (ambiguous casing)
```

### 5. Keep Scope Tight

One skill = one technology or pattern, done deeply. Split if needed:

| Too broad                   | Better split                                   |
|-----------------------------|-------------------------------------------------|
| "React"                    | `react-components`, `react-state`, `react-forms` |
| "AWS"                      | `aws-lambda`, `aws-s3`, `aws-dynamodb`           |
| "Testing"                  | `unit-testing`, `e2e-playwright`, `api-testing`   |

### 6. Include Real-World Patterns

Go beyond hello-world examples. Show patterns developers actually encounter:

- Error boundaries with recovery
- Loading states with skeleton screens
- Pagination with cursor-based APIs
- Auth flows with token refresh
- Form validation with nested objects

### 7. Target 80-200 Lines

- Under 50 lines: probably too shallow
- 80-200 lines: ideal depth
- Over 300 lines: consider splitting into multiple skills

## Creating a New Skill

### Step 1: Create the directory

```bash
mkdir -p skills/<category>/<skill-name>
```

### Step 2: Write SKILL.md

Use the frontmatter template and content structure above.

### Step 3: Validate locally

```bash
cd scripts
npx tsx validate-skills.ts
```

### Step 4: Build the registry

```bash
cd scripts
npx tsx build-registry.ts
```

### Step 5: Test your skill

The best way to test a skill is to use it:

1. Copy your `SKILL.md` to `~/.claude/skills/<skill-name>/SKILL.md`
2. Open a project and ask Claude Code to follow the skill
3. Verify the AI produces code that matches your recommendations

## Submitting a Pull Request

1. Fork the repo and create a branch:
   ```bash
   git checkout -b feat/add-<skill-name>
   ```

2. Add your skill following the steps above.

3. Run validation and fix any errors.

4. Commit with a descriptive message:
   ```bash
   git add skills/<category>/<skill-name>/SKILL.md
   git commit -m "feat(skills): add <skill-name> skill"
   ```

5. Push and open a PR against `main`.

6. In your PR description, include:
   - What the skill covers
   - Why it's useful (what gap does it fill?)
   - Your experience with the technology
   - Any references or sources used

## Updating an Existing Skill

1. Edit the SKILL.md directly
2. Bump `metadata.version` for significant changes
3. Run validation and registry build
4. Submit PR with clear description of what changed and why

## Review Criteria

PRs are reviewed for:

| Criterion       | What we check                                                |
|-----------------|--------------------------------------------------------------|
| **Accuracy**    | Are recommendations correct and current?                     |
| **Depth**       | Does it cover essential patterns beyond basics?              |
| **Actionability** | Can the AI directly follow these instructions?             |
| **Examples**    | Does every pattern include working code?                     |
| **Focus**       | Is it one topic done well, not many topics done shallow?     |
| **Format**      | Does it follow the content structure and naming conventions? |

## Stack Detection Integration

Skillbox auto-detects the user's project stack and recommends matching skills. When you create a new skill, make sure it can be discovered by the stack detector.

### How Detection Works

The stack detector scans the workspace for signals:

| Signal Type | Examples |
|-------------|---------|
| **Config files** | `next.config.js`, `Dockerfile`, `.gitlab-ci.yml`, `tailwind.config.ts` |
| **Dependencies** | `package.json` deps, `requirements.txt`, `Gemfile` gems |
| **File extensions** | `.tsx` (React), `.tf` (Terraform), `.jsx` (React) |

Each signal maps to one or more skill IDs. The mapping lives in `cli/src/lib/stackDetector.ts` and `extension/src/lib/stackDetector.ts`.

### Adding Detection for Your Skill

If your skill targets a technology that isn't currently detected, add a rule to both stack detectors:

```typescript
{
  name: "Your Technology",
  skillIds: ["category/your-skill-name"],
  files: ["your-config-file.json"],       // optional
  dependencies: ["your-npm-package"],      // optional
  extensions: [".your-ext"],               // optional
}
```

Include this change in your skill PR.

## Scalability Guidelines

The registry is designed to scale to 100,000+ skills. Follow these practices:

### Registry Performance

- **registry.json is the single source of truth** — the CLI, extension, and website all read from it
- The build script (`scripts/build-registry.ts`) auto-generates it by scanning all `SKILL.md` files
- Do not manually edit `registry.json` — it is overwritten on every build
- Keep skill descriptions concise (under 200 characters) for fast index loading

### Pagination and Search

- The website paginates at 60 skills per page
- The extension loads the full registry into memory but uses filtered views
- Tags and category are the primary search dimensions — choose them carefully

### File Size

- Keep individual SKILL.md files under 20KB
- Target 80-200 lines of content
- Avoid embedding large code samples — link to external references instead
- Do not include binary files (images, etc.) in skill directories

### Category Organization

- Each category should contain 5-50 skills
- If a category grows beyond 50 skills, consider splitting into sub-categories
- Propose new categories via PR when the existing ones don't fit

### Naming Conventions

Consistent naming enables reliable search and detection:

- Skill names: `lowercase-with-hyphens` (max 64 characters)
- Categories: single word, lowercase (`frontend`, `backend`, `data`, `devops`)
- Tags: lowercase, no spaces, 3-7 per skill
- IDs follow the pattern `category/skill-name`

## Architecture Overview

Understanding the system helps you contribute effectively:

```
GitHub Repository (source of truth)
  |
  ├── skills/           SKILL.md files + registry.json
  |
  ├── scripts/          build-registry.ts (scans SKILL.md → registry.json)
  |                     validate-skills.ts (CI validation)
  |
  ├── cli/              npm package "skillbox"
  |   ├── commands/     install, remove, list, search, info, detect, recommend
  |   └── lib/          registry fetcher, installer, stack detector
  |
  ├── extension/        VSCode/Cursor extension "skillbox-vscode"
  |   ├── providers/    search (webview), recommended, available, installed
  |   └── lib/          registry fetcher, installer, stack detector
  |
  └── docs/             GitHub Pages landing site
      └── app.js        Loads registry.json dynamically (paginated)
```

### Data Flow

1. Contributors add/edit `SKILL.md` files and open a PR
2. CI validates frontmatter and builds `registry.json`
3. On merge to `main`, GitHub Actions commits the updated `registry.json`
4. CLI and extension fetch `registry.json` from GitHub raw URL
5. Stack detector scans workspace and maps signals to skill IDs
6. Users install skills which copies `SKILL.md` to tool-specific directories

## Questions?

- Open an issue for questions or skill ideas
- Join our [Discord community](https://discord.com/invite/J7X6gmWk3) for discussions
