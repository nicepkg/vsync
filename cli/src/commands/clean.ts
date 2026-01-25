/**
 * vibe-sync clean command
 * Remove items from target tools (and optionally from source)
 */

import { cwd } from "node:process";
import chalk from "chalk";
import { Command } from "commander";
import inquirer from "inquirer";
import ora from "ora";
import { getAdapter } from "@src/adapters/registry.js";
import { loadManifest, saveManifest } from "@src/core/manifest-manager.js";
import type { ConfigLevel, ToolName } from "@src/types/config.js";
import type { Manifest } from "@src/types/manifest.js";
import { loadSyncConfig, readSourceConfig } from "./sync.js";

/**
 * Parsed item name
 */
export interface ParsedItemName {
  type: "skill" | "mcp";
  name: string;
}

/**
 * Clean plan data
 */
export interface CleanPlan {
  itemName: string;
  type: "skill" | "mcp";
  name: string;
  targetTools: ToolName[];
  fromSource: boolean;
  sourceTool: ToolName;
}

/**
 * Parse item name in format "type/name"
 *
 * @param itemName - Item name (e.g., "skill/name" or "mcp/name")
 * @returns Parsed type and name
 */
export function parseItemName(itemName: string): ParsedItemName {
  const parts = itemName.split("/");
  if (parts.length !== 2) {
    throw new Error("Invalid item name format. Use 'skill/name' or 'mcp/name'");
  }

  const [type, name] = parts;
  if (type !== "skill" && type !== "mcp") {
    throw new Error("Invalid item type. Use 'skill' or 'mcp'");
  }

  return { type: type as "skill" | "mcp", name: name || "" };
}

/**
 * Format clean plan for display
 *
 * @param plan - Clean plan
 * @returns Formatted plan string
 */
export function formatCleanPlan(plan: CleanPlan): string {
  const lines: string[] = [];

  lines.push("");

  if (plan.fromSource) {
    lines.push(chalk.red.bold("⚠️⚠️⚠️  DANGER ZONE  ⚠️⚠️⚠️"));
    lines.push("");
    lines.push(
      chalk.red(
        `This will delete from the SOURCE tool (${plan.sourceTool}) AND all targets.`,
      ),
    );
    lines.push(chalk.red("This action CANNOT be undone."));
  } else {
    lines.push(
      chalk.yellow(
        "⚠️  This will remove from target tools only (source unchanged)",
      ),
    );
  }

  lines.push("");

  if (plan.targetTools.length === 0 && !plan.fromSource) {
    lines.push(chalk.gray("Not synced to any targets. Nothing to remove."));
    lines.push("");
    return lines.join("\n");
  }

  lines.push(
    chalk.bold(plan.fromSource ? "Will delete from:" : "Will remove from:"),
  );

  if (plan.fromSource) {
    if (plan.type === "skill") {
      lines.push(
        chalk.red(
          `  • ${plan.sourceTool} (.${plan.sourceTool}/skills/${plan.name}/) ← SOURCE`,
        ),
      );
    } else {
      lines.push(
        chalk.red(`  • ${plan.sourceTool} (mcp server: ${plan.name}) ← SOURCE`),
      );
    }
  }

  for (const tool of plan.targetTools) {
    if (plan.type === "skill") {
      lines.push(`  • ${tool} (.${tool}/skills/${plan.name}/)`);
    } else {
      lines.push(`  • ${tool} (mcp server: ${plan.name})`);
    }
  }

  if (!plan.fromSource) {
    lines.push("");
    lines.push(chalk.gray(`Source (${plan.sourceTool}) will NOT be affected.`));
  }

  lines.push("");

  return lines.join("\n");
}

/**
 * Get synced targets for an item from manifest
 *
 * @param itemKey - Item key (e.g., "skill/name" or "mcp/name")
 * @param manifest - Manifest
 * @returns List of synced target tools
 */
function getSyncedTargets(itemKey: string, manifest: Manifest): ToolName[] {
  const item = manifest.items[itemKey];
  if (!item || !item.targets) {
    return [];
  }

  return Object.entries(item.targets)
    .filter(([_, target]) => target?.synced)
    .map(([toolName]) => toolName as ToolName);
}

/**
 * Remove item from targets and update manifest
 *
 * @param parsed - Parsed item name
 * @param targetTools - Target tools to remove from
 * @param fromSource - Whether to also remove from source
 * @param sourceTool - Source tool name
 * @param projectDir - Project directory
 */
