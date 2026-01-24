/**
 * vibe-sync sync command
 * Synchronize configurations across tools
 */

import { cwd } from "node:process";
import chalk from "chalk";
import { Command } from "commander";
import inquirer from "inquirer";
import ora from "ora";
import { getAdapter } from "@src/adapters/registry.js";
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
import type { SyncMode, ToolName, VibeConfig } from "@src/types/config.js";
import type { Manifest, ItemType } from "@src/types/manifest.js";
import type { MCPServer, Skill, Agent } from "@src/types/models.js";
import type { SyncPlan } from "@src/types/plan.js";

/**
 * Source configuration data
 */
export interface SourceData {
  skills: Skill[];
  mcpServers: MCPServer[];
  agents: Agent[];
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
): Promise<SourceData> {
  const adapter = getAdapter({ tool: sourceTool, baseDir: projectDir });

  const skills = await adapter.readSkills();
  const mcpServers = await adapter.readMCPServers();
  const agents = await adapter.readAgents();

  return {
    skills,
    mcpServers,
    agents,
  };
}

/**
 * Read target tool configurations
 *
 * @param targetTools - Target tool names
 * @param projectDir - Project directory
 * @returns Map of target data
 */
export async function readTargetConfigs(targetTools: ToolName[]): Promise<
  Partial<
    Record<
      ToolName,
      {
        skills: Skill[];
        mcpServers: MCPServer[];
        agents: Agent[];
      }
    >
  >
> {
  const targetData: Partial<
    Record<
      ToolName,
      {
        skills: Skill[];
        mcpServers: MCPServer[];
        agents: Agent[];
      }
    >
  > = {};

  // For vibe-sync, target tools are write-only.
  // We rely on the manifest to track what was previously written,
  // rather than reading from target tools.
  // This allows us to support write-only adapters like Cursor.
  for (const tool of targetTools) {
    targetData[tool] = {
      skills: [],
      mcpServers: [],
      agents: [],
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
    targetSkills: Object.fromEntries(
      Object.entries(targetData).map(([tool, data]) => [tool, data.skills]),
    ),
    targetMCPServers: Object.fromEntries(
      Object.entries(targetData).map(([tool, data]) => [tool, data.mcpServers]),
    ),
    targetAgents: Object.fromEntries(
      Object.entries(targetData).map(([tool, data]) => [tool, data.agents]),
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
function getTargetFilePaths(tool: ToolName, baseDir: string): string[] {
  const paths: string[] = [];

  if (tool === "cursor") {
    paths.push(`${baseDir}/.cursor/mcp.json`);
    // Note: Individual skill files would be backed up separately if needed
  } else if (tool === "opencode") {
    paths.push(`${baseDir}/.opencode/opencode.jsonc`);
  } else if (tool === "claude-code") {
    paths.push(`${baseDir}/.mcp.json`);
  }

  return paths;
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
): Promise<SyncResults> {
  const results: SyncResults = {};
  const allBackups: BackupInfo[] = [];

  try {
    // Phase 1: Create backups for all target files
    for (const toolName of Object.keys(plan.diffs)) {
      const tool = toolName as ToolName;
      const filePaths = getTargetFilePaths(tool, projectDir);

      for (const filePath of filePaths) {
        const backup = await createBackup(filePath);
        allBackups.push(backup);
      }
    }

    // Phase 2: Execute sync operations for each target
    for (const [toolName, diff] of Object.entries(plan.diffs)) {
      if (!diff) continue;

      const tool = toolName as ToolName;
      const adapter = getAdapter({ tool, baseDir: projectDir });

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

        // Write skills (CREATE + UPDATE combined)
        const allSkills = [...skillsToCreate, ...skillsToUpdate];
        if (allSkills.length > 0) {
          try {
            const writeResult = await adapter.writeSkills(allSkills);
            if (writeResult.success) {
              result.created += skillsToCreate.length;
              result.updated += skillsToUpdate.length;
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
        console.error(
          chalk.yellow(`\n⚠️  Error occurred - rolling back changes...`),
        );
        for (const backup of allBackups) {
          await restoreBackup(backup);
        }
        console.error(chalk.green("✅ Rollback completed"));

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
 * Run sync command
 *
 * @param options - Command options
 */
export async function syncCommand(options: {
  dryRun?: boolean;
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
      `Read ${sourceData.skills.length} skills, ${sourceData.mcpServers.length} MCP servers, ${sourceData.agents.length} agents`,
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

    // Display plan
    console.log(formatPlan(plan));

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
      console.log(chalk.green("\n✅ Everything is up to date!\n"));
      return;
    }

    // Dry run - skip execution
    if (options.dryRun) {
      console.log(chalk.blue("\n💡 Dry run mode - no changes will be made\n"));
      return;
    }

    // Prompt for confirmation
    const { confirm } = await inquirer.prompt<{ confirm: boolean }>([
      {
        type: "confirm",
        name: "confirm",
        message: "Do you want to proceed with the sync?",
        default: false,
      },
    ]);

    if (!confirm) {
      console.log(chalk.yellow("\n⚠️  Sync cancelled\n"));
      return;
    }

    // Execute sync
    const execSpinner = ora("Syncing configurations...").start();
    const results = await executeSyncPlan(plan, sourceData, projectDir);
    execSpinner.succeed("Sync completed");

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
    console.log(chalk.bold("\n📊 Sync Summary:\n"));
    for (const [toolName, result] of Object.entries(results)) {
      if (!result) continue;

      const icon = result.success ? "✅" : "❌";
      console.log(chalk.bold(`${icon} ${toolName}:`));
      console.log(`  Created: ${result.created}`);
      console.log(`  Updated: ${result.updated}`);
      console.log(`  Deleted: ${result.deleted}`);

      if (result.errors.length > 0) {
        console.log(chalk.red("  Errors:"));
        result.errors.forEach((err) => console.log(chalk.red(`    - ${err}`)));
      }
    }

    const allSuccess = Object.values(results).every((r) => r?.success);
    if (allSuccess) {
      console.log(chalk.green("\n✅ Sync completed successfully!\n"));
    } else {
      console.log(chalk.yellow("\n⚠️  Sync completed with errors\n"));
      process.exit(1);
    }
  } catch (error) {
    if (error instanceof Error) {
      console.error(chalk.red(`\n❌ Error: ${error.message}\n`));
      process.exit(1);
    }
  }
}

export function createSyncCommand(): Command {
  const command = new Command("sync");

  command
    .description("Synchronize configurations across tools")
    .option("--dry-run", "Show what would be synced without making changes")
    .option("--prune", "Enable delete operations (use with caution)")
    .option("--user", "Use user-level config instead of project-level")
    .action(async (options) => {
      await syncCommand(options);
    });

  return command;
}
