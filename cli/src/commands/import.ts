/**
 * vibe-sync import command
 * Import configurations from another project
 */

import { access } from "node:fs/promises";
import { join } from "node:path";
import chalk from "chalk";
import { Command } from "commander";
import inquirer from "inquirer";
import ora from "ora";
import { getAdapter, getAllConfigDirs } from "@src/adapters/registry.js";
import type { ToolName } from "@src/types/config.js";

/**
 * Import options
 */
export interface ImportOptions {
  /** Source project path */
  sourcePath: string;
  /** Target project path (current project) */
  targetPath: string;
  /** Source tool to import from */
  sourceTool: ToolName;
  /** Target tool to import to (defaults to source tool) */
  targetTool?: ToolName;
  /** Import skills */
  importSkills: boolean;
  /** Import MCP servers */
  importMcp: boolean;
  /** Import agents */
  importAgents: boolean;
  /** Import commands */
  importCommands: boolean;
  /** Skip existing items with same name */
  skipExisting?: boolean;
}

/**
 * Import count for a single type - Internal use only
 */
interface ImportCount {
  imported: number;
  skipped: number;
}

/**
 * Import result
 */
export interface ImportResult {
  success: boolean;
  skills: ImportCount;
  mcp: ImportCount;
  agents: ImportCount;
  commands: ImportCount;
  errors: string[];
}

/**
 * Detect available source tools in a directory
 *
 * @param projectDir - Project directory to scan
 * @returns Array of detected tool names
 */
export async function detectSourceTool(
  projectDir: string,
): Promise<ToolName[]> {
  const detected: ToolName[] = [];

  // Get config directories from registry (no hardcoding!)
  const toolDirs = getAllConfigDirs();

  for (const [tool, dir] of Object.entries(toolDirs)) {
    try {
      await access(join(projectDir, dir));
      detected.push(tool as ToolName);
    } catch {
      // Directory doesn't exist
    }
  }

  return detected;
}

/**
 * Import configurations from source to target
 *
 * @param options - Import options
 * @returns Import result
 */
