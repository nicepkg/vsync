/**
 * CLI Framework
 * Sets up Commander.js with all commands and global error handling
 */

import { Command } from "commander";
import packageJson from "../../package.json";
import { createCleanCommand } from "./commands/clean.js";
import { createImportCommand } from "./commands/import.js";
import { createInitCommand } from "./commands/init.js";
import { createListCommand } from "./commands/list.js";
import { createPlanCommand } from "./commands/plan.js";
import { createStatusCommand } from "./commands/status.js";
import { createSyncCommand } from "./commands/sync.js";
import { ensureLanguageConfig } from "./utils/config-initializer.js";
import { setDebugMode } from "./utils/logger.js";
/**
 * Get package.json version
 *
 * @returns Version string from package.json
 */
function getVersion(): string {
  return packageJson.version || "1.0.0";
}

/**
 * Create CLI program with all commands registered
 *
 * @returns Commander program instance
 */
export function createCLI(): Command {
  const program = new Command();

  program
    .name("vsync")
    .description(
      "AI Coding Tool Config Synchronizer\n" +
        "Single source of truth → Compile to multiple formats → Diff-based sync",
    )
    .version(getVersion(), "-v, --version", "Display version number")
    .option("--debug", "Enable debug logging with stack traces");

  // Register all commands
  program.addCommand(createInitCommand());
  program.addCommand(createSyncCommand());
  program.addCommand(createPlanCommand());
  program.addCommand(createStatusCommand());
  program.addCommand(createListCommand());
  program.addCommand(createImportCommand());
  program.addCommand(createCleanCommand());

  // Global error handler
  program.exitOverride((err) => {
    if (err.code === "commander.help" || err.code === "commander.version") {
      // Don't treat help/version as errors
      process.exit(0);
    }
    if (err.code === "commander.unknownCommand") {
      console.error(`\nError: Unknown command '${err.message}'`);
      console.error("Run 'vsync --help' to see available commands\n");
      process.exit(1);
    }
    throw err;
  });

  return program;
}

/**
 * Run CLI program
 * Called from main entry point
 */
export async function runCLI(): Promise<void> {
  try {
    // Initialize i18n BEFORE creating CLI
    // This detects language from user config or system, prompts if needed
    await ensureLanguageConfig();

    const program = createCLI();

    // Show help if no arguments
    if (process.argv.length === 2) {
      program.help();
    }

    await program.parseAsync(process.argv);

    // Enable debug mode if --debug flag is present
    const opts = program.opts();
    if (opts.debug) {
      setDebugMode(true);
    }
  } catch (error) {
    if (error instanceof Error) {
      if (error.message !== "process.exit called") {
        console.error("\nError:", error.message);
        process.exit(1);
      }
    }
  }
}
