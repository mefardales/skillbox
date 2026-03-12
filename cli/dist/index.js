"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// package.json
var require_package = __commonJS({
  "package.json"(exports2, module2) {
    module2.exports = {
      name: "skillbox",
      version: "0.1.0",
      description: "Skill Pack for your development environment",
      keywords: [
        "ai",
        "skills",
        "claude",
        "cursor",
        "codex",
        "agent-skills",
        "agentskills"
      ],
      homepage: "https://agentskills.io",
      repository: {
        type: "git",
        url: "https://github.com/MarcoRiformworking/skillbox.git"
      },
      license: "MIT",
      type: "commonjs",
      bin: {
        skillbox: "./bin/skillbox.js"
      },
      files: [
        "bin",
        "dist"
      ],
      scripts: {
        build: "tsup src/index.ts --format cjs --dts --clean --target node18",
        dev: "tsup src/index.ts --format cjs --watch",
        prepublishOnly: "npm run build",
        typecheck: "tsc --noEmit"
      },
      dependencies: {
        chalk: "^4.1.2",
        commander: "^12.1.0",
        "node-fetch": "^2.7.0",
        ora: "^5.4.1"
      },
      devDependencies: {
        "@types/node": "^20.14.0",
        "@types/node-fetch": "^2.6.11",
        tsup: "^8.1.0",
        typescript: "^5.5.2"
      },
      engines: {
        node: ">=18.0.0"
      }
    };
  }
});

// src/index.ts
var import_commander = require("commander");

// src/commands/install.ts
var import_chalk = __toESM(require("chalk"));
var import_ora = __toESM(require("ora"));

// src/lib/registry.ts
var import_fs2 = __toESM(require("fs"));
var import_node_fetch = __toESM(require("node-fetch"));

