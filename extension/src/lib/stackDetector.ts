/**
 * Workspace stack detection for Skillbox.
 *
 * Scans the open workspace to detect which technologies are in use
 * (frameworks, languages, tools) and maps them to relevant skill IDs.
 */

import * as vscode from "vscode";
import fs from "fs";
import path from "path";

// ---------------------------------------------------------------------------
// Stack detection rules
// ---------------------------------------------------------------------------

interface StackRule {
  /** Human-readable name of the technology */
  name: string;
  /** Skill IDs that are relevant when this tech is detected */
  skillIds: string[];
  /** Files whose presence signals this technology */
  files?: string[];
  /** package.json dependency names that signal this technology */
  dependencies?: string[];
  /** File extensions that signal this technology */
  extensions?: string[];
}

const STACK_RULES: StackRule[] = [
  // Frontend frameworks
  {
    name: "React",
    skillIds: ["frontend/react-components", "frontend/react-patterns"],
    dependencies: ["react", "react-dom"],
    extensions: [".jsx", ".tsx"],
  },
  {
    name: "Next.js",
    skillIds: ["frontend/nextjs-app-router", "frontend/react-components", "frontend/react-patterns"],
    dependencies: ["next"],
    files: ["next.config.js", "next.config.mjs", "next.config.ts"],
  },
  {
    name: "Tailwind CSS",
    skillIds: ["frontend/tailwind-css"],
    dependencies: ["tailwindcss"],
    files: ["tailwind.config.js", "tailwind.config.ts", "tailwind.config.cjs"],
  },
  {
    name: "Vercel",
    skillIds: ["frontend/vercel-deployment"],
    files: ["vercel.json", ".vercel"],
    dependencies: ["vercel"],
  },
  {
    name: "Ionic",
    skillIds: ["frontend/ionic-framework"],
    dependencies: ["@ionic/angular", "@ionic/react", "@ionic/vue"],
    files: ["ionic.config.json"],
  },
  {
    name: "Alpine.js",
    skillIds: ["frontend/alpine-js"],
    dependencies: ["alpinejs"],
  },
  {
    name: "HTMX",
    skillIds: ["frontend/htmx"],
    dependencies: ["htmx.org"],
  },
  {
    name: "jQuery",
    skillIds: ["frontend/jquery"],
    dependencies: ["jquery"],
  },

  // Backend
  {
    name: "Express.js",
    skillIds: ["backend/node-express-api", "backend/api-design"],
    dependencies: ["express"],
  },
  {
    name: "FastAPI",
    skillIds: ["backend/python-fastapi", "backend/api-design"],
    files: ["main.py"],
    dependencies: ["fastapi"],
  },
  {
    name: "Django",
    skillIds: ["backend/django", "frontend/django-templates", "backend/api-design"],
    files: ["manage.py", "settings.py"],
    dependencies: ["django", "Django"],
  },
  {
    name: "Ruby on Rails",
    skillIds: ["backend/ruby-on-rails", "backend/api-design"],
    files: ["Gemfile", "Rakefile", "config/routes.rb"],
  },
  {
    name: "Spring Boot",
    skillIds: ["backend/spring-boot", "backend/api-design"],
    files: ["pom.xml", "build.gradle", "build.gradle.kts"],
  },
  {
    name: "Microservices",
    skillIds: ["backend/microservices", "backend/api-design"],
    files: ["docker-compose.yml", "docker-compose.yaml"],
  },

  // Databases
  {
    name: "PostgreSQL",
    skillIds: ["data/postgresql", "backend/database-design"],
    dependencies: ["pg", "postgres", "sequelize", "knex", "prisma", "typeorm"],
    files: [".pgpass"],
  },
  {
    name: "MongoDB",
    skillIds: ["data/mongodb", "backend/database-design"],
    dependencies: ["mongoose", "mongodb"],
  },
  {
    name: "Redis",
    skillIds: ["data/redis"],
    dependencies: ["redis", "ioredis"],
  },
  {
    name: "Elasticsearch",
    skillIds: ["data/elasticsearch"],
    dependencies: ["@elastic/elasticsearch", "elasticsearch"],
  },

  // DevOps
  {
    name: "Docker",
    skillIds: ["devops/docker-compose"],
    files: ["Dockerfile", "docker-compose.yml", "docker-compose.yaml", ".dockerignore"],
  },
  {
    name: "Kubernetes",
    skillIds: ["devops/kubernetes"],
    files: ["k8s", "kubernetes", "helm"],
  },
  {
    name: "Terraform",
    skillIds: ["devops/terraform"],
    files: ["main.tf", "terraform.tfvars", ".terraform"],
    extensions: [".tf"],
  },
  {
    name: "GitHub Actions",
    skillIds: ["devops/github-actions"],
    files: [".github/workflows"],
  },
  {
    name: "GitLab CI",
    skillIds: ["devops/gitlab-ci"],
    files: [".gitlab-ci.yml"],
  },
  {
    name: "Nginx",
    skillIds: ["devops/nginx"],
    files: ["nginx.conf", "nginx"],
  },
  {
    name: "AWS",
    skillIds: ["devops/aws-infrastructure"],
    files: ["serverless.yml", "serverless.yaml", "template.yaml", "samconfig.toml", "cdk.json"],
    dependencies: ["aws-sdk", "@aws-sdk/client-s3", "aws-cdk-lib"],
  },

  // Testing
  {
    name: "Jest / Vitest",
    skillIds: ["testing/unit-testing"],
    dependencies: ["jest", "vitest", "@jest/core", "ts-jest"],
    files: ["jest.config.js", "jest.config.ts", "vitest.config.ts"],
  },
  {
    name: "Playwright",
    skillIds: ["testing/e2e-playwright"],
    dependencies: ["@playwright/test", "playwright"],
    files: ["playwright.config.ts", "playwright.config.js"],
  },
  {
    name: "pytest",
    skillIds: ["testing/unit-testing"],
    files: ["pytest.ini", "pyproject.toml", "conftest.py"],
  },

  // General
  {
    name: "Git",
    skillIds: ["general/git-workflow"],
    files: [".git"],
  },
];

