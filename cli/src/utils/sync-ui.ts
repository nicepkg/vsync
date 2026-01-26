/**
 * Sync UI Service
 * Handles all user interactions for sync command
 * Separates UI concerns from business logic
 */

import chalk from "chalk";
import inquirer from "inquirer";
import ora, { type Ora } from "ora";
import { formatPlan } from "@src/core/planner.js";
import type { VSyncConfig } from "@src/types/config.js";
import type { SyncPlan } from "@src/types/plan.js";
import { t } from "@src/utils/i18n.js";

/**
 * Plan validation result
 */
interface PlanValidation {
  valid: boolean;
  errors: string[];
  warnings?: string[];
}

/**
 * Sync UI Utilities
 * Centralized user interaction helpers for sync operations
 */
export class SyncUI {
  /**
   * Show loading config spinner
   */
  static showLoadingConfig(): Ora {
    return ora(t("commands.sync.loadingConfig")).start();
  }

  /**
   * Show config loaded success
   */
  static configLoaded(spinner: Ora): void {
    spinner.succeed(t("commands.sync.configLoaded"));
  }

  /**
   * Show reading source data spinner
   */
  static showReadingSource(sourceTool: string): Ora {
    return ora(t("commands.sync.reading", { tool: sourceTool })).start();
  }

  /**
   * Show read complete success
   */
  static readComplete(
    spinner: Ora,
    counts: {
      skills: number;
      mcp: number;
      agents: number;
      commands: number;
    },
  ): void {
    spinner.succeed(
      t("commands.sync.readComplete", {
        skills: counts.skills,
        mcp: counts.mcp,
        agents: counts.agents,
        commands: counts.commands,
      }),
    );
  }

  /**
   * Show calculating diff spinner
   */
  static showCalculating(): Ora {
    return ora(t("commands.sync.calculating")).start();
  }

  /**
   * Show plan generated success
   */
  static planGenerated(spinner: Ora): void {
    spinner.succeed(t("commands.sync.planGenerated"));
  }

  /**
   * Display sync plan to user
   */
  static displayPlan(plan: SyncPlan): void {
    console.log(formatPlan(plan));
  }

  /**
   * Display plan validation errors and exit
   */
  static displayValidationErrors(validation: PlanValidation): never {
    console.error(chalk.red(`\n❌ ${t("commands.sync.planValidationFailed")}`));
    validation.errors.forEach((err: string) =>
      console.error(chalk.red(`  - ${err}`)),
    );
    process.exit(1);
  }

  /**
   * Display plan validation warnings
   */
  static displayValidationWarnings(validation: PlanValidation): void {
    if (validation.warnings && validation.warnings.length > 0) {
      console.log(chalk.yellow(`\n⚠️  ${t("commands.sync.warnings")}`));
      validation.warnings.forEach((warn: string) =>
        console.log(chalk.yellow(`  - ${warn}`)),
      );
    }
  }

  /**
   * Show no changes message
   */
  static showNoChanges(): void {
    console.log(chalk.green(`\n✅ ${t("commands.sync.noChanges")}\n`));
  }

  /**
   * Show dry run message
   */
  static showDryRun(): void {
    console.log(chalk.blue(`\n💡 ${t("commands.sync.dryRun")}\n`));
  }

  /**
   * Prompt for sync confirmation
   * Returns true if user confirms, false otherwise
   */
  static async confirmSync(isDestructive: boolean): Promise<boolean> {
    // Safe mode (no deletes) defaults to Yes - non-destructive
    // Prune mode (with deletes) defaults to No - requires explicit confirmation
    const defaultConfirm = !isDestructive;

    const { confirm } = await inquirer.prompt<{ confirm: boolean }>([
      {
        type: "confirm",
        name: "confirm",
        message: t("commands.sync.confirmPrompt"),
        default: defaultConfirm,
      },
    ]);

    return confirm;
  }