// src/lib/config.ts
var import_fs = __toESM(require("fs"));
var import_path = __toESM(require("path"));
var import_os = __toESM(require("os"));
var SKILLBOX_DIR = import_path.default.join(import_os.default.homedir(), ".skillbox");
var CONFIG_PATH = import_path.default.join(SKILLBOX_DIR, "config.json");
var INSTALLED_PATH = import_path.default.join(SKILLBOX_DIR, "installed.json");
var CACHE_DIR = import_path.default.join(SKILLBOX_DIR, "cache");
var DEFAULT_CONFIG = {
  registryUrl: "https://raw.githubusercontent.com/MarcoRiformworking/skillbox/main/skills/registry.json",
  cacheTtlMs: 60 * 60 * 1e3,
  // 1 hour
  defaultScope: "global",
  ignoredTools: []
};
function ensureDir(dir) {
  if (!import_fs.default.existsSync(dir)) {
    import_fs.default.mkdirSync(dir, { recursive: true });
  }
}
function readJson(filePath, fallback) {
  try {
    const raw = import_fs.default.readFileSync(filePath, "utf8");
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}
function writeJson(filePath, data) {
  ensureDir(import_path.default.dirname(filePath));
  import_fs.default.writeFileSync(filePath, JSON.stringify(data, null, 2) + "\n", "utf8");
}
function loadConfig() {
  const stored = readJson(CONFIG_PATH, {});
  return { ...DEFAULT_CONFIG, ...stored };
}
function getRegistryUrl() {
  return process.env.SKILLBOX_REGISTRY || loadConfig().registryUrl;
}
function loadInstalled() {
  return readJson(INSTALLED_PATH, []);
}
function saveInstalled(skills) {
  writeJson(INSTALLED_PATH, skills);
}
function trackInstall(skill) {
  const installed = loadInstalled();
  const idx = installed.findIndex((s) => s.id === skill.id);
  if (idx !== -1) {
    installed[idx] = skill;
  } else {
    installed.push(skill);
  }
  saveInstalled(installed);
}
function untrackInstall(skillId) {
  const installed = loadInstalled();
  const filtered = installed.filter((s) => s.id !== skillId);
  if (filtered.length === installed.length) return false;
  saveInstalled(filtered);
  return true;
}
function getInstalledSkill(skillId) {
  return loadInstalled().find((s) => s.id === skillId);
}
function getCachePath(key) {
  ensureDir(CACHE_DIR);
  const safe = key.replace(/[^a-z0-9]/gi, "_");
  return import_path.default.join(CACHE_DIR, `${safe}.json`);
}
function readCache(key, ttlMs) {
  const filePath = getCachePath(key);
  try {
    const entry = readJson(filePath, null);
    if (!entry) return null;
    if (Date.now() - entry.cachedAt > ttlMs) return null;
    return entry.data;
  } catch {
    return null;
  }
}
function writeCache(key, data) {
  const filePath = getCachePath(key);
  const entry = { cachedAt: Date.now(), data };
  writeJson(filePath, entry);
}

// src/lib/registry.ts
var CACHE_KEY = "registry";
async function fetchRegistryRemote(url) {
  if (url.startsWith("file://") || url.startsWith("/") || /^[a-zA-Z]:[\\/]/.test(url)) {
    const filePath = url.replace(/^file:\/\//, "");
    const raw = import_fs2.default.readFileSync(filePath, "utf8");
    const data2 = JSON.parse(raw);
    validateRegistry(data2);
    return data2;
  }
  const res = await (0, import_node_fetch.default)(url, {
    headers: { "User-Agent": "skillbox-cli/0.1.0" }
  });
  if (!res.ok) {
    throw new Error(
      `Failed to fetch registry (HTTP ${res.status}): ${res.statusText}
URL: ${url}`
    );
  }
  let data;
  try {
    data = await res.json();
  } catch {
    throw new Error("Registry response is not valid JSON.");
  }
  validateRegistry(data);
  return data;
}
function validateRegistry(data) {
  if (!data || typeof data !== "object") {
    throw new Error("Registry payload is not an object.");
  }
  const obj = data;
  if (!Array.isArray(obj.skills)) {
    throw new Error('Registry payload is missing "skills" array.');
  }
}
async function fetchRegistry(forceRefresh = false) {
  const config = loadConfig();
  const url = getRegistryUrl();
  if (!forceRefresh) {
    const cached = readCache(CACHE_KEY, config.cacheTtlMs);
    if (cached) return cached;
  }
  const data = await fetchRegistryRemote(url);
  writeCache(CACHE_KEY, data);
  return data;
}
async function findSkill(query, forceRefresh = false) {
  const registry = await fetchRegistry(forceRefresh);
  const q = query.toLowerCase();
  const exact = registry.skills.find((s) => s.id.toLowerCase() === q);
  if (exact) return exact;
  return registry.skills.find((s) => {
    const parts = s.id.toLowerCase().split("/");
    return parts[parts.length - 1] === q;
  });
}
async function listSkills(category, forceRefresh = false) {
  const registry = await fetchRegistry(forceRefresh);
  if (!category) return registry.skills;
  const cat = category.toLowerCase();
  return registry.skills.filter((s) => s.category.toLowerCase() === cat);
}
async function searchSkills(query, forceRefresh = false) {
  const registry = await fetchRegistry(forceRefresh);
  const q = query.toLowerCase();
  return registry.skills.filter((s) => {
    return s.id.toLowerCase().includes(q) || s.name.toLowerCase().includes(q) || s.description.toLowerCase().includes(q) || s.tags.some((t) => t.toLowerCase().includes(q));
  });
}
async function listCategories(forceRefresh = false) {
  const registry = await fetchRegistry(forceRefresh);
  const cats = new Set(registry.skills.map((s) => s.category));
  return Array.from(cats).sort();
}
async function fetchSkillContent(skill) {
  const res = await (0, import_node_fetch.default)(skill.skillUrl, {
    headers: { "User-Agent": "skillbox-cli/0.1.0" }
  });
  if (!res.ok) {
    throw new Error(
      `Failed to download skill "${skill.id}" (HTTP ${res.status})
URL: ${skill.skillUrl}`
    );
  }
  return res.text();
}

// src/lib/installer.ts
var import_fs4 = __toESM(require("fs"));
var import_path3 = __toESM(require("path"));

// src/lib/detector.ts
var import_fs3 = __toESM(require("fs"));
var import_path2 = __toESM(require("path"));
var import_os2 = __toESM(require("os"));
var import_child_process = require("child_process");
var HOME = import_os2.default.homedir();
var IS_WINDOWS = process.platform === "win32";
var TOOL_DEFS = [
  {
    name: "claude",
    label: "Claude Code",
    homeDir: ".claude",
    binaries: ["claude"],
    skillsSubDir: "skills",
    projectSkillsRelDir: ".claude/skills"
  },
  {
    name: "cursor",
    label: "Cursor",
    homeDir: ".cursor",
    binaries: ["cursor"],
    skillsSubDir: "skills",
    projectSkillsRelDir: ".cursor/skills"
  },
  {
    name: "codex",
    label: "Codex CLI",
    homeDir: ".codex",
    binaries: ["codex"],
    skillsSubDir: "skills",
    projectSkillsRelDir: ".codex/skills"
  }
];
function dirExists(dirPath) {
  try {
    return import_fs3.default.statSync(dirPath).isDirectory();
  } catch {
    return false;
  }
}
function commandExists(bin) {
  const check = IS_WINDOWS ? `where ${bin}` : `which ${bin}`;
  try {
    (0, import_child_process.execSync)(check, { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}
function countInstalledSkills(skillsDir) {
  if (!dirExists(skillsDir)) return 0;
  try {
    return import_fs3.default.readdirSync(skillsDir, { withFileTypes: true }).filter((e) => e.isDirectory()).length;
  } catch {
    return 0;
  }
}
function detectTools() {
  return TOOL_DEFS.map((def) => {
    const globalBase = import_path2.default.join(HOME, def.homeDir);
    const globalSkillsDir = import_path2.default.join(globalBase, def.skillsSubDir);
    const projectSkillsDir = def.projectSkillsRelDir;
    const dirDetected = dirExists(globalBase);
    const binDetected = def.binaries.some(commandExists);
    const detected = dirDetected || binDetected;
    return {
      name: def.name,
      label: def.label,
      globalSkillsDir,
      projectSkillsDir,
      detected,
      installedCount: detected ? countInstalledSkills(globalSkillsDir) : 0
    };
  });
}
function getToolTarget(name) {
  return detectTools().find((t) => t.name === name);
}

// src/lib/installer.ts
function ensureDir2(dir) {
  if (!import_fs4.default.existsSync(dir)) {
    import_fs4.default.mkdirSync(dir, { recursive: true });
  }
}
function resolveSkillDir(target, skillId, isGlobal) {
  const dirName = skillId.replace(/\//g, "__");
  if (isGlobal) {
    return import_path3.default.join(target.globalSkillsDir, dirName);
  }
  return import_path3.default.join(process.cwd(), target.projectSkillsDir, dirName);
}
async function installSkillToTargets(skill, content, options) {
  const isGlobal = !options.project;
  let targets;
  if (options.tool) {
    const t = getToolTarget(options.tool);
    if (!t) {
      throw new Error(`Unknown tool: "${options.tool}"`);
    }
    targets = [t];
  } else {
    targets = detectTools().filter((t) => t.detected);
    if (targets.length === 0) {
      throw new Error(
        "No supported AI tools detected. Install Claude Code, Cursor, or Codex first.\nOr specify a tool explicitly with --tool <claude|cursor|codex>."
      );
    }
  }
  const results = [];
  const successfulTargets = [];
  for (const target of targets) {
    try {
      const skillDir = resolveSkillDir(target, skill.id, isGlobal);
      ensureDir2(skillDir);
      const skillFilePath = import_path3.default.join(skillDir, "SKILL.md");
      import_fs4.default.writeFileSync(skillFilePath, content, "utf8");
      successfulTargets.push(target);
      results.push({ tool: target.label, skillDir, success: true });
    } catch (err) {
      results.push({
        tool: target.label,
        skillDir: "",
        success: false,
        error: err instanceof Error ? err.message : String(err)
      });
    }
  }
  if (successfulTargets.length > 0) {
    const record = {
      id: skill.id,
      version: skill.version,
      installedAt: (/* @__PURE__ */ new Date()).toISOString(),
      targets: successfulTargets.map((t) => t.name),
      global: isGlobal
    };
    trackInstall(record);
  }
  return results;
}
async function installSkill(skill, options) {
  const content = await fetchSkillContent(skill);
  return installSkillToTargets(skill, content, options);
}
async function removeSkill(skillId) {
  const installed = loadInstalled().find((s) => s.id === skillId);
  const results = [];
  const allTargets = detectTools();
  const dirName = skillId.replace(/\//g, "__");
  for (const target of allTargets) {
    const locations = [
      import_path3.default.join(target.globalSkillsDir, dirName),
      import_path3.default.join(process.cwd(), target.projectSkillsDir, dirName)
    ];
    for (const skillDir of locations) {
      if (!import_fs4.default.existsSync(skillDir)) {
        results.push({ tool: target.label, skillDir, success: true, skipped: true });
        continue;
      }
      try {
        import_fs4.default.rmSync(skillDir, { recursive: true, force: true });
        results.push({ tool: target.label, skillDir, success: true });
      } catch (err) {
        results.push({
          tool: target.label,
          skillDir,
          success: false,
          error: err instanceof Error ? err.message : String(err)
        });
      }
    }
  }
  untrackInstall(skillId);
  return results;
}

// src/commands/install.ts
var VALID_TOOLS = ["claude", "cursor", "codex"];
function registerInstall(program2) {
  program2.command("install <skill>").description(
    'Install a skill into your AI tools (e.g. "backend/django-architect")'
  ).option("--global", "Install globally for all projects (default)", false).option("--project", "Install only for the current project", false).option(
    "--tool <tool>",
    `Target a specific tool (${VALID_TOOLS.join(", ")})`
  ).action(async (skillArg, opts) => {
    if (opts.tool && !VALID_TOOLS.includes(opts.tool)) {
      console.error(
        import_chalk.default.red(`Unknown tool "${opts.tool}". Valid options: ${VALID_TOOLS.join(", ")}`)
      );
      process.exit(1);
    }
    const installOptions = {
      global: !opts.project,
      project: opts.project,
      tool: opts.tool
    };
    const lookupSpinner = (0, import_ora.default)(`Looking up skill ${import_chalk.default.cyan(skillArg)}...`).start();
    let skill;
    try {
      skill = await findSkill(skillArg);
    } catch (err) {
      lookupSpinner.fail(import_chalk.default.red("Failed to reach registry."));
      console.error(
        import_chalk.default.dim(err instanceof Error ? err.message : String(err))
      );
      process.exit(1);
    }
    if (!skill) {
      lookupSpinner.fail(
        import_chalk.default.red(`Skill "${skillArg}" not found in the registry.`)
      );
      console.error(
        import_chalk.default.dim(
          `Run ${import_chalk.default.cyan("skillbox search <query>")} to browse available skills.`
        )
      );
      process.exit(1);
    }
    lookupSpinner.succeed(
      `Found ${import_chalk.default.green(skill.name)} ${import_chalk.default.dim(`v${skill.version}`)}`
    );
    const scope = installOptions.project ? import_chalk.default.yellow("project-local") : import_chalk.default.blue("global");
    if (installOptions.tool) {
      console.log(
        `  Installing into ${import_chalk.default.cyan(installOptions.tool)} (${scope})`
      );
    } else {
      const detected = detectTools().filter((t) => t.detected);
      if (detected.length === 0) {
        console.error(
          import_chalk.default.red(
            "\nNo supported AI tools detected on this machine.\nInstall Claude Code, Cursor, or Codex, or specify --tool explicitly."
          )
        );
        process.exit(1);
      }
      console.log(
        `  Installing into: ${detected.map((t) => import_chalk.default.cyan(t.label)).join(", ")} (${scope})`
      );
    }
    const installSpinner = (0, import_ora.default)("Downloading and installing...").start();
    let results;
    try {
      results = await installSkill(skill, installOptions);
    } catch (err) {
      installSpinner.fail(import_chalk.default.red("Installation failed."));
      console.error(
        import_chalk.default.dim(err instanceof Error ? err.message : String(err))
      );
      process.exit(1);
    }
    installSpinner.stop();
    let anySuccess = false;
    for (const r of results) {
      if (r.skipped) continue;
      if (r.success) {
        anySuccess = true;
        console.log(
          `  ${import_chalk.default.green("\u2714")} ${import_chalk.default.cyan(r.tool)} \u2192 ${import_chalk.default.dim(r.skillDir)}`
        );
      } else {
        console.log(
          `  ${import_chalk.default.red("\u2716")} ${import_chalk.default.cyan(r.tool)} \u2014 ${import_chalk.default.red(r.error ?? "unknown error")}`
        );
      }
    }
    if (anySuccess) {
      console.log(
        `
${import_chalk.default.green("Skill installed:")} ${import_chalk.default.bold(skill.name)}`
      );
      console.log(import_chalk.default.dim(`  ${skill.description}`));
      console.log(
        import_chalk.default.dim(
          `
Run ${import_chalk.default.cyan(`skillbox info ${skill.id}`)} to view usage instructions.`
        )
      );
    } else {
      console.error(import_chalk.default.red("\nInstallation failed for all targets."));
      process.exit(1);
    }
  });
}

// src/commands/remove.ts
var import_chalk2 = __toESM(require("chalk"));
var import_ora2 = __toESM(require("ora"));
function registerRemove(program2) {
  program2.command("remove <skill>").alias("uninstall").description("Remove an installed skill from all AI tools").action(async (skillArg) => {
    const tracked = getInstalledSkill(skillArg);
    if (!tracked) {
      console.log(
        import_chalk2.default.yellow(
          `Skill "${skillArg}" is not tracked by skillbox \u2014 attempting cleanup anyway.`
        )
      );
    }
    const spinner = (0, import_ora2.default)(`Removing ${import_chalk2.default.cyan(skillArg)}...`).start();
    let results;
    try {
      results = await removeSkill(skillArg);
    } catch (err) {
      spinner.fail(import_chalk2.default.red("Removal failed."));
      console.error(
        import_chalk2.default.dim(err instanceof Error ? err.message : String(err))
      );
      process.exit(1);
    }
    spinner.stop();
    const removed = results.filter((r) => r.success && !r.skipped);
    const failed = results.filter((r) => !r.success);
    if (removed.length === 0 && failed.length === 0) {
      console.log(
        import_chalk2.default.yellow(`No installed files found for "${skillArg}".`)
      );
      return;
    }
    for (const r of removed) {
      console.log(
        `  ${import_chalk2.default.green("\u2714")} Removed from ${import_chalk2.default.cyan(r.tool)} ${import_chalk2.default.dim(`(${r.skillDir})`)}`
      );
    }
    for (const r of failed) {
      console.log(
        `  ${import_chalk2.default.red("\u2716")} Failed to remove from ${import_chalk2.default.cyan(r.tool)}: ${import_chalk2.default.red(r.error ?? "unknown error")}`
      );
    }
    if (failed.length === 0) {
      console.log(`
${import_chalk2.default.green("Skill removed:")} ${import_chalk2.default.bold(skillArg)}`);
    } else {
      console.warn(
        import_chalk2.default.yellow("\nSome targets could not be cleaned up. See errors above.")
      );
      process.exit(1);
    }
  });
}

// src/commands/list.ts
var import_chalk3 = __toESM(require("chalk"));
var import_ora3 = __toESM(require("ora"));
var COL_ID = 32;
var COL_VERSION = 8;
var COL_DESC = 50;
function truncate(str, max) {
  if (str.length <= max) return str;
  return str.slice(0, max - 1) + "\u2026";
}
function pad(str, len) {
  return str.padEnd(len, " ");
}
function renderSkillRow(skill, isInstalled) {
  const idPart = pad(truncate(skill.id, COL_ID), COL_ID);
  const versionPart = pad(skill.version, COL_VERSION);
  const descPart = truncate(skill.description, COL_DESC);
  const installedMark = isInstalled ? import_chalk3.default.green(" \u2714") : "  ";
  return installedMark + " " + import_chalk3.default.cyan(idPart) + " " + import_chalk3.default.dim(versionPart) + " " + descPart;
}
function renderHeader() {
  const idPart = pad("SKILL ID", COL_ID);
  const versionPart = pad("VERSION", COL_VERSION);
  const descPart = "DESCRIPTION";
  return "   " + import_chalk3.default.bold.underline(idPart) + " " + import_chalk3.default.bold.underline(versionPart) + " " + import_chalk3.default.bold.underline(descPart);
}
function registerList(program2) {
  program2.command("list [category]").description("List available skills, optionally filtered by category").option("--no-cache", "Bypass local cache and fetch fresh data").action(async (category, opts) => {
    const spinner = (0, import_ora3.default)("Fetching skill registry...").start();
    let skills;
    try {
      skills = await listSkills(category, !opts.cache);
    } catch (err) {
      spinner.fail(import_chalk3.default.red("Failed to load registry."));
      console.error(
        import_chalk3.default.dim(err instanceof Error ? err.message : String(err))
      );
      process.exit(1);
    }
    spinner.stop();
    if (skills.length === 0) {
      if (category) {
        console.log(
          import_chalk3.default.yellow(`No skills found in category "${category}".`)
        );
        const cats = await listCategories();
        console.log(
          import_chalk3.default.dim(
            `Available categories: ${cats.map((c) => import_chalk3.default.cyan(c)).join(", ")}`
          )
        );
      } else {
        console.log(import_chalk3.default.yellow("Registry is empty."));
      }
      return;
    }
    const installed = loadInstalled();
    const installedIds = new Set(installed.map((s) => s.id));
    const byCategory = /* @__PURE__ */ new Map();
    for (const skill of skills) {
      const group = byCategory.get(skill.category) ?? [];
      group.push(skill);
      byCategory.set(skill.category, group);
    }
    if (category) {
      console.log(
        `
${import_chalk3.default.bold(`Skills in "${category}"`)}
`
      );
    } else {
      console.log(
        `
${import_chalk3.default.bold("Available Skills")} ${import_chalk3.default.dim(`(${skills.length} total)`)}
`
      );
    }
    console.log(renderHeader());
    console.log(import_chalk3.default.dim("\u2500".repeat(COL_ID + COL_VERSION + COL_DESC + 8)));
    for (const [cat, catSkills] of Array.from(byCategory.entries()).sort()) {
      console.log(`
  ${import_chalk3.default.bold.yellow(cat.toUpperCase())}`);
      for (const skill of catSkills.sort((a, b) => a.id.localeCompare(b.id))) {
        console.log(renderSkillRow(skill, installedIds.has(skill.id)));
      }
    }
    const installedCount = skills.filter((s) => installedIds.has(s.id)).length;
    console.log("");
    if (installedCount > 0) {
      console.log(
        import_chalk3.default.dim(`  ${import_chalk3.default.green("\u2714")} = installed on this machine (${installedCount} skills)`)
      );
    }
    console.log(
      import_chalk3.default.dim(
        `
  Run ${import_chalk3.default.cyan("skillbox info <skill>")} to view details and usage instructions.`
      )
    );
    console.log(
      import_chalk3.default.dim(
        `  Run ${import_chalk3.default.cyan("skillbox install <skill>")} to install a skill.`
      )
    );
  });
}

// src/commands/search.ts
var import_chalk4 = __toESM(require("chalk"));
var import_ora4 = __toESM(require("ora"));
function highlight(text, query) {
  const q = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`(${q})`, "gi");
  return text.replace(regex, import_chalk4.default.bold.yellow("$1"));
}
function scoreSkill(skill, q) {
  const ql = q.toLowerCase();
  let score = 0;
  if (skill.id.toLowerCase() === ql) score += 100;
  if (skill.name.toLowerCase() === ql) score += 90;
  if (skill.id.toLowerCase().includes(ql)) score += 50;
  if (skill.name.toLowerCase().includes(ql)) score += 40;
  if (skill.tags.some((t) => t.toLowerCase() === ql)) score += 30;
  if (skill.tags.some((t) => t.toLowerCase().includes(ql))) score += 20;
  if (skill.description.toLowerCase().includes(ql)) score += 10;
  return score;
}
function registerSearch(program2) {
  program2.command("search <query>").description("Search skills by name, tags, or description").option("--no-cache", "Bypass local cache and fetch fresh data").action(async (query, opts) => {
    if (!query || query.trim().length === 0) {
      console.error(import_chalk4.default.red("Please provide a search query."));
      process.exit(1);
    }
    const spinner = (0, import_ora4.default)(`Searching for ${import_chalk4.default.cyan(`"${query}"`)}`).start();
    let results;
    try {
      results = await searchSkills(query, !opts.cache);
    } catch (err) {
      spinner.fail(import_chalk4.default.red("Failed to load registry."));
      console.error(
        import_chalk4.default.dim(err instanceof Error ? err.message : String(err))
      );
      process.exit(1);
    }
    spinner.stop();
    if (results.length === 0) {
      console.log(
        import_chalk4.default.yellow(`No skills found matching "${query}".`)
      );
      console.log(
        import_chalk4.default.dim(
          `Try ${import_chalk4.default.cyan("skillbox list")} to see all available skills.`
        )
      );
      return;
    }
    const scored = results.map((s) => ({ skill: s, score: scoreSkill(s, query) })).sort((a, b) => b.score - a.score);
    const installed = loadInstalled();
    const installedIds = new Set(installed.map((s) => s.id));
    console.log(
      `
${import_chalk4.default.bold(`Search results for "${query}"`)}` + import_chalk4.default.dim(` \u2014 ${results.length} skill${results.length !== 1 ? "s" : ""} found`) + "\n"
    );
    for (const { skill } of scored) {
      const isInstalled = installedIds.has(skill.id);
      const mark = isInstalled ? import_chalk4.default.green(" \u2714 ") : "   ";
      const id = highlight(skill.id, query);
      const name = highlight(skill.name, query);
      const desc = highlight(skill.description, query);
      const tags = skill.tags.map((t) => import_chalk4.default.dim(`#${highlight(t, query)}`)).join(" ");
      console.log(
        `${mark}${import_chalk4.default.cyan(id)}  ${import_chalk4.default.bold(name)}`
      );
      console.log(`     ${desc}`);
      if (tags) {
        console.log(`     ${tags}`);
      }
      console.log(
        `     ${import_chalk4.default.dim(`v${skill.version}`)}  ${import_chalk4.default.dim(skill.category)}` + (isInstalled ? import_chalk4.default.green("  (installed)") : "")
      );
      console.log("");
    }
    console.log(
      import_chalk4.default.dim(
        `Run ${import_chalk4.default.cyan("skillbox install <skill-id>")} to install a skill.`
      )
    );
  });
}

// src/commands/info.ts
var import_chalk5 = __toESM(require("chalk"));
var import_ora5 = __toESM(require("ora"));
var PREVIEW_LINES = 40;
function formatDate(iso) {
  try {
    return new Date(iso).toLocaleDateString(void 0, {
      year: "numeric",
      month: "long",
      day: "numeric"
    });
  } catch {
    return iso;
  }
}
function registerInfo(program2) {
  program2.command("info <skill>").description("Show full details for a skill").option("--no-cache", "Bypass local cache and fetch fresh data").option("--preview", "Show a preview of the SKILL.md content", false).action(async (skillArg, opts) => {
    const spinner = (0, import_ora5.default)(`Looking up ${import_chalk5.default.cyan(skillArg)}...`).start();
    let skill;
    try {
      skill = await findSkill(skillArg, !opts.cache);
    } catch (err) {
      spinner.fail(import_chalk5.default.red("Failed to reach registry."));
      console.error(
        import_chalk5.default.dim(err instanceof Error ? err.message : String(err))
      );
      process.exit(1);
    }
    if (!skill) {
      spinner.fail(import_chalk5.default.red(`Skill "${skillArg}" not found in registry.`));
      console.error(
        import_chalk5.default.dim(
          `Run ${import_chalk5.default.cyan("skillbox search <query>")} to find skills.`
        )
      );
      process.exit(1);
    }
    spinner.stop();
    const installed = getInstalledSkill(skill.id);
    console.log("");
    console.log(import_chalk5.default.bold.white(`  ${skill.name}`));
    console.log(import_chalk5.default.dim(`  ${skill.id}`));
    console.log("");
    const row = (label, value) => `  ${import_chalk5.default.dim(label.padEnd(12))}  ${value}`;
    console.log(row("Version", import_chalk5.default.green(skill.version)));
    console.log(row("Category", import_chalk5.default.cyan(skill.category)));
    console.log(row("Author", skill.author));
    console.log(row("Updated", formatDate(skill.updatedAt)));
    console.log(
      row(
        "Tags",
        skill.tags.map((t) => import_chalk5.default.dim(`#${t}`)).join("  ") || import_chalk5.default.dim("\u2014")
      )
    );
    if (installed) {
      console.log(
        row(
          "Installed",
          import_chalk5.default.green(
            `Yes \u2014 ${formatDate(installed.installedAt)} ` + import_chalk5.default.dim(`(${installed.targets.join(", ")})`)
          )
        )
      );
    } else {
      console.log(row("Installed", import_chalk5.default.dim("No")));
    }
    console.log("");
    console.log(import_chalk5.default.dim("  \u2500".padEnd(50, "\u2500")));
    console.log("");
    console.log(`  ${skill.description}`);
    console.log("");
    if (skill.repoUrl) {
      console.log(`  ${import_chalk5.default.dim("Source:")} ${import_chalk5.default.blue(skill.repoUrl)}`);
    }
    console.log(`  ${import_chalk5.default.dim("SKILL.md:")} ${import_chalk5.default.blue(skill.skillUrl)}`);
    console.log("");
    if (opts.preview) {
      const previewSpinner = (0, import_ora5.default)("Fetching SKILL.md preview...").start();
      let content;
      try {
        content = await fetchSkillContent(skill);
        previewSpinner.stop();
      } catch (err) {
        previewSpinner.fail(import_chalk5.default.red("Could not fetch SKILL.md."));
        console.error(
          import_chalk5.default.dim(err instanceof Error ? err.message : String(err))
        );
        content = null;
      }
      if (content) {
        const lines = content.split("\n");
        const preview = lines.slice(0, PREVIEW_LINES).join("\n");
        const truncated = lines.length > PREVIEW_LINES;
        console.log(import_chalk5.default.dim("  \u2500\u2500 SKILL.md preview " + "\u2500".padEnd(30, "\u2500")));
        console.log("");
        console.log(
          preview.split("\n").map((l) => "  " + l).join("\n")
        );
        if (truncated) {
          console.log(
            import_chalk5.default.dim(`
  ... (${lines.length - PREVIEW_LINES} more lines)`)
          );
        }
        console.log("");
      }
    }
    if (!installed) {
      console.log(
        import_chalk5.default.dim(
          `  Run ${import_chalk5.default.cyan(`skillbox install ${skill.id}`)} to install this skill.`
        )
      );
    } else {
      console.log(
        import_chalk5.default.dim(
          `  Run ${import_chalk5.default.cyan(`skillbox remove ${skill.id}`)} to remove this skill.`
        )
      );
    }
  });
}

// src/commands/detect.ts
var import_chalk6 = __toESM(require("chalk"));
var import_ora6 = __toESM(require("ora"));
function registerDetect(program2) {
  program2.command("detect").description("Detect which AI coding tools are installed on this machine").action(async () => {
    const spinner = (0, import_ora6.default)("Scanning for AI tools...").start();
    let targets;
    try {
      targets = detectTools();
    } catch (err) {
      spinner.fail(import_chalk6.default.red("Detection failed."));
      console.error(
        import_chalk6.default.dim(err instanceof Error ? err.message : String(err))
      );
      process.exit(1);
    }
    spinner.stop();
    const installed = loadInstalled();
    const detected = targets.filter((t) => t.detected);
    const missing = targets.filter((t) => !t.detected);
    console.log("");
    console.log(import_chalk6.default.bold("AI Tool Detection\n"));
    if (detected.length === 0) {
      console.log(
        import_chalk6.default.yellow(
          "  No supported AI coding tools were detected on this machine."
        )
      );
      console.log(
        import_chalk6.default.dim(
          "\n  Skillbox supports: Claude Code, Cursor, Codex CLI\n  Install one of these tools and re-run skillbox detect."
        )
      );
    } else {
      console.log(
        `  ${import_chalk6.default.green("Detected")} (${detected.length}):
`
      );
      for (const tool of detected) {
        const trackedCount = installed.filter(
          (s) => s.targets.includes(tool.name)
        ).length;
        const skillCountStr = trackedCount > 0 ? import_chalk6.default.green(`${trackedCount} skill${trackedCount !== 1 ? "s" : ""} installed`) : import_chalk6.default.dim("no skills installed");
        console.log(
          `    ${import_chalk6.default.green("\u2714")}  ${import_chalk6.default.bold(tool.label.padEnd(16))}  ${import_chalk6.default.dim(tool.globalSkillsDir)}`
        );
        console.log(
          `       ${" ".repeat(16)}  ${skillCountStr}`
        );
        console.log("");
      }
    }
    if (missing.length > 0) {
      console.log(
        `  ${import_chalk6.default.dim("Not detected")} (${missing.length}):
`
      );
      for (const tool of missing) {
        console.log(
          `    ${import_chalk6.default.dim("\u25CB")}  ${import_chalk6.default.dim(tool.label)}`
        );
      }
      console.log("");
    }
    const totalTracked = installed.length;
    if (totalTracked > 0) {
      console.log(
        import_chalk6.default.dim(
          `  ${totalTracked} skill${totalTracked !== 1 ? "s" : ""} tracked by skillbox.`
        )
      );
      console.log(
        import_chalk6.default.dim(
          `  Run ${import_chalk6.default.cyan("skillbox list")} to browse available skills.`
        )
      );
    } else if (detected.length > 0) {
      console.log(
        import_chalk6.default.dim(
          `  Run ${import_chalk6.default.cyan("skillbox list")} to browse available skills.`
        )
      );
      console.log(
        import_chalk6.default.dim(
          `  Run ${import_chalk6.default.cyan("skillbox install <skill>")} to get started.`
        )
      );
    }
  });
}

// src/commands/recommend.ts
var import_chalk7 = __toESM(require("chalk"));
var import_ora7 = __toESM(require("ora"));

// src/lib/stackDetector.ts
var import_fs5 = __toESM(require("fs"));
var import_path4 = __toESM(require("path"));
var STACK_RULES = [
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
  { name: "Git", skillIds: ["general/git-workflow"], files: [".git"] }
];
function detectProjectStack(rootPath = process.cwd()) {
  const detected = [];
  const deps = readPackageJsonDeps(rootPath);
  const pyDeps = readPythonDeps(rootPath);
  const allDeps = /* @__PURE__ */ new Set([...deps, ...pyDeps]);
  const rubyDeps = readGemfileDeps(rootPath);
  rubyDeps.forEach((d) => allDeps.add(d));
  const exts = collectExtensions(rootPath, 2);
  for (const rule of STACK_RULES) {
    let signal = null;
    if (rule.files) {
      for (const file of rule.files) {
        if (import_fs5.default.existsSync(import_path4.default.join(rootPath, file))) {
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
function readPackageJsonDeps(rootPath) {
  const deps = /* @__PURE__ */ new Set();
  try {
    const raw = import_fs5.default.readFileSync(import_path4.default.join(rootPath, "package.json"), "utf8");
    const pkg = JSON.parse(raw);
    for (const name of Object.keys({ ...pkg.dependencies, ...pkg.devDependencies, ...pkg.peerDependencies })) {
      deps.add(name);
    }
  } catch {
  }
  return deps;
}
function readPythonDeps(rootPath) {
  const deps = /* @__PURE__ */ new Set();
  try {
    const content = import_fs5.default.readFileSync(import_path4.default.join(rootPath, "requirements.txt"), "utf8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith("#")) {
        const name = trimmed.split(/[>=<!\[]/)[0].trim().toLowerCase();
        if (name) deps.add(name);
      }
    }
  } catch {
  }
  return deps;
}
function readGemfileDeps(rootPath) {
  const deps = /* @__PURE__ */ new Set();
  try {
    const content = import_fs5.default.readFileSync(import_path4.default.join(rootPath, "Gemfile"), "utf8");
    const matches = content.matchAll(/gem\s+['"]([^'"]+)['"]/g);
    for (const m of matches) deps.add(m[1]);
  } catch {
  }
  return deps;
}
function collectExtensions(rootPath, maxDepth) {
  const exts = /* @__PURE__ */ new Set();
  function walk(dir, depth) {
    if (depth > maxDepth) return;
    try {
      const entries = import_fs5.default.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
        if (entry.isFile()) {
          const ext = import_path4.default.extname(entry.name);
          if (ext) exts.add(ext);
        } else if (entry.isDirectory()) {
          walk(import_path4.default.join(dir, entry.name), depth + 1);
        }
      }
    } catch {
    }
  }
  walk(rootPath, 0);
  return exts;
}

// src/commands/recommend.ts
function registerRecommend(program2) {
  program2.command("recommend").alias("rec").description("Detect your project stack and recommend matching skills").option("-d, --dir <path>", "Directory to scan (default: current directory)").action(async (opts) => {
    const rootPath = opts.dir || process.cwd();
    const spinner = (0, import_ora7.default)("Scanning project stack...").start();
    let stacks;
    try {
      stacks = detectProjectStack(rootPath);
    } catch (err) {
      spinner.fail(import_chalk7.default.red("Failed to scan project."));
      console.error(import_chalk7.default.dim(err instanceof Error ? err.message : String(err)));
      process.exit(1);
    }
    if (stacks.length === 0) {
      spinner.info("No recognized technologies detected in this directory.");
      console.log(import_chalk7.default.dim("\n  Try running this command from your project root."));
      console.log(import_chalk7.default.dim(`  Run ${import_chalk7.default.cyan("skillbox list")} to browse all available skills.
`));
      return;
    }
    spinner.text = "Loading registry...";
    let registrySkills = [];
    try {
      const registry = await fetchRegistry();
      registrySkills = registry.skills;
    } catch (err) {
      spinner.fail(import_chalk7.default.red("Failed to load registry."));
      console.error(import_chalk7.default.dim(err instanceof Error ? err.message : String(err)));
      process.exit(1);
    }
    spinner.stop();
    const installed = loadInstalled();
    const installedIds = new Set(installed.map((s) => s.id));
    console.log("");
    console.log(import_chalk7.default.bold("Stack Detection & Recommendations\n"));
    console.log(import_chalk7.default.bold("  Detected Technologies:\n"));
    for (const stack of stacks) {
      console.log(`    ${import_chalk7.default.green(">")}  ${import_chalk7.default.bold(stack.name)}  ${import_chalk7.default.dim(`(${stack.signal})`)}`);
    }
    console.log("");
    console.log(import_chalk7.default.bold("  Recommended Skills:\n"));
    const recommendedIds = /* @__PURE__ */ new Set();
    for (const stack of stacks) {
      for (const id of stack.skillIds) {
        recommendedIds.add(id);
      }
    }
    recommendedIds.add("general/git-workflow");
    recommendedIds.add("general/code-review");
    let notInstalledCount = 0;
    for (const id of recommendedIds) {
      const skill = registrySkills.find((s) => s.id === id);
      if (!skill) continue;
      const isInst = installedIds.has(id);
      const status = isInst ? import_chalk7.default.green("  installed") : import_chalk7.default.yellow("  not installed");
      const icon = isInst ? import_chalk7.default.green("\u2714") : import_chalk7.default.yellow("\u25CB");
      console.log(`    ${icon}  ${import_chalk7.default.bold(skill.name.padEnd(28))} ${import_chalk7.default.dim(skill.category.padEnd(12))} ${status}`);
      if (!isInst) {
        console.log(import_chalk7.default.dim(`       ${skill.description.substring(0, 70)}`));
        notInstalledCount++;
      }
    }
    console.log("");
    if (notInstalledCount > 0) {
      console.log(
        import_chalk7.default.dim(`  ${notInstalledCount} skill${notInstalledCount !== 1 ? "s" : ""} recommended but not yet installed.`)
      );
      console.log(
        import_chalk7.default.dim(`  Run ${import_chalk7.default.cyan("skillbox install <category/skill>")} to install.
`)
      );
    } else {
      console.log(import_chalk7.default.green("  All recommended skills are already installed!\n"));
    }
  });
}

// src/index.ts
function getVersion() {
  try {
    const pkg = require_package();
    return pkg.version;
  } catch {
    return "0.1.0";
  }
}
var program = new import_commander.Command();
program.name("skillbox").description("Skill Pack for your development environment").version(getVersion(), "-v, --version", "Print the current version").helpOption("-h, --help", "Display help for command").addHelpCommand("help [command]", "Display help for a command").passThroughOptions(false).allowExcessArguments(false);
registerInstall(program);
registerRemove(program);
registerList(program);
registerSearch(program);
registerInfo(program);
registerDetect(program);
registerRecommend(program);
program.configureOutput({
  writeErr: (str) => {
    process.stderr.write(str);
  }
});
program.on("command:*", (operands) => {
  console.error(`Unknown command: ${operands[0]}`);
  console.error(`Run ${"`"}skillbox --help${"`"} to see available commands.`);
  process.exit(1);
});
if (process.argv.length <= 2) {
  program.outputHelp();
  process.exit(0);
}
program.parseAsync(process.argv).catch((err) => {
  console.error(
    err instanceof Error ? err.message : "An unexpected error occurred."
  );
  process.exit(1);
});
