/**
 * Workspace stack detection for the Skillbox CLI.
 *
 * Scans the current working directory to detect which technologies
 * are in use and maps them to relevant skill IDs from the registry.
 */

import fs from "fs";
import path from "path";

// ---------------------------------------------------------------------------
// Stack detection rules
// ---------------------------------------------------------------------------

interface StackRule {
  name: string;
  skillIds: string[];
  files?: string[];
  dependencies?: string[];
  extensions?: string[];
}

const STACK_RULES: StackRule[] = [
  // Frontend
  { name: "React", skillIds: ["frontend/react-components", "frontend/react-patterns"], dependencies: ["react", "react-dom"], extensions: [".jsx", ".tsx"] },
  { name: "Next.js", skillIds: ["frontend/nextjs-app-router", "frontend/react-components"], dependencies: ["next"], files: ["next.config.js", "next.config.mjs", "next.config.ts"] },
  { name: "Tailwind CSS", skillIds: ["frontend/tailwind-css"], dependencies: ["tailwindcss"], files: ["tailwind.config.js", "tailwind.config.ts"] },
  { name: "Vercel", skillIds: ["frontend/vercel-deployment"], files: ["vercel.json", ".vercel"], dependencies: ["vercel"] },
  { name: "Ionic", skillIds: ["frontend/ionic-framework"], dependencies: ["@ionic/angular", "@ionic/react", "@ionic/vue"] },
  { name: "Alpine.js", skillIds: ["frontend/alpine-js"], dependencies: ["alpinejs"] },
  { name: "HTMX", skillIds: ["frontend/htmx"], dependencies: ["htmx.org"] },
  { name: "jQuery", skillIds: ["frontend/jquery"], dependencies: ["jquery"] },

  // Backend
  { name: "Express.js", skillIds: ["backend/node-express-api", "backend/api-design"], dependencies: ["express"] },
  { name: "FastAPI", skillIds: ["backend/python-fastapi", "backend/api-design"], dependencies: ["fastapi"] },
  { name: "Django", skillIds: ["backend/django", "frontend/django-templates"], files: ["manage.py"], dependencies: ["django", "Django"] },
  { name: "Ruby on Rails", skillIds: ["backend/ruby-on-rails"], files: ["Gemfile", "Rakefile", "config/routes.rb"] },
  { name: "Spring Boot", skillIds: ["backend/spring-boot"], files: ["pom.xml", "build.gradle", "build.gradle.kts"] },
  { name: "Microservices", skillIds: ["backend/microservices"], files: ["docker-compose.yml", "docker-compose.yaml"] },

  // Databases
  { name: "PostgreSQL", skillIds: ["data/postgresql", "backend/database-design"], dependencies: ["pg", "postgres", "sequelize", "knex", "prisma", "typeorm"] },
  { name: "MongoDB", skillIds: ["data/mongodb"], dependencies: ["mongoose", "mongodb"] },
  { name: "Redis", skillIds: ["data/redis"], dependencies: ["redis", "ioredis"] },
  { name: "Elasticsearch", skillIds: ["data/elasticsearch"], dependencies: ["@elastic/elasticsearch"] },

  // DevOps
  { name: "Docker", skillIds: ["devops/docker-compose"], files: ["Dockerfile", "docker-compose.yml", "docker-compose.yaml"] },
  { name: "Kubernetes", skillIds: ["devops/kubernetes"], files: ["k8s", "kubernetes"] },
  { name: "Terraform", skillIds: ["devops/terraform"], files: ["main.tf", ".terraform"], extensions: [".tf"] },
  { name: "GitHub Actions", skillIds: ["devops/github-actions"], files: [".github/workflows"] },
  { name: "GitLab CI", skillIds: ["devops/gitlab-ci"], files: [".gitlab-ci.yml"] },
  { name: "Nginx", skillIds: ["devops/nginx"], files: ["nginx.conf"] },
  { name: "AWS", skillIds: ["devops/aws-infrastructure"], files: ["serverless.yml", "template.yaml", "cdk.json"], dependencies: ["aws-sdk", "@aws-sdk/client-s3", "aws-cdk-lib"] },

  // Testing
  { name: "Jest / Vitest", skillIds: ["testing/unit-testing"], dependencies: ["jest", "vitest"], files: ["jest.config.js", "jest.config.ts", "vitest.config.ts"] },
  { name: "Playwright", skillIds: ["testing/e2e-playwright"], dependencies: ["@playwright/test", "playwright"], files: ["playwright.config.ts"] },
  { name: "pytest", skillIds: ["testing/unit-testing"], files: ["pytest.ini", "conftest.py"] },

  // General
  { name: "Git", skillIds: ["general/git-workflow"], files: [".git"] },
];