export async function importConfigs(
  options: ImportOptions,
): Promise<ImportResult> {
  const result: ImportResult = {
    success: false,
    skills: { imported: 0, skipped: 0 },
    mcp: { imported: 0, skipped: 0 },
    agents: { imported: 0, skipped: 0 },
    commands: { imported: 0, skipped: 0 },
    errors: [],
  };

  try {
    // Create adapters for source and target
    const sourceAdapter = getAdapter({
      tool: options.sourceTool,
      baseDir: options.sourcePath,
      level: "project",
    });

    // Use targetTool if specified, otherwise use sourceTool
    const targetTool = options.targetTool || options.sourceTool;
    const targetAdapter = getAdapter({
      tool: targetTool,
      baseDir: options.targetPath,
      level: "project",
    });

    // Import skills
    if (options.importSkills) {
      const sourceSkills = await sourceAdapter.readSkills();

      // Try to read target skills for duplicate checking
      let targetSkills: typeof sourceSkills = [];
      try {
        targetSkills = await targetAdapter.readSkills();
      } catch {
        // Target adapter is write-only, try using source adapter to read target
        try {
          const fallbackAdapter = getAdapter({
            tool: options.sourceTool,
            baseDir: options.targetPath,
            level: "project",
          });
          targetSkills = await fallbackAdapter.readSkills();
        } catch {
          // Failed to read target skills, assume empty
        }
      }
      const targetSkillNames = new Set(targetSkills.map((s) => s.name));

      const skillsToImport = sourceSkills.filter((skill) => {
        if (options.skipExisting && targetSkillNames.has(skill.name)) {
          result.skills.skipped++;
          return false;
        }
        return true;
      });

      if (skillsToImport.length > 0) {
        const writeResult = await targetAdapter.writeSkills(skillsToImport);
        if (writeResult.success) {
          result.skills.imported = writeResult.count;
        } else {
          result.errors.push(
            writeResult.error || "Failed to write skills to target",
          );
        }
      }
    }

    // Import MCP servers
    if (options.importMcp) {
      const sourceServers = await sourceAdapter.readMCPServers();

      // Try to read target servers for duplicate checking
      let targetServers: typeof sourceServers = [];
      try {
        targetServers = await targetAdapter.readMCPServers();
      } catch {
        // Target adapter is write-only, try using source adapter to read target
        try {
          const fallbackAdapter = getAdapter({
            tool: options.sourceTool,
            baseDir: options.targetPath,
            level: "project",
          });
          targetServers = await fallbackAdapter.readMCPServers();
        } catch {
          // Failed to read target servers, assume empty
        }
      }
      const targetServerNames = new Set(targetServers.map((s) => s.name));

      const serversToImport = sourceServers.filter((server) => {
        if (options.skipExisting && targetServerNames.has(server.name)) {
          result.mcp.skipped++;
          return false;
        }
        return true;
      });

      if (serversToImport.length > 0) {
        const writeResult =
          await targetAdapter.writeMCPServers(serversToImport);
        if (writeResult.success) {
          result.mcp.imported = writeResult.count;
        } else {
          result.errors.push(
            writeResult.error || "Failed to write MCP servers to target",
          );
        }
      }
    }

    // Import agents
    if (options.importAgents) {
      const sourceAgents = await sourceAdapter.readAgents();

      // Try to read target agents for duplicate checking
      let targetAgents: typeof sourceAgents = [];
      try {
        targetAgents = await targetAdapter.readAgents();
      } catch {
        // Target adapter is write-only, try using source adapter to read target
        try {
          const fallbackAdapter = getAdapter({
            tool: options.sourceTool,
            baseDir: options.targetPath,
            level: "project",
          });
          targetAgents = await fallbackAdapter.readAgents();
        } catch {
          // Failed to read target agents, assume empty
        }
      }
      const targetAgentNames = new Set(targetAgents.map((a) => a.name));

      const agentsToImport = sourceAgents.filter((agent) => {
        if (options.skipExisting && targetAgentNames.has(agent.name)) {
          result.agents.skipped++;
          return false;
        }
        return true;
      });

      if (agentsToImport.length > 0) {
        const writeResult = await targetAdapter.writeAgents(agentsToImport);
        if (writeResult.success) {
          result.agents.imported = writeResult.count;
        } else {
          result.errors.push(
            writeResult.error || "Failed to write agents to target",
          );
        }
      }
    }

    // Import commands
    if (options.importCommands) {
      const sourceCommands = await sourceAdapter.readCommands();

      // Try to read target commands for duplicate checking
      let targetCommands: typeof sourceCommands = [];
      try {
        targetCommands = await targetAdapter.readCommands();
      } catch {
        // Target adapter is write-only, try using source adapter to read target
        try {
          const fallbackAdapter = getAdapter({
            tool: options.sourceTool,
            baseDir: options.targetPath,
            level: "project",
          });
          targetCommands = await fallbackAdapter.readCommands();
        } catch {
          // Failed to read target commands, assume empty
        }
      }
      const targetCommandNames = new Set(targetCommands.map((c) => c.name));

      const commandsToImport = sourceCommands.filter((command) => {
        if (options.skipExisting && targetCommandNames.has(command.name)) {
          result.commands.skipped++;
          return false;
        }
        return true;
      });

      if (commandsToImport.length > 0) {
        const writeResult = await targetAdapter.writeCommands(commandsToImport);
        if (writeResult.success) {
          result.commands.imported = writeResult.count;
        } else {
          result.errors.push(
            writeResult.error || "Failed to write commands to target",
          );
        }
      }
    }

    result.success = result.errors.length === 0;
  } catch (error) {
    result.errors.push(
      error instanceof Error ? error.message : "Unknown error during import",
    );
    result.success = false;
  }

  return result;
}

/**
 * Create import command
 */
