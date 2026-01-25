/**
 * vibe-sync plan command
 * Show sync plan without executing
 */

import { cwd } from "node:process";
import chalk from "chalk";
import { Command } from "commander";
import ora from "ora";
import { loadManifest } from "@src/core/manifest-manager.js";
import { validatePlan } from "@src/core/planner.js";
import type { SyncMode } from "@src/types/config.js";
import type { DiffResult, SyncPlan } from "@src/types/plan.js";
import { t } from "@src/utils/i18n.js";
import { calculateSyncDiff, readSourceConfig } from "./sync.js";
import { ensureConfig } from "@src/utils/config-loader.js";

/**
 * Format detailed plan with hash comparisons and reasons
 *
 * @param plan - Sync plan to format
 * @returns Formatted plan string with details
 */
export function formatDetailedPlan(plan: SyncPlan): string {
  const lines: string[] = [];

  lines.push("");
  lines.push(chalk.bold(`📋 ${t("commands.plan.title")}`));
  lines.push("");
  lines.push("─".repeat(60));
  lines.push("");

  for (const [toolName, diff] of Object.entries(plan.diffs)) {
    if (!diff || typeof diff !== "object") continue;

    const d = diff as DiffResult;

    lines.push(chalk.bold.cyan(`${toolName}:`));

    // CREATE operations
    if (d.toCreate && d.toCreate.length > 0) {
      lines.push(chalk.green(`  ${t("commands.plan.create")}:`));
      for (const op of d.toCreate) {
        lines.push(chalk.green(`    • ${op.itemType}/${op.name}`));
        lines.push(
          chalk.gray(`      ${t("commands.plan.reason")}: ${op.reason}`),
        );
        if (op.newHash) {
          lines.push(
            chalk.gray(
              `      ${t("commands.plan.hash")}: ${op.newHash.substring(0, 16)}...`,
            ),
          );
        }
      }
      lines.push("");
    }

    // UPDATE operations
    if (d.toUpdate && d.toUpdate.length > 0) {
      lines.push(chalk.yellow(`  ${t("commands.plan.update")}:`));
      for (const op of d.toUpdate) {
        lines.push(chalk.yellow(`    • ${op.itemType}/${op.name}`));
        lines.push(
          chalk.gray(`      ${t("commands.plan.reason")}: ${op.reason}`),
        );
        if (op.oldHash && op.newHash) {
          lines.push(
            chalk.gray(
              `      ${t("commands.plan.oldHash")}: ${op.oldHash.substring(0, 16)}...`,
            ),
          );
          lines.push(
            chalk.gray(
              `      ${t("commands.plan.newHash")}: ${op.newHash.substring(0, 16)}...`,
            ),
          );
        }
      }
      lines.push("");
    }

    // DELETE operations
    if (d.toDelete && d.toDelete.length > 0) {
      lines.push(chalk.red(`  ${t("commands.plan.delete")}:`));
      for (const op of d.toDelete) {
        lines.push(chalk.red(`    • ${op.itemType}/${op.name}`));
        lines.push(
          chalk.gray(`      ${t("commands.plan.reason")}: ${op.reason}`),
        );
        if (op.oldHash) {
          lines.push(
            chalk.gray(
              `      ${t("commands.plan.hash")}: ${op.oldHash.substring(0, 16)}...`,
            ),
          );
        }
      }
      lines.push("");
    }

    // SKIP operations (only show count)
    if (d.toSkip && d.toSkip.length > 0) {
      lines.push(
        chalk.gray(`  ${t("commands.plan.skip", { count: d.toSkip.length })}`),
      );
      lines.push("");
    }
  }

  lines.push("─".repeat(60));
  lines.push("");
  lines.push(chalk.blue(`💡 ${t("commands.plan.applyHint")}`));
  lines.push("");

  return lines.join("\n");
}

/**
 * Run plan command
 *
 * @param options - Command options
 */
async function planCommand(options: {
  prune?: boolean;
  user?: boolean;
}): Promise<void> {
  try {
    const projectDir = options.user ? process.env.HOME || cwd() : cwd();
    const mode: SyncMode = options.prune ? "prune" : "safe";

    // Load configuration (with auto-init if needed)
    const spinner = ora(t("commands.plan.loadingConfig")).start();
    const config = await ensureConfig(projectDir, options.user || false, spinner);
    spinner.succeed(t("commands.plan.configLoaded"));

    // Read source configuration
    const readSpinner = ora(
      t("commands.plan.reading", { tool: config.source_tool }),
    ).start();
    const sourceData = await readSourceConfig(
      config.source_tool,
      projectDir,
      config.level,
    );
    readSpinner.succeed(
      t("commands.plan.readComplete", {
        skills: sourceData.skills.length,
        mcp: sourceData.mcpServers.length,
      }),
    );

    // Load manifest
    const manifest = await loadManifest(projectDir);

    // Calculate diff and generate plan
    const planSpinner = ora(t("commands.plan.calculating")).start();
    const plan = await calculateSyncDiff(
      sourceData,
      config.target_tools,
      manifest,
      mode,
      config.sync_config,
      projectDir,
      config.level,
    );
    planSpinner.succeed(t("commands.plan.planGenerated"));

    // Display detailed plan
    console.log(formatDetailedPlan(plan));

    // Validate plan
    const validation = validatePlan(plan);
    if (!validation.valid) {
      console.error(
        chalk.red(`\n❌ ${t("commands.plan.planValidationFailed")}`),
      );
      validation.errors.forEach((err) =>
        console.error(chalk.red(`  - ${err}`)),
      );
      process.exit(1);
    }

    if (validation.warnings && validation.warnings.length > 0) {
      console.log(chalk.yellow(`\n⚠️  ${t("commands.plan.warnings")}`));
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
      console.log(chalk.green(`\n✅ ${t("commands.plan.noChanges")}\n`));
    }
  } catch (error) {
    if (error instanceof Error) {
      console.error(chalk.red(`\n❌ ${t("common.error")}: ${error.message}\n`));
      process.exit(1);
    }
  }
}

export function createPlanCommand(): Command {
  const command = new Command("plan");

  command
    .description(t("commands.plan.description"))
    .option("--prune", t("commands.plan.pruneOption"))
    .option("--user", t("commands.plan.userLevelOption"))
    .action(async (options) => {
      await planCommand(options);
    });

  return command;
}
