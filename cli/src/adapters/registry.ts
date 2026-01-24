/**
 * Adapter registry - Auto-registration system
 * Add new adapters by importing them and adding to ADAPTERS array
 * Type system automatically infers ToolName from registered adapters
 */

import type { ToolName } from "../types/config.js";
import type { AdapterConfig, ToolAdapter } from "./base.js";
import { ClaudeCodeAdapter } from "./claude-code.js";
import { CodexAdapter } from "./codex.js";
import { CursorAdapter } from "./cursor.js";
import { OpenCodeAdapter } from "./opencode.js";

/**
 * Registry of all available adapters
 * To add a new adapter:
 * 1. Import the adapter class
 * 2. Add it to this array
 * 3. That's it! Type system auto-updates
 */
export const ADAPTERS = [
  ClaudeCodeAdapter,
  CursorAdapter,
  OpenCodeAdapter,
  CodexAdapter,
] as const;

/**
 * Adapter constructor type
 */
type AdapterConstructor = new (config: AdapterConfig) => ToolAdapter;

/**
 * Adapter registry singleton - Internal use only
 * Manages adapter instantiation and discovery
 */
class AdapterRegistry {
  private adapters = new Map<string, AdapterConstructor>();
  private static instance: AdapterRegistry;

  constructor() {
    // Auto-register all adapters
    for (const AdapterClass of ADAPTERS) {
      const tempInstance = new AdapterClass({ baseDir: "", tool: "" as any });
      this.adapters.set(tempInstance.toolName, AdapterClass);
    }
  }

  /**
   * Get singleton instance
   */
  static getInstance(): AdapterRegistry {
    if (!AdapterRegistry.instance) {
      AdapterRegistry.instance = new AdapterRegistry();
    }
    return AdapterRegistry.instance;
  }

  /**
   * Create adapter instance for a tool
   */
  create(toolName: string, config: AdapterConfig): ToolAdapter {
    const AdapterClass = this.adapters.get(toolName);
    if (!AdapterClass) {
      const available = Array.from(this.adapters.keys()).join(", ");
      throw new Error(
        `Unsupported tool: ${toolName}. Supported tools: ${available}`,
      );
    }
    return new AdapterClass(config);
  }

  /**
   * Get all registered tool names
   */
  getToolNames(): string[] {
    return Array.from(this.adapters.keys());
  }

  /**
   * Get all adapter metadata (for discovery)
   */
  getAllMetadata(): Array<{
    toolName: string;
    displayName: string;
    configFormat: string;
    capabilities: Record<string, boolean>;
    isReadOnly: boolean;
  }> {
    return Array.from(this.adapters.values()).map((AdapterClass) => {
      const instance = new AdapterClass({ baseDir: "", tool: "" as any });
      return {
        toolName: instance.toolName,
        displayName: instance.displayName,
        configFormat: instance.configFormat,
        capabilities: { ...instance.capabilities },
        isReadOnly: instance.isReadOnly,
      };
    });
  }

  /**
   * Check if a tool is registered
   */
  has(toolName: string): boolean {
    return this.adapters.has(toolName);
  }
}

/**
 * Global registry instance - Internal use only
 */
const registry = AdapterRegistry.getInstance();

/**
 * Legacy function for backward compatibility
 * @deprecated Use registry.create() instead
 */
export function getAdapter(config: AdapterConfig): ToolAdapter {
  return registry.create(config.tool, config);
}

/**
 * Get all available tool names
 * Convenience function for registry.getToolNames()
 */
export function getAvailableTools(): string[] {
  return registry.getToolNames();
}

/**
 * Create adapter instance (factory pattern) - Internal use only
 * Convenience function for registry.create()
 */
function createAdapter(
  toolName: string,
  config: Omit<AdapterConfig, "tool">,
): ToolAdapter {
  return registry.create(toolName, { ...config, tool: toolName as ToolName });
}

/**
 * Get configuration directory name for a tool - Internal use only
 * @param toolName - Tool name
 * @returns Config directory name (e.g., ".claude", ".cursor")
 */
function getToolConfigDir(toolName: string): string {
  const adapter = createAdapter(toolName, { baseDir: "" });
  return adapter.getConfigDir();
}

/**
 * Get all configuration directories as a map
 * @returns Record mapping tool names to their config directories
 */
export function getAllConfigDirs(): Record<string, string> {
  const dirs: Record<string, string> = {};
  for (const toolName of getAvailableTools()) {
    dirs[toolName] = getToolConfigDir(toolName);
  }
  return dirs;
}

/**
 * Get configuration file paths for a tool
 * @param toolName - Tool name
 * @param baseDir - Base directory
 * @returns Array of config file paths
 */
export function getToolConfigFiles(
  toolName: string,
  baseDir: string,
): string[] {
  const adapter = createAdapter(toolName, { baseDir });
  return adapter.getConfigFiles().map((file) => `${baseDir}/${file}`);
}

/**
 * Get tool choices for CLI prompts
 * @param detectedTools - Already detected tool names
 * @returns Array of choices for inquirer
 */
export function getToolChoices(detectedTools: string[] = []) {
  return registry.getAllMetadata().map((meta) => ({
    name: meta.displayName,
    value: meta.toolName,
    checked: detectedTools.includes(meta.toolName),
  }));
}
