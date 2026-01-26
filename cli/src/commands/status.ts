/**
 * vibe-sync status command
 * Display sync status and configuration info
 */

import { homedir } from "node:os";
import { relative } from "node:path";
import { cwd } from "node:process";
import chalk from "chalk";
import { Command } from "commander";
import ora from "ora";
import { loadManifest, getManifestPath } from "@src/core/manifest-manager.js";
import type { VibeConfig } from "@src/types/config.js";
import type { Manifest } from "@src/types/manifest.js";
import { ensureConfig } from "@src/utils/config-initializer.js";
import { t } from "@src/utils/i18n.js";
import { readSourceConfig, calculateSyncDiff } from "./sync.js";

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
  if (!timestamp) return t("commands.status.neverSynced");

  const now = new Date();
  const then = new Date(timestamp);
  const diffMs = now.getTime() - then.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  let relative = "";
  if (diffMins < 1) {
    relative = t("commands.status.timeJustNow");
  } else if (diffMins < 60) {
    relative = t("commands.status.timeMinutesAgo", {
      minutes: diffMins,
      plural: diffMins === 1 ? "" : "s",
    });
  } else if (diffHours < 24) {
    relative = t("commands.status.timeHoursAgo", {
      hours: diffHours,
      plural: diffHours === 1 ? "" : "s",
    });
  } else {
    relative = t("commands.status.timeDaysAgo", {
      days: diffDays,
      plural: diffDays === 1 ? "" : "s",
    });
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
  const levelLabel =
    data.config.level === "user"
      ? t("commands.status.levelUser")
      : t("commands.status.levelProject");
  lines.push("");
  lines.push(chalk.bold(t("commands.status.title", { level: levelLabel })));
  lines.push("━".repeat(60));
  lines.push("");

  // Configuration info
  lines.push(
    chalk.cyan(`${t("commands.status.sourceTool")}:       `) +
      data.config.source_tool!,
  );
  lines.push(
    chalk.cyan(`${t("commands.status.targetTools")}:      `) +
      data.config.target_tools!.join(", "),
  );

  const lastSync = data.manifest.last_synced
    ? formatRelativeTime(data.manifest.last_synced)
    : t("commands.status.neverSynced");
  lines.push(
    chalk.cyan(`${t("commands.status.lastSync")}:         `) + lastSync,
  );

  lines.push(
    chalk.cyan(`${t("commands.status.configuration")}:     `) +
      (data.config.level === "user" ? "~/.vibe-sync.json" : ".vibe-sync.json"),
  );

  // Show manifest path relative to home directory
  const manifestPath = getManifestPath();
  const home = homedir();
  const displayPath = manifestPath.startsWith(home)
    ? `~/${relative(home, manifestPath)}`
    : manifestPath;

  lines.push(
    chalk.cyan(`${t("commands.status.manifest")}:          `) + displayPath,
  );
  lines.push("");

  // Synced items count
  lines.push(chalk.bold(t("commands.status.syncedItems")));
  lines.push(
    `  ${t("commands.status.skillsLabel")}:          ${t("commands.status.itemsCount", { count: data.skillCount })}`,
  );
  lines.push(
    `  ${t("commands.status.mcpLabel")}:     ${t("commands.status.itemsCount", { count: data.mcpCount })}`,
  );
  lines.push("");

  // Tool status
  lines.push(chalk.bold(t("commands.status.toolStatus")));
  lines.push(
    chalk.green(
      `  ✓ ${data.config.source_tool!}    ${t("commands.status.sourceIndicator")}`,
    ),
  );

  for (const tool of data.config.target_tools!) {
    lines.push(
      chalk.green(`  ✓ ${tool}         ${t("commands.status.syncedUpToDate")}`),
    );
  }
  lines.push("");

  // Health
  lines.push(chalk.bold(t("commands.status.health")));
  if (data.pendingChanges) {
    lines.push(chalk.yellow(`  ⚠ ${t("commands.status.pendingChanges")}`));
    lines.push("");
    lines.push(chalk.blue(t("commands.status.runPlanToSee")));
  } else {
    lines.push(chalk.green(`  ✓ ${t("commands.status.allUpToDate")}`));
    lines.push(chalk.green(`  ✓ ${t("commands.status.noChanges")}`));
    lines.push("");
    lines.push(chalk.gray(t("commands.status.runPlanToSee")));
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

    // Load configuration (with auto-init if needed)
    const spinner = ora(t("commands.status.loadingConfig")).start();
    const config = await ensureConfig(projectDir, options.user || false, {
      spinner,
      requireFields: ["source_tool", "target_tools", "sync_config"],
    });
    spinner.succeed(t("commands.status.configLoaded"));
    // Config fields are guaranteed by ensureConfig validation

    // Load manifest
    const manifest = await loadManifest(projectDir);

    // Count synced items
    const items = Object.values(manifest.items);
    const skillCount = items.filter((item) => item.type === "skill").length;
    const mcpCount = items.filter((item) => item.type === "mcp").length;

    // Check for pending changes
    const checkSpinner = ora(t("commands.status.checkingChanges")).start();
    const sourceData = await readSourceConfig(
      config.source_tool!,
      projectDir,
      config.level,
    );
    const plan = await calculateSyncDiff(
      sourceData,
      config.source_tool!,
      config.target_tools!,
      manifest,
      "safe",
      config.sync_config!,
      projectDir,
      config.level,
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
      console.error(chalk.red(`\n❌ ${t("common.error")}: ${error.message}\n`));
      process.exit(1);
    }
  }
}

export function createStatusCommand(): Command {
  const command = new Command("status");

  command
    .description(t("commands.status.description"))
    .option("--user", t("commands.status.userLevelOption"))
    .action(async (options) => {
      await statusCommand(options);
    });

  return command;
}
