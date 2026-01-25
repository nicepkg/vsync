/**
 * Language preference management
 * Stores user language preference independently from project config
 */

import { readFile, mkdir } from "node:fs/promises";
import { homedir } from "node:os";
import { join, dirname } from "node:path";
import chalk from "chalk";
import inquirer from "inquirer";
import { atomicWrite } from "@src/utils/atomic-write.js";
import {
  detectSystemLanguage,
  setLanguage,
  type Language,
} from "@src/utils/i18n.js";

/**
 * Get language preference file path
 * Stored in ~/.vibe-sync/language.json
 */
function getLanguageFilePath(): string {
  return join(homedir(), ".vibe-sync", "language.json");
}

/**
 * Load saved language preference
 * Returns null if not found
 */
async function loadLanguagePreference(): Promise<Language | null> {
  const filePath = getLanguageFilePath();

  try {
    const content = await readFile(filePath, "utf-8");
    const data = JSON.parse(content) as { language: Language };
    return data.language;
  } catch (error) {
    // File doesn't exist or invalid JSON
    return null;
  }
}

/**
 * Save language preference
 */
async function saveLanguagePreference(language: Language): Promise<void> {
  const filePath = getLanguageFilePath();
  const dir = dirname(filePath);

  // Ensure directory exists
  await mkdir(dir, { recursive: true });

  // Save preference
  const content = JSON.stringify({ language }, null, 2);
  await atomicWrite(filePath, content);
}

/**
 * Ensure language is configured
 * Prompts user to select language if not already set
 *
 * @returns Configured language
 */
export async function ensureLanguageConfig(): Promise<Language> {
  // Try to load saved preference
  const savedLang = await loadLanguagePreference();

  if (savedLang) {
    // Language already configured, use it
    await setLanguage(savedLang);
    return savedLang;
  }

  // No preference saved, detect system language
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

  // Save preference
  await saveLanguagePreference(language);

  // Set language
  await setLanguage(language);

  console.log(
    chalk.green(`\n✓ Language preference saved to ${getLanguageFilePath()}\n`),
  );

  return language;
}
