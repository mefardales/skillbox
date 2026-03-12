/**
 * `skillbox search <query>` command.
 *
 * Searches skills by name, description, tags, and category.
 * Results are ranked by relevance (exact matches first).
 */

import chalk from "chalk";
import ora from "ora";
import type { Command } from "commander";
import { searchSkills } from "../lib/registry.js";
import { loadInstalled } from "../lib/config.js";
import type { Skill } from "../lib/types.js";

function highlight(text: string, query: string): string {
  const q = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`(${q})`, "gi");
  return text.replace(regex, chalk.bold.yellow("$1"));
}

function scoreSkill(skill: Skill, q: string): number {
  const ql = q.toLowerCase();
  let score = 0;

  if (skill.id.toLowerCase() === ql) score += 100;
  if (skill.name.toLowerCase() === ql) score += 90;
  if (skill.id.toLowerCase().includes(ql)) score += 50;
  if (skill.name.toLowerCase().includes(ql)) score += 40;
  if (skill.tags.some((t) => t.toLowerCase() === ql)) score += 30;
  if (skill.tags.some((t) => t.toLowerCase().includes(ql))) score += 20;
  if (skill.description.toLowerCase().includes(ql)) score += 10;

  return score;
}

export function registerSearch(program: Command): void {
  program
    .command("search <query>")
    .description("Search skills by name, tags, or description")
    .option("--no-cache", "Bypass local cache and fetch fresh data")
    .action(async (query: string, opts: { cache: boolean }) => {
      if (!query || query.trim().length === 0) {
        console.error(chalk.red("Please provide a search query."));
        process.exit(1);
      }

      const spinner = ora(`Searching for ${chalk.cyan(`"${query}"`)}`).start();

      let results;
      try {
        results = await searchSkills(query, !opts.cache);
      } catch (err) {
        spinner.fail(chalk.red("Failed to load registry."));
        console.error(
          chalk.dim(err instanceof Error ? err.message : String(err))
        );
        process.exit(1);
      }

      spinner.stop();

      if (results.length === 0) {
        console.log(
          chalk.yellow(`No skills found matching "${query}".`)
        );
        console.log(
          chalk.dim(
            `Try ${chalk.cyan("skillbox list")} to see all available skills.`
          )
        );
        return;
      }

      // Sort by relevance score descending
      const scored = results
        .map((s) => ({ skill: s, score: scoreSkill(s, query) }))
        .sort((a, b) => b.score - a.score);

      const installed = loadInstalled();
      const installedIds = new Set(installed.map((s) => s.id));

      console.log(
        `\n${chalk.bold(`Search results for "${query}"`)}`  +
        chalk.dim(` — ${results.length} skill${results.length !== 1 ? "s" : ""} found`) +
        "\n"
      );

      for (const { skill } of scored) {
        const isInstalled = installedIds.has(skill.id);
        const mark = isInstalled ? chalk.green(" ✔ ") : "   ";
        const id = highlight(skill.id, query);
        const name = highlight(skill.name, query);
        const desc = highlight(skill.description, query);
        const tags = skill.tags
          .map((t) => chalk.dim(`#${highlight(t, query)}`))
          .join(" ");

        console.log(
          `${mark}${chalk.cyan(id)}  ${chalk.bold(name)}`
        );
        console.log(`     ${desc}`);
        if (tags) {
          console.log(`     ${tags}`);
        }
        console.log(
          `     ${chalk.dim(`v${skill.version}`)}  ${chalk.dim(skill.category)}` +
          (isInstalled ? chalk.green("  (installed)") : "")
        );
        console.log("");
      }

      console.log(
        chalk.dim(
          `Run ${chalk.cyan("skillbox install <skill-id>")} to install a skill.`
        )
      );
    });
}
