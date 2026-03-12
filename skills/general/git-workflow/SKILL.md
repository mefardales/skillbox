---
name: git-workflow
description: >
  Git workflow patterns including branching strategies, commit conventions,
  rebasing, and collaboration practices. Use this skill when working with
  Git for version control, resolving merge conflicts, or establishing
  team Git workflows.
license: MIT
metadata:
  author: skillbox
  version: "1.0"
  category: general
  tags: git, workflow, branching, commits, version-control
---

# Git Workflow and Conventions

## Branching Strategy

Use a trunk-based development model with short-lived feature branches.

```
main (production-ready)
  ├── feature/user-auth
  ├── fix/login-redirect
  ├── chore/update-deps
  └── refactor/api-client
```

### Branch Naming

Use prefixes to categorize branches:

- `feature/` -- New functionality: `feature/user-registration`
- `fix/` -- Bug fixes: `fix/cart-total-calculation`
- `chore/` -- Maintenance: `chore/upgrade-node-20`
- `refactor/` -- Code improvements: `refactor/extract-auth-service`
- `docs/` -- Documentation: `docs/api-endpoints`
- `test/` -- Test additions: `test/payment-edge-cases`

Rules:
- Use lowercase with hyphens: `feature/add-search-filter`, not `Feature/AddSearchFilter`.
- Keep names short but descriptive. Include a ticket number if applicable: `fix/PROJ-123-login-error`.
- Branch from `main`. Merge back to `main`. Delete the branch after merging.
- Keep branches short-lived (1-3 days). Long-lived branches accumulate merge conflicts.

## Commit Messages

Follow the Conventional Commits specification.

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

- `feat` -- A new feature visible to users.
- `fix` -- A bug fix.
- `refactor` -- Code change that neither fixes a bug nor adds a feature.
- `test` -- Adding or updating tests.
- `docs` -- Documentation changes.
- `chore` -- Build, CI, dependency updates, tooling.
- `perf` -- Performance improvement.
- `style` -- Formatting, whitespace (no logic changes).

### Examples

```
feat(auth): add password reset via email

Users can now request a password reset email from the login page.
The reset token expires after 1 hour.

Closes #234
```

```
fix(cart): correct tax calculation for exempt items

Tax-exempt items were incorrectly included in the tax base.
Updated calculateTax to filter exempt items before computation.
```

```
refactor(api): extract HTTP client into shared module
```

### Rules

- Subject line: imperative mood, no period, max 72 characters.
- Body: explain *why*, not *what*. The diff shows what changed.
- Reference issues in the footer: `Closes #123`, `Fixes #456`.
- One logical change per commit. Do not mix a feature with a refactor.

## Daily Workflow

### Starting Work

```bash
git checkout main
git pull origin main
git checkout -b feature/my-feature
```

### While Working

Commit frequently in small, logical chunks.

```bash
git add src/auth/login.ts src/auth/login.test.ts
git commit -m "feat(auth): add login form validation"

git add src/auth/session.ts
git commit -m "feat(auth): implement session management"
```

- Stage specific files, not `git add .`, to keep commits focused.
- Commit when you reach a logical checkpoint, not at the end of the day.

### Staying Up to Date

Rebase your branch on `main` to keep a linear history.

```bash
git fetch origin
git rebase origin/main
```

- Rebase unpushed commits freely.
- After pushing, prefer `git merge origin/main` into your branch to avoid rewriting shared history.
- Never force-push to shared branches (`main`, `develop`).

### Before Opening a PR

```bash
# Ensure your branch is up to date
git fetch origin
git rebase origin/main

# Run tests locally
npm test

# Review your own changes
git diff origin/main...HEAD
```

## Merge Strategies

### Squash and Merge (recommended for feature branches)

Combines all branch commits into a single commit on `main`. Keeps the main history clean.

- Use when the branch has messy or WIP commits.
- Write a clear squash commit message summarizing the change.

### Rebase and Merge

Replays each branch commit on top of `main`. Preserves individual commit history.

- Use when each commit is clean, logical, and passes tests independently.
- Requires clean commit discipline on the branch.

### Merge Commit

Creates a merge commit. Preserves the branch history.

- Use for long-running branches or release merges where history preservation matters.

## Resolving Merge Conflicts

```bash
git fetch origin
git rebase origin/main
# Conflicts appear -- resolve them in your editor

# After resolving each file:
git add <resolved-file>
git rebase --continue

# If the rebase becomes too complex:
git rebase --abort
```

- Resolve conflicts by understanding both changes, not by picking one side blindly.
- After resolving, verify the code compiles and tests pass.
- If a rebase produces many conflicts, consider merging `main` into your branch instead.

## Interactive Rebase (Cleaning Up Before PR)

Clean up commits before requesting review.

```bash
git rebase -i origin/main
```

Common operations:
- `squash` (s): combine a commit with the previous one.
- `fixup` (f): like squash but discard the commit message.
- `reword` (r): edit the commit message.
- `drop` (d): remove a commit.

Use this to:
- Squash WIP commits into logical units.
- Reword unclear commit messages.
- Remove debugging commits.

## Git Stash

```bash
# Save current work temporarily
git stash push -m "WIP: login form styling"

# List stashes
git stash list

# Restore the latest stash
git stash pop

# Restore a specific stash
git stash pop stash@{2}
```

Use stash when you need to switch branches without committing incomplete work.

## Tags and Releases

```bash
# Create an annotated tag
git tag -a v1.2.0 -m "Release 1.2.0: user dashboard"

# Push tags
git push origin v1.2.0
```

- Use semantic versioning: `MAJOR.MINOR.PATCH`.
- Use annotated tags (`-a`) for releases. Lightweight tags for temporary markers.

## Common Recovery Operations

```bash
# Undo the last commit (keep changes staged)
git reset --soft HEAD~1

# Discard changes in a specific file
git checkout -- path/to/file

# Find a lost commit
git reflog

# Cherry-pick a commit from another branch
git cherry-pick <commit-hash>

# Revert a merged commit (creates a new commit that undoes it)
git revert <commit-hash>
```

- Prefer `git revert` over `git reset` for commits that have been pushed.
- Use `git reflog` to recover from mistakes. It keeps a log of all HEAD changes for 90 days.

## .gitignore

Maintain a thorough `.gitignore` from the start.

```
# Dependencies
node_modules/
venv/
__pycache__/

# Build output
dist/
build/
.next/

# Environment files
.env
.env.local
.env.production

# IDE
.vscode/settings.json
.idea/

# OS
.DS_Store
Thumbs.db

# Test & coverage
coverage/
playwright-report/
```

- Use gitignore.io or GitHub's templates as a starting point.
- Never commit secrets, credentials, or environment files.
- Add generated files to `.gitignore`, not to the repository.
