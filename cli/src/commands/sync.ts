/**
 * vibe-sync sync command
 * Synchronize configurations across tools
 */

import { join } from "node:path";
import { cwd } from "node:process";
import chalk from "chalk";
import { Command } from "commander";
import inquirer from "inquirer";
import ora from "ora";
import { getAdapter, getToolConfigFiles } from "@src/adapters/registry.js";
import { loadConfig } from "@src/core/config-manager.js";
import {
  loadManifest,
  saveManifest,
  updateAfterCreate,
  updateAfterUpdate,
  updateAfterDelete,
} from "@src/core/manifest-manager.js";
import { generatePlan, formatPlan, validatePlan } from "@src/core/planner.js";
import {
  createBackup,
  restoreBackup,
  cleanupBackup,
} from "@src/core/rollback.js";
import type { BackupInfo } from "@src/core/rollback.js";
import {
  shouldUseSymlinks,
  setupSymlinkWithBackup,
  cleanupDirectoryBackup,
} from "@src/core/symlink-sync.js";
import type { DirectoryBackupInfo } from "@src/core/symlink-sync.js";
import type {
  ConfigLevel,
  SyncMode,
  ToolName,
  VibeConfig,
} from "@src/types/config.js";
import type { Manifest, ItemType } from "@src/types/manifest.js";
import type {
  MCPServer,
  Skill,
  Agent,
  Command as VibeCommand,
} from "@src/types/models.js";
import type { SyncPlan } from "@src/types/plan.js";
import { t } from "@src/utils/i18n.js";
import {
  debug,
  debugError,
  debugObject,
  debugTiming,
} from "@src/utils/logger.js";

/**
 * Source configuration data
 */
export interface SourceData {
  skills: Skill[];
  mcpServers: MCPServer[];
  agents: Agent[];
  commands: VibeCommand[];
}

/**
 * Sync operation result for a target
 */
export interface TargetSyncResult {
  success: boolean;
  created: number;
  updated: number;
  deleted: number;
  errors: string[];
}

/**
 * Sync results for all targets
 */
export type SyncResults = Partial<Record<ToolName, TargetSyncResult>>;

/**
 * Operations performed during sync
 */
export interface SyncOperations {
  created: Array<{ type: ItemType; name: string; hash: string }>;
  updated: Array<{ type: ItemType; name: string; hash: string }>;
  deleted: Array<{ type: ItemType; name: string }>;
}

/**
 * Load sync configuration
 *
 * @param projectDir - Project directory
 * @param isUserLevel - Whether to load user-level config
 * @returns Loaded config
 */
export async function loadSyncConfig(
  projectDir: string,
  isUserLevel: boolean,
): Promise<VibeConfig> {
  const level = isUserLevel ? "user" : "project";
  const config = await loadConfig(level, projectDir);

  return config;
}

/**
 * Read source tool configuration
 *
 * @param sourceTool - Source tool name
 * @param projectDir - Project directory
 * @returns Source data
 */
export async function readSourceConfig(
  sourceTool: ToolName,
  projectDir: string,
  level: ConfigLevel,
): Promise<SourceData> {
  const adapter = getAdapter({
    tool: sourceTool,
    baseDir: projectDir,
    level,
  });

  const skills = await adapter.readSkills();
  const mcpServers = await adapter.readMCPServers();
  const agents = await adapter.readAgents();
  const commands = await adapter.readCommands();

  return {
    skills,
    mcpServers,
    agents,
    commands,
  };
}

/**
 * Detect if this is the first time syncing skills
 * Checks if manifest has any skill entries
 *
 * @param manifest - Current manifest
 * @returns True if no skill entries exist in manifest
 */
export function detectFirstTimeSkillsSync(manifest: Manifest): boolean {
  // Check if any manifest items are skills
  const hasSkillEntries = Object.keys(manifest.items).some((key) => {
    const item = manifest.items[key];
    return item && item.type === "skill";
  });

  return !hasSkillEntries;
}

/**
 * Determine if we should prompt user about symlink usage
 * Only prompt on first sync when use_symlinks_for_skills is undefined
 *
 * @param config - vibe-sync configuration
 * @param manifest - Current manifest
 * @param targetTools - Target tools to sync to
 * @returns True if should prompt for symlink preference
 */
