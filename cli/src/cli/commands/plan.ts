/**
 * vibe-sync plan command
 * Show sync plan without executing
 */

import { cwd } from "node:process";
import chalk from "chalk";
import { Command } from "commander";
import ora from "ora";
import { loadManifest } from "../../core/manifest-manager.js";
import { validatePlan } from "../../core/planner.js";
import type { SyncMode } from "../../types/config.js";
import type { DiffResult, SyncPlan } from "../../types/plan.js";
import { calculateSyncDiff, loadSyncConfig, readSourceConfig } from "./sync.js";

/**
 * Format detailed plan with hash comparisons and reasons
 *
 * @param plan - Sync plan to format
 * @returns Formatted plan string with details
 */
export function formatDetailedPlan(plan: SyncPlan): string {
  const lines: string[] = [];

  lines.push("");
  lines.push(chalk.bold("📋 Sync Plan"));
  lines.push("");
  lines.push("─".repeat(60));
  lines.push("");

  for (const [toolName, diff] of Object.entries(plan.diffs)) {
    if (!diff || typeof diff !== "object") continue;

    const d = diff as DiffResult;

    lines.push(chalk.bold.cyan(`${toolName}:`));

    // CREATE operations
    if (d.toCreate && d.toCreate.length > 0) {
      lines.push(chalk.green("  CREATE:"));
      for (const op of d.toCreate) {
        lines.push(chalk.green(`    • ${op.itemType}/${op.name}`));
        lines.push(chalk.gray(`      Reason: ${op.reason}`));
        if (op.newHash) {
          lines.push(
            chalk.gray(`      Hash: ${op.newHash.substring(0, 16)}...`),
          );
        }
      }
      lines.push("");
    }

    // UPDATE operations
    if (d.toUpdate && d.toUpdate.length > 0) {
      lines.push(chalk.yellow("  UPDATE:"));
      for (const op of d.toUpdate) {
        lines.push(chalk.yellow(`    • ${op.itemType}/${op.name}`));
        lines.push(chalk.gray(`      Reason: ${op.reason}`));
        if (op.oldHash && op.newHash) {
          lines.push(
            chalk.gray(`      Old: ${op.oldHash.substring(0, 16)}...`),
          );
          lines.push(
            chalk.gray(`      New: ${op.newHash.substring(0, 16)}...`),
          );
        }
      }
      lines.push("");
    }

    // DELETE operations
    if (d.toDelete && d.toDelete.length > 0) {
      lines.push(chalk.red("  DELETE:"));
      for (const op of d.toDelete) {
        lines.push(chalk.red(`    • ${op.itemType}/${op.name}`));
        lines.push(chalk.gray(`      Reason: ${op.reason}`));
        if (op.oldHash) {
          lines.push(
            chalk.gray(`      Hash: ${op.oldHash.substring(0, 16)}...`),
          );
        }
      }
      lines.push("");
    }

    // SKIP operations (only show count)
    if (d.toSkip && d.toSkip.length > 0) {
      lines.push(chalk.gray(`  SKIP: ${d.toSkip.length} items (unchanged)`));
      lines.push("");
    }
  }

  lines.push("─".repeat(60));
  lines.push("");
  lines.push(chalk.blue("💡 Run `vibe-sync sync` to apply this plan"));
  lines.push("");

  return lines.join("\n");
}

/**
 * Run plan command
 *
 * @param options - Command options
 */
export async function planCommand(options: {
  prune?: boolean;
  user?: boolean;
}): Promise<void> {
  try {
    const projectDir = options.user ? process.env.HOME || cwd() : cwd();
    const mode: SyncMode = options.prune ? "prune" : "safe";

    // Load configuration
    const spinner = ora("Loading configuration...").start();
    const config = await loadSyncConfig(projectDir, options.user || false);
    spinner.succeed("Configuration loaded");

    // Read source configuration
    const readSpinner = ora(
      `Reading ${config.source_tool} configuration...`,
    ).start();
    const sourceData = await readSourceConfig(config.source_tool, projectDir);
    readSpinner.succeed(
      `Read ${sourceData.skills.length} skills, ${sourceData.mcpServers.length} MCP servers`,
    );

    // Load manifest
    const manifest = await loadManifest(projectDir);

    // Calculate diff and generate plan
    const planSpinner = ora("Calculating differences...").start();
    const plan = await calculateSyncDiff(
      sourceData,
      config.target_tools,
      manifest,
      mode,
    );
    planSpinner.succeed("Sync plan generated");

    // Display detailed plan
    console.log(formatDetailedPlan(plan));

    // Validate plan
    const validation = validatePlan(plan);
    if (!validation.valid) {
      console.error(chalk.red("\n❌ Plan validation failed:"));
      validation.errors.forEach((err) =>
        console.error(chalk.red(`  - ${err}`)),
      );
      process.exit(1);
    }

    if (validation.warnings && validation.warnings.length > 0) {
      console.log(chalk.yellow("\n⚠️  Warnings:"));
      validation.warnings.forEach((warn) =>
        console.log(chalk.yellow(`  - ${warn}`)),
      );
    }

    // Check if there are any operations
    const hasOperations = Object.values(plan.diffs).some(
      (diff) =>
        diff &&
        (diff.toCreate.length > 0 ||
          diff.toUpdate.length > 0 ||
          diff.toDelete.length > 0),
    );

    if (!hasOperations) {
      console.log(chalk.green("✅ Everything is up to date!\n"));
    }
  } catch (error) {
    if (error instanceof Error) {
      console.error(chalk.red(`\n❌ Error: ${error.message}\n`));
      process.exit(1);
    }
  }
}

export function createPlanCommand(): Command {
  const command = new Command("plan");

  command
    .description("Show sync plan without executing")
    .option("--prune", "Include delete operations in plan")
    .option("--user", "Use user-level config instead of project-level")
    .action(async (options) => {
      await planCommand(options);
    });

  return command;
}
