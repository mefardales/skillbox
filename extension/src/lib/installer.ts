/**
 * Install / remove logic for the Skillbox VSCode extension.
 * Shares the same ~/.skillbox/installed.json format as the CLI.
 */

import fs from "fs";
import path from "path";
import os from "os";
import type {
  Skill,
  ToolTarget,
  InstalledSkill,
  InstallOptions,
  InstallResult,
  RemoveResult,
  ToolName,
} from "./types";
import { fetchSkillContent } from "./registry";
import { detectTools, getToolTarget } from "./detector";

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const SKILLBOX_DIR = path.join(os.homedir(), ".skillbox");
const INSTALLED_PATH = path.join(SKILLBOX_DIR, "installed.json");

// ---------------------------------------------------------------------------
// installed.json helpers
// ---------------------------------------------------------------------------

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export function loadInstalled(): InstalledSkill[] {
  try {
    const raw = fs.readFileSync(INSTALLED_PATH, "utf8");
    return JSON.parse(raw) as InstalledSkill[];
  } catch {
    return [];
  }
}

function saveInstalled(skills: InstalledSkill[]): void {
  ensureDir(SKILLBOX_DIR);
  fs.writeFileSync(
    INSTALLED_PATH,
    JSON.stringify(skills, null, 2) + "\n",
    "utf8"
  );
}

export function trackInstall(skill: InstalledSkill): void {
  const installed = loadInstalled();
  const idx = installed.findIndex((s) => s.id === skill.id);
  if (idx !== -1) {
    installed[idx] = skill;
  } else {
    installed.push(skill);
  }
  saveInstalled(installed);
}

export function untrackInstall(skillId: string): boolean {
  const installed = loadInstalled();
  const filtered = installed.filter((s) => s.id !== skillId);
  if (filtered.length === installed.length) return false;
  saveInstalled(filtered);
  return true;
}

export function isInstalled(skillId: string): boolean {
  return loadInstalled().some((s) => s.id === skillId);
}

export function getInstalledRecord(skillId: string): InstalledSkill | undefined {
  return loadInstalled().find((s) => s.id === skillId);
}

// ---------------------------------------------------------------------------
// Path resolution
// ---------------------------------------------------------------------------

function resolveSkillDir(
  target: ToolTarget,
  skillId: string,
  isGlobal: boolean,
  workspaceDir?: string
): string {
  // Replace "/" with "__" for the directory name (same as CLI)
  const dirName = skillId.replace(/\//g, "__");

  if (isGlobal) {
    return path.join(target.globalSkillsDir, dirName);
  }

  // Project-local: relative to the provided workspace dir or cwd
  const base = workspaceDir ?? process.cwd();
  return path.join(base, target.projectSkillsDir, dirName);
}

// ---------------------------------------------------------------------------
// Install
// ---------------------------------------------------------------------------

/**
 * Install a skill into all detected tools (or a specific one).
 * Downloads content, writes SKILL.md, and updates installed.json.
 */
export async function installSkill(
  skill: Skill,
  options: InstallOptions
): Promise<InstallResult[]> {
  const content = await fetchSkillContent(skill);
  return installSkillWithContent(skill, content, options);
}

/**
 * Install a skill when you already have the content (avoids re-download).
 */
export async function installSkillWithContent(
  skill: Skill,
  content: string,
  options: InstallOptions
): Promise<InstallResult[]> {
  const isGlobal = !options.project;

  let targets: ToolTarget[];

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
        "No supported AI tools detected. Install Claude Code, Cursor, or Codex first."
      );
    }
  }

  const results: InstallResult[] = [];
  const successfulTargets: ToolTarget[] = [];

  for (const target of targets) {
    try {
      const skillDir = resolveSkillDir(
        target,
        skill.id,
        isGlobal,
        options.workspaceDir
      );
      ensureDir(skillDir);

      const skillFilePath = path.join(skillDir, "SKILL.md");
      fs.writeFileSync(skillFilePath, content, "utf8");

      successfulTargets.push(target);
      results.push({ tool: target.label, skillDir, success: true });
    } catch (err) {
      results.push({
        tool: target.label,
        skillDir: "",
        success: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  if (successfulTargets.length > 0) {
    const record: InstalledSkill = {
      id: skill.id,
      version: skill.version,
      installedAt: new Date().toISOString(),
      targets: successfulTargets.map((t) => t.name as ToolName),
      global: isGlobal,
    };
    trackInstall(record);
  }

  return results;
}

// ---------------------------------------------------------------------------
// Remove
// ---------------------------------------------------------------------------

/**
 * Remove an installed skill from all target directories and update installed.json.
 */
export async function removeSkill(
  skillId: string,
  workspaceDir?: string
): Promise<RemoveResult[]> {
  const results: RemoveResult[] = [];
  const allTargets = detectTools();
  const dirName = skillId.replace(/\//g, "__");

  for (const target of allTargets) {
    const locations = [
      path.join(target.globalSkillsDir, dirName),
      path.join(
        workspaceDir ?? process.cwd(),
        target.projectSkillsDir,
        dirName
      ),
    ];

    for (const skillDir of locations) {
      if (!fs.existsSync(skillDir)) {
        results.push({
          tool: target.label,
          skillDir,
          success: true,
          skipped: true,
        });
        continue;
      }
      try {
        fs.rmSync(skillDir, { recursive: true, force: true });
        results.push({ tool: target.label, skillDir, success: true });
      } catch (err) {
        results.push({
          tool: target.label,
          skillDir,
          success: false,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }

  untrackInstall(skillId);
  return results;
}
