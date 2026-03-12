/**
 * `skillbox info <skill>` command.
 *
 * Displays full metadata for a skill: description, version, category,
 * tags, author, update date, installation status, and the SKILL.md preview.
 */

import chalk from "chalk";
import ora from "ora";
import type { Command } from "commander";
import { findSkill, fetchSkillContent } from "../lib/registry.js";
import { getInstalledSkill } from "../lib/config.js";

const PREVIEW_LINES = 40;

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

export function registerInfo(program: Command): void {
  program
    .command("info <skill>")
    .description("Show full details for a skill")
    .option("--no-cache", "Bypass local cache and fetch fresh data")
    .option("--preview", "Show a preview of the SKILL.md content", false)
    .action(async (skillArg: string, opts: { cache: boolean; preview: boolean }) => {
      const spinner = ora(`Looking up ${chalk.cyan(skillArg)}...`).start();

      let skill;
      try {
        skill = await findSkill(skillArg, !opts.cache);
      } catch (err) {
        spinner.fail(chalk.red("Failed to reach registry."));
        console.error(
          chalk.dim(err instanceof Error ? err.message : String(err))
        );
        process.exit(1);
      }

      if (!skill) {
        spinner.fail(chalk.red(`Skill "${skillArg}" not found in registry.`));
        console.error(
          chalk.dim(
            `Run ${chalk.cyan("skillbox search <query>")} to find skills.`
          )
        );
        process.exit(1);
      }

      spinner.stop();

      const installed = getInstalledSkill(skill.id);

      // ── Header ───────────────────────────────────────────────────────────
      console.log("");
      console.log(chalk.bold.white(`  ${skill.name}`));
      console.log(chalk.dim(`  ${skill.id}`));
      console.log("");

      // ── Metadata table ───────────────────────────────────────────────────
      const row = (label: string, value: string) =>
        `  ${chalk.dim(label.padEnd(12))}  ${value}`;

      console.log(row("Version", chalk.green(skill.version)));
      console.log(row("Category", chalk.cyan(skill.category)));
      console.log(row("Author", skill.author));
      console.log(row("Updated", formatDate(skill.updatedAt)));
      console.log(
        row(
          "Tags",
          skill.tags.map((t) => chalk.dim(`#${t}`)).join("  ") || chalk.dim("—")
        )
      );

      if (installed) {
        console.log(
          row(
            "Installed",
            chalk.green(
              `Yes — ${formatDate(installed.installedAt)} ` +
                chalk.dim(`(${installed.targets.join(", ")})`)
            )
          )
        );
      } else {
        console.log(row("Installed", chalk.dim("No")));
      }

      // ── Description ──────────────────────────────────────────────────────
      console.log("");
      console.log(chalk.dim("  ─".padEnd(50, "─")));
      console.log("");
      console.log(`  ${skill.description}`);
      console.log("");

      // ── Links ─────────────────────────────────────────────────────────────
      if (skill.repoUrl) {
        console.log(`  ${chalk.dim("Source:")} ${chalk.blue(skill.repoUrl)}`);
      }
      console.log(`  ${chalk.dim("SKILL.md:")} ${chalk.blue(skill.skillUrl)}`);
      console.log("");

      // ── SKILL.md preview (optional) ───────────────────────────────────────
      if (opts.preview) {
        const previewSpinner = ora("Fetching SKILL.md preview...").start();
        let content;
        try {
          content = await fetchSkillContent(skill);
          previewSpinner.stop();
        } catch (err) {
          previewSpinner.fail(chalk.red("Could not fetch SKILL.md."));
          console.error(
            chalk.dim(err instanceof Error ? err.message : String(err))
          );
          content = null;
        }

        if (content) {
          const lines = content.split("\n");
          const preview = lines.slice(0, PREVIEW_LINES).join("\n");
          const truncated = lines.length > PREVIEW_LINES;

          console.log(chalk.dim("  ── SKILL.md preview " + "─".padEnd(30, "─")));
          console.log("");
          console.log(
            preview
              .split("\n")
              .map((l) => "  " + l)
              .join("\n")
          );
          if (truncated) {
            console.log(
              chalk.dim(`\n  ... (${lines.length - PREVIEW_LINES} more lines)`)
            );
          }
          console.log("");
        }
      }

      // ── CTA ───────────────────────────────────────────────────────────────
      if (!installed) {
        console.log(
          chalk.dim(
            `  Run ${chalk.cyan(`skillbox install ${skill.id}`)} to install this skill.`
          )
        );
      } else {
        console.log(
          chalk.dim(
            `  Run ${chalk.cyan(`skillbox remove ${skill.id}`)} to remove this skill.`
          )
        );
      }
    });
}
