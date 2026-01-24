/**
 * vibe-sync init command
 * Initialize vibe-sync configuration
 */

import { Command } from "commander";

export function createInitCommand(): Command {
  const command = new Command("init");

  command
    .description("Initialize vibe-sync configuration")
    .option("--user", "Create user-level config instead of project-level")
    .action(async (options) => {
      console.log("Init command - Coming soon!", options);
    });

  return command;
}
