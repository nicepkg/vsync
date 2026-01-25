/**
 * Language preference management
 * Ensures user-level language configuration exists
 */

import { homedir } from "node:os";
import chalk from "chalk";
import inquirer from "inquirer";
import { loadConfig, saveConfig } from "@src/core/config-manager.js";
import type { VibeConfig } from "@src/types/config.js";
import {
  detectSystemLanguage,
  setLanguage,
  type Language,
} from "@src/utils/i18n.js";

/**
 * Ensure user-level language configuration exists
 * Checks ~/.vibe-sync.json for language preference
 * If not found, prompts user and creates minimal user config
 *
 * @returns Configured language
 */
export async function ensureLanguageConfig(): Promise<Language> {
  try {
    // Try to load user-level config
    const userConfig = await loadConfig("user", homedir());

    // If language is set, use it
    if (userConfig.language) {
      await setLanguage(userConfig.language);
      return userConfig.language;
    }
  } catch {
    // User config doesn't exist or can't be loaded
    // Will create minimal config below
  }

  // No language configured, detect system language
  const systemLang = detectSystemLanguage();

  // Ask user to confirm or choose language
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

  // Try to update existing user config
  try {
    const existingConfig = await loadConfig("user", homedir());
    existingConfig.language = language;
    await saveConfig(existingConfig, "user", homedir());
  } catch {
    // User config doesn't exist, create minimal config with language only
    const minimalConfig: VibeConfig = {
      version: "1.0.0",
      level: "user",
      language,
    };

    await saveConfig(minimalConfig, "user", homedir());
    console.log(
      chalk.gray(`\n✓ Language preference saved to ~/.vibe-sync.json\n`),
    );
  }

  // Set language
  await setLanguage(language);
  return language;
}
