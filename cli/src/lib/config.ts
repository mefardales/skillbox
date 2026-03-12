/**
 * Config and installation-tracking management.
 *
 * All persistent state lives under ~/.skillbox/:
 *   config.json    – user preferences
 *   installed.json – record of every installed skill
 *   cache/         – cached registry payloads
 */

import fs from "fs";
import path from "path";
import os from "os";
import type { Config, InstalledSkill } from "./types.js";

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

export const SKILLBOX_DIR = path.join(os.homedir(), ".skillbox");
export const CONFIG_PATH = path.join(SKILLBOX_DIR, "config.json");
export const INSTALLED_PATH = path.join(SKILLBOX_DIR, "installed.json");
export const CACHE_DIR = path.join(SKILLBOX_DIR, "cache");

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const DEFAULT_CONFIG: Config = {
  registryUrl:
    "https://raw.githubusercontent.com/MarcoRiformworking/skillbox/main/skills/registry.json",
  cacheTtlMs: 60 * 60 * 1000, // 1 hour
  defaultScope: "global",
  ignoredTools: [],
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function readJson<T>(filePath: string, fallback: T): T {
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson(filePath: string, data: unknown): void {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + "\n", "utf8");
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

export function loadConfig(): Config {
  const stored = readJson<Partial<Config>>(CONFIG_PATH, {});
  return { ...DEFAULT_CONFIG, ...stored };
}

export function saveConfig(config: Config): void {
  writeJson(CONFIG_PATH, config);
}

export function getRegistryUrl(): string {
  return process.env.SKILLBOX_REGISTRY || loadConfig().registryUrl;
}

// ---------------------------------------------------------------------------
// Installed skills tracking
// ---------------------------------------------------------------------------

export function loadInstalled(): InstalledSkill[] {
  return readJson<InstalledSkill[]>(INSTALLED_PATH, []);
}

export function saveInstalled(skills: InstalledSkill[]): void {
  writeJson(INSTALLED_PATH, skills);
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

export function getInstalledSkill(skillId: string): InstalledSkill | undefined {
  return loadInstalled().find((s) => s.id === skillId);
}

// ---------------------------------------------------------------------------
// Cache helpers (used by registry.ts)
// ---------------------------------------------------------------------------

export function getCachePath(key: string): string {
  ensureDir(CACHE_DIR);
  // Sanitise key for use as a filename
  const safe = key.replace(/[^a-z0-9]/gi, "_");
  return path.join(CACHE_DIR, `${safe}.json`);
}

export interface CacheEntry<T> {
  cachedAt: number;
  data: T;
}

export function readCache<T>(key: string, ttlMs: number): T | null {
  const filePath = getCachePath(key);
  try {
    const entry = readJson<CacheEntry<T> | null>(filePath, null);
    if (!entry) return null;
    if (Date.now() - entry.cachedAt > ttlMs) return null;
    return entry.data;
  } catch {
    return null;
  }
}

export function writeCache<T>(key: string, data: T): void {
  const filePath = getCachePath(key);
  const entry: CacheEntry<T> = { cachedAt: Date.now(), data };
  writeJson(filePath, entry);
}
