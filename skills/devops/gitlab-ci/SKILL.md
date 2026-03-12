---
name: gitlab-ci
description: >
  GitLab CI/CD best practices for building reliable, fast pipelines. Covers
  pipeline structure, caching, Docker builds, environment deployments, secrets
  management, and advanced patterns like DAG and parent-child pipelines. Use
  this skill when writing or reviewing .gitlab-ci.yml configurations.
license: MIT
metadata:
  author: skillbox
  version: "1.0"
  category: devops
  tags: gitlab, ci, cd, pipeline, automation
---

# GitLab CI/CD Best Practices

## Pipeline Structure

Define stages explicitly. Set `retry` at the default level for infrastructure failures only -- do not retry application test failures.

```yaml
stages:
  - lint
  - test
  - build
  - deploy

default:
  image: node:20-alpine
  retry:
    max: 2
    when:
      - runner_system_failure
      - stuck_or_timeout_failure
```

## Job Rules

Use `rules` instead of `only/except`. Extract shared rules into hidden jobs with `extends`:

```yaml
.on-merge-request:
  rules:
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"
    - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH

lint:
  extends: .on-merge-request
  stage: lint
  script: npm run lint

test:
  extends: .on-merge-request
  stage: test
  script: npm test
```

## DAG Pipelines

Use `needs` to run jobs as soon as their dependencies finish, bypassing stage ordering:

```yaml
deploy-frontend:
  stage: deploy
  needs: ["build-frontend"]
  script: ./deploy-frontend.sh

deploy-backend:
  stage: deploy
  needs: ["build-backend"]
  script: ./deploy-backend.sh
```

## Caching and Artifacts

Use `cache` for dependencies redownloaded between pipelines. Use `artifacts` for build outputs consumed by later jobs. Set `expire_in` on all artifacts.

```yaml
build:
  stage: build
  cache:
    key:
      files:
        - package-lock.json
    paths:
      - node_modules/
    policy: pull-push
  artifacts:
    paths:
      - dist/
    expire_in: 1 hour
  script:
    - npm ci
    - npm run build
```

Use `cache:policy: pull` on jobs that only read the cache (test jobs) and `pull-push` on jobs that populate it.

## Docker Builds

Prefer Kaniko over Docker-in-Docker. Kaniko does not require privileged mode:

```yaml
build-image:
  stage: build
  image:
    name: gcr.io/kaniko-project/executor:v1.22.0-debug
    entrypoint: [""]
  script:
    - >-
      /kaniko/executor
      --context $CI_PROJECT_DIR
      --dockerfile Dockerfile
      --destination $CI_REGISTRY_IMAGE:$CI_COMMIT_SHORT_SHA
```

If you must use DinD, always set `DOCKER_TLS_CERTDIR: "/certs"` and use matching image/service versions (e.g., `docker:24` with `docker:24-dind`).

## Environment Deployments

Use `when: manual` for production. Use dynamic environments for merge request review apps:

```yaml
deploy-staging:
  stage: deploy
  script: ./deploy.sh staging
  environment:
    name: staging
    url: https://staging.example.com
  rules:
    - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH

deploy-production:
  stage: deploy
  script: ./deploy.sh production
  environment:
    name: production
    url: https://example.com
  rules:
    - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH
      when: manual
```

## Variables and Secrets

Store secrets in GitLab CI/CD settings (Settings > CI/CD > Variables), not in `.gitlab-ci.yml`. Mark them as "Masked" and "Protected". Use environment scoping to restrict secrets to specific environments. Do not echo or print variables in scripts.

## Parent-Child Pipelines

Split large pipelines into focused child pipelines. Use `strategy: depend` so the parent reflects child results. Use `changes` to trigger only when relevant files change:

```yaml
frontend:
  stage: triggers
  trigger:
    include: frontend/.gitlab-ci.yml
    strategy: depend
  rules:
    - changes:
        - frontend/**/*
```

## Merge Request Pipelines

Prevent duplicate pipelines with a workflow rule:

```yaml
workflow:
  rules:
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"
    - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH
```

This ensures CI runs on the merged result rather than just the source branch.
