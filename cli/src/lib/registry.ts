/**
 * Registry fetcher — retrieves and caches the skill registry from GitHub.
 *
 * Cache strategy: store the parsed payload in ~/.skillbox/cache/ keyed by URL.
 * Cache is considered fresh for `cacheTtlMs` milliseconds (default 1 hour).
 * A forced refresh (--no-cache flag or programmatic call) bypasses the cache.
 */

import fs from "fs";
import fetch from "node-fetch";
import type { RegistryData, Skill } from "./types.js";
import {
  readCache,
  writeCache,
  loadConfig,
  getRegistryUrl,
} from "./config.js";

const CACHE_KEY = "registry";

// ---------------------------------------------------------------------------
// Fetch
// ---------------------------------------------------------------------------

async function fetchRegistryRemote(url: string): Promise<RegistryData> {
  // Support local file paths (file:// or absolute paths)
  if (url.startsWith("file://") || url.startsWith("/") || /^[a-zA-Z]:[\\/]/.test(url)) {
    const filePath = url.replace(/^file:\/\//, "");
    const raw = fs.readFileSync(filePath, "utf8");
    const data = JSON.parse(raw);
    validateRegistry(data);
    return data as RegistryData;
  }

  const res = await fetch(url, {
    headers: { "User-Agent": "skillbox-cli/0.1.0" },
  });

  if (!res.ok) {
    throw new Error(
      `Failed to fetch registry (HTTP ${res.status}): ${res.statusText}\n` +
        `URL: ${url}`
    );
  }

  let data: unknown;
  try {
    data = await res.json();
  } catch {
    throw new Error("Registry response is not valid JSON.");
  }

  validateRegistry(data);
  return data as RegistryData;
}

function validateRegistry(data: unknown): asserts data is RegistryData {
  if (!data || typeof data !== "object") {
    throw new Error("Registry payload is not an object.");
  }
  const obj = data as Record<string, unknown>;
  if (!Array.isArray(obj.skills)) {
    throw new Error('Registry payload is missing "skills" array.');
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Load the skill registry, using the on-disk cache when available and fresh.
 * Pass `forceRefresh = true` to always hit the network.
 */
export async function fetchRegistry(
  forceRefresh = false
): Promise<RegistryData> {
  const config = loadConfig();
  const url = getRegistryUrl();

  if (!forceRefresh) {
    const cached = readCache<RegistryData>(CACHE_KEY, config.cacheTtlMs);
    if (cached) return cached;
  }

  const data = await fetchRegistryRemote(url);
  writeCache(CACHE_KEY, data);
  return data;
}

/**
 * Find a skill by its full ID ("category/skill-name") or just "skill-name".
 * Returns undefined when not found.
 */
export async function findSkill(
  query: string,
  forceRefresh = false
): Promise<Skill | undefined> {
  const registry = await fetchRegistry(forceRefresh);
  const q = query.toLowerCase();

  // Exact full-ID match first
  const exact = registry.skills.find((s) => s.id.toLowerCase() === q);
  if (exact) return exact;

  // Fallback: match by the skill-name portion only
  return registry.skills.find((s) => {
    const parts = s.id.toLowerCase().split("/");
    return parts[parts.length - 1] === q;
  });
}

/**
 * Return skills filtered by category (case-insensitive).
 * Pass undefined to return all skills.
 */
export async function listSkills(
  category?: string,
  forceRefresh = false
): Promise<Skill[]> {
  const registry = await fetchRegistry(forceRefresh);
  if (!category) return registry.skills;
  const cat = category.toLowerCase();
  return registry.skills.filter((s) => s.category.toLowerCase() === cat);
}

/**
 * Search skills by matching query against name, description, tags, and ID.
 */
export async function searchSkills(
  query: string,
  forceRefresh = false
): Promise<Skill[]> {
  const registry = await fetchRegistry(forceRefresh);
  const q = query.toLowerCase();

  return registry.skills.filter((s) => {
    return (
      s.id.toLowerCase().includes(q) ||
      s.name.toLowerCase().includes(q) ||
      s.description.toLowerCase().includes(q) ||
      s.tags.some((t) => t.toLowerCase().includes(q))
    );
  });
}

/**
 * Return all unique categories present in the registry.
 */
export async function listCategories(forceRefresh = false): Promise<string[]> {
  const registry = await fetchRegistry(forceRefresh);
  const cats = new Set(registry.skills.map((s) => s.category));
  return Array.from(cats).sort();
}

/**
 * Fetch the raw SKILL.md content for a given skill.
 */
export async function fetchSkillContent(skill: Skill): Promise<string> {
  const res = await fetch(skill.skillUrl, {
    headers: { "User-Agent": "skillbox-cli/0.1.0" },
  });

  if (!res.ok) {
    throw new Error(
      `Failed to download skill "${skill.id}" (HTTP ${res.status})\n` +
        `URL: ${skill.skillUrl}`
    );
  }

  return res.text();
}
