/**
 * Configuration manager for .vibe-sync.json
 * Handles loading, saving, and validation of configuration
 */

import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { cwd } from "node:process";
import { getAvailableTools } from "@src/adapters/registry.js";
import type { VibeConfig, ConfigLevel } from "@src/types/config.js";
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
    source_tool: projectConfig.source_tool || userConfig.source_tool,
    target_tools: projectConfig.target_tools || userConfig.target_tools,
    sync_config: {
      skills:
        projectConfig.sync_config?.skills ?? userConfig.sync_config?.skills,
      mcp: projectConfig.sync_config?.mcp ?? userConfig.sync_config?.mcp,
    },
  };

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
 * Validate configuration structure and values
 *
 * @param config - Configuration to validate
 * @returns Validation result with errors if any
 */
export function validateConfig(config: VibeConfig): ValidationResult {
  const errors: string[] = [];

  // Check required fields
  if (!config.version) {
    errors.push("Missing required field: version");
  }

  if (!config.level) {
    errors.push("Missing required field: level");
  } else if (config.level !== "project" && config.level !== "user") {
    errors.push(`Invalid level: ${config.level}`);
  }

  if (!config.source_tool) {
    errors.push("Missing required field: source_tool");
  } else {
    // Get valid tools from registry (no hardcoding!)
    const validTools = getAvailableTools();
    if (!validTools.includes(config.source_tool)) {
      errors.push(`Invalid source_tool: ${config.source_tool}`);
    }
  }

  if (!config.target_tools) {
    errors.push("Missing required field: target_tools");
  } else {
    if (!Array.isArray(config.target_tools)) {
      errors.push("target_tools must be an array");
    } else if (config.target_tools.length === 0) {
      errors.push("target_tools cannot be empty");
    } else {
      // Get valid tools from registry (no hardcoding!)
      const validTools = getAvailableTools();
      for (const tool of config.target_tools) {
        if (!validTools.includes(tool)) {
          errors.push(`Invalid target tool: ${tool}`);
        }
      }

      // Source tool cannot be in target tools
      if (
        config.source_tool &&
        config.target_tools.includes(config.source_tool)
      ) {
        errors.push(
          "source_tool cannot be included in target_tools (would create a loop)",
        );
      }
    }
  }

  if (!config.sync_config) {
    errors.push("Missing required field: sync_config");
  } else {
    if (typeof config.sync_config.skills !== "boolean") {
      errors.push("sync_config.skills must be a boolean");
    }
    if (typeof config.sync_config.mcp !== "boolean") {
      errors.push("sync_config.mcp must be a boolean");
    }

    // At least one sync type must be enabled
    if (!config.sync_config.skills && !config.sync_config.mcp) {
      errors.push("At least one sync type must be enabled (skills or mcp)");
    }
  }

  // Validate use_symlinks_for_skills (optional boolean)
  if (
    config.use_symlinks_for_skills !== undefined &&
    typeof config.use_symlinks_for_skills !== "boolean"
  ) {
    errors.push("use_symlinks_for_skills must be a boolean");
  }

  // Validate language (optional 'en' | 'zh')
  if (config.language !== undefined) {
    if (config.language !== "en" && config.language !== "zh") {
      errors.push("language must be 'en' or 'zh'");
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
