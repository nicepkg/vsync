/**
 * vibe-sync list command
 * List all synced items
 */

import { Command } from "commander";

export function createListCommand(): Command {
  const command = new Command("list");

  command
    .description("List all synced items")
    .option("--user", "Use user-level config instead of project-level")
    .action(async (options) => {
      console.log("List command - Coming soon!", options);
    });

  return command;
}
