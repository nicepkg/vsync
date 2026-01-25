/**
 * Language Detection & Prompt
 *
 * Handles first-run language detection and user preference prompts.
 * Integrates with user-level config to persist language choice.
 *
 * Design Principles:
 * - Single Responsibility: Only handles language initialization flow
 * - High Cohesion: All language prompt logic in one module
 * - Low Coupling: Uses existing config-manager and i18n modules
 * - User-Centric: Prompts only on first run (no user config)
 */

import { access } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import inquirer from "inquirer";
import { loadConfig, saveConfig } from "@src/core/config-manager.js";
import type { VibeConfig } from "@src/types/config.js";
import {
  detectSystemLanguage,
  initI18n,
  type Language,
} from "@src/utils/i18n.js";

/**
 * Check if we should prompt for language preference
 *
 * Returns true if user config doesn't exist (first run)
 *
 * @param userDir - User home directory (defaults to homedir())
 * @returns True if should prompt, false otherwise
 */
export async function shouldPromptForLanguage(
  userDir?: string,
): Promise<boolean> {
  const dir = userDir ?? homedir();
  const configPath = join(dir, ".vibe-sync.json");

  try {
    await access(configPath);
    return false; // Config exists, don't prompt
  } catch (error: unknown) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return true; // Config doesn't exist, should prompt
    }
    return false; // Other error (e.g., permission denied), don't prompt
  }
}

/**
 * Prompt user for language preference
 *
 * Shows bilingual prompt: "选择语言 / Choose language:"
 * Options: "中文" (zh) / "English" (en)
 *
 * @returns Selected language code
 */
export async function promptForLanguage(): Promise<Language> {
  const answer = await inquirer.prompt<{ language: Language }>([
    {
      type: "list",
      name: "language",
      message: "Choose language / 选择语言:",
      choices: [
        { name: "English", value: "en" },
        { name: "中文", value: "zh" },
      ],
    },
  ]);

  return answer.language;
}

/**
 * Initialize i18n with language detection and optional prompting
 *
 * Flow:
 * 1. Check if user config exists
 * 2. If exists:
 *    - Load language from config
 *    - Fall back to system language if not set
 * 3. If not exists and prompt enabled:
 *    - Prompt user for language
 *    - Create minimal user config with language preference
 * 4. If not exists and prompt disabled:
 *    - Use system language (no config created)
 * 5. Initialize i18n with selected language
 *
 * @param shouldPrompt - Whether to prompt if config doesn't exist (default: true)
 * @param userDir - User home directory (defaults to homedir())
 */
export async function initializeLanguage(
  shouldPrompt = true,
  userDir?: string,
): Promise<void> {
  let selectedLanguage: Language;

  try {
    // Try to load existing user config
    const userConfig = await loadConfig("user", undefined, userDir);

    // Use language from config, or fall back to system language
    selectedLanguage = userConfig.language ?? detectSystemLanguage();
  } catch {
    // User config doesn't exist or is invalid
    if (shouldPrompt) {
      // Prompt user for language preference
      selectedLanguage = await promptForLanguage();

      // Create minimal user config with language preference
      const minimalConfig: VibeConfig = {
        version: "1.0.0",
        level: "user",
        source_tool: "claude-code", // Placeholder (will be set by init command)
        target_tools: [],
        sync_config: {
          skills: true,
          mcp: true,
        },
        language: selectedLanguage,
      };

      // Save to user config
      await saveConfig(minimalConfig, "user", undefined, userDir);
    } else {
      // Use system language without prompting or saving
      selectedLanguage = detectSystemLanguage();
    }
  }

  // Initialize i18n with selected language
  await initI18n(selectedLanguage);
}