export function shouldPromptForSymlinks(
  config: VibeConfig,
  manifest: Manifest,
  targetTools: ToolName[],
): boolean {
  // Don't prompt if use_symlinks_for_skills is already set
  if (config.use_symlinks_for_skills !== undefined) {
    return false;
  }

  // Don't prompt if skills not in sync config
  if (!config.sync_config.skills) {
    return false;
  }

  // Don't prompt if no target tools
  if (targetTools.length === 0) {
    return false;
  }

  // Only prompt on first-time skills sync
  return detectFirstTimeSkillsSync(manifest);
}

/**
 * Read target tool configurations
 *
 * @param targetTools - Target tool names
 * @param projectDir - Project directory
 * @returns Map of target data
 */
async function readTargetConfigs(targetTools: ToolName[]): Promise<
  Record<
    ToolName,
    {
      skills: Skill[];
      mcpServers: MCPServer[];
      agents: Agent[];
      commands: VibeCommand[];
    }
  >
> {
  const targetData = {} as Record<
    ToolName,
    {
      skills: Skill[];
      mcpServers: MCPServer[];
      agents: Agent[];
      commands: VibeCommand[];
    }
  >;

  // For vibe-sync, target tools are write-only.
  // We rely on the manifest to track what was previously written,
  // rather than reading from target tools.
  // This allows us to support write-only adapters like Cursor.
  for (const tool of targetTools) {
    targetData[tool] = {
      skills: [],
      mcpServers: [],
      agents: [],
      commands: [],
    };
  }

  return targetData;
}

/**
 * Calculate sync diff for all targets
 *
 * @param sourceData - Source configuration
 * @param targetTools - Target tool names
 * @param manifest - Current manifest
 * @param mode - Sync mode
 * @param projectDir - Project directory
 * @returns Sync plan
 */
export async function calculateSyncDiff(
  sourceData: SourceData,
  targetTools: ToolName[],
  manifest: Manifest,
  mode: SyncMode,
): Promise<SyncPlan> {
  const targetData = await readTargetConfigs(targetTools);

  const plan = generatePlan({
    sourceSkills: sourceData.skills,
    sourceMCPServers: sourceData.mcpServers,
    sourceAgents: sourceData.agents,
    sourceCommands: sourceData.commands,
    targetSkills: Object.fromEntries(
      Object.entries(targetData).map(([tool, data]) => [tool, data.skills]),
    ),
    targetMCPServers: Object.fromEntries(
      Object.entries(targetData).map(([tool, data]) => [tool, data.mcpServers]),
    ),
    targetAgents: Object.fromEntries(
      Object.entries(targetData).map(([tool, data]) => [tool, data.agents]),
    ),
    targetCommands: Object.fromEntries(
      Object.entries(targetData).map(([tool, data]) => [tool, data.commands]),
    ),
    manifest,
    mode,
    sourceTool: "claude-code", // Will be passed from config
    targetTools,
  });

  return plan;
}

/**
 * Get file paths that will be modified during sync
 *
 * @param tool - Tool name
 * @param baseDir - Base directory
 * @returns Array of file paths that may be modified
 */
function getTargetFilePaths(
  tool: ToolName,
  baseDir: string,
  level: ConfigLevel,
): string[] {
  // Get config files from registry (no hardcoding!)
  return getToolConfigFiles(tool, baseDir, level);
}

/**
 * Execute sync plan for all targets
 *
 * @param plan - Sync plan
 * @param sourceData - Source data
 * @param projectDir - Project directory
 * @returns Sync results
 */
