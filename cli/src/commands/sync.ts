/**
 * vsync sync command
 * Synchronize configurations across tools
 */

import { join } from "node:path";
import { cwd } from "node:process";
import chalk from "chalk";
import { Command } from "commander";
import { getAdapter, getToolConfigFiles } from "@src/adapters/registry.js";
import {
  loadManifest,
  saveManifest,
  updateAfterCreate,
  updateAfterUpdate,
  updateAfterDelete,
} from "@src/core/manifest-manager.js";
import { generatePlan, validatePlan } from "@src/core/planner.js";
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
import {
  SyncExecutor,
  SourceData as SourceDataClass,
} from "@src/core/sync-executor.js";
import type {
  ConfigLevel,
  SyncMode,
  ToolName,
  VSyncConfig,
} from "@src/types/config.js";
import type { Manifest, ItemType } from "@src/types/manifest.js";
import type {
  MCPServer,
  Skill,
  Agent,
  Command as VibeCommand,
} from "@src/types/models.js";
import type { SyncPlan } from "@src/types/plan.js";
import { ensureConfig } from "@src/utils/config-initializer.js";
import {
  PruneModeReadError,
  FileOperationError,
  ErrorSeverity,
} from "@src/utils/errors.js";
import { t } from "@src/utils/i18n.js";
import {
  debug,
  debugError,
  debugObject,
  debugTiming,
} from "@src/utils/logger.js";
import { SyncUI } from "@src/utils/sync-ui.js";

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
 * @param config - vsync configuration
 * @param manifest - Current manifest
 * @param targetTools - Target tools to sync to
 * @returns True if should prompt for symlink preference
 */
