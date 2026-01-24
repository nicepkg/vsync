/**
 * vibe-sync status command
 * Show sync status and configuration
 */

import { Command } from "commander";

export function createStatusCommand(): Command {
  const command = new Command("status");

  command
    .description("Show sync status and configuration")
    .option("--user", "Use user-level config instead of project-level")
    .action(async (options) => {
      console.log("Status command - Coming soon!", options);
    });

  return command;
}