// ---------------------------------------------------------------------------
// Detection result
// ---------------------------------------------------------------------------

export interface DetectedStack {
  name: string;
  signal: string;
  skillIds: string[];
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function detectProjectStack(rootPath: string = process.cwd()): DetectedStack[] {
  const detected: DetectedStack[] = [];
  const deps = readPackageJsonDeps(rootPath);
  const pyDeps = readPythonDeps(rootPath);
  const allDeps = new Set([...deps, ...pyDeps]);
  const rubyDeps = readGemfileDeps(rootPath);
  rubyDeps.forEach((d) => allDeps.add(d));
  const exts = collectExtensions(rootPath, 2);

  for (const rule of STACK_RULES) {
    let signal: string | null = null;

    if (rule.files) {
      for (const file of rule.files) {
        if (fs.existsSync(path.join(rootPath, file))) {
          signal = `Found ${file}`;
          break;
        }
      }
    }

    if (rule.dependencies && !signal) {
      for (const dep of rule.dependencies) {
        if (allDeps.has(dep)) {
          signal = `Dependency: ${dep}`;
          break;
        }
      }
    }

    if (rule.extensions && !signal) {
      for (const ext of rule.extensions) {
        if (exts.has(ext)) {
          signal = `Files: *${ext}`;
          break;
        }
      }
    }

    if (signal) {
      detected.push({ name: rule.name, signal, skillIds: rule.skillIds });
    }
  }

  return detected;
}

export function getRecommendedSkillIds(rootPath?: string): string[] {
  const stacks = detectProjectStack(rootPath);
  const ids = new Set<string>();
  for (const s of stacks) {
    for (const id of s.skillIds) ids.add(id);
  }
  ids.add("general/git-workflow");
  ids.add("general/code-review");
  return Array.from(ids);
}

// ---------------------------------------------------------------------------
// File parsers
// ---------------------------------------------------------------------------

function readPackageJsonDeps(rootPath: string): Set<string> {
  const deps = new Set<string>();
  try {
    const raw = fs.readFileSync(path.join(rootPath, "package.json"), "utf8");
    const pkg = JSON.parse(raw);
    for (const name of Object.keys({ ...pkg.dependencies, ...pkg.devDependencies, ...pkg.peerDependencies })) {
      deps.add(name);
    }
  } catch { /* no package.json */ }
  return deps;
}

function readPythonDeps(rootPath: string): Set<string> {
  const deps = new Set<string>();
  try {
    const content = fs.readFileSync(path.join(rootPath, "requirements.txt"), "utf8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith("#")) {
        const name = trimmed.split(/[>=<!\[]/)[0].trim().toLowerCase();
        if (name) deps.add(name);
      }
    }
  } catch { /* no requirements.txt */ }
  return deps;
}

function readGemfileDeps(rootPath: string): Set<string> {
  const deps = new Set<string>();
  try {
    const content = fs.readFileSync(path.join(rootPath, "Gemfile"), "utf8");
    const matches = content.matchAll(/gem\s+['"]([^'"]+)['"]/g);
    for (const m of matches) deps.add(m[1]);
  } catch { /* no Gemfile */ }
  return deps;
}

function collectExtensions(rootPath: string, maxDepth: number): Set<string> {
  const exts = new Set<string>();
  function walk(dir: string, depth: number) {
    if (depth > maxDepth) return;
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
        if (entry.isFile()) {
          const ext = path.extname(entry.name);
          if (ext) exts.add(ext);
        } else if (entry.isDirectory()) {
          walk(path.join(dir, entry.name), depth + 1);
        }
      }
    } catch { /* permission denied */ }
  }
  walk(rootPath, 0);
  return exts;
}
