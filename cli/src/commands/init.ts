/**
 * vibe-sync init command
 * Initialize vibe-sync configuration
 */

import { access, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { cwd } from "node:process";
import chalk from "chalk";
import { Command } from "commander";
import inquirer from "inquirer";
import ora from "ora";
import { getAllConfigDirs, getToolChoices } from "@src/adapters/registry.js";
import {
  createEmptyManifest,
  saveManifest,
} from "@src/core/manifest-manager.js";
import type { ToolName, VibeConfig, ConfigLevel } from "@src/types/config.js";
import { atomicWrite } from "@src/utils/atomic-write.js";
import { t } from "@src/utils/i18n.js";

/**
 * Options for config generation
 */
export interface ConfigOptions {
  tools: ToolName[];
  source: ToolName;
  syncItems: string[];
  isUserLevel: boolean;
}

/**
 * Detect existing tool directories
 *
 * @param projectDir - Project directory to check
 * @returns Array of detected tool names
 */
export async function detectTools(projectDir: string): Promise<ToolName[]> {
  const detected: ToolName[] = [];

  // Get config directories from registry (no hardcoding!)
  const toolDirs = getAllConfigDirs();

  for (const [tool, dir] of Object.entries(toolDirs)) {
    try {
      await access(join(projectDir, dir));
      detected.push(tool as ToolName);
    } catch {
      // Directory doesn't exist, skip
    }
  }

  return detected;
}

/**
 * Generate vibe-sync configuration from user selections
 *
 * @param options - User selections
 * @returns Generated config
 */
export async function generateConfig(
  options: ConfigOptions,
): Promise<VibeConfig> {
  // Validate inputs
  if (options.tools.length === 0) {
    throw new Error("At least one tool must be selected");
  }

  if (!options.tools.includes(options.source)) {
    throw new Error("Source tool must be one of the selected tools");
  }

  if (options.syncItems.length === 0) {
    throw new Error("At least one sync item must be selected");
  }

  // Build config
  const level: ConfigLevel = options.isUserLevel ? "user" : "project";

  const config: VibeConfig = {
    version: "1.0.0",
    level,
    source_tool: options.source,
    target_tools: options.tools.filter((t) => t !== options.source),
    sync_config: {
      skills: options.syncItems.includes("skills"),
      mcp: options.syncItems.includes("mcp"),
    },
  };

  return config;
}

/**
 * Save config to disk
 *
 * @param config - Config to save
 * @param projectDir - Project directory
 */
export async function saveConfig(
  config: VibeConfig,
  projectDir: string,
): Promise<void> {
  const configPath = join(projectDir, ".vibe-sync.json");
  const content = JSON.stringify(config, null, 2);

  await atomicWrite(configPath, content);
}

/**
 * Create .vibe-sync-cache directory
 *
 * @param projectDir - Project directory
 */
export async function createCacheDirectory(projectDir: string): Promise<void> {
  const cacheDir = join(projectDir, ".vibe-sync-cache");

  try {
    await mkdir(cacheDir, { recursive: true });
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code !== "EEXIST") {
      throw error;
    }
  }
}

/**
 * Initialize empty manifest
 *
 * @param projectDir - Project directory
 */
export async function initializeManifest(projectDir: string): Promise<void> {
  const manifest = createEmptyManifest();
  await saveManifest(manifest, projectDir);
}

/**
 * Run init command with interactive prompts
 *
 * @param options - Command options
 */
async function initCommand(options: { user?: boolean }): Promise<void> {
  try {
    const projectDir = options.user ? process.env.HOME || cwd() : cwd();

    console.log(chalk.bold(`\n${t("commands.init.welcome")}\n`));

    // Detect existing tools
    const spinner = ora(t("commands.init.detectingTools")).start();
    const detected = await detectTools(projectDir);
    spinner.succeed(
      t("commands.init.detectedTools", {
        tools: detected.length > 0 ? detected.join(", ") : "none",
      }),
    );

    // Prompt for tools
    const toolsAnswer = await inquirer.prompt<{ tools: ToolName[] }>([
      {
        type: "checkbox",
        name: "tools",
        message: t("commands.init.selectTools"),
        // Get choices from registry (no hardcoding!)
        choices: getToolChoices(detected),
        validate: (input: string[]) => {
          if (input.length === 0) {
            return t("commands.init.selectToolsValidation");
          }
          return true;
        },
      },
    ]);

    // Prompt for source tool
    const sourceAnswer = await inquirer.prompt<{ source: ToolName }>([
      {
        type: "select",
        name: "source",
        message: t("commands.init.selectSource"),
        choices: toolsAnswer.tools.map((tool) => ({
          name: tool,
          value: tool,
        })),
      },
    ]);

    // Prompt for sync items
    const syncAnswer = await inquirer.prompt<{ syncItems: string[] }>([
      {
        type: "checkbox",
        name: "syncItems",
        message: t("commands.init.selectSyncItems"),
        choices: [
          {
            name: t("commands.init.skillsChoice"),
            value: "skills",
            checked: true,
          },
          { name: t("commands.init.mcpChoice"), value: "mcp", checked: true },
        ],
        validate: (input: string[]) => {
          if (input.length === 0) {
            return t("commands.init.selectSyncItemsValidation");
          }
          return true;
        },
      },
    ]);

    // Generate config
    const config = await generateConfig({
      tools: toolsAnswer.tools,
      source: sourceAnswer.source,
      syncItems: syncAnswer.syncItems,
      isUserLevel: options.user || false,
    });

    // Save config
    const saveSpinner = ora(t("commands.init.creatingConfig")).start();
    await saveConfig(config, projectDir);
    saveSpinner.succeed(t("commands.init.configCreated"));

    // Create cache directory
    const cacheSpinner = ora(t("commands.init.creatingCache")).start();
    await createCacheDirectory(projectDir);
    cacheSpinner.succeed(t("commands.init.cacheCreated"));

    // Initialize manifest
    const manifestSpinner = ora(
      t("commands.init.initializingManifest"),
    ).start();
    await initializeManifest(projectDir);
    manifestSpinner.succeed(t("commands.init.manifestCreated"));

    console.log(
      chalk.green(
        `\n✅ ${t("commands.init.complete", { command: chalk.bold("vibe-sync sync") })}\n`,
      ),
    );
  } catch (error) {
    if (error instanceof Error) {
      console.error(chalk.red(`\n❌ ${t("common.error")}: ${error.message}\n`));
      process.exit(1);
    }
  }
}

export function createInitCommand(): Command {
  const command = new Command("init");

  command
    .description(t("commands.init.description"))
    .option("--user", t("commands.init.userLevelOption"))
    .action(async (options) => {
      await initCommand(options);
    });

  return command;
}