export async function executeSyncPlan(
  plan: SyncPlan,
  sourceData: SourceData,
  projectDir: string,
  level: ConfigLevel,
): Promise<SyncResults> {
  const results: SyncResults = {};
  const allBackups: BackupInfo[] = [];

  try {
    // Phase 1: Create backups for all target files
    for (const toolName of Object.keys(plan.diffs)) {
      const tool = toolName as ToolName;
      const filePaths = getTargetFilePaths(tool, projectDir, level);

      for (const filePath of filePaths) {
        const backup = await createBackup(filePath);
        allBackups.push(backup);
      }
    }

    // Phase 2: Execute sync operations for each target
    for (const [toolName, diff] of Object.entries(plan.diffs)) {
      if (!diff) continue;

      const tool = toolName as ToolName;
      const adapter = getAdapter({
        tool,
        baseDir: projectDir,
        level,
      });

      const result: TargetSyncResult = {
        success: true,
        created: 0,
        updated: 0,
        deleted: 0,
        errors: [],
      };

      try {
        // Collect skills and MCP servers to CREATE
        const skillsToCreate = diff.toCreate
          .filter((op) => op.itemType === "skill")
          .map((op) => sourceData.skills.find((s) => s.name === op.name))
          .filter((s): s is NonNullable<typeof s> => s !== undefined);

        const mcpToCreate = diff.toCreate
          .filter((op) => op.itemType === "mcp")
          .map((op) => sourceData.mcpServers.find((m) => m.name === op.name))
          .filter((m): m is NonNullable<typeof m> => m !== undefined);

        // Collect skills and MCP servers to UPDATE
        const skillsToUpdate = diff.toUpdate
          .filter((op) => op.itemType === "skill")
          .map((op) => sourceData.skills.find((s) => s.name === op.name))
          .filter((s): s is NonNullable<typeof s> => s !== undefined);

        const mcpToUpdate = diff.toUpdate
          .filter((op) => op.itemType === "mcp")
          .map((op) => sourceData.mcpServers.find((m) => m.name === op.name))
          .filter((m): m is NonNullable<typeof m> => m !== undefined);

        // Collect agents to CREATE
        const agentsToCreate = diff.toCreate
          .filter((op) => op.itemType === "agent")
          .map((op) => sourceData.agents.find((a) => a.name === op.name))
          .filter((a): a is NonNullable<typeof a> => a !== undefined);

        // Collect agents to UPDATE
        const agentsToUpdate = diff.toUpdate
          .filter((op) => op.itemType === "agent")
          .map((op) => sourceData.agents.find((a) => a.name === op.name))
          .filter((a): a is NonNullable<typeof a> => a !== undefined);

        // Collect commands to CREATE
        const commandsToCreate = diff.toCreate
          .filter((op) => op.itemType === "command")
          .map((op) => sourceData.commands.find((c) => c.name === op.name))
          .filter((c): c is NonNullable<typeof c> => c !== undefined);

        // Collect commands to UPDATE
        const commandsToUpdate = diff.toUpdate
          .filter((op) => op.itemType === "command")
          .map((op) => sourceData.commands.find((c) => c.name === op.name))
          .filter((c): c is NonNullable<typeof c> => c !== undefined);

        // Write skills (CREATE + UPDATE combined)
        const allSkills = [...skillsToCreate, ...skillsToUpdate];
        if (allSkills.length > 0) {
          try {
            const writeResult = await adapter.writeSkills(allSkills);
            if (writeResult.success) {
              // Use actual write count (may be 0 for symlinked directories)
              if (writeResult.count > 0) {
                result.created += skillsToCreate.length;
                result.updated += skillsToUpdate.length;
              }
            } else {
              result.errors.push(writeResult.error || "Failed to write skills");
              result.success = false;
              throw new Error("Skill write failed - initiating rollback");
            }
          } catch (error) {
            result.errors.push(
              `Failed to write skills: ${error instanceof Error ? error.message : String(error)}`,
            );
            result.success = false;
            throw error;
          }
        }

        // Write MCP servers (CREATE + UPDATE combined)
        const allMCP = [...mcpToCreate, ...mcpToUpdate];
        if (allMCP.length > 0) {
          try {
            const writeResult = await adapter.writeMCPServers(allMCP);
            if (writeResult.success) {
              result.created += mcpToCreate.length;
              result.updated += mcpToUpdate.length;
            } else {
              result.errors.push(
                writeResult.error || "Failed to write MCP servers",
              );
              result.success = false;
              throw new Error("MCP write failed - initiating rollback");
            }
          } catch (error) {
            result.errors.push(
              `Failed to write MCP servers: ${error instanceof Error ? error.message : String(error)}`,
            );
            result.success = false;
            throw error;
          }
        }

        // Write agents (CREATE + UPDATE combined)
        const allAgents = [...agentsToCreate, ...agentsToUpdate];
        if (allAgents.length > 0) {
          try {
            const writeResult = await adapter.writeAgents(allAgents);
            if (writeResult.success) {
              result.created += agentsToCreate.length;
              result.updated += agentsToUpdate.length;
            } else {
              result.errors.push(writeResult.error || "Failed to write agents");
              result.success = false;
              throw new Error("Agent write failed - initiating rollback");
            }
          } catch (error) {
            result.errors.push(
              `Failed to write agents: ${error instanceof Error ? error.message : String(error)}`,
            );
            result.success = false;
            throw error;
          }
        }

        // Write commands (CREATE + UPDATE combined)
        const allCommands = [...commandsToCreate, ...commandsToUpdate];
        if (allCommands.length > 0) {
          try {
            const writeResult = await adapter.writeCommands(allCommands);
            if (writeResult.success) {
              result.created += commandsToCreate.length;
              result.updated += commandsToUpdate.length;
            } else {
              result.errors.push(
                writeResult.error || "Failed to write commands",
              );
              result.success = false;
              throw new Error("Command write failed - initiating rollback");
            }
          } catch (error) {
            result.errors.push(
              `Failed to write commands: ${error instanceof Error ? error.message : String(error)}`,
            );
            result.success = false;
            throw error;
          }
        }

        // Execute DELETE operations (one at a time)
        for (const op of diff.toDelete) {
          try {
            if (op.itemType === "skill") {
              await adapter.deleteSkill(op.name);
              result.deleted++;
            } else if (op.itemType === "mcp") {
              await adapter.deleteMCPServer(op.name);
              result.deleted++;
            } else if (op.itemType === "agent") {
              await adapter.deleteAgent(op.name);
              result.deleted++;
            } else if (op.itemType === "command") {
              await adapter.deleteCommand(op.name);
              result.deleted++;
            }
          } catch (error) {
            result.errors.push(
              `Failed to delete ${op.itemType} ${op.name}: ${error instanceof Error ? error.message : String(error)}`,
            );
            result.success = false;
            throw error;
          }
        }
      } catch (error) {
        result.success = false;
        if (!result.errors.some((e) => e.includes("Fatal error"))) {
          result.errors.push(
            `Fatal error syncing to ${tool}: ${error instanceof Error ? error.message : String(error)}`,
          );
        }

        // Rollback all changes on error
        console.error(chalk.yellow(`\n⚠️  ${t("commands.sync.rollingBack")}`));
        for (const backup of allBackups) {
          await restoreBackup(backup);
        }
        console.error(chalk.green(`✅ ${t("commands.sync.rollbackComplete")}`));

        // Clean up backups after rollback
        for (const backup of allBackups) {
          await cleanupBackup(backup);
        }

        throw error; // Re-throw to exit sync
      }

      results[tool] = result;
    }

    // Phase 3: Success - cleanup all backups
    for (const backup of allBackups) {
      await cleanupBackup(backup);
    }
  } catch (error) {
    // Error already handled and rolled back
    throw error;
  }

  return results;
}

