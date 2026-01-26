/**
 * Configuration manager for .vibe-sync.json
 * Pure config operations (no UI logic)
 *
 * Separation of Concerns:
 * - This module: Pure config read/write/validate
 * - utils/config-initializer: UI interaction for setup
 */

import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { cwd } from "node:process";
import { ZodError, type ZodIssue } from "zod";
import { getAvailableTools } from "@src/adapters/registry.js";
import type { VibeConfig, ConfigLevel } from "@src/types/config.js";
import { createVibeConfigSchema } from "@src/types/config.js";
import { atomicWrite } from "@src/utils/atomic-write.js";

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Get configuration file path
 *
 * @param level - Config level (project or user)
 * @param projectDir - Project directory (defaults to cwd)
 * @param userDir - User home directory (defaults to homedir)
 * @returns Absolute path to config file
 */
export function getConfigPath(
  level: ConfigLevel,
  projectDir?: string,
  userDir?: string,
): string {
  if (level === "project") {
    const dir = projectDir ?? cwd();
    return join(dir, ".vibe-sync.json");
  } else {
    const dir = userDir ?? homedir();
    return join(dir, ".vibe-sync.json");
  }
}

/**
 * Load configuration from disk
 *
 * @param level - Config level
 * @param projectDir - Project directory (optional)
 * @param userDir - User home directory (optional)
 * @returns Parsed configuration
 * @throws Error if file doesn't exist or is invalid
 */
export async function loadConfig(
  level: ConfigLevel,
  projectDir?: string,
  userDir?: string,
): Promise<VibeConfig> {
  const configPath = getConfigPath(level, projectDir, userDir);

  try {
    const content = await readFile(configPath, "utf-8");
    const config = JSON.parse(content) as VibeConfig;

    // Validate loaded config
    const validation = validateConfig(config);
    if (!validation.valid) {
      throw new Error(`Invalid configuration: ${validation.errors.join(", ")}`);
    }

    return config;
  } catch (error) {
    if (error instanceof Error) {
      if ("code" in error && error.code === "ENOENT") {
        throw new Error(
          `Configuration file not found: ${configPath}. Run 'vibe-sync init' first.`,
        );
      }
      throw error;
    }
    throw new Error("Failed to load configuration");
  }
}

/**
 * Save configuration to disk
 * Uses atomic write for crash safety
 *
 * @param config - Configuration to save
 * @param level - Config level
 * @param projectDir - Project directory (optional)
 * @param userDir - User home directory (optional)
 */
export async function saveConfig(
  config: VibeConfig,
  level: ConfigLevel,
  projectDir?: string,
  userDir?: string,
): Promise<void> {
  const configPath = getConfigPath(level, projectDir, userDir);

  // Validate before saving
  const validation = validateConfig(config);
  if (!validation.valid) {
    throw new Error(
      `Cannot save invalid configuration: ${validation.errors.join(", ")}`,
    );
  }

  // Format with indentation for readability
  const content = JSON.stringify(config, null, 2);

  await atomicWrite(configPath, content);
}

/**
 * Merge user and project configurations
 * Project config takes precedence over user config
 *
 * @param userConfig - User-level configuration (optional)
 * @param projectConfig - Project-level configuration (optional)
 * @returns Merged configuration
 * @throws Error if both configs are undefined
 */
export function mergeConfigs(
  userConfig?: VibeConfig,
  projectConfig?: VibeConfig,
): VibeConfig {
  if (!userConfig && !projectConfig) {
    throw new Error("At least one config must be provided");
  }

  // If only one config exists, return it
  if (!userConfig) return projectConfig!;
  if (!projectConfig) return userConfig;

  // Merge with project taking precedence
  const merged: VibeConfig = {
    version: projectConfig.version || userConfig.version,
    level: projectConfig.level, // Always use project level when merging
  };

  // Add optional fields if present
  const sourceTool = projectConfig.source_tool || userConfig.source_tool;
  if (sourceTool) {
    merged.source_tool = sourceTool;
  }

  const targetTools = projectConfig.target_tools || userConfig.target_tools;
  if (targetTools) {
    merged.target_tools = targetTools;
  }

  // Only add sync_config if at least one config has it
  if (projectConfig.sync_config || userConfig.sync_config) {
    merged.sync_config = {
      skills:
        projectConfig.sync_config?.skills ??
        userConfig.sync_config?.skills ??
        true,
      mcp:
        projectConfig.sync_config?.mcp ?? userConfig.sync_config?.mcp ?? true,
      agents:
        projectConfig.sync_config?.agents ??
        userConfig.sync_config?.agents ??
        true,
      commands:
        projectConfig.sync_config?.commands ??
        userConfig.sync_config?.commands ??
        true,
    };
  }

  // Add last_sync if either config has it (project takes precedence)
  const lastSync = projectConfig.last_sync ?? userConfig.last_sync;
  if (lastSync) {
    merged.last_sync = lastSync;
  }

  // Add symlink configuration if either config has it (project takes precedence)
  const useSymlinks =
    projectConfig.use_symlinks_for_skills ?? userConfig.use_symlinks_for_skills;
  if (useSymlinks !== undefined) {
    merged.use_symlinks_for_skills = useSymlinks;
  }

  // Add language preference from user config (user preference, not overridden by project)
  if (userConfig.language !== undefined) {
    merged.language = userConfig.language;
  }

  return merged;
}

