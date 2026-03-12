/**
 * `skillbox remove <skill>` command.
 *
 * Removes a skill from every tool directory it was installed into (both global
 * and project-local) and updates the tracking file.
 */

import chalk from "chalk";
import ora from "ora";
import type { Command } from "commander";
import { removeSkill } from "../lib/installer.js";
import { getInstalledSkill } from "../lib/config.js";

export function registerRemove(program: Command): void {
  program
    .command("remove <skill>")
    .alias("uninstall")
    .description("Remove an installed skill from all AI tools")
    .action(async (skillArg: string) => {
      // Check whether the skill is tracked
      const tracked = getInstalledSkill(skillArg);
      if (!tracked) {
        // Still attempt removal in case the user installed it manually
        console.log(
          chalk.yellow(
            `Skill "${skillArg}" is not tracked by skillbox — attempting cleanup anyway.`
          )
        );
      }

      const spinner = ora(`Removing ${chalk.cyan(skillArg)}...`).start();

      let results;
      try {
        results = await removeSkill(skillArg);
      } catch (err) {
        spinner.fail(chalk.red("Removal failed."));
        console.error(
          chalk.dim(err instanceof Error ? err.message : String(err))
        );
        process.exit(1);
      }

      spinner.stop();

      const removed = results.filter((r) => r.success && !r.skipped);
      const failed = results.filter((r) => !r.success);

      if (removed.length === 0 && failed.length === 0) {
        console.log(
          chalk.yellow(`No installed files found for "${skillArg}".`)
        );
        return;
      }

      for (const r of removed) {
        console.log(
          `  ${chalk.green("✔")} Removed from ${chalk.cyan(r.tool)} ${chalk.dim(`(${r.skillDir})`)}`
        );
      }

      for (const r of failed) {
        console.log(
          `  ${chalk.red("✖")} Failed to remove from ${chalk.cyan(r.tool)}: ${chalk.red(r.error ?? "unknown error")}`
        );
      }

      if (failed.length === 0) {
        console.log(`\n${chalk.green("Skill removed:")} ${chalk.bold(skillArg)}`);
      } else {
        console.warn(
          chalk.yellow("\nSome targets could not be cleaned up. See errors above.")
        );
        process.exit(1);
      }
    });
}
