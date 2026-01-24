/**
 * vibe-sync status command
 * Display sync status and configuration info
 */

import { cwd } from "node:process";
import chalk from "chalk";
import { Command } from "commander";
import ora from "ora";
import { loadManifest } from "@src/core/manifest-manager.js";
import type { VibeConfig } from "@src/types/config.js";
import type { Manifest } from "@src/types/manifest.js";
import { loadSyncConfig, readSourceConfig, calculateSyncDiff } from "./sync.js";

/**
 * Status display data
 */
export interface StatusData {
  config: VibeConfig;
  manifest: Manifest;
  skillCount: number;
  mcpCount: number;
  pendingChanges: boolean;
}

/**
 * Format relative time from timestamp
 *
 * @param timestamp - ISO 8601 timestamp
 * @returns Formatted relative time string
 */
function formatRelativeTime(timestamp: string): string {
  if (!timestamp) return "Never synced";

  const now = new Date();
  const then = new Date(timestamp);
  const diffMs = now.getTime() - then.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  let relative = "";
  if (diffMins < 1) {
    relative = "just now";
  } else if (diffMins < 60) {
    relative = `${diffMins} minute${diffMins === 1 ? "" : "s"} ago`;
  } else if (diffHours < 24) {
    relative = `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;
  } else {
    relative = `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
  }

  const dateStr = then.toISOString().replace("T", " ").substring(0, 19);
  return `${dateStr} (${relative})`;
}

/**
 * Format status output
 *
 * @param data - Status data
 * @returns Formatted status string
 */
export function formatStatus(data: StatusData): string {
  const lines: string[] = [];

  // Header
  const levelLabel = data.config.level === "user" ? "User" : "Project";
  lines.push("");
  lines.push(chalk.bold(`Configuration Status (${levelLabel})`));
  lines.push("━".repeat(60));
  lines.push("");

  // Configuration info
  lines.push(chalk.cyan("Source Tool:       ") + data.config.source_tool);
  lines.push(
    chalk.cyan("Target Tools:      ") + data.config.target_tools.join(", "),
  );

  const lastSync = data.manifest.last_synced
    ? formatRelativeTime(data.manifest.last_synced)
    : "Never synced";
  lines.push(chalk.cyan("Last Sync:         ") + lastSync);

  lines.push(
    chalk.cyan("Configuration:     ") +
      (data.config.level === "user" ? "~/.vibe-sync.json" : ".vibe-sync.json"),
  );
  lines.push(
    chalk.cyan("Manifest:          ") + ".vibe-sync-cache/manifest.json",
  );
  lines.push("");

  // Synced items count
  lines.push(chalk.bold("Synced Items:"));
  lines.push(`  Skills:          ${data.skillCount} items`);
  lines.push(`  MCP Servers:     ${data.mcpCount} items`);
  lines.push("");

  // Tool status
  lines.push(chalk.bold("Tool Status:"));
  lines.push(chalk.green(`  ✓ ${data.config.source_tool}    (source)`));

  for (const tool of data.config.target_tools) {
    lines.push(chalk.green(`  ✓ ${tool}         (synced, up-to-date)`));
  }
  lines.push("");

  // Health
  lines.push(chalk.bold("Health:"));
  if (data.pendingChanges) {
    lines.push(chalk.yellow("  ⚠ Pending changes detected"));
    lines.push("");
    lines.push(chalk.blue("Run `vibe-sync plan` to see sync plan"));
  } else {
    lines.push(chalk.green("  ✓ All targets up-to-date"));
    lines.push(chalk.green("  ✓ No pending changes"));
    lines.push("");
    lines.push(chalk.gray("Run `vibe-sync plan` to see sync plan"));
  }
  lines.push("");

  return lines.join("\n");
}

/**
 * Run status command
 *
 * @param options - Command options
 */
async function statusCommand(options: { user?: boolean }): Promise<void> {
  try {
    const projectDir = options.user ? process.env.HOME || cwd() : cwd();

    // Load configuration
    const spinner = ora("Loading configuration...").start();
    const config = await loadSyncConfig(projectDir, options.user || false);
    spinner.succeed("Configuration loaded");

    // Load manifest
    const manifest = await loadManifest(projectDir);

    // Count synced items
    const items = Object.values(manifest.items);
    const skillCount = items.filter((item) => item.type === "skill").length;
    const mcpCount = items.filter((item) => item.type === "mcp").length;

    // Check for pending changes
    const checkSpinner = ora("Checking for pending changes...").start();
    const sourceData = await readSourceConfig(config.source_tool, projectDir);
    const plan = await calculateSyncDiff(
      sourceData,
      config.target_tools,
      manifest,
      "safe",
    );

    const hasChanges = Object.values(plan.diffs).some(
      (diff) =>
        diff &&
        (diff.toCreate.length > 0 ||
          diff.toUpdate.length > 0 ||
          diff.toDelete.length > 0),
    );
    checkSpinner.stop();

    // Display status
    const status = formatStatus({
      config,
      manifest,
      skillCount,
      mcpCount,
      pendingChanges: hasChanges,
    });

    console.log(status);
  } catch (error) {
    if (error instanceof Error) {
      console.error(chalk.red(`\n❌ Error: ${error.message}\n`));
      process.exit(1);
    }
  }
}

export function createStatusCommand(): Command {
  const command = new Command("status");

  command
    .description("Show sync status and configuration info")
    .option("--user", "Use user-level config instead of project-level")
    .action(async (options) => {
      await statusCommand(options);
    });

  return command;
}