/**
 * Load and merge user and project configurations
 * Attempts to load both configs and merges them with project taking precedence
 *
 * @param projectDir - Project directory
 * @param userDir - User home directory (optional)
 * @returns Merged configuration
 * @throws Error if neither config exists
 */
export async function loadMergedConfig(
  projectDir: string,
  userDir?: string,
): Promise<VibeConfig> {
  let userConfig: VibeConfig | undefined;
  let projectConfig: VibeConfig | undefined;

  // Try to load user config
  try {
    userConfig = await loadConfig("user", undefined, userDir);
  } catch {
    // User config doesn't exist or is invalid - continue
  }

  // Try to load project config
  try {
    projectConfig = await loadConfig("project", projectDir);
  } catch {
    // Project config doesn't exist or is invalid - continue
  }

  // If neither exists, throw error
  if (!userConfig && !projectConfig) {
    throw new Error(
      "No configuration found. Run 'vibe-sync init' to create one.",
    );
  }

  return mergeConfigs(userConfig, projectConfig);
}

/**
 * Format a single Zod issue into error message
 * Pure function - no side effects
 */
function formatZodIssue(issue: ZodIssue): string {
  const path = issue.path?.join(".") || "";
  let message = issue.message;
  let includePath = true;

  // Custom messages for specific fields
  if (path === "use_symlinks_for_skills" && issue.code === "invalid_type") {
    message = "use_symlinks_for_skills must be a boolean";
    includePath = false;
  } else if (path === "language") {
    if (issue.code === "invalid_type" || issue.code === "invalid_value") {
      message = "language must be 'en' or 'zh'";
      includePath = false;
    }
  }

  return path && includePath ? `${path}: ${message}` : message;
}

/**
 * Flatten nested union errors recursively
 * Pure function - returns new array without modifying input
 */
function flattenZodIssues(issues: ZodIssue[]): ZodIssue[] {
  return issues.flatMap((issue) => {
    // Handle invalid_union - recursively flatten nested errors
    if (issue.code === "invalid_union" && issue.errors) {
      return issue.errors.flatMap((errorGroup) =>
        Array.isArray(errorGroup) ? flattenZodIssues(errorGroup) : [],
      );
    }
    // Regular issue - return as is
    return [issue];
  });
}

/**
 * Extract and format errors from Zod issues, handling nested union errors
 * Pure function - no external state mutation
 */
function extractZodErrors(issues: ZodIssue[]): string[] {
  // 1. Flatten nested union errors
  const flatIssues = flattenZodIssues(issues);

  // 2. Format each issue
  const messages = flatIssues.map(formatZodIssue);

  // 3. Deduplicate
  return Array.from(new Set(messages));
}

/**
 * Validate configuration structure and values using Zod
 *
 * @param config - Configuration to validate
 * @returns Validation result with errors if any
 */
export function validateConfig(config: VibeConfig): ValidationResult {
  try {
    // Get valid tools from registry (dynamic validation)
    const validTools = getAvailableTools();

    // Create schema with current valid tools
    const schema = createVibeConfigSchema(validTools);

    // Validate config
    schema.parse(config);

    return {
      valid: true,
      errors: [],
    };
  } catch (error) {
    if (error instanceof ZodError) {
      // Extract errors, handling nested union errors
      const errors = extractZodErrors(error.issues);

      return {
        valid: false,
        errors,
      };
    }

    // Unexpected error
    return {
      valid: false,
      errors: [
        `Validation error: ${error instanceof Error ? error.message : String(error)}`,
      ],
    };
  }
}

/**
 * Required configuration fields (used by config-initializer)
 */
export type RequiredConfigField =
  | "source_tool"
  | "target_tools"
  | "sync_config";