async function removeItem(
  parsed: ParsedItemName,
  targetTools: ToolName[],
  fromSource: boolean,
  sourceTool: ToolName,
  projectDir: string,
  level: ConfigLevel,
): Promise<void> {
  // Remove from source if requested
  if (fromSource) {
    const sourceAdapter = getAdapter({
      tool: sourceTool,
      baseDir: projectDir,
      level,
    });
    const spinner = ora(`Deleting from source (${sourceTool})...`).start();

    try {
      if (parsed.type === "skill") {
        await sourceAdapter.deleteSkill(parsed.name);
      } else {
        await sourceAdapter.deleteMCPServer(parsed.name);
      }
      spinner.succeed(
        chalk.red(`🗑️  ${sourceTool}: ${parsed.type}/${parsed.name} deleted`),
      );
    } catch (error) {
      spinner.fail(`Failed to delete from ${sourceTool}`);
      throw error;
    }
  }

  // Remove from each target
  for (const tool of targetTools) {
    const adapter = getAdapter({ tool, baseDir: projectDir, level });
    const spinner = ora(`Removing from ${tool}...`).start();

    try {
      if (parsed.type === "skill") {
        await adapter.deleteSkill(parsed.name);
      } else {
        await adapter.deleteMCPServer(parsed.name);
      }
      spinner.succeed(
        `${fromSource ? chalk.red("🗑️") : "✓"} ${tool}: ${parsed.type}/${parsed.name} removed`,
      );
    } catch (error) {
      spinner.fail(`Failed to remove from ${tool}`);
      throw error;
    }
  }

  // Update manifest
  const manifest = await loadManifest(projectDir);
  const itemKey = `${parsed.type}/${parsed.name}`;

  if (fromSource) {
    // Remove entire item from manifest
    delete manifest.items[itemKey];
  } else {
    // Remove only target entries
    const item = manifest.items[itemKey];
    if (item && item.targets) {
      for (const tool of targetTools) {
        delete item.targets[tool];
      }

      // If no targets left, remove the item
      if (Object.keys(item.targets).length === 0) {
        delete manifest.items[itemKey];
      }
    }
  }

  await saveManifest(manifest, projectDir);
}

/**
 * Run clean command - Internal use only
 *
 * @param itemName - Optional item name (e.g., "skill/name")
 * @param options - Command options
 */
