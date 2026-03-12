---
name: github-actions
description: >
  GitHub Actions CI/CD pipeline patterns for testing, building, and
  deploying applications. Use this skill when creating or maintaining
  GitHub Actions workflows. Covers workflow syntax, job orchestration,
  caching, secrets management, and common pipeline patterns.
license: MIT
metadata:
  author: skillbox
  version: "1.0"
  category: devops
  tags: github-actions, ci-cd, automation, devops, deployment
---

# GitHub Actions CI/CD Pipelines

## Workflow Structure

Workflows live in `.github/workflows/`. Each YAML file defines a separate workflow.

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm run lint
      - run: npm run typecheck

  test:
    runs-on: ubuntu-latest
    needs: lint
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm test -- --coverage
      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: coverage-report
          path: coverage/
```

## Triggers

```yaml
on:
  push:
    branches: [main, develop]
    paths-ignore: ['docs/**', '*.md']   # Skip docs-only changes
  pull_request:
    branches: [main]
  schedule:
    - cron: '0 6 * * 1'                 # Weekly Monday 6 AM UTC
  workflow_dispatch:                      # Manual trigger
    inputs:
      environment:
        type: choice
        options: [staging, production]
```

- Use `paths` or `paths-ignore` to avoid running pipelines for irrelevant changes.
- Use `concurrency` with `cancel-in-progress: true` to cancel outdated runs on the same branch.
- Use `workflow_dispatch` for manual triggers with input parameters.

## Caching

Cache dependencies to speed up workflows significantly.

```yaml
- uses: actions/setup-node@v4
  with:
    node-version: 20
    cache: npm          # Built-in caching for npm/yarn/pnpm

# For custom caches:
- uses: actions/cache@v4
  with:
    path: |
      ~/.cache/pip
      .mypy_cache
    key: ${{ runner.os }}-pip-${{ hashFiles('requirements.txt') }}
    restore-keys: |
      ${{ runner.os }}-pip-
```

- Use the built-in cache option in `setup-node`, `setup-python`, etc. when available.
- Use `actions/cache` for custom caching (build artifacts, tool caches).
- Key caches on lockfile hashes to invalidate when dependencies change.
- Use `restore-keys` for partial cache hits.

## Secrets and Environment Variables

```yaml
env:
  NODE_ENV: test

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: production          # GitHub Environment with protection rules
    steps:
      - run: deploy.sh
        env:
          API_KEY: ${{ secrets.API_KEY }}
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
```

- Store sensitive values in GitHub Secrets (Settings > Secrets and variables).
- Use GitHub Environments for environment-specific secrets and deployment protection rules.
- Never echo or log secrets. GitHub masks them, but avoid unnecessary exposure.
- Use `GITHUB_TOKEN` (automatically available) for GitHub API calls within workflows.

## Job Dependencies and Matrix

```yaml
jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node-version: [18, 20, 22]
      fail-fast: false
    steps:
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
      - run: npm ci && npm test

  deploy:
    needs: test
    if: github.ref == 'refs/heads/main' && github.event_name == 'push'
    runs-on: ubuntu-latest
    steps:
      - run: echo "Deploying..."
```

- Use `needs` to define job dependencies.
- Use `strategy.matrix` to test across multiple versions, OSes, or configurations.
- Set `fail-fast: false` to run all matrix combinations even if one fails.
- Use `if` conditions to control when jobs run.

## Services (Database Testing)

```yaml
jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: test
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    env:
      DATABASE_URL: postgresql://postgres:postgres@localhost:5432/test
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npm run db:migrate
      - run: npm test
```

## Reusable Workflows

```yaml
# .github/workflows/reusable-deploy.yml
on:
  workflow_call:
    inputs:
      environment:
        required: true
        type: string
    secrets:
      deploy_key:
        required: true

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: ${{ inputs.environment }}
    steps:
      - uses: actions/checkout@v4
      - run: ./deploy.sh
        env:
          DEPLOY_KEY: ${{ secrets.deploy_key }}
```

Call from another workflow:
```yaml
jobs:
  deploy-staging:
    uses: ./.github/workflows/reusable-deploy.yml
    with:
      environment: staging
    secrets:
      deploy_key: ${{ secrets.STAGING_DEPLOY_KEY }}
```

## Common Patterns

### PR Checks with Status Reporting

```yaml
- name: Run tests
  run: npm test -- --reporter=junit --outputFile=results.xml

- name: Publish test results
  uses: dorny/test-reporter@v1
  if: always()
  with:
    name: Test Results
    path: results.xml
    reporter: jest-junit
```

### Build and Push Docker Image

```yaml
- uses: docker/setup-buildx-action@v3
- uses: docker/login-action@v3
  with:
    registry: ghcr.io
    username: ${{ github.actor }}
    password: ${{ secrets.GITHUB_TOKEN }}
- uses: docker/build-push-action@v5
  with:
    push: true
    tags: ghcr.io/${{ github.repository }}:${{ github.sha }}
    cache-from: type=gha
    cache-to: type=gha,mode=max
```

### Release Workflow

```yaml
on:
  push:
    tags: ['v*']

jobs:
  release:
    runs-on: ubuntu-latest
    permissions:
      contents: write
    steps:
      - uses: actions/checkout@v4
      - run: npm ci && npm run build
      - uses: softprops/action-gh-release@v2
        with:
          generate_release_notes: true
          files: dist/*
```

## Best Practices

- Pin action versions to full SHA for security: `actions/checkout@abc123...` or at minimum use major version tags.
- Keep workflows fast. Parallelize independent jobs. Cache aggressively.
- Use `timeout-minutes` on jobs to prevent runaway workflows (default is 6 hours).
- Set minimum `permissions` for `GITHUB_TOKEN` -- follow principle of least privilege.
- Use branch protection rules to require CI checks before merging.
- Store workflow-related scripts in `.github/scripts/` for complex logic.
