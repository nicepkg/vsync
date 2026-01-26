/**
 * Configuration Initialization
 * Handles user interaction for config setup (UI layer)
 *
 * Separation of Concerns:
 * - This module handles UI (inquirer prompts)
 * - core/config-manager handles pure config operations
 */

import { homedir } from "node:os";
import chalk from "chalk";
import inquirer from "inquirer";
import ora from "ora";
import {
  loadConfig,
  saveConfig,
  type RequiredConfigField,
} from "@src/core/config-manager.js";
import type { VibeConfig } from "@src/types/config.js";
import {
  detectSystemLanguage,
  setLanguage,
  t,
  type Language,
} from "@src/utils/i18n.js";

/**
 * Ensure user-level language configuration exists
 */
export async function ensureLanguageConfig(): Promise<Language> {
  try {
    const userConfig = await loadConfig("user", homedir());
    if (userConfig.language) {
      await setLanguage(userConfig.language);
      return userConfig.language;
    }
  } catch {
    // User config doesn't exist
  }

  const systemLang = detectSystemLanguage();

  const { language } = await inquirer.prompt<{ language: Language }>([
    {
      type: "select",
      name: "language",
      message: "Choose your preferred language / 选择你的语言偏好:",
      choices: [
        {
          name: `English (detected: ${systemLang === "en" ? "✓" : "×"})`,
          value: "en",
        },
        {
          name: `中文 (detected: ${systemLang === "zh" ? "✓" : "×"})`,
          value: "zh",
        },
      ],
      default: systemLang,
    },
  ]);

  try {
    const existingConfig = await loadConfig("user", homedir());
    existingConfig.language = language;
    await saveConfig(existingConfig, "user", homedir());
  } catch {
    const minimalConfig: VibeConfig = {
      version: "1.0.0",
      level: "user",
      language,
    };
    await saveConfig(minimalConfig, "user", homedir());
    console.log(chalk.gray(`\n✓ Language preference saved to ~/.vsync.json\n`));
  }

  await setLanguage(language);
  return language;
}

export interface EnsureConfigOptions {
  spinner?: ReturnType<typeof ora>;
  requireFields?: RequiredConfigField[];
}

/**
 * Ensure configuration exists, prompts if needed
 */
export async function ensureConfig(
  projectDir: string,
  isUserLevel: boolean,
  options?: EnsureConfigOptions,
): Promise<VibeConfig> {
  await ensureLanguageConfig();

  const level = isUserLevel ? "user" : "project";
  const spinner = options?.spinner;
  const requireFields = options?.requireFields || [];

  try {
    const config = await loadConfig(level, projectDir);

    const missingFields: string[] = [];
    for (const field of requireFields) {
      if (config[field] === undefined) {
        missingFields.push(field);
      }
    }

    if (missingFields.length === 0) {
      return config;
    }

    if (spinner) {
      spinner.fail(
        `Configuration is missing required fields: ${missingFields.join(", ")}`,
      );
    }

    const { shouldInit } = await inquirer.prompt<{ shouldInit: boolean }>([
      {
        type: "confirm",
        name: "shouldInit",
        message: chalk.yellow(
          `⚠️  Missing fields (${missingFields.join(", ")}). Run init?`,
        ),
        default: true,
      },
    ]);

    if (!shouldInit) {
      console.log(chalk.gray("\n💡 Run 'vsync init' later.\n"));
      process.exit(0);
    }

    return await runInitFlow(projectDir, isUserLevel);
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes("Configuration file not found")
    ) {
      if (spinner) {
        spinner.fail("Configuration file not found");
      }

      const { shouldInit } = await inquirer.prompt<{ shouldInit: boolean }>([
        {
          type: "confirm",
          name: "shouldInit",
          message: chalk.yellow("⚠️  No config found. Initialize now?"),
          default: true,
        },
      ]);

      if (!shouldInit) {
        console.log(chalk.gray("\n💡 Run 'vsync init' later.\n"));
        process.exit(0);
      }

      return await runInitFlow(projectDir, isUserLevel);
    } else {
      throw error;
    }
  }
}

async function runInitFlow(
  projectDir: string,
  isUserLevel: boolean,
): Promise<VibeConfig> {
  console.log(chalk.bold("\n🚀 Let's set up vsync!\n"));

  const {
    detectTools,
    generateConfig,
    saveConfig: saveInitConfig,
  } = await import("@src/commands/init.js");
  const { getToolChoices } = await import("@src/adapters/registry.js");

  const detectSpinner = ora(t("commands.init.detectingTools")).start();
  const detected = await detectTools(projectDir);
  detectSpinner.succeed(
    t("commands.init.detectedTools", {
      tools: detected.length > 0 ? detected.join(", ") : "none",
    }),
  );

  const toolsAnswer = await inquirer.prompt<{ tools: string[] }>([
    {
      type: "checkbox",
      name: "tools",
      message: t("commands.init.selectTools"),
      choices: getToolChoices(detected),
      validate: (input: string[]) =>
        input.length === 0 ? t("commands.init.selectToolsValidation") : true,
    },
  ]);

  const sourceAnswer = await inquirer.prompt<{ source: string }>([
    {
      type: "select",
      name: "source",
      message: t("commands.init.selectSource"),
      choices: toolsAnswer.tools.map((tool) => ({ name: tool, value: tool })),
    },
  ]);

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
        {
          name: t("commands.init.agentsChoiceInit"),
          value: "agents",
          checked: true,
        },
        {
          name: t("commands.init.commandsChoiceInit"),
          value: "commands",
          checked: true,
        },
      ],
      validate: (input: string[]) =>
        input.length === 0
          ? t("commands.init.selectSyncItemsValidation")
          : true,
    },
  ]);

  const config = await generateConfig({
    tools: toolsAnswer.tools as never,
    source: sourceAnswer.source as never,
    syncItems: syncAnswer.syncItems,
    isUserLevel,
  });

  const saveSpinner = ora(t("commands.init.creatingConfig")).start();
  await saveInitConfig(config, projectDir);
  saveSpinner.succeed(t("commands.init.configCreated"));

  console.log(chalk.green("\n✅ Configuration complete! Continuing...\n"));

  return config;
}
