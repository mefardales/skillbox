/**
 * `skillbox detect` command.
 *
 * Scans the current machine for supported AI coding tools (Claude Code,
 * Cursor, Codex) and reports installation status and skill counts.
 */

import chalk from "chalk";
import ora from "ora";
import type { Command } from "commander";
import { detectTools } from "../lib/detector.js";
import { loadInstalled } from "../lib/config.js";

export function registerDetect(program: Command): void {
  program
    .command("detect")
    .description("Detect which AI coding tools are installed on this machine")
    .action(async () => {
      const spinner = ora("Scanning for AI tools...").start();

      let targets;
      try {
        targets = detectTools();
      } catch (err) {
        spinner.fail(chalk.red("Detection failed."));
        console.error(
          chalk.dim(err instanceof Error ? err.message : String(err))
        );
        process.exit(1);
      }

      spinner.stop();

      const installed = loadInstalled();

      const detected = targets.filter((t) => t.detected);
      const missing = targets.filter((t) => !t.detected);

      console.log("");
      console.log(chalk.bold("AI Tool Detection\n"));

      if (detected.length === 0) {
        console.log(
          chalk.yellow(
            "  No supported AI coding tools were detected on this machine."
          )
        );
        console.log(
          chalk.dim(
            "\n  Skillbox supports: Claude Code, Cursor, Codex CLI\n" +
              "  Install one of these tools and re-run skillbox detect."
          )
        );
      } else {
        console.log(
          `  ${chalk.green("Detected")} (${detected.length}):\n`
        );

        for (const tool of detected) {
          // Count skills tracked for this tool
          const trackedCount = installed.filter((s) =>
            s.targets.includes(tool.name)
          ).length;

          const skillCountStr =
            trackedCount > 0
              ? chalk.green(`${trackedCount} skill${trackedCount !== 1 ? "s" : ""} installed`)
              : chalk.dim("no skills installed");

          console.log(
            `    ${chalk.green("✔")}  ${chalk.bold(tool.label.padEnd(16))}` +
              `  ${chalk.dim(tool.globalSkillsDir)}`
          );
          console.log(
            `       ${" ".repeat(16)}  ${skillCountStr}`
          );
          console.log("");
        }
      }

      if (missing.length > 0) {
        console.log(
          `  ${chalk.dim("Not detected")} (${missing.length}):\n`
        );
        for (const tool of missing) {
          console.log(
            `    ${chalk.dim("○")}  ${chalk.dim(tool.label)}`
          );
        }
        console.log("");
      }

      // Summary
      const totalTracked = installed.length;
      if (totalTracked > 0) {
        console.log(
          chalk.dim(
            `  ${totalTracked} skill${totalTracked !== 1 ? "s" : ""} tracked by skillbox.`
          )
        );
        console.log(
          chalk.dim(
            `  Run ${chalk.cyan("skillbox list")} to browse available skills.`
          )
        );
      } else if (detected.length > 0) {
        console.log(
          chalk.dim(
            `  Run ${chalk.cyan("skillbox list")} to browse available skills.`
          )
        );
        console.log(
          chalk.dim(
            `  Run ${chalk.cyan("skillbox install <skill>")} to get started.`
          )
        );
      }
    });
}
