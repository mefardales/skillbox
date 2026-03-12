/**
 * `skillbox list [category]` command.
 *
 * Displays all skills in the registry, optionally filtered by category.
 * Skills are grouped by category and displayed in a clean table layout.
 */

import chalk from "chalk";
import ora from "ora";
import type { Command } from "commander";
import { listSkills, listCategories } from "../lib/registry.js";
import { loadInstalled } from "../lib/config.js";
import type { Skill } from "../lib/types.js";

const COL_ID = 32;
const COL_VERSION = 8;
const COL_DESC = 50;

function truncate(str: string, max: number): string {
  if (str.length <= max) return str;
  return str.slice(0, max - 1) + "…";
}

function pad(str: string, len: number): string {
  return str.padEnd(len, " ");
}

function renderSkillRow(skill: Skill, isInstalled: boolean): string {
  const idPart = pad(truncate(skill.id, COL_ID), COL_ID);
  const versionPart = pad(skill.version, COL_VERSION);
  const descPart = truncate(skill.description, COL_DESC);
  const installedMark = isInstalled ? chalk.green(" ✔") : "  ";

  return (
    installedMark +
    " " +
    chalk.cyan(idPart) +
    " " +
    chalk.dim(versionPart) +
    " " +
    descPart
  );
}

function renderHeader(): string {
  const idPart = pad("SKILL ID", COL_ID);
  const versionPart = pad("VERSION", COL_VERSION);
  const descPart = "DESCRIPTION";
  return (
    "   " +
    chalk.bold.underline(idPart) +
    " " +
    chalk.bold.underline(versionPart) +
    " " +
    chalk.bold.underline(descPart)
  );
}

export function registerList(program: Command): void {
  program
    .command("list [category]")
    .description("List available skills, optionally filtered by category")
    .option("--no-cache", "Bypass local cache and fetch fresh data")
    .action(async (category: string | undefined, opts: { cache: boolean }) => {
      const spinner = ora("Fetching skill registry...").start();

      let skills;
      try {
        skills = await listSkills(category, !opts.cache);
      } catch (err) {
        spinner.fail(chalk.red("Failed to load registry."));
        console.error(
          chalk.dim(err instanceof Error ? err.message : String(err))
        );
        process.exit(1);
      }

      spinner.stop();

      if (skills.length === 0) {
        if (category) {
          console.log(
            chalk.yellow(`No skills found in category "${category}".`)
          );
          const cats = await listCategories();
          console.log(
            chalk.dim(
              `Available categories: ${cats.map((c) => chalk.cyan(c)).join(", ")}`
            )
          );
        } else {
          console.log(chalk.yellow("Registry is empty."));
        }
        return;
      }

      const installed = loadInstalled();
      const installedIds = new Set(installed.map((s) => s.id));

      // Group by category
      const byCategory = new Map<string, Skill[]>();
      for (const skill of skills) {
        const group = byCategory.get(skill.category) ?? [];
        group.push(skill);
        byCategory.set(skill.category, group);
      }

      if (category) {
        console.log(
          `\n${chalk.bold(`Skills in "${category}"`)}\n`
        );
      } else {
        console.log(
          `\n${chalk.bold("Available Skills")} ${chalk.dim(`(${skills.length} total)`)}\n`
        );
      }

      console.log(renderHeader());
      console.log(chalk.dim("─".repeat(COL_ID + COL_VERSION + COL_DESC + 8)));

      for (const [cat, catSkills] of Array.from(byCategory.entries()).sort()) {
        console.log(`\n  ${chalk.bold.yellow(cat.toUpperCase())}`);
        for (const skill of catSkills.sort((a, b) => a.id.localeCompare(b.id))) {
          console.log(renderSkillRow(skill, installedIds.has(skill.id)));
        }
      }

      // Legend
      const installedCount = skills.filter((s) => installedIds.has(s.id)).length;
      console.log("");
      if (installedCount > 0) {
        console.log(
          chalk.dim(`  ${chalk.green("✔")} = installed on this machine (${installedCount} skills)`)
        );
      }
      console.log(
        chalk.dim(
          `\n  Run ${chalk.cyan("skillbox info <skill>")} to view details and usage instructions.`
        )
      );
      console.log(
        chalk.dim(
          `  Run ${chalk.cyan("skillbox install <skill>")} to install a skill.`
        )
      );
    });
}
