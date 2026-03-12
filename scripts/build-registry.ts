import * as fs from "fs";
import * as path from "path";

const REPO_BASE_URL =
  "https://raw.githubusercontent.com/MarcoRiformworking/skillbox/main";

interface SkillMetadata {
  author: string;
  version: string;
  category: string;
  tags: string[];
}

interface SkillEntry {
  id: string;
  name: string;
  description: string;
  category: string;
  tags: string[];
  version: string;
  author: string;
  skillUrl: string;
  updatedAt: string;
}

interface Registry {
  version: string;
  updatedAt: string;
  skills: SkillEntry[];
}

function parseFrontmatter(content: string): Record<string, any> | null {
  const lines = content.split("\n");
  if (lines[0].trim() !== "---") return null;

  let endIndex = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === "---") {
      endIndex = i;
      break;
    }
  }
  if (endIndex === -1) return null;

  const yamlLines = lines.slice(1, endIndex);
  const result: Record<string, any> = {};
  let currentKey = "";
  let currentValue = "";
  let inMultiline = false;
  let inMetadata = false;
  const metadata: Record<string, any> = {};

  for (let i = 0; i < yamlLines.length; i++) {
    const line = yamlLines[i];
    const trimmed = line.trimEnd();

    // Check if this is a top-level key (no leading spaces, or exactly 0 indent)
    const topLevelMatch = trimmed.match(/^(\w[\w-]*):\s*(.*)/);
    const metadataFieldMatch = trimmed.match(/^\s{2}(\w[\w-]*):\s*(.*)/);

    if (topLevelMatch && !trimmed.startsWith(" ")) {
      // Save any pending multiline value
      if (inMultiline && currentKey) {
        result[currentKey] = currentValue.trim();
        inMultiline = false;
      }

      const key = topLevelMatch[1];
      const value = topLevelMatch[2];

      if (key === "metadata") {
        inMetadata = true;
        inMultiline = false;
        currentKey = "";
        continue;
      }

      inMetadata = false;

      if (value === ">" || value === "|") {
        // Start of multiline value
        inMultiline = true;
        currentKey = key;
        currentValue = "";
      } else {
        currentKey = "";
        inMultiline = false;
        // Remove surrounding quotes
        result[key] = value.replace(/^["']|["']$/g, "");
      }
    } else if (inMetadata && metadataFieldMatch) {
      const key = metadataFieldMatch[1];
      let value = metadataFieldMatch[2].replace(/^["']|["']$/g, "");
      metadata[key] = value;
    } else if (inMultiline) {
      // Continuation of multiline value
      currentValue += " " + trimmed.trim();
    }
  }

  // Save any pending multiline value
  if (inMultiline && currentKey) {
    result[currentKey] = currentValue.trim();
  }

  if (Object.keys(metadata).length > 0) {
    result["metadata"] = metadata;
  }

  return result;
}

function parseTags(tagsStr: string): string[] {
  return tagsStr
    .split(",")
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
}

function findSkillFiles(skillsDir: string): string[] {
  const results: string[] = [];

  function walk(dir: string) {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        // Check if this directory contains a SKILL.md
        const skillPath = path.join(fullPath, "SKILL.md");
        if (fs.existsSync(skillPath)) {
          results.push(skillPath);
        }
        walk(fullPath);
      }
    }
  }

  walk(skillsDir);
  return results;
}

function buildRegistry(): void {
  const rootDir = path.resolve(__dirname, "..");
  const skillsDir = path.join(rootDir, "skills");
  const outputPath = path.join(skillsDir, "registry.json");

  console.log("Scanning for SKILL.md files...\n");

  const skillFiles = findSkillFiles(skillsDir);

  if (skillFiles.length === 0) {
    console.error("No SKILL.md files found!");
    process.exit(1);
  }

  const now = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
  const skills: SkillEntry[] = [];

  for (const filePath of skillFiles) {
    const content = fs.readFileSync(filePath, "utf-8");
    const frontmatter = parseFrontmatter(content);

    if (!frontmatter) {
      console.warn(`  WARNING: No frontmatter found in ${filePath}, skipping.`);
      continue;
    }

    const relativePath = path.relative(skillsDir, filePath);
    const parts = relativePath.split(path.sep);
    // parts = ["category", "skill-name", "SKILL.md"]
    const category = parts.length >= 3 ? parts[0] : "uncategorized";
    const skillDirName = parts.length >= 3 ? parts[1] : parts[0];

    const name = frontmatter.name || skillDirName;
    const description = frontmatter.description || "";
    const meta = frontmatter.metadata || {};
    const author = meta.author || "unknown";
    const version = meta.version || "1.0";
    const skillCategory = meta.category || category;
    const tags = meta.tags ? parseTags(meta.tags) : [];

    const skillRelativePath = path
      .relative(rootDir, filePath)
      .split(path.sep)
      .join("/");
    const skillUrl = `${REPO_BASE_URL}/${skillRelativePath}`;

    const id = `${skillCategory}/${name}`;

    // Use git last-modified date if available, otherwise use file mtime
    let updatedAt = now;
    try {
      const stat = fs.statSync(filePath);
      updatedAt = stat.mtime.toISOString().replace(/\.\d{3}Z$/, "Z");
    } catch {
      // fallback to now
    }

    skills.push({
      id,
      name,
      description,
      category: skillCategory,
      tags,
      version,
      author,
      skillUrl,
      updatedAt,
    });

    console.log(`  Found: ${id}`);
  }

  // Sort by category then name
  skills.sort((a, b) => {
    if (a.category !== b.category) return a.category.localeCompare(b.category);
    return a.name.localeCompare(b.name);
  });

  const registry: Registry = {
    version: "1",
    updatedAt: now,
    skills,
  };

  const registryJson = JSON.stringify(registry, null, 2) + "\n";
  fs.writeFileSync(outputPath, registryJson, "utf-8");

  // Also copy to docs/ for the landing page
  const docsOutput = path.join(rootDir, "docs", "registry.json");
  if (fs.existsSync(path.join(rootDir, "docs"))) {
    fs.writeFileSync(docsOutput, registryJson, "utf-8");
    console.log(`  Copied to: ${docsOutput}`);
  }

  console.log(`\nRegistry built successfully!`);
  console.log(`  Total skills indexed: ${skills.length}`);
  console.log(`  Output: ${outputPath}`);

  // Print category summary
  const categories = new Map<string, number>();
  for (const skill of skills) {
    categories.set(skill.category, (categories.get(skill.category) || 0) + 1);
  }
  console.log(`\n  By category:`);
  for (const [cat, count] of Array.from(categories.entries()).sort()) {
    console.log(`    ${cat}: ${count}`);
  }
}

buildRegistry();