  /**
   * Show sync cancelled message
   */
  static showCancelled(): void {
    console.log(chalk.yellow(`\n⚠️  ${t("commands.sync.cancelled")}\n`));
  }

  /**
   * Show setting up symlinks spinner
   */
  static showSettingUpSymlinks(): Ora {
    return ora(t("commands.sync.settingUpSymlinks")).start();
  }

  /**
   * Show symlinks configured success
   */
  static symlinksConfigured(spinner: Ora): void {
    spinner.succeed(t("commands.sync.symlinksConfigured"));
  }

  /**
   * Show symlinks failed
   */
  static symlinksFailed(spinner: Ora): void {
    spinner.fail(t("commands.sync.symlinksFailed"));
  }

  /**
   * Show syncing configurations spinner
   */
  static showSyncing(): Ora {
    return ora(t("commands.sync.syncing")).start();
  }

  /**
   * Show sync completed success
   */
  static syncCompleted(spinner: Ora): void {
    spinner.succeed(t("commands.sync.syncCompleted"));
  }

  /**
   * Display sync summary
   */
  static displaySyncSummary(
    results: Record<
      string,
      {
        success: boolean;
        created: number;
        updated: number;
        deleted: number;
        errors: string[];
      }
    >,
  ): void {
    console.log(chalk.bold(`\n📊 ${t("commands.sync.syncSummary")}\n`));

    for (const [toolName, result] of Object.entries(results)) {
      if (!result) continue;

      const icon = result.success ? "✅" : "❌";
      console.log(chalk.bold(`${icon} ${toolName}:`));
      console.log(`  ${t("commands.sync.created")}: ${result.created}`);
      console.log(`  ${t("commands.sync.updated")}: ${result.updated}`);
      console.log(`  ${t("commands.sync.deleted")}: ${result.deleted}`);

      if (result.errors.length > 0) {
        console.log(chalk.red(`  ${t("commands.sync.errors")}:`));
        result.errors.forEach((err) => console.log(chalk.red(`    - ${err}`)));
      }
    }

    const allSuccess = Object.values(results).every((r) => r?.success);
    if (allSuccess) {
      console.log(chalk.green(`\n✅ ${t("commands.sync.syncSuccess")}\n`));
    } else {
      console.log(
        chalk.yellow(`\n⚠️  ${t("commands.sync.completedWithErrors")}\n`),
      );
    }
  }

  /**
   * Prompt for symlink usage (first-time setup)
   * Returns the user's choice and updates config
   */
  static async promptForSymlinkUsage(config: VSyncConfig): Promise<boolean> {
    // Display info
    console.log(chalk.cyan(t("commands.sync.symlinkPromptTitle")));
    console.log(
      chalk.gray(
        `  ${t("commands.sync.symlinkPromptSource", { tool: config.source_tool! })}`,
      ),
    );
    console.log(
      chalk.gray(
        `  ${t("commands.sync.symlinkPromptTargets", { tools: config.target_tools!.join(", ") })}`,
      ),
    );
    console.log();
    console.log(t("commands.sync.symlinkPromptInfo"));
    console.log();

    // Ask user
    const { useSymlinks } = await inquirer.prompt<{ useSymlinks: boolean }>([
      {
        type: "select",
        name: "useSymlinks",
        message: t("commands.sync.symlinkPromptQuestion"),
        choices: [
          {
            name: t("commands.sync.symlinkChoiceSymlink"),
            value: true,
          },
          {
            name: t("commands.sync.symlinkChoiceCopy"),
            value: false,
          },
        ],
        default: true, // Recommend symlinks
      },
    ]);

    // Show warning/benefits based on choice
    if (useSymlinks) {
      console.log(chalk.yellow(`\n  ${t("commands.sync.symlinkWarning")}`));
      console.log(chalk.blue(`  ${t("commands.sync.symlinkBenefits")}`));
    }
    console.log();

    return useSymlinks;
  }

  /**
   * Show error message
   */
  static showError(message: string): void {
    console.error(chalk.red(`\n❌ ${message}\n`));
  }
}
