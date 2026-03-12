/**
 * `skillbox install <skill>` command.
 *
 * Parses the skill argument as "category/skill-name" or just "skill-name",
 * fetches it from the registry, and installs it into every detected tool
 * (or a specific tool if --tool is given).
 *
 * Flags:
 *   --global    Install to ~/.<tool>/skills/<name>/ (default)
 *   --project   Install to ./.claude/skills/<name>/ etc. (relative to cwd)
 *   --tool      Target a specific tool: claude | cursor | codex
 */

import chalk from "chalk";
import ora from "ora";
import type { Command } from "commander";
import { findSkill } from "../lib/registry.js";
import { installSkill } from "../lib/installer.js";
import { detectTools } from "../lib/detector.js";
import type { InstallOptions, ToolName } from "../lib/types.js";

const VALID_TOOLS: ToolName[] = ["claude", "cursor", "codex"];

export function registerInstall(program: Command): void {
  program
    .command("install <skill>")
    .description(
      'Install a skill into your AI tools (e.g. "backend/django-architect")'
    )
    .option("--global", "Install globally for all projects (default)", false)
    .option("--project", "Install only for the current project", false)
    .option(
      "--tool <tool>",
      `Target a specific tool (${VALID_TOOLS.join(", ")})`
    )
    .action(async (skillArg: string, opts: { global: boolean; project: boolean; tool?: string }) => {
      // Validate --tool if provided
      if (opts.tool && !VALID_TOOLS.includes(opts.tool as ToolName)) {
        console.error(
          chalk.red(`Unknown tool "${opts.tool}". Valid options: ${VALID_TOOLS.join(", ")}`)
        );
        process.exit(1);
      }

      // --global is the default; --project overrides it
      const installOptions: InstallOptions = {
        global: !opts.project,
        project: opts.project,
        tool: opts.tool as ToolName | undefined,
      };

      // ── Step 1: Resolve skill from registry ─────────────────────────────
      const lookupSpinner = ora(`Looking up skill ${chalk.cyan(skillArg)}...`).start();

      let skill;
      try {
        skill = await findSkill(skillArg);
      } catch (err) {
        lookupSpinner.fail(chalk.red("Failed to reach registry."));
        console.error(
          chalk.dim(err instanceof Error ? err.message : String(err))
        );
        process.exit(1);
      }

      if (!skill) {
        lookupSpinner.fail(
          chalk.red(`Skill "${skillArg}" not found in the registry.`)
        );
        console.error(
          chalk.dim(
            `Run ${chalk.cyan("skillbox search <query>")} to browse available skills.`
          )
        );
        process.exit(1);
      }

      lookupSpinner.succeed(
        `Found ${chalk.green(skill.name)} ${chalk.dim(`v${skill.version}`)}`
      );

      // ── Step 2: Show target summary ──────────────────────────────────────
      const scope = installOptions.project
        ? chalk.yellow("project-local")
        : chalk.blue("global");

      if (installOptions.tool) {
        console.log(
          `  Installing into ${chalk.cyan(installOptions.tool)} (${scope})`
        );
      } else {
        const detected = detectTools().filter((t) => t.detected);
        if (detected.length === 0) {
          console.error(
            chalk.red(
              "\nNo supported AI tools detected on this machine.\n" +
                "Install Claude Code, Cursor, or Codex, or specify --tool explicitly."
            )
          );
          process.exit(1);
        }
        console.log(
          `  Installing into: ${detected.map((t) => chalk.cyan(t.label)).join(", ")} (${scope})`
        );
      }

      // ── Step 3: Download and install ────────────────────────────────────
      const installSpinner = ora("Downloading and installing...").start();

      let results;
      try {
        results = await installSkill(skill, installOptions);
      } catch (err) {
        installSpinner.fail(chalk.red("Installation failed."));
        console.error(
          chalk.dim(err instanceof Error ? err.message : String(err))
        );
        process.exit(1);
      }

      installSpinner.stop();

      // ── Step 4: Report results ───────────────────────────────────────────
      let anySuccess = false;
      for (const r of results) {
        if (r.skipped) continue;
        if (r.success) {
          anySuccess = true;
          console.log(
            `  ${chalk.green("✔")} ${chalk.cyan(r.tool)} → ${chalk.dim(r.skillDir)}`
          );
        } else {
          console.log(
            `  ${chalk.red("✖")} ${chalk.cyan(r.tool)} — ${chalk.red(r.error ?? "unknown error")}`
          );
        }
      }

      if (anySuccess) {
        console.log(
          `\n${chalk.green("Skill installed:")} ${chalk.bold(skill.name)}`
        );
        console.log(chalk.dim(`  ${skill.description}`));
        console.log(
          chalk.dim(
            `\nRun ${chalk.cyan(`skillbox info ${skill.id}`)} to view usage instructions.`
          )
        );
      } else {
        console.error(chalk.red("\nInstallation failed for all targets."));
        process.exit(1);
      }
    });
}
