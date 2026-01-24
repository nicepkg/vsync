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
import {
  createEmptyManifest,
  saveManifest,
} from "@src/core/manifest-manager.js";
import type { ToolName, VibeConfig, ConfigLevel } from "@src/types/config.js";
import { atomicWrite } from "@src/utils/atomic-write.js";

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

  const toolDirs: Record<ToolName, string> = {
    "claude-code": ".claude",
    cursor: ".cursor",
    opencode: ".opencode",
    codex: ".codex",
  };

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
export async function initCommand(options: { user?: boolean }): Promise<void> {
  try {
    const projectDir = options.user ? process.env.HOME || cwd() : cwd();

    console.log(chalk.bold("\n🎯 vibe-sync initialization\n"));

    // Detect existing tools
    const spinner = ora("Detecting installed tools...").start();
    const detected = await detectTools(projectDir);
    spinner.succeed(
      `Detected tools: ${detected.length > 0 ? detected.join(", ") : "none"}`,
    );

    // Prompt for tools
    const toolsAnswer = await inquirer.prompt<{ tools: ToolName[] }>([
      {
        type: "checkbox",
        name: "tools",
        message: "Which tools do you want to sync?",
        choices: [
          {
            name: "Claude Code",
            value: "claude-code",
            checked: detected.includes("claude-code"),
          },
          {
            name: "Cursor",
            value: "cursor",
            checked: detected.includes("cursor"),
          },
          {
            name: "OpenCode",
            value: "opencode",
            checked: detected.includes("opencode"),
          },
        ],
        validate: (input: string[]) => {
          if (input.length === 0) {
            return "Please select at least one tool";
          }
          return true;
        },
      },
    ]);

    // Prompt for source tool
    const sourceAnswer = await inquirer.prompt<{ source: ToolName }>([
      {
        type: "list",
        name: "source",
        message: "Which tool should be the source of truth?",
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
        message: "What would you like to sync?",
        choices: [
          { name: "Skills", value: "skills", checked: true },
          { name: "MCP Servers", value: "mcp", checked: true },
        ],
        validate: (input: string[]) => {
          if (input.length === 0) {
            return "Please select at least one item to sync";
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
    const saveSpinner = ora("Creating configuration...").start();
    await saveConfig(config, projectDir);
    saveSpinner.succeed("Created .vibe-sync.json");

    // Create cache directory
    const cacheSpinner = ora("Creating cache directory...").start();
    await createCacheDirectory(projectDir);
    cacheSpinner.succeed("Created .vibe-sync-cache/");

    // Initialize manifest
    const manifestSpinner = ora("Initializing manifest...").start();
    await initializeManifest(projectDir);
    manifestSpinner.succeed("Created manifest.json");

    console.log(
      chalk.green(
        `\n✅ Initialization complete! Run ${chalk.bold("vibe-sync sync")} to start syncing.\n`,
      ),
    );
  } catch (error) {
    if (error instanceof Error) {
      console.error(chalk.red(`\n❌ Error: ${error.message}\n`));
      process.exit(1);
    }
  }
}

export function createInitCommand(): Command {
  const command = new Command("init");

  command
    .description("Initialize vibe-sync configuration")
    .option("--user", "Create user-level config instead of project-level")
    .action(async (options) => {
      await initCommand(options);
    });

  return command;
}
