/**
 * `skillbox recommend` command.
 *
 * Scans the current project directory to detect the tech stack and
 * recommends skills from the registry that match the detected technologies.
 */

import chalk from "chalk";
import ora from "ora";
import type { Command } from "commander";
import { detectProjectStack } from "../lib/stackDetector.js";
import { fetchRegistry } from "../lib/registry.js";
import { loadInstalled } from "../lib/config.js";

export function registerRecommend(program: Command): void {
  program
    .command("recommend")
    .alias("rec")
    .description("Detect your project stack and recommend matching skills")
    .option("-d, --dir <path>", "Directory to scan (default: current directory)")
    .action(async (opts: { dir?: string }) => {
      const rootPath = opts.dir || process.cwd();
      const spinner = ora("Scanning project stack...").start();

      let stacks;
      try {
        stacks = detectProjectStack(rootPath);
      } catch (err) {
        spinner.fail(chalk.red("Failed to scan project."));
        console.error(chalk.dim(err instanceof Error ? err.message : String(err)));
        process.exit(1);
      }

      if (stacks.length === 0) {
        spinner.info("No recognized technologies detected in this directory.");
        console.log(chalk.dim("\n  Try running this command from your project root."));
        console.log(chalk.dim(`  Run ${chalk.cyan("skillbox list")} to browse all available skills.\n`));
        return;
      }

      spinner.text = "Loading registry...";

      let registrySkills: { id: string; name: string; description: string; category: string }[] = [];
      try {
        const registry = await fetchRegistry();
        registrySkills = registry.skills;
      } catch (err) {
        spinner.fail(chalk.red("Failed to load registry."));
        console.error(chalk.dim(err instanceof Error ? err.message : String(err)));
        process.exit(1);
      }

      spinner.stop();

      const installed = loadInstalled();
      const installedIds = new Set(installed.map((s) => s.id));

      console.log("");
      console.log(chalk.bold("Stack Detection & Recommendations\n"));

      // Show detected stack
      console.log(chalk.bold("  Detected Technologies:\n"));
      for (const stack of stacks) {
        console.log(`    ${chalk.green(">")}  ${chalk.bold(stack.name)}  ${chalk.dim(`(${stack.signal})`)}`);
      }

      console.log("");
      console.log(chalk.bold("  Recommended Skills:\n"));

      // Collect all recommended skill IDs (deduplicated)
      const recommendedIds = new Set<string>();
      for (const stack of stacks) {
        for (const id of stack.skillIds) {
          recommendedIds.add(id);
        }
      }
      // Always add general skills
      recommendedIds.add("general/git-workflow");
      recommendedIds.add("general/code-review");

      let notInstalledCount = 0;

      for (const id of recommendedIds) {
        const skill = registrySkills.find((s) => s.id === id);
        if (!skill) continue;

        const isInst = installedIds.has(id);
        const status = isInst
          ? chalk.green("  installed")
          : chalk.yellow("  not installed");
        const icon = isInst ? chalk.green("✔") : chalk.yellow("○");

        console.log(`    ${icon}  ${chalk.bold(skill.name.padEnd(28))} ${chalk.dim(skill.category.padEnd(12))} ${status}`);
        if (!isInst) {
          console.log(chalk.dim(`       ${skill.description.substring(0, 70)}`));
          notInstalledCount++;
        }
      }

      console.log("");

      if (notInstalledCount > 0) {
        console.log(
          chalk.dim(`  ${notInstalledCount} skill${notInstalledCount !== 1 ? "s" : ""} recommended but not yet installed.`)
        );
        console.log(
          chalk.dim(`  Run ${chalk.cyan("skillbox install <category/skill>")} to install.\n`)
        );
      } else {
        console.log(chalk.green("  All recommended skills are already installed!\n"));
      }
    });
}