async function cleanCommand(
  itemName: string | undefined,
  options: { user?: boolean; fromSource?: boolean },
): Promise<void> {
  try {
    const projectDir = options.user ? process.env.HOME || cwd() : cwd();
    const level: ConfigLevel = options.user ? "user" : "project";

    // Load configuration
    const spinner = ora("Loading configuration...").start();
    const config = await loadSyncConfig(projectDir, options.user || false);
    spinner.succeed("Configuration loaded");

    // Load manifest
    const manifest = await loadManifest(projectDir);

    // Single item mode
    if (itemName) {
      const parsed = parseItemName(itemName);
      const itemKey = `${parsed.type}/${parsed.name}`;

      // Check if item exists in manifest
      if (!manifest.items[itemKey]) {
        console.log(
          chalk.yellow(
            `\n⚠️  Item '${itemName}' not found in manifest. Nothing to clean.\n`,
          ),
        );
        return;
      }

      // Get synced targets
      const targetTools = getSyncedTargets(itemKey, manifest);

      // Create clean plan
      const plan: CleanPlan = {
        itemName,
        type: parsed.type,
        name: parsed.name,
        targetTools,
        fromSource: options.fromSource || false,
        sourceTool: config.source_tool,
      };

      // Display plan
      console.log(formatCleanPlan(plan));

      if (targetTools.length === 0 && !options.fromSource) {
        return;
      }

      // Confirm
      if (options.fromSource) {
        // Double confirmation for source deletion
        const { confirmName } = await inquirer.prompt<{ confirmName: string }>([
          {
            type: "input",
            name: "confirmName",
            message: "Type the name to confirm:",
          },
        ]);

        if (confirmName !== parsed.name) {
          console.log(chalk.yellow("\n⚠️  Name mismatch. Cleanup cancelled\n"));
          return;
        }

        const { confirmAbsolute } = await inquirer.prompt<{
          confirmAbsolute: string;
        }>([
          {
            type: "input",
            name: "confirmAbsolute",
            message: "Are you absolutely sure? (yes/no)",
          },
        ]);

        if (confirmAbsolute !== "yes") {
          console.log(chalk.yellow("\n⚠️  Cleanup cancelled\n"));
          return;
        }
      } else {
        const { confirm } = await inquirer.prompt<{ confirm: boolean }>([
          {
            type: "confirm",
            name: "confirm",
            message: "Confirm removal from targets?",
            default: false,
          },
        ]);

        if (!confirm) {
          console.log(chalk.yellow("\n⚠️  Cleanup cancelled\n"));
          return;
        }
      }

      // Execute removal
      console.log(
        chalk.cyan(
          `\n🔧 ${options.fromSource ? "Deleting from source and targets" : "Removing from targets"}...`,
        ),
      );
      await removeItem(
        parsed,
        targetTools,
        options.fromSource || false,
        config.source_tool,
        projectDir,
        level,
      );

      console.log(
        chalk.green(
          `\n✓ ${options.fromSource ? "Deletion" : "Cleanup"} completed`,
        ),
      );
      if (!options.fromSource) {
        console.log(chalk.green("✓ Manifest updated\n"));
      }
    } else {
      // Interactive mode
      const sourceData = await readSourceConfig(
        config.source_tool,
        projectDir,
        level,
      );

      // Ask for type
      const { cleanType } = await inquirer.prompt<{ cleanType: string }>([
        {
          type: "list",
          name: "cleanType",
          message: "What type do you want to clean?",
          choices: ["Skills", "MCP Servers"],
        },
      ]);

      const type = cleanType === "Skills" ? "skill" : "mcp";
      const items =
        type === "skill" ? sourceData.skills : sourceData.mcpServers;

      if (items.length === 0) {
        console.log(
          chalk.yellow(`\n⚠️  No ${cleanType.toLowerCase()} found.\n`),
        );
        return;
      }

      // Multi-select items
      const { selectedItems } = await inquirer.prompt<{
        selectedItems: string[];
      }>([
        {
          type: "checkbox",
          name: "selectedItems",
          message: "Select items to remove from targets:",
          choices: items.map((item) => ({
            name: item.name,
            value: item.name,
          })),
        },
      ]);

      if (selectedItems.length === 0) {
        console.log(
          chalk.yellow("\n⚠️  No items selected. Cleanup cancelled\n"),
        );
        return;
      }

      // Show selected items
      console.log(chalk.bold(`\nSelected items (${selectedItems.length}):`));
      for (const name of selectedItems) {
        console.log(`  • ${type}/${name}`);
      }
      console.log("");

      // Show warning
      console.log(
        chalk.yellow(
          "⚠️  This will remove from target tools only (source unchanged)\n",
        ),
      );

      // Confirm
      const { confirm } = await inquirer.prompt<{ confirm: boolean }>([
        {
          type: "confirm",
          name: "confirm",
          message: "Confirm removal from targets?",
          default: false,
        },
      ]);

      if (!confirm) {
        console.log(chalk.yellow("\n⚠️  Cleanup cancelled\n"));
        return;
      }

      // Execute removal for each selected item
      console.log(chalk.cyan("\n🔧 Removing from targets...\n"));

      for (const name of selectedItems) {
        const itemKey = `${type}/${name}`;
        const targetTools = getSyncedTargets(itemKey, manifest);

        if (targetTools.length === 0) {
          console.log(chalk.gray(`  • ${itemKey}: not synced, skipped`));
          continue;
        }

        await removeItem(
          { type, name },
          targetTools,
          false,
          config.source_tool,
          projectDir,
          level,
        );
      }

      console.log(chalk.green("\n✓ Cleanup completed"));
      console.log(chalk.green("✓ Manifest updated\n"));
    }
  } catch (error) {
    if (error instanceof Error) {
      console.error(chalk.red(`\n❌ Error: ${error.message}\n`));
      process.exit(1);
    }
  }
}

export function createCleanCommand(): Command {
  const command = new Command("clean");

  command
    .description("Remove items from target tools (not from source)")
    .argument(
      "[item]",
      "Item to clean (e.g., 'skill/name' or 'mcp/name'), or omit for interactive mode",
    )
    .option("--user", "Use user-level config instead of project-level")
    .option(
      "--from-source",
      "DANGEROUS: Also delete from source tool (requires confirmation)",
    )
    .action(async (item, options) => {
      await cleanCommand(item, options);
    });

  return command;
}
