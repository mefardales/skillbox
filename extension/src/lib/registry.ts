/**
 * Registry fetcher for the Skillbox VSCode extension.
 *
 * Fetches the skill registry from GitHub and caches it on disk at
 * ~/.skillbox/cache/registry.json — same cache location as the CLI,
 * so the two tools share a warm cache.
 */

import fetch from "node-fetch";
import fs from "fs";
import path from "path";
import os from "os";
import type { RegistryData, Skill } from "./types";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_REGISTRY_URL =
  "https://raw.githubusercontent.com/MarcoRiformworking/skillbox/main/skills/registry.json";

/**
 * Returns the registry URL, checking SKILLBOX_REGISTRY env var first.
 * Supports local file paths for development (file://, absolute paths).
 */
function getRegistryUrl(): string {
  return process.env.SKILLBOX_REGISTRY || DEFAULT_REGISTRY_URL;
}

export const REGISTRY_URL = getRegistryUrl();

const SKILLBOX_DIR = path.join(os.homedir(), ".skillbox");
const CACHE_DIR = path.join(SKILLBOX_DIR, "cache");
const CACHE_FILE = path.join(CACHE_DIR, "registry.json");
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

interface CacheEntry {
  cachedAt: number;
  data: RegistryData;
}

// ---------------------------------------------------------------------------
// Cache helpers
// ---------------------------------------------------------------------------

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function readCache(): RegistryData | null {
  try {
    const raw = fs.readFileSync(CACHE_FILE, "utf8");
    const entry: CacheEntry = JSON.parse(raw);
    if (Date.now() - entry.cachedAt > CACHE_TTL_MS) return null;
    return entry.data;
  } catch {
    return null;
  }
}

function writeCache(data: RegistryData): void {
  ensureDir(CACHE_DIR);
  const entry: CacheEntry = { cachedAt: Date.now(), data };
  fs.writeFileSync(CACHE_FILE, JSON.stringify(entry, null, 2), "utf8");
}

// ---------------------------------------------------------------------------
// Fetch
// ---------------------------------------------------------------------------

function validateRegistry(data: unknown): asserts data is RegistryData {
  if (!data || typeof data !== "object") {
    throw new Error("Registry payload is not an object.");
  }
  const obj = data as Record<string, unknown>;
  if (!Array.isArray(obj.skills)) {
    throw new Error('Registry payload is missing "skills" array.');
  }
}

function isLocalPath(url: string): boolean {
  return (
    url.startsWith("file://") ||
    url.startsWith("/") ||
    /^[a-zA-Z]:[\\/]/.test(url)
  );
}

function readLocalFile(url: string): string {
  const filePath = url.replace(/^file:\/\//, "");
  return fs.readFileSync(filePath, "utf8");
}

async function fetchRemote(): Promise<RegistryData> {
  const url = REGISTRY_URL;

  if (isLocalPath(url)) {
    const raw = readLocalFile(url);
    const data: unknown = JSON.parse(raw);
    validateRegistry(data);
    return data;
  }

  const res = await fetch(url, {
    headers: { "User-Agent": "skillbox-vscode/0.1.0" },
  });

  if (!res.ok) {
    throw new Error(
      `Failed to fetch registry (HTTP ${res.status}): ${res.statusText}`
    );
  }

  const data: unknown = await res.json();
  validateRegistry(data);
  return data;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Fetch the skill registry, using the disk cache when available and fresh.
 * Pass forceRefresh=true to always hit the network.
 */
export async function fetchRegistry(
  forceRefresh = false
): Promise<RegistryData> {
  if (!forceRefresh) {
    const cached = readCache();
    if (cached) return cached;
  }

  const data = await fetchRemote();
  writeCache(data);
  return data;
}

/**
 * Fetch the raw SKILL.md content for a given skill.
 * Supports local file paths when SKILLBOX_REGISTRY points to a local registry.
 */
export async function fetchSkillContent(skill: Skill): Promise<string> {
  const url = skill.skillUrl;

  // If skillUrl is local or if registry is local, try to resolve locally
  if (isLocalPath(url)) {
    return readLocalFile(url);
  }

  // If the registry itself is local, derive the local path from skillUrl
  const registryUrl = REGISTRY_URL;
  if (isLocalPath(registryUrl)) {
    // Registry is local — derive skill path relative to repo root
    // skillUrl is like https://raw.githubusercontent.com/.../skills/category/name/SKILL.md
    // Extract the "skills/..." part and resolve from registry parent
    const skillsMatch = url.match(/skills\/.+$/);
    if (skillsMatch) {
      const registryDir = path.dirname(registryUrl.replace(/^file:\/\//, ""));
      // registryDir is the skills/ folder parent, or the skills/ folder itself
      const repoRoot = registryDir.endsWith("skills")
        ? path.dirname(registryDir)
        : path.dirname(registryDir);
      const localPath = path.join(repoRoot, skillsMatch[0]);
      if (fs.existsSync(localPath)) {
        return fs.readFileSync(localPath, "utf8");
      }
    }
  }

  const res = await fetch(url, {
    headers: { "User-Agent": "skillbox-vscode/0.1.0" },
  });

  if (!res.ok) {
    throw new Error(
      `Failed to download skill "${skill.id}" (HTTP ${res.status})`
    );
  }

  return res.text();
}

/**
 * Search skills by name, description, tags, and ID.
 */
export function searchSkills(skills: Skill[], query: string): Skill[] {
  const q = query.toLowerCase().trim();
  if (!q) return skills;

  return skills.filter((s) => {
    return (
      s.id.toLowerCase().includes(q) ||
      s.name.toLowerCase().includes(q) ||
      s.description.toLowerCase().includes(q) ||
      s.tags.some((t) => t.toLowerCase().includes(q)) ||
      s.category.toLowerCase().includes(q)
    );
  });
}

/**
 * Group skills by category, returning a sorted map.
 */
export function groupByCategory(
  skills: Skill[]
): Map<string, Skill[]> {
  const map = new Map<string, Skill[]>();

  for (const skill of skills) {
    const cat = skill.category || "general";
    const list = map.get(cat) ?? [];
    list.push(skill);
    map.set(cat, list);
  }

  // Sort categories alphabetically
  return new Map([...map.entries()].sort(([a], [b]) => a.localeCompare(b)));
}
