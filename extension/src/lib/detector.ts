/**
 * Detects which AI coding tools are installed on the current machine.
 * Mirrors the CLI detector with the same logic and tool definitions.
 */

import fs from "fs";
import path from "path";
import os from "os";
import { execSync } from "child_process";
import type { ToolName, ToolTarget } from "./types";

const HOME = os.homedir();
const IS_WINDOWS = process.platform === "win32";

interface ToolDef {
  name: ToolName;
  label: string;
  homeDir: string;
  binaries: string[];
  skillsSubDir: string;
  projectSkillsRelDir: string;
}

const TOOL_DEFS: ToolDef[] = [
  {
    name: "claude",
    label: "Claude Code",
    homeDir: ".claude",
    binaries: ["claude"],
    skillsSubDir: "skills",
    projectSkillsRelDir: ".claude/skills",
  },
  {
    name: "cursor",
    label: "Cursor",
    homeDir: ".cursor",
    binaries: ["cursor"],
    skillsSubDir: "skills",
    projectSkillsRelDir: ".cursor/skills",
  },
  {
    name: "codex",
    label: "Codex CLI",
    homeDir: ".codex",
    binaries: ["codex"],
    skillsSubDir: "skills",
    projectSkillsRelDir: ".codex/skills",
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function dirExists(dirPath: string): boolean {
  try {
    return fs.statSync(dirPath).isDirectory();
  } catch {
    return false;
  }
}

function commandExists(bin: string): boolean {
  const check = IS_WINDOWS ? `where ${bin}` : `which ${bin}`;
  try {
    execSync(check, { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function countInstalledSkills(skillsDir: string): number {
  if (!dirExists(skillsDir)) return 0;
  try {
    return fs
      .readdirSync(skillsDir, { withFileTypes: true })
      .filter((e) => e.isDirectory()).length;
  } catch {
    return 0;
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Returns a ToolTarget descriptor for every known tool, with `detected` set
 * based on whether the tool appears to be present on this machine.
 */
export function detectTools(): ToolTarget[] {
  return TOOL_DEFS.map((def) => {
    const globalBase = path.join(HOME, def.homeDir);
    const globalSkillsDir = path.join(globalBase, def.skillsSubDir);
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
      installedCount: detected ? countInstalledSkills(globalSkillsDir) : 0,
    };
  });
}

/**
 * Returns only the tools that are detected as installed.
 */
export function getInstalledTools(): ToolTarget[] {
  return detectTools().filter((t) => t.detected);
}

/**
 * Returns a single ToolTarget by name, regardless of detection status.
 */
export function getToolTarget(name: ToolName): ToolTarget | undefined {
  return detectTools().find((t) => t.name === name);
}
