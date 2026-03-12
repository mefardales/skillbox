/**
 * Shared types for the Skillbox VSCode extension.
 * Mirrors the CLI types exactly so installed.json is fully compatible.
 */

export interface Skill {
  /** Unique identifier in the form "category/skill-name" */
  id: string;
  /** Human-readable name */
  name: string;
  /** Short description shown in listings */
  description: string;
  /** Category this skill belongs to (e.g. "backend", "frontend") */
  category: string;
  /** Searchable tags */
  tags: string[];
  /** Semantic version string */
  version: string;
  /** Skill author */
  author: string;
  /** Raw GitHub URL to the SKILL.md file */
  skillUrl: string;
  /** Raw GitHub URL to the full skill directory (optional) */
  repoUrl?: string;
  /** ISO timestamp of last update */
  updatedAt: string;
}

export interface RegistryData {
  /** Registry format version */
  version: string;
  /** ISO timestamp when registry was last updated */
  updatedAt: string;
  /** All available skills */
  skills: Skill[];
}

export interface InstalledSkill {
  /** Skill ID as "category/skill-name" */
  id: string;
  /** Version that was installed */
  version: string;
  /** ISO timestamp of installation */
  installedAt: string;
  /** Tools this skill was installed into */
  targets: ToolName[];
  /** Whether it was installed globally (true) or project-local (false) */
  global: boolean;
}

export type ToolName = "claude" | "cursor" | "codex";

export interface ToolTarget {
  /** Tool identifier */
  name: ToolName;
  /** Human-readable label */
  label: string;
  /** Absolute path to the tool's global skills directory */
  globalSkillsDir: string;
  /** Relative path (from cwd) to the tool's project-local skills directory */
  projectSkillsDir: string;
  /** Whether the tool appears to be installed on this machine */
  detected: boolean;
  /** Number of skills currently installed in the global dir */
  installedCount?: number;
}

export interface InstallOptions {
  /** Install globally (default) */
  global: boolean;
  /** Install project-locally */
  project: boolean;
  /** Only install into this specific tool */
  tool?: ToolName;
  /** Workspace folder for project-local install */
  workspaceDir?: string;
}

export interface InstallResult {
  tool: string;
  skillDir: string;
  success: boolean;
  skipped?: boolean;
  error?: string;
}

export interface RemoveResult {
  tool: string;
  skillDir: string;
  success: boolean;
  skipped?: boolean;
  error?: string;
}
