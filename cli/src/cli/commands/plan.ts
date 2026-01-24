/**
 * vibe-sync plan command
 * Show sync plan without executing
 */

import { Command } from "commander";

export function createPlanCommand(): Command {
  const command = new Command("plan");

  command
    .description("Show sync plan without executing")
    .option("--prune", "Include delete operations in plan")
    .option("--user", "Use user-level config instead of project-level")
    .action(async (options) => {
      console.log("Plan command - Coming soon!", options);
    });

  return command;
}