/**
 * Update manifest after successful sync
 *
 * @param operations - Operations performed
 * @param targetTool - Target tool
 * @param projectDir - Project directory
 */
export async function updateManifestAfterSync(
  operations: SyncOperations,
  targetTool: ToolName,
  projectDir: string,
): Promise<void> {
  const manifest = await loadManifest(projectDir);

  // Update for CREATE operations
  for (const item of operations.created) {
    updateAfterCreate(manifest, item.type, item.name, item.hash, targetTool);
  }

  // Update for UPDATE operations
  for (const item of operations.updated) {
    updateAfterUpdate(manifest, item.type, item.name, item.hash, targetTool);
  }

  // Update for DELETE operations
  for (const item of operations.deleted) {
    updateAfterDelete(manifest, item.type, item.name, targetTool);
  }

  await saveManifest(manifest, projectDir);
}

/**
 * Setup symlinks for skills directories when enabled
 *
 * @param config - Vibe configuration
 * @param plan - Sync plan
 * @param projectDir - Project directory
 */
export async function syncWithSymlinks(
  config: VibeConfig,
  plan: SyncPlan,
  projectDir: string,
): Promise<void> {
  // Check if symlinks should be used
  if (!shouldUseSymlinks(config)) {
    return;
  }

  // Get source adapter to determine source skills directory
  const sourceAdapter = getAdapter({
    tool: config.source_tool,
    baseDir: projectDir,
    level: config.level,
  });

  const sourceSkillsDir = join(projectDir, sourceAdapter.getSkillsDir());

  // Track backups for cleanup after successful sync
  const backups: DirectoryBackupInfo[] = [];

  try {
    // Setup symlinks for each target tool
    for (const targetTool of Object.keys(plan.diffs)) {
      const tool = targetTool as ToolName;
      const targetAdapter = getAdapter({
        tool,
        baseDir: projectDir,
        level: config.level,
      });

      const targetSkillsDir = join(projectDir, targetAdapter.getSkillsDir());

      // Setup symlink from target to source with automatic rollback on error
      const backup = await setupSymlinkWithBackup(
        sourceSkillsDir,
        targetSkillsDir,
      );
      backups.push(backup);
    }

    // All symlinks created successfully - cleanup backups
    for (const backup of backups) {
      await cleanupDirectoryBackup(backup);
    }
  } catch (error) {
    // Error occurred - rollback already happened in setupSymlinkWithBackup
    // Just cleanup any successful backups and re-throw
    for (const backup of backups) {
      await cleanupDirectoryBackup(backup);
    }
    throw error;
  }
}

