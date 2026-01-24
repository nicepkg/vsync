/**
 * vibe-sync clean command
 * Clean up orphaned items from manifest
 */

import { Command } from "commander";

export function createCleanCommand(): Command {
  const command = new Command("clean");

  command
    .description("Clean up orphaned items from manifest")
    .option("--user", "Use user-level config instead of project-level")
    .action(async (options) => {
      console.log("Clean command - Coming soon!", options);
    });

  return command;
}
