/**
 * Skillbox CLI — entry point.
 *
 * Sets up the Commander program, registers all sub-commands, and dispatches
 * to the correct handler based on argv.
 */

import { Command } from "commander";
import { registerInstall } from "./commands/install.js";
import { registerRemove } from "./commands/remove.js";
import { registerList } from "./commands/list.js";
import { registerSearch } from "./commands/search.js";
import { registerInfo } from "./commands/info.js";
import { registerDetect } from "./commands/detect.js";
import { registerRecommend } from "./commands/recommend.js";

// ---------------------------------------------------------------------------
// Version (injected by tsup at build time via __PKG_VERSION__)
// ---------------------------------------------------------------------------

// Fallback to reading package.json at runtime when the constant is undefined.
// tsup will replace __PKG_VERSION__ with the actual version string.
declare const __PKG_VERSION__: string | undefined;

function getVersion(): string {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const pkg = require("../package.json") as { version: string };
    return pkg.version;
  } catch {
    return "0.1.0";
  }
}

// ---------------------------------------------------------------------------
// Program
// ---------------------------------------------------------------------------

const program = new Command();

program
  .name("skillbox")
  .description("Skill Pack for your development environment")
  .version(getVersion(), "-v, --version", "Print the current version")
  .helpOption("-h, --help", "Display help for command")
  // Show help when no command is given
  .addHelpCommand("help [command]", "Display help for a command")
  // Propagate unknown options to sub-commands rather than erroring immediately
  .passThroughOptions(false)
  .allowExcessArguments(false);

// Register all commands
registerInstall(program);
registerRemove(program);
registerList(program);
registerSearch(program);
registerInfo(program);
registerDetect(program);
registerRecommend(program);

// ---------------------------------------------------------------------------
// Error handling & execution
// ---------------------------------------------------------------------------

// Override Commander's default error output to use chalk styling
program.configureOutput({
  writeErr: (str) => {
    // Commander adds its own "error:" prefix — pass through as-is
    process.stderr.write(str);
  },
});

// Handle unknown commands gracefully
program.on("command:*", (operands: string[]) => {
  console.error(`Unknown command: ${operands[0]}`);
  console.error(`Run ${"`"}skillbox --help${"`"} to see available commands.`);
  process.exit(1);
});

// Show help if called with no arguments
if (process.argv.length <= 2) {
  program.outputHelp();
  process.exit(0);
}

program.parseAsync(process.argv).catch((err: unknown) => {
  console.error(
    err instanceof Error ? err.message : "An unexpected error occurred."
  );
  process.exit(1);
});