// ---------------------------------------------------------------------------
// Detection result
// ---------------------------------------------------------------------------

export interface DetectedStack {
  /** Technology name */
  name: string;
  /** How it was detected */
  signal: string;
  /** Relevant skill IDs */
  skillIds: string[];
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Scan the current workspace and return detected technologies with
 * their associated skill recommendations.
 */
export async function detectWorkspaceStack(): Promise<DetectedStack[]> {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) {
    return [];
  }

  const rootPath = workspaceFolders[0].uri.fsPath;
  const detected: DetectedStack[] = [];
  const seenSkills = new Set<string>();

  // Parse package.json dependencies
  const deps = readPackageJsonDeps(rootPath);

  // Parse requirements.txt / Pipfile
  const pyDeps = readPythonDeps(rootPath);
  const allDeps = new Set([...deps, ...pyDeps]);

  // Parse Gemfile dependencies
  const rubyDeps = readGemfileDeps(rootPath);
  allDeps.forEach((d) => allDeps.add(d));
  rubyDeps.forEach((d) => allDeps.add(d));

  // Collect file extensions in workspace (shallow scan, top 2 levels)
  const extensions = collectExtensions(rootPath, 2);

  for (const rule of STACK_RULES) {
    let signal: string | null = null;

    // Check files
    if (rule.files && !signal) {
      for (const file of rule.files) {
        const fullPath = path.join(rootPath, file);
        if (fs.existsSync(fullPath)) {
          signal = `Found ${file}`;
          break;
        }
      }
    }

    // Check dependencies
    if (rule.dependencies && !signal) {
      for (const dep of rule.dependencies) {
        if (allDeps.has(dep)) {
          signal = `Dependency: ${dep}`;
          break;
        }
      }
    }

    // Check file extensions
    if (rule.extensions && !signal) {
      for (const ext of rule.extensions) {
        if (extensions.has(ext)) {
          signal = `Files: *${ext}`;
          break;
        }
      }
    }

    if (signal) {
      // Only include skill IDs we haven't seen yet
      const newSkillIds = rule.skillIds.filter((id) => !seenSkills.has(id));
      newSkillIds.forEach((id) => seenSkills.add(id));

      detected.push({
        name: rule.name,
        signal,
        skillIds: rule.skillIds,
      });
    }
  }

  return detected;
}

/**
 * Get a flat, deduplicated list of recommended skill IDs for this workspace.
 */
export async function getRecommendedSkillIds(): Promise<string[]> {
  const stacks = await detectWorkspaceStack();
  const ids = new Set<string>();
  for (const stack of stacks) {
    for (const id of stack.skillIds) {
      ids.add(id);
    }
  }
  // Always recommend general skills
  ids.add("general/git-workflow");
  ids.add("general/code-review");
  return Array.from(ids);
}

// ---------------------------------------------------------------------------
// File parsers
// ---------------------------------------------------------------------------

function readPackageJsonDeps(rootPath: string): Set<string> {
  const deps = new Set<string>();
  const pkgPath = path.join(rootPath, "package.json");

  try {
    const raw = fs.readFileSync(pkgPath, "utf8");
    const pkg = JSON.parse(raw);
    const allDeps = {
      ...pkg.dependencies,
      ...pkg.devDependencies,
      ...pkg.peerDependencies,
    };
    for (const name of Object.keys(allDeps)) {
      deps.add(name);
    }
  } catch {
    // No package.json or invalid JSON
  }

  return deps;
}

function readPythonDeps(rootPath: string): Set<string> {
  const deps = new Set<string>();

  // requirements.txt
  try {
    const reqPath = path.join(rootPath, "requirements.txt");
    const content = fs.readFileSync(reqPath, "utf8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith("#")) {
        const name = trimmed.split(/[>=<!\[]/)[0].trim().toLowerCase();
        if (name) deps.add(name);
      }
    }
  } catch {
    // No requirements.txt
  }

  // pyproject.toml (basic parsing for dependencies)
  try {
    const pyprojectPath = path.join(rootPath, "pyproject.toml");
    const content = fs.readFileSync(pyprojectPath, "utf8");
    const depMatch = content.match(/dependencies\s*=\s*\[([\s\S]*?)\]/);
    if (depMatch) {
      const depBlock = depMatch[1];
      const nameMatches = depBlock.matchAll(/"([a-zA-Z0-9_-]+)/g);
      for (const m of nameMatches) {
        deps.add(m[1].toLowerCase());
      }
    }
  } catch {
    // No pyproject.toml
  }

  return deps;
}

function readGemfileDeps(rootPath: string): Set<string> {
  const deps = new Set<string>();

  try {
    const gemfilePath = path.join(rootPath, "Gemfile");
    const content = fs.readFileSync(gemfilePath, "utf8");
    const gemMatches = content.matchAll(/gem\s+['"]([^'"]+)['"]/g);
    for (const m of gemMatches) {
      deps.add(m[1]);
    }
  } catch {
    // No Gemfile
  }

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
    } catch {
      // Permission denied or other FS error
    }
  }

  walk(rootPath, 0);
  return exts;
}
