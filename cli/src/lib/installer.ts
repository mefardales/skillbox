/**
 * Core install/remove logic for Skillbox.
 *
 * Responsibilities:
 *   - Download SKILL.md content from the registry
 *   - Write it to the correct location for each target tool
 *   - Maintain the installed.json tracking file
 *   - Clean up on remove
 */

import fs from "fs";
import path from "path";
import os from "os";
import type { Skill, ToolTarget, InstalledSkill, InstallOptions } from "./types.js";
import { fetchSkillContent } from "./registry.js";
import { trackInstall, untrackInstall, loadInstalled } from "./config.js";
import { detectTools, getToolTarget } from "./detector.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/**
 * Resolve the directory where a skill's files should land.
 *
 * @param target   Tool target descriptor
 * @param skillId  Full skill ID (e.g. "backend/django-architect")
 * @param global   True → global install, false → project-local
 */
function resolveSkillDir(
  target: ToolTarget,
  skillId: string,
  isGlobal: boolean
): string {
  // Use the last segment of the ID as the directory name
  const dirName = skillId.replace(/\//g, "__");

  if (isGlobal) {
    return path.join(target.globalSkillsDir, dirName);
  }

  // Project-local: relative to cwd
  return path.join(process.cwd(), target.projectSkillsDir, dirName);
}

// ---------------------------------------------------------------------------
// Install
// ---------------------------------------------------------------------------

export interface InstallResult {
  tool: string;
  skillDir: string;
  success: boolean;
  /** True when the target was skipped (e.g. not installed, no-op) */
  skipped?: boolean;
  error?: string;
}

/**
 * Install a skill into one or more tools.
 *
 * @param skill    Skill metadata from the registry
 * @param content  Raw SKILL.md content (pre-fetched to avoid redundant downloads)
 * @param options  Install flags (global / project / tool filter)
 * @returns        Per-tool result array
 */
export async function installSkillToTargets(
  skill: Skill,
  content: string,
  options: InstallOptions
): Promise<InstallResult[]> {
  const isGlobal = !options.project;

  // Determine which tools to target
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
        "No supported AI tools detected. Install Claude Code, Cursor, or Codex first.\n" +
          'Or specify a tool explicitly with --tool <claude|cursor|codex>.'
      );
    }
  }

  const results: InstallResult[] = [];
  const successfulTargets: ToolTarget[] = [];

  for (const target of targets) {
    try {
      const skillDir = resolveSkillDir(target, skill.id, isGlobal);
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
      targets: successfulTargets.map((t) => t.name),
      global: isGlobal,
    };
    trackInstall(record);
  }

  return results;
}

/**
 * Download skill content and install it.
 * This is the top-level install entry point used by the install command.
 */
export async function installSkill(
  skill: Skill,
  options: InstallOptions
): Promise<InstallResult[]> {
  const content = await fetchSkillContent(skill);
  return installSkillToTargets(skill, content, options);
}

// ---------------------------------------------------------------------------
// Remove
// ---------------------------------------------------------------------------

export interface RemoveResult {
  tool: string;
  skillDir: string;
  success: boolean;
  skipped?: boolean;
  error?: string;
}

/**
 * Remove an installed skill from all target directories.
 *
 * @param skillId  Full skill ID (e.g. "backend/django-architect")
 */
export async function removeSkill(skillId: string): Promise<RemoveResult[]> {
  const installed = loadInstalled().find((s) => s.id === skillId);
  const results: RemoveResult[] = [];

  const allTargets = detectTools();
  const dirName = skillId.replace(/\//g, "__");

  for (const target of allTargets) {
    // Remove from both global and project locations
    const locations = [
      path.join(target.globalSkillsDir, dirName),
      path.join(process.cwd(), target.projectSkillsDir, dirName),
    ];

    for (const skillDir of locations) {
      if (!fs.existsSync(skillDir)) {
        results.push({ tool: target.label, skillDir, success: true, skipped: true });
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
