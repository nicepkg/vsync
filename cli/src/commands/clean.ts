/**
 * vsync clean command
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
import { ensureConfig } from "@src/utils/config-initializer.js";
import { t } from "@src/utils/i18n.js";
import { readSourceConfig } from "./sync.js";

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
    throw new Error(t("commands.clean.invalidFormat"));
  }

  const [type, name] = parts;
  if (type !== "skill" && type !== "mcp") {
    throw new Error(t("commands.clean.invalidType"));
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
    lines.push(chalk.red.bold(t("commands.clean.dangerZone")));
    lines.push("");
    lines.push(
      chalk.red(
        t("commands.clean.deleteFromSource", { tool: plan.sourceTool }),
      ),
    );
    lines.push(chalk.red(t("commands.clean.cannotUndo")));
  } else {
    lines.push(chalk.yellow(`⚠️  ${t("commands.clean.removeTargetsOnly")}`));
  }

  lines.push("");

  if (plan.targetTools.length === 0 && !plan.fromSource) {
    lines.push(chalk.gray(t("commands.clean.notSynced")));
    lines.push("");
    return lines.join("\n");
  }

  lines.push(
    chalk.bold(
      plan.fromSource
        ? t("commands.clean.willDeleteFrom")
        : t("commands.clean.willRemoveFrom"),
    ),
  );

  if (plan.fromSource) {
    if (plan.type === "skill") {
      lines.push(
        chalk.red(
          `  • ${plan.sourceTool} (.${plan.sourceTool}/skills/${plan.name}/) ${t("commands.clean.sourceLabel")}`,
        ),
      );
    } else {
      lines.push(
        chalk.red(
          `  • ${plan.sourceTool} (mcp server: ${plan.name}) ${t("commands.clean.sourceLabel")}`,
        ),
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
    lines.push(
      chalk.gray(
        t("commands.clean.sourceNotAffected", { tool: plan.sourceTool }),
      ),
    );
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
    const spinner = ora(
      t("commands.clean.deletingFromSource", { tool: sourceTool }),
    ).start();

    try {
      if (parsed.type === "skill") {
        await sourceAdapter.deleteSkill(parsed.name);
      } else {
        await sourceAdapter.deleteMCPServer(parsed.name);
      }
      spinner.succeed(
        chalk.red(
          t("commands.clean.sourceDeleted", {
            tool: sourceTool,
            type: parsed.type,
            name: parsed.name,
          }),
        ),
      );
    } catch (error) {
      spinner.fail(
        t("commands.clean.deleteFromSourceFailed", { tool: sourceTool }),
      );
      throw error;
    }
  }

  // Remove from each target
  for (const tool of targetTools) {
    const adapter = getAdapter({ tool, baseDir: projectDir, level });
    const spinner = ora(t("commands.clean.removingFrom", { tool })).start();

    try {
      if (parsed.type === "skill") {
        await adapter.deleteSkill(parsed.name);
      } else {
        await adapter.deleteMCPServer(parsed.name);
      }
      spinner.succeed(
        `${fromSource ? chalk.red("🗑️") : "✓"} ${tool}: ${t("commands.clean.targetRemoved", { type: parsed.type, name: parsed.name })}`,
      );
    } catch (error) {
      spinner.fail(t("commands.clean.removeFromTargetFailed", { tool }));
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
  options: { user?: boolean; fromSource?: boolean; yes?: boolean },
): Promise<void> {
  try {
    const projectDir = options.user ? process.env.HOME || cwd() : cwd();
    const level: ConfigLevel = options.user ? "user" : "project";

    // Load configuration (with auto-init if needed)
    const spinner = ora(t("commands.clean.loadingConfig")).start();
    const config = await ensureConfig(projectDir, options.user || false, {
      spinner,
      requireFields: ["source_tool", "target_tools"],
    });
    spinner.succeed(t("commands.clean.configLoaded"));
    // Config fields are guaranteed by ensureConfig validation

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
            `\n⚠️  ${t("commands.clean.itemNotFound", { item: itemName })}\n`,
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
        sourceTool: config.source_tool!,
      };

      // Display plan
      console.log(formatCleanPlan(plan));

      if (targetTools.length === 0 && !options.fromSource) {
        return;
      }

      // Confirm (--yes flag does NOT skip dangerous --from-source confirmation)
      if (options.fromSource) {
        // Double confirmation for source deletion (ALWAYS required for safety)
        const { confirmName } = await inquirer.prompt<{ confirmName: string }>([
          {
            type: "input",
            name: "confirmName",
            message: t("commands.clean.typeNameToConfirm"),
          },
        ]);

        if (confirmName !== parsed.name) {
          console.log(
            chalk.yellow(`\n⚠️  ${t("commands.clean.nameMismatch")}\n`),
          );
          return;
        }

        const { confirmAbsolute } = await inquirer.prompt<{
          confirmAbsolute: string;
        }>([
          {
            type: "input",
            name: "confirmAbsolute",
            message: t("commands.clean.absoluteConfirm"),
          },
        ]);

        if (confirmAbsolute !== "yes") {
          console.log(chalk.yellow(`\n⚠️  ${t("commands.clean.cancelled")}\n`));
          return;
        }
      } else if (!options.yes) {
        // Skip standard confirmation if --yes flag is provided
        const { confirm } = await inquirer.prompt<{ confirm: boolean }>([
          {
            type: "confirm",
            name: "confirm",
            message: t("commands.clean.confirmRemoval"),
            default: false,
          },
        ]);

        if (!confirm) {
          console.log(chalk.yellow(`\n⚠️  ${t("commands.clean.cancelled")}\n`));
          return;
        }
      }

      // Execute removal
      console.log(
        chalk.cyan(
          `\n🔧 ${options.fromSource ? t("commands.clean.deletingFromSourceAndTargets") : t("commands.clean.removingFromTargets")}`,
        ),
      );
      await removeItem(
        parsed,
        targetTools,
        options.fromSource || false,
        config.source_tool!,
        projectDir,
        level,
      );

      console.log(
        chalk.green(
          `\n✓ ${options.fromSource ? t("commands.clean.deletionComplete") : t("commands.clean.cleanupComplete")}`,
        ),
      );
      if (!options.fromSource) {
        console.log(chalk.green(`✓ ${t("commands.clean.manifestUpdated")}\n`));
      }
    } else {
      // Interactive mode
      const sourceData = await readSourceConfig(
        config.source_tool!,
        projectDir,
        level,
      );

      // Ask for type
      const { cleanType } = await inquirer.prompt<{ cleanType: string }>([
        {
          type: "select",
          name: "cleanType",
          message: t("commands.clean.selectType"),
          choices: [
            t("commands.clean.skillsChoice"),
            t("commands.clean.mcpServersChoice"),
          ],
        },
      ]);

      const type =
        cleanType === t("commands.clean.skillsChoice") ? "skill" : "mcp";
      const items =
        type === "skill" ? sourceData.skills : sourceData.mcpServers;

      if (items.length === 0) {
        console.log(
          chalk.yellow(
            `\n⚠️  ${t("commands.clean.noItemsFound", { type: cleanType.toLowerCase() })}\n`,
          ),
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
          message: t("commands.clean.selectItems"),
          choices: items.map((item) => ({
            name: item.name,
            value: item.name,
          })),
        },
      ]);

      if (selectedItems.length === 0) {
        console.log(
          chalk.yellow(`\n⚠️  ${t("commands.clean.noItemsSelected")}\n`),
        );
        return;
      }

      // Show selected items
      console.log(
        chalk.bold(
          `\n${t("commands.clean.selectedItems", { count: selectedItems.length })}`,
        ),
      );
      for (const name of selectedItems) {
        console.log(`  • ${type}/${name}`);
      }
      console.log("");

      // Show warning
      console.log(
        chalk.yellow(`⚠️  ${t("commands.clean.removeTargetsOnly")}\n`),
      );

      // Confirm (skip if --yes flag is provided)
      if (!options.yes) {
        const { confirm } = await inquirer.prompt<{ confirm: boolean }>([
          {
            type: "confirm",
            name: "confirm",
            message: t("commands.clean.confirmRemoval"),
            default: false,
          },
        ]);

        if (!confirm) {
          console.log(chalk.yellow(`\n⚠️  ${t("commands.clean.cancelled")}\n`));
          return;
        }
      }

      // Execute removal for each selected item
      console.log(
        chalk.cyan(`\n🔧 ${t("commands.clean.removingFromTargets")}\n`),
      );

      for (const name of selectedItems) {
        const itemKey = `${type}/${name}`;
        const targetTools = getSyncedTargets(itemKey, manifest);

        if (targetTools.length === 0) {
          console.log(
            chalk.gray(
              `  • ${itemKey}: ${t("commands.clean.notSyncedSkipped")}`,
            ),
          );
          continue;
        }

        await removeItem(
          { type, name },
          targetTools,
          false,
          config.source_tool!,
          projectDir,
          level,
        );
      }

      console.log(chalk.green(`\n✓ ${t("commands.clean.cleanupComplete")}`));
      console.log(chalk.green(`✓ ${t("commands.clean.manifestUpdated")}\n`));
    }
  } catch (error) {
    if (error instanceof Error) {
      console.error(chalk.red(`\n❌ ${t("common.error")}: ${error.message}\n`));
      process.exit(1);
    }
  }
}

export function createCleanCommand(): Command {
  const command = new Command("clean");

  command
    .description(t("commands.clean.description"))
    .argument("[item]", t("commands.clean.itemArgument"))
    .option("--user", t("commands.clean.userLevelOption"))
    .option("--from-source", t("commands.clean.fromSourceOption"))
    .option("-y, --yes", t("commands.clean.yesOption"))
    .action(async (item, options) => {
      await cleanCommand(item, options);
    });

  return command;
}
