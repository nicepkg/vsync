/**
 * Configuration loader with auto-init prompt
 * Ensures configuration exists before running commands
 */

import chalk from "chalk";
import inquirer from "inquirer";
import ora from "ora";
import { loadConfig } from "@src/core/config-manager.js";
import type { VibeConfig } from "@src/types/config.js";
import { ensureLanguageConfig } from "@src/utils/language-config.js";

/**
 * Ensure configuration exists, prompting user to initialize if not found
 *
 * @param projectDir - Project directory
 * @param isUserLevel - Whether to use user-level config
 * @param spinner - Optional spinner to update during process
 * @returns Loaded or newly created config
 */
export async function ensureConfig(
  projectDir: string,
  isUserLevel: boolean,
  spinner?: ReturnType<typeof ora>,
): Promise<VibeConfig> {
  // Always ensure language is configured first (user-level)
  await ensureLanguageConfig();

  const level = isUserLevel ? "user" : "project";

  try {
    const config = await loadConfig(level, projectDir);
    return config;
  } catch (error) {
    // Check if it's a "config not found" error
    if (
      error instanceof Error &&
      error.message.includes("Configuration file not found")
    ) {
      if (spinner) {
        spinner.fail("Configuration file not found");
      }

      // Ask user if they want to initialize
      const { shouldInit } = await inquirer.prompt<{ shouldInit: boolean }>([
        {
          type: "confirm",
          name: "shouldInit",
          message: chalk.yellow(
            "⚠️  No configuration found. Would you like to initialize vibe-sync now?",
          ),
          default: true,
        },
      ]);

      if (!shouldInit) {
        console.log(
          chalk.gray(
            "\n💡 You can run 'vibe-sync init' later to set up the configuration.\n",
          ),
        );
        process.exit(0);
      }

      // Run init flow
      console.log(chalk.bold("\n🚀 Let's set up vibe-sync!\n"));

      // Import init functions
      const {
        detectTools,
        generateConfig,
        saveConfig: saveInitConfig,
      } = await import("@src/commands/init.js");
      const { getToolChoices } = await import("@src/adapters/registry.js");
      const { t } = await import("@src/utils/i18n.js");

      // Detect existing tools
      const detectSpinner = ora(t("commands.init.detectingTools")).start();
      const detected = await detectTools(projectDir);
      detectSpinner.succeed(
        t("commands.init.detectedTools", {
          tools: detected.length > 0 ? detected.join(", ") : "none",
        }),
      );

      // Prompt for tools
      const toolsAnswer = await inquirer.prompt<{ tools: string[] }>([
        {
          type: "checkbox",
          name: "tools",
          message: t("commands.init.selectTools"),
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
      const sourceAnswer = await inquirer.prompt<{ source: string }>([
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
          validate: (input: string[]) => {
            if (input.length === 0) {
              return t("commands.init.selectSyncItemsValidation");
            }
            return true;
          },
        },
      ]);

      // Generate and save config
      const config = await generateConfig({
        tools: toolsAnswer.tools as any,
        source: sourceAnswer.source as any,
        syncItems: syncAnswer.syncItems,
        isUserLevel,
      });

      const saveSpinner = ora(t("commands.init.creatingConfig")).start();
      await saveInitConfig(config, projectDir);
      saveSpinner.succeed(t("commands.init.configCreated"));

      console.log(chalk.green("\n✅ Configuration complete! Continuing...\n"));

      return config;
    } else {
      // Re-throw other errors
      throw error;
    }
  }
}
