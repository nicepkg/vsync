/**
 * i18n Utilities - Lightweight internationalization support
 *
 * Design Principles:
 * - Single Responsibility: Handles only translation and language management
 * - High Cohesion: All i18n logic in one module
 * - Low Coupling: No external dependencies except Node.js fs
 * - DRY: Single translate function with parameter interpolation
 */

import { readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Supported languages
 */
export type Language = "en" | "zh";

/**
 * Translation data structure
 */
type Translations = Record<string, any>;

/**
 * Current language and loaded translations
 */
let currentLanguage: Language = "en";
let translations: Translations = {};

/**
 * Get the locales directory path
 * Handles both ESM (__dirname not available) and test environments
 */
function getLocalesDir(): string {
  // Check for test environment with mocked __dirname
  if (typeof (globalThis as any).__dirname === "string") {
    return join((globalThis as any).__dirname, "..", "locales");
  }

  try {
    // Try ESM approach for production
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    return join(__dirname, "..", "locales");
  } catch {
    // Final fallback
    return join(process.cwd(), "src", "locales");
  }
}

/**
 * Detect system language from environment variables
 *
 * @returns Detected language code or 'en' as default
 */
export function detectSystemLanguage(): Language {
  const lang = process.env.LANG || process.env.LANGUAGE || "";

  // Extract language code (e.g., "zh_CN.UTF-8" -> "zh")
  const langCode = lang.split(/[_.-]/)[0]?.toLowerCase();

  // Map to supported languages
  if (langCode === "zh" || langCode === "cn") {
    return "zh";
  }

  // Default to English
  return "en";
}

/**
 * Load translations for a specific language
 *
 * @param lang - Language code to load
 * @throws Error if language is unsupported or file cannot be loaded
 */
export async function loadLanguage(lang: Language): Promise<void> {
  // Validate language
  if (lang !== "en" && lang !== "zh") {
    throw new Error(`Unsupported language: ${lang}`);
  }

  try {
    const localesDir = getLocalesDir();
    const filePath = join(localesDir, `${lang}.json`);
    const content = await readFile(filePath, "utf-8");

    translations = JSON.parse(content);
    currentLanguage = lang;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(
        `Failed to load language ${lang}: ${error.message}`,
        error,
      );
    }
    throw error;
  }
}

/**
 * Set language (alias for loadLanguage for better DX)
 *
 * @param lang - Language code to set
 */
export async function setLanguage(lang: Language): Promise<void> {
  await loadLanguage(lang);
}

/**
 * Get current language
 *
 * @returns Current language code
 */
export function getCurrentLanguage(): Language {
  return currentLanguage;
}

/**
 * Get nested value from object using dot notation
 *
 * @param obj - Object to traverse
 * @param path - Dot-separated path (e.g., "common.yes")
 * @returns Value at path or undefined
 */
function getNestedValue(obj: any, path: string): string | undefined {
  const keys = path.split(".");
  let current = obj;

  for (const key of keys) {
    if (current === undefined || current === null) {
      return undefined;
    }
    current = current[key];
  }

  return typeof current === "string" ? current : undefined;
}

/**
 * Interpolate parameters in translation string
 *
 * Replaces {paramName} with corresponding value from params object
 *
 * @param str - Translation string with placeholders
 * @param params - Parameter values
 * @returns Interpolated string
 */
function interpolate(
  str: string,
  params?: Record<string, string | number>,
): string {
  if (!params) {
    return str;
  }

  return str.replace(/\{(\w+)\}/g, (match, key) => {
    const value = params[key];
    return value !== undefined ? String(value) : match;
  });
}

/**
 * Translate a key to current language
 *
 * Supports:
 * - Nested keys using dot notation (e.g., "commands.init.welcome")
 * - Parameter interpolation (e.g., "Found {count} skills")
 * - Fallback to key if translation not found
 *
 * @param key - Translation key (dot-separated path)
 * @param params - Optional parameters for interpolation
 * @returns Translated and interpolated string
 *
 * @example
 * t("common.yes") // "Yes" or "是"
 * t("commands.sync.reading", { tool: "claude-code" })
 * // "Reading source (claude-code)..." or "正在读取源配置 (claude-code)..."
 */
export function t(
  key: string,
  params?: Record<string, string | number>,
): string {
  const translation = getNestedValue(translations, key);

  // Fallback to key if translation not found
  if (translation === undefined) {
    return key;
  }

  return interpolate(translation, params);
}

/**
 * Initialize i18n with default language
 * Call this once at application startup
 *
 * @param lang - Optional language override (defaults to system language)
 */
export async function initI18n(lang?: Language): Promise<void> {
  const language = lang || detectSystemLanguage();
  await loadLanguage(language);
}