/**
 * Prompt user for symlink usage preference
 * Shows information about symlinks and asks user to choose
 * Updates config file with user's choice
 *
 * @param config - Current config
 * @param projectDir - Project directory
 */
async function promptForSymlinkUsage(
  config: VibeConfig,
  projectDir: string,
): Promise<void> {
  // Display info
  console.log(chalk.cyan(t("commands.sync.symlinkPromptTitle")));
  console.log(
    chalk.gray(
      `  ${t("commands.sync.symlinkPromptSource", { tool: config.source_tool })}`,
    ),
  );
  console.log(
    chalk.gray(
      `  ${t("commands.sync.symlinkPromptTargets", { tools: config.target_tools.join(", ") })}`,
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

  // Update config with user's choice
  config.use_symlinks_for_skills = useSymlinks;

  // Save config back to file
  const { saveConfig } = await import("@src/core/config-manager.js");
  await saveConfig(config, config.level, projectDir);
}

/**
 * Run sync command
 *
 * @param options - Command options
 */
export async function syncCommand(options: {
  dryRun?: boolean;
  prune?: boolean;
  user?: boolean;
  yes?: boolean;
}): Promise<void> {
  const endTiming = debugTiming("sync command");

  try {
    const projectDir = options.user ? process.env.HOME || cwd() : cwd();
    const mode: SyncMode = options.prune ? "prune" : "safe";

    debug("Sync command started", { projectDir, mode, options });

    // Load configuration
    const spinner = ora(t("commands.sync.loadingConfig")).start();
    const config = await loadSyncConfig(projectDir, options.user || false);
    debugObject("Loaded config", config);
    spinner.succeed(t("commands.sync.configLoaded"));

    // Read source configuration
    const readSpinner = ora(
      t("commands.sync.reading", { tool: config.source_tool }),
    ).start();
    const sourceData = await readSourceConfig(
      config.source_tool,
      projectDir,
      config.level,
    );
    readSpinner.succeed(
      t("commands.sync.readComplete", {
        skills: sourceData.skills.length,
        mcp: sourceData.mcpServers.length,
        agents: sourceData.agents.length,
        commands: sourceData.commands.length,
      }),
    );

    // Load manifest
    const manifest = await loadManifest(projectDir);

    // Check if we should prompt for symlink usage (only on first skills sync)
    if (shouldPromptForSymlinks(config, manifest, config.target_tools)) {
      await promptForSymlinkUsage(config, projectDir);
    }

    // Calculate diff and generate plan
    const planSpinner = ora(t("commands.sync.calculating")).start();
    const plan = await calculateSyncDiff(
      sourceData,
      config.target_tools,
      manifest,
      mode,
    );
    planSpinner.succeed(t("commands.sync.planGenerated"));

    // Display plan
    console.log(formatPlan(plan));

    // Validate plan
    const validation = validatePlan(plan);
    if (!validation.valid) {
      console.error(
        chalk.red(`\n❌ ${t("commands.sync.planValidationFailed")}`),
      );
      validation.errors.forEach((err) =>
        console.error(chalk.red(`  - ${err}`)),
      );
      process.exit(1);
    }

    if (validation.warnings && validation.warnings.length > 0) {
      console.log(chalk.yellow(`\n⚠️  ${t("commands.sync.warnings")}`));
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
      console.log(chalk.green(`\n✅ ${t("commands.sync.noChanges")}\n`));
      return;
    }

    // Dry run - skip execution
    if (options.dryRun) {
      console.log(chalk.blue(`\n💡 ${t("commands.sync.dryRun")}\n`));
      return;
    }

    // Prompt for confirmation (skip if --yes flag is provided)
    if (!options.yes) {
      const { confirm } = await inquirer.prompt<{ confirm: boolean }>([
        {
          type: "confirm",
          name: "confirm",
          message: t("commands.sync.confirmPrompt"),
          default: false,
        },
      ]);

      if (!confirm) {
        console.log(chalk.yellow(`\n⚠️  ${t("commands.sync.cancelled")}\n`));
        return;
      }
    }

    // Setup symlinks if enabled
    if (shouldUseSymlinks(config)) {
      const symlinkSpinner = ora(t("commands.sync.settingUpSymlinks")).start();
      try {
        await syncWithSymlinks(config, plan, projectDir);
        symlinkSpinner.succeed(t("commands.sync.symlinksConfigured"));
      } catch (error) {
        symlinkSpinner.fail(t("commands.sync.symlinksFailed"));
        throw error;
      }
    }

    // Execute sync
    const execSpinner = ora(t("commands.sync.syncing")).start();
    const results = await executeSyncPlan(
      plan,
      sourceData,
      projectDir,
      config.level,
    );
    execSpinner.succeed(t("commands.sync.completed"));

    // Update manifest
    for (const [toolName, result] of Object.entries(results)) {
      if (!result || !result.success) continue;

      const tool = toolName as ToolName;
      const diff = plan.diffs[tool];
      if (!diff) continue;

      const operations: SyncOperations = {
        created: diff.toCreate.map((op) => ({
          type: op.itemType,
          name: op.name,
          hash: op.newHash || "",
        })),
        updated: diff.toUpdate.map((op) => ({
          type: op.itemType,
          name: op.name,
          hash: op.newHash || "",
        })),
        deleted: diff.toDelete.map((op) => ({
          type: op.itemType,
          name: op.name,
        })),
      };

      await updateManifestAfterSync(operations, tool, projectDir);
    }

    // Display summary
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
      endTiming();
    } else {
      console.log(
        chalk.yellow(`\n⚠️  ${t("commands.sync.completedWithErrors")}\n`),
      );
      debugObject("Sync results with errors", results);
      endTiming();
      process.exit(1);
    }
  } catch (error) {
    debugError("Sync command failed", error);
    endTiming();
    if (error instanceof Error) {
      console.error(chalk.red(`\n❌ ${t("common.error")}: ${error.message}\n`));
      process.exit(1);
    }
  }
}

export function createSyncCommand(): Command {
  const command = new Command("sync");

  command
    .description(t("commands.sync.description"))
    .option("--dry-run", t("commands.sync.dryRunOption"))
    .option("--prune", t("commands.sync.pruneOption"))
    .option("--user", t("commands.sync.userLevelOption"))
    .option("-y, --yes", t("commands.sync.yesOption"))
    .action(async (options) => {
      await syncCommand(options);
    });

  return command;
}
