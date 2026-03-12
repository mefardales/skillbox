import * as fs from "fs";
import * as path from "path";

interface ValidationResult {
  file: string;
  errors: string[];
  warnings: string[];
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

    const topLevelMatch = trimmed.match(/^(\w[\w-]*):\s*(.*)/);
    const metadataFieldMatch = trimmed.match(/^\s{2}(\w[\w-]*):\s*(.*)/);

    if (topLevelMatch && !trimmed.startsWith(" ")) {
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
        inMultiline = true;
        currentKey = key;
        currentValue = "";
      } else {
        currentKey = "";
        inMultiline = false;
        result[key] = value.replace(/^["']|["']$/g, "");
      }
    } else if (inMetadata && metadataFieldMatch) {
      const key = metadataFieldMatch[1];
      let value = metadataFieldMatch[2].replace(/^["']|["']$/g, "");
      metadata[key] = value;
    } else if (inMultiline) {
      currentValue += " " + trimmed.trim();
    }
  }

  if (inMultiline && currentKey) {
    result[currentKey] = currentValue.trim();
  }

  if (Object.keys(metadata).length > 0) {
    result["metadata"] = metadata;
  }

  return result;
}

function findSkillFiles(skillsDir: string): string[] {
  const results: string[] = [];

  function walk(dir: string) {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
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

function validateSkill(filePath: string, skillsDir: string): ValidationResult {
  const relativePath = path.relative(skillsDir, filePath);
  const result: ValidationResult = {
    file: relativePath,
    errors: [],
    warnings: [],
  };

  // Read file
  let content: string;
  try {
    content = fs.readFileSync(filePath, "utf-8");
  } catch (err) {
    result.errors.push(`Cannot read file: ${err}`);
    return result;
  }

  // Check frontmatter exists
  const frontmatter = parseFrontmatter(content);
  if (!frontmatter) {
    result.errors.push("Missing or malformed YAML frontmatter (must start and end with ---)");
    return result;
  }

  // Required fields
  if (!frontmatter.name) {
    result.errors.push("Missing required field: name");
  }

  if (!frontmatter.description) {
    result.errors.push("Missing required field: description");
  }

  // Validate name matches directory name
  const parts = relativePath.split(path.sep);
  if (parts.length >= 2) {
    const dirName = parts[parts.length - 2]; // directory containing SKILL.md
    if (frontmatter.name && frontmatter.name !== dirName) {
      result.errors.push(
        `Skill name "${frontmatter.name}" does not match directory name "${dirName}"`
      );
    }
  }

  // Check metadata block
  const meta = frontmatter.metadata;
  if (!meta) {
    result.warnings.push("Missing metadata block (author, version, category, tags)");
  } else {
    if (!meta.author) {
      result.warnings.push("Missing metadata.author");
    }
    if (!meta.version) {
      result.warnings.push("Missing metadata.version");
    }
    if (!meta.category) {
      result.warnings.push("Missing metadata.category");
    }
    if (!meta.tags) {
      result.warnings.push("Missing metadata.tags");
    }

    // Validate category matches parent directory
    if (meta.category && parts.length >= 3) {
      const categoryDir = parts[0];
      if (meta.category !== categoryDir) {
        result.warnings.push(
          `metadata.category "${meta.category}" does not match parent directory "${categoryDir}"`
        );
      }
    }
  }

  // Check license
  if (!frontmatter.license) {
    result.warnings.push("Missing license field");
  }

  // Check content after frontmatter
  const contentAfterFrontmatter = content.split("---").slice(2).join("---").trim();
  if (!contentAfterFrontmatter) {
    result.warnings.push("No content after frontmatter");
  } else if (contentAfterFrontmatter.length < 100) {
    result.warnings.push("Content is very short (less than 100 characters)");
  }

  // Check for a top-level heading
  if (contentAfterFrontmatter && !contentAfterFrontmatter.match(/^#\s+/m)) {
    result.warnings.push("No top-level heading (# ...) found in content");
  }

  return result;
}

function main(): void {
  const rootDir = path.resolve(__dirname, "..");
  const skillsDir = path.join(rootDir, "skills");

  console.log("Validating SKILL.md files...\n");

  const skillFiles = findSkillFiles(skillsDir);

  if (skillFiles.length === 0) {
    console.error("No SKILL.md files found!");
    process.exit(1);
  }

  let totalErrors = 0;
  let totalWarnings = 0;
  const results: ValidationResult[] = [];

  for (const filePath of skillFiles) {
    const result = validateSkill(filePath, skillsDir);
    results.push(result);
    totalErrors += result.errors.length;
    totalWarnings += result.warnings.length;
  }

  // Print results
  for (const result of results) {
    const hasIssues = result.errors.length > 0 || result.warnings.length > 0;
    const status =
      result.errors.length > 0 ? "FAIL" : result.warnings.length > 0 ? "WARN" : "PASS";

    console.log(`  [${status}] ${result.file}`);

    for (const error of result.errors) {
      console.log(`         ERROR: ${error}`);
    }
    for (const warning of result.warnings) {
      console.log(`         WARNING: ${warning}`);
    }
  }

  console.log(`\nValidation complete.`);
  console.log(`  Files scanned: ${skillFiles.length}`);
  console.log(`  Errors: ${totalErrors}`);
  console.log(`  Warnings: ${totalWarnings}`);

  if (totalErrors > 0) {
    console.log(`\nValidation FAILED with ${totalErrors} error(s).`);
    process.exit(1);
  } else {
    console.log(`\nAll skills passed validation.`);
  }
}

main();