export function shouldPromptForSymlinks(
  config: VSyncConfig,
  manifest: Manifest,
  targetTools: ToolName[],
): boolean {
  // Don't prompt if use_symlinks_for_skills is already set
  if (config.use_symlinks_for_skills !== undefined) {
    return false;
  }

  // Don't prompt if skills not in sync config
  if (!config.sync_config?.skills) {
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
 * Target configuration with capabilities
 */
interface TargetConfig {
  skills: Skill[];
  mcpServers: MCPServer[];
  agents: Agent[];
  commands: VibeCommand[];
  capabilities: import("@src/adapters/base.js").AdapterCapabilities;
}

/**
 * Read items with fallback to empty array on error
 * Single responsibility: handle one type of read operation
 * Uses unified error handling strategy
 */
async function readItemsWithFallback<T>(
  reader: () => Promise<T[]>,
  itemType: string,
  tool: ToolName,
  mode: SyncMode,
): Promise<T[]> {
  try {
    return await reader();
  } catch (error) {
    // File not found is expected on first sync - don't warn
    const isFileNotFound =
      error instanceof Error &&
      (error.message.includes("ENOENT") || error.message.includes("not found"));

    if (isFileNotFound) {
      return [];
    }

    // Convert to proper error type
    const originalError =
      error instanceof Error ? error : new Error(String(error));

    // ⚠️ CRITICAL: Non-ENOENT errors in prune mode could cause data loss!
    // If we can't read the target config (permission, corruption, etc.),
    // returning [] would make prune think "user deleted everything" → delete all
    if (mode === "prune") {
      throw new PruneModeReadError(tool, itemType, originalError);
    }

    // Safe mode: Create warning-level error and log
    const readError = new FileOperationError(
      "read",
      `${tool}/${itemType}`,
      originalError,
      ErrorSeverity.WARNING,
    );

    // Log warning with consistent format
    console.warn(`⚠️  ${readError.message}`);
    debug("Read error context:", readError.context);

    return [];
  }
}

/**
 * Read configuration from a single tool
 * Single responsibility: coordinate reading all item types for one tool
 */
async function readToolConfig(
  tool: ToolName,
  projectDir: string,
  level: ConfigLevel,
  mode: SyncMode,
): Promise<TargetConfig> {
  const adapter = getAdapter({ tool, baseDir: projectDir, level });
  const capabilities = adapter.getCapabilities();

  // Read each type in parallel if supported
  // Pass mode to enable strict error handling in prune mode
  const [skills, mcpServers, agents, commands] = await Promise.all([
    capabilities.skills
      ? readItemsWithFallback(() => adapter.readSkills(), "skills", tool, mode)
      : Promise.resolve([]),
    capabilities.mcp
      ? readItemsWithFallback(
          () => adapter.readMCPServers(),
          "MCP servers",
          tool,
          mode,
        )
      : Promise.resolve([]),
    capabilities.agents
      ? readItemsWithFallback(() => adapter.readAgents(), "agents", tool, mode)
      : Promise.resolve([]),
    capabilities.commands
      ? readItemsWithFallback(
          () => adapter.readCommands(),
          "commands",
          tool,
          mode,
        )
      : Promise.resolve([]),
  ]);

  return { skills, mcpServers, agents, commands, capabilities };
}

/**
 * Read configurations from all target tools in parallel
 *
 * @param targetTools - Target tool names
 * @param projectDir - Project directory
 * @param level - Config level
 * @returns Map of target data with capabilities
 */
async function readTargetConfigs(
  targetTools: ToolName[],
  projectDir: string,
  level: ConfigLevel,
  mode: SyncMode,
): Promise<Record<ToolName, TargetConfig>> {
  // Parallel read for performance
  const configs = await Promise.all(
    targetTools.map((tool) => readToolConfig(tool, projectDir, level, mode)),
  );

  // Convert array to record
  return Object.fromEntries(
    targetTools.map((tool, i) => [tool, configs[i]]),
  ) as Record<ToolName, TargetConfig>;
}

/**
 * Calculate sync diff for all targets
 *
 * @param sourceData - Source configuration
 * @param sourceTool - Source tool name
 * @param targetTools - Target tool names
 * @param manifest - Current manifest
 * @param mode - Sync mode
 * @param syncConfig - Sync configuration (what to sync)
 * @param projectDir - Project directory
 * @param level - Config level
 * @returns Sync plan
 */
export async function calculateSyncDiff(
  sourceData: SourceData,
  sourceTool: ToolName,
  targetTools: ToolName[],
  manifest: Manifest,
  mode: SyncMode,
  syncConfig: VSyncConfig["sync_config"],
  projectDir: string,
  level: ConfigLevel,
): Promise<SyncPlan> {
  const targetData = await readTargetConfigs(
    targetTools,
    projectDir,
    level,
    mode,
  );

  // Filter source data based on sync_config
  // Only include items that are enabled in configuration
  const plan = generatePlan({
    sourceSkills: syncConfig?.skills ? sourceData.skills : [],
    sourceMCPServers: syncConfig?.mcp ? sourceData.mcpServers : [],
    sourceAgents: syncConfig?.agents ? sourceData.agents : [],
    sourceCommands: syncConfig?.commands ? sourceData.commands : [],
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
    targetCapabilities: Object.fromEntries(
      Object.entries(targetData).map(([tool, data]) => [
        tool,
        data.capabilities,
      ]),
    ),
    manifest,
    mode,
    sourceTool,
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

    // Phase 2: Execute sync operations for each target (using SyncExecutor - DRY principle)
    // Convert source data to SourceDataClass for proper abstraction
    const sourceDataObj = new SourceDataClass(
      sourceData.skills,
      sourceData.mcpServers,
      sourceData.agents,
      sourceData.commands,
    );

    for (const [toolName, diff] of Object.entries(plan.diffs)) {
      if (!diff) continue;

      const tool = toolName as ToolName;
      const adapter = getAdapter({
        tool,
        baseDir: projectDir,
        level,
      });

      try {
        // Use SyncExecutor to handle all sync logic (eliminates 200+ lines of duplication)
        const executor = new SyncExecutor(adapter, sourceDataObj);
        const result = await executor.execute(diff);

        results[tool] = {
          success: result.success,
          created: result.created,
          updated: result.updated,
          deleted: result.deleted,
          errors: result.errors,
        };
      } catch (error) {
        // Error already handled by SyncExecutor
        if (error instanceof Error) {
          debugError(`Error syncing to ${tool}:`, error);
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
    const key = `${item.type}/${item.name}`;
    const manifestItem = manifest.items[key];

    // If item doesn't exist in manifest yet (first time syncing to this target),
    // treat it as CREATE instead of UPDATE
    if (!manifestItem || !manifestItem.targets[targetTool]) {
      updateAfterCreate(manifest, item.type, item.name, item.hash, targetTool);
    } else {
      updateAfterUpdate(manifest, item.type, item.name, item.hash, targetTool);
    }
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
  config: VSyncConfig,
  plan: SyncPlan,
  projectDir: string,
): Promise<void> {
  // Check if symlinks should be used
  if (!shouldUseSymlinks(config)) {
    return;
  }

  // Get source adapter to determine source skills directory
  // Config fields are guaranteed by ensureConfig validation
  const sourceAdapter = getAdapter({
    tool: config.source_tool!,
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
/**
 * Prompt for symlink usage (simplified - delegates to UI service)
 * Updates config with user's choice and saves
 */
async function promptForSymlinkUsage(
  config: VSyncConfig,
  projectDir: string,
): Promise<void> {
  const useSymlinks = await SyncUI.promptForSymlinkUsage(config);

  // Update config with user's choice
  config.use_symlinks_for_skills = useSymlinks;

  // Save config back to file
  const { saveConfig } = await import("@src/core/config-manager.js");
  await saveConfig(config, config.level, projectDir);
}

/**
 * Sync context containing all necessary data for sync operation
 */
interface SyncContext {
  projectDir: string;
  mode: SyncMode;
  config: VSyncConfig;
  sourceData: SourceData;
  manifest: Manifest;
}

/**
 * Validated sync plan with user interaction results
 */
interface ValidatedPlan {
  plan: SyncPlan;
  hasOperations: boolean;
  shouldExecute: boolean;
}

/**
 * Phase 1: Prepare sync context
 * - Load configuration
 * - Read source data
 * - Load manifest
 * - Handle symlink prompts
 *
 * Single Responsibility: Context initialization
 */
async function prepareSyncContext(options: {
  user?: boolean;
  prune?: boolean;
}): Promise<SyncContext> {
  const projectDir = options.user ? process.env.HOME || cwd() : cwd();
  const mode: SyncMode = options.prune ? "prune" : "safe";

  debug("Sync command started", { projectDir, mode, options });

  // Load configuration (with auto-init if needed)
  const spinner = SyncUI.showLoadingConfig();
  const config = await ensureConfig(projectDir, options.user || false, {
    spinner,
    requireFields: ["source_tool", "target_tools", "sync_config"],
  });
  debugObject("Loaded config", config);
  SyncUI.configLoaded(spinner);

  // Read source configuration
  const readSpinner = SyncUI.showReadingSource(config.source_tool!);
  const sourceData = await readSourceConfig(
    config.source_tool!,
    projectDir,
    config.level,
  );
  SyncUI.readComplete(readSpinner, {
    skills: sourceData.skills.length,
    mcp: sourceData.mcpServers.length,
    agents: sourceData.agents.length,
    commands: sourceData.commands.length,
  });

  // Load manifest
  const manifest = await loadManifest(projectDir);

  // Check if we should prompt for symlink usage (only on first skills sync)
  // Config fields are guaranteed by ensureConfig validation
  if (shouldPromptForSymlinks(config, manifest, config.target_tools!)) {
    await promptForSymlinkUsage(config, projectDir);
  }

  return { projectDir, mode, config, sourceData, manifest };
}

/**
 * Phase 2: Build and validate sync plan
 * - Calculate diff
 * - Display plan
 * - Validate plan
 * - Check for operations
 *
 * Single Responsibility: Plan generation and validation
 */
async function buildAndValidatePlan(
  context: SyncContext,
): Promise<ValidatedPlan> {
  const { config, sourceData, manifest, mode, projectDir } = context;

  // Debug: Show manifest state before calculating diff
  debug("Manifest items count:", Object.keys(manifest.items).length);
  if (Object.keys(manifest.items).length > 0) {
    debug(
      "Sample manifest items:",
      Object.keys(manifest.items).slice(0, 5).join(", "),
    );
  }

  const planSpinner = SyncUI.showCalculating();
  const plan = await calculateSyncDiff(
    sourceData,
    config.source_tool!,
    config.target_tools!,
    manifest,
    mode,
    config.sync_config!,
    projectDir,
    config.level,
  );
  SyncUI.planGenerated(planSpinner);

  // Display plan
  SyncUI.displayPlan(plan);

  // Validate plan
  const validation = validatePlan(plan);
  if (!validation.valid) {
    SyncUI.displayValidationErrors(validation);
  }

  SyncUI.displayValidationWarnings(validation);

  // Check if there are any operations
  const hasOperations = Object.values(plan.diffs).some(
    (diff) =>
      diff &&
      (diff.toCreate.length > 0 ||
        diff.toUpdate.length > 0 ||
        diff.toDelete.length > 0),
  );

  return {
    plan,
    hasOperations,
    shouldExecute: true, // Will be determined in next phase
  };
}

/**
 * Phase 3: Confirm execution with user
 * - Check for operations
 * - Handle dry-run
 * - Prompt for confirmation
 *
 * Single Responsibility: User interaction and confirmation
 */
async function confirmExecution(
  validatedPlan: ValidatedPlan,
  context: SyncContext,
  options: { dryRun?: boolean; yes?: boolean },
): Promise<boolean> {
  // No operations - nothing to do
  if (!validatedPlan.hasOperations) {
    SyncUI.showNoChanges();
    return false;
  }

  // Dry run - skip execution
  if (options.dryRun) {
    SyncUI.showDryRun();
    return false;
  }

  // Prompt for confirmation (skip if --yes flag is provided)
  if (!options.yes) {
    const isDestructive = context.mode === "prune";
    const confirm = await SyncUI.confirmSync(isDestructive);

    if (!confirm) {
      SyncUI.showCancelled();
      return false;
    }
  }

  return true;
}

/**
 * Phase 4: Execute sync with symlinks
 * - Setup symlinks if enabled
 * - Execute sync plan
 *
 * Single Responsibility: Sync execution
 */
async function executeSyncWithSymlinks(
  plan: SyncPlan,
  context: SyncContext,
): Promise<SyncResults> {
  const { config, sourceData, projectDir } = context;

  // Setup symlinks if enabled
  if (shouldUseSymlinks(config)) {
    const symlinkSpinner = SyncUI.showSettingUpSymlinks();
    try {
      await syncWithSymlinks(config, plan, projectDir);
      SyncUI.symlinksConfigured(symlinkSpinner);
    } catch (error) {
      SyncUI.symlinksFailed(symlinkSpinner);
      throw error;
    }
  }

  // Execute sync
  const execSpinner = SyncUI.showSyncing();
  const results = await executeSyncPlan(
    plan,
    sourceData,
    projectDir,
    config.level,
  );
  SyncUI.syncCompleted(execSpinner);

  return results;
}

/**
 * Phase 5: Finalize sync results
 * - Update manifest
 * - Display summary
 * - Handle errors
 *
 * Single Responsibility: Post-sync finalization
 */
async function finalizeSyncResults(
  results: SyncResults,
  plan: SyncPlan,
  context: SyncContext,
): Promise<boolean> {
  const { sourceData, projectDir } = context;

  // Update manifest for each successful target
  for (const [toolName, result] of Object.entries(results)) {
    if (!result || !result.success) continue;

    const tool = toolName as ToolName;
    const diff = plan.diffs[tool];
    if (!diff) continue;

    // Use SourceData class method instead of inline if-else chain (DRY principle)
    const sourceDataObj = new SourceDataClass(
      sourceData.skills,
      sourceData.mcpServers,
      sourceData.agents,
      sourceData.commands,
    );

    const operations: SyncOperations = {
      created: diff.toCreate.map((op) => ({
        type: op.itemType,
        name: op.name,
        hash: sourceDataObj.getHash(op.itemType, op.name),
      })),
      updated: diff.toUpdate.map((op) => ({
        type: op.itemType,
        name: op.name,
        hash: sourceDataObj.getHash(op.itemType, op.name),
      })),
      deleted: diff.toDelete.map((op) => ({
        type: op.itemType,
        name: op.name,
      })),
    };

    await updateManifestAfterSync(operations, tool, projectDir);
  }

  // Display summary
  SyncUI.displaySyncSummary(results);

  // Check if all succeeded
  const allSuccess = Object.values(results).every((r) => r?.success);

  if (!allSuccess) {
    debugObject("Sync results with errors", results);
  }

  return allSuccess;
}

/**
 * Run sync command
 * Refactored to follow Single Responsibility Principle
 * Each phase is handled by a dedicated function
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
    // Phase 1: Prepare sync context (config, source data, manifest)
    const context = await prepareSyncContext(options);

    // Phase 2: Build and validate sync plan
    const validatedPlan = await buildAndValidatePlan(context);

    // Phase 3: Confirm execution with user
    const shouldExecute = await confirmExecution(
      validatedPlan,
      context,
      options,
    );

    if (!shouldExecute) {
      endTiming();
      return;
    }

    // Phase 4: Execute sync with symlinks
    const results = await executeSyncWithSymlinks(validatedPlan.plan, context);

    // Phase 5: Finalize results (manifest update, summary)
    const allSuccess = await finalizeSyncResults(
      results,
      validatedPlan.plan,
      context,
    );

    endTiming();

    if (!allSuccess) {
      process.exit(1);
    }
  } catch (error) {
    debugError("Sync command failed", error);
    endTiming();
    if (error instanceof Error) {
      SyncUI.showError(`${t("common.error")}: ${error.message}`);
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