export function createImportCommand(): Command {
  const cmd = new Command("import");

  cmd
    .description("Import configurations from another project")
    .argument("<path>", "Path to source project")
    .option("--user", "Import to user-level configuration", false)
    .action(async (sourcePath: string) => {
      try {
        const targetPath = process.cwd();

        // Detect available tools in source
        const spinner = ora("Scanning source project...").start();
        const availableTools = await detectSourceTool(sourcePath);

        if (availableTools.length === 0) {
          spinner.fail("No AI coding tool configurations found in source");
          // Generate directory list from registry
          const configDirs = Object.values(getAllConfigDirs())
            .map((dir) => `${dir}/`)
            .join(", ");
          console.log(chalk.yellow(`\nLooked for: ${configDirs}`));
          process.exit(1);
        }

        spinner.succeed(
          `Found ${availableTools.length} tool(s): ${availableTools.join(", ")}`,
        );

        // Select source tool
        let sourceTool: ToolName;
        if (availableTools.length === 1) {
          sourceTool = availableTools[0]!;
          console.log(chalk.blue(`\nImporting from: ${sourceTool}`));
        } else {
          const { selectedTool } = await inquirer.prompt<{
            selectedTool: ToolName;
          }>([
            {
              type: "list",
              name: "selectedTool",
              message: "Import from which tool?",
              choices: availableTools,
            },
          ]);
          sourceTool = selectedTool;
        }

        // Read source configuration
        const readSpinner = ora(
          `Reading ${sourceTool} configuration...`,
        ).start();
        const sourceAdapter = getAdapter({
          tool: sourceTool,
          baseDir: sourcePath,
          level: "project",
        });

        const sourceSkills = await sourceAdapter.readSkills();
        const sourceMcp = await sourceAdapter.readMCPServers();
        const sourceAgents = await sourceAdapter.readAgents();
        const sourceCommands = await sourceAdapter.readCommands();

        readSpinner.succeed("Configuration read successfully");

        console.log(chalk.blue("\nAvailable items:"));
        console.log(`  ${chalk.green("✓")} Skills: ${sourceSkills.length}`);
        console.log(`  ${chalk.green("✓")} MCP servers: ${sourceMcp.length}`);
        console.log(`  ${chalk.green("✓")} Agents: ${sourceAgents.length}`);
        console.log(`  ${chalk.green("✓")} Commands: ${sourceCommands.length}`);

        // Select what to import
        const { itemsToImport } = await inquirer.prompt<{
          itemsToImport: string[];
        }>([
          {
            type: "checkbox",
            name: "itemsToImport",
            message: "What do you want to import?",
            choices: [
              {
                name: `Skills (${sourceSkills.length} items)`,
                value: "skills",
                checked: sourceSkills.length > 0,
              },
              {
                name: `MCP servers (${sourceMcp.length} items)`,
                value: "mcp",
                checked: sourceMcp.length > 0,
              },
              {
                name: `Agents (${sourceAgents.length} items)`,
                value: "agents",
                checked: sourceAgents.length > 0,
              },
              {
                name: `Commands (${sourceCommands.length} items)`,
                value: "commands",
                checked: sourceCommands.length > 0,
              },
            ],
          },
        ]);

        if (itemsToImport.length === 0) {
          console.log(chalk.yellow("\nNo items selected for import"));
          process.exit(0);
        }

        // Confirm import
        const { confirm } = await inquirer.prompt<{ confirm: boolean }>([
          {
            type: "confirm",
            name: "confirm",
            message: "Proceed with import?",
            default: true,
          },
        ]);

        if (!confirm) {
          console.log(chalk.yellow("\nImport cancelled"));
          process.exit(0);
        }

        // Execute import
        const importSpinner = ora("Importing configurations...").start();

        const importOptions: ImportOptions = {
          sourcePath,
          targetPath,
          sourceTool,
          importSkills: itemsToImport.includes("skills"),
          importMcp: itemsToImport.includes("mcp"),
          importAgents: itemsToImport.includes("agents"),
          importCommands: itemsToImport.includes("commands"),
          skipExisting: true,
        };

        const result = await importConfigs(importOptions);

        if (result.success) {
          importSpinner.succeed("Import completed successfully");

          console.log(chalk.blue("\nImport summary:"));
          if (importOptions.importSkills) {
            console.log(
              `  ${chalk.green("✓")} Skills: ${result.skills.imported} imported, ${result.skills.skipped} skipped`,
            );
          }
          if (importOptions.importMcp) {
            console.log(
              `  ${chalk.green("✓")} MCP: ${result.mcp.imported} imported, ${result.mcp.skipped} skipped`,
            );
          }
          if (importOptions.importAgents) {
            console.log(
              `  ${chalk.green("✓")} Agents: ${result.agents.imported} imported, ${result.agents.skipped} skipped`,
            );
          }
          if (importOptions.importCommands) {
            console.log(
              `  ${chalk.green("✓")} Commands: ${result.commands.imported} imported, ${result.commands.skipped} skipped`,
            );
          }

          // Ask if user wants to sync now
          const { syncNow } = await inquirer.prompt<{ syncNow: boolean }>([
            {
              type: "confirm",
              name: "syncNow",
              message: "Sync to target tools now?",
              default: true,
            },
          ]);

          if (syncNow) {
            console.log(
              chalk.blue("\nRun 'vibe-sync sync' to sync configurations"),
            );
          }
        } else {
          importSpinner.fail("Import failed");
          console.error(chalk.red("\nErrors:"));
          for (const error of result.errors) {
            console.error(`  ${chalk.red("✗")} ${error}`);
          }
          process.exit(1);
        }
      } catch (error) {
        console.error(chalk.red("\nImport failed:"));
        console.error(
          chalk.red(error instanceof Error ? error.message : "Unknown error"),
        );
        process.exit(1);
      }
    });

  return cmd;
}
