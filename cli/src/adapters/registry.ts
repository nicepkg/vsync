/**
 * Adapter Registry - Extensible Plugin System
 *
 * Supports dynamic adapter registration for plugin ecosystem.
 * Third-party plugins can register adapters without patching core code.
 *
 * Design Principles:
 * - Open/Closed: Open for extension (register new adapters), closed for modification
 * - Plugin-Friendly: External packages can call registerAdapter()
 * - Type-Safe: Full TypeScript support with proper type guards
 */

import { join } from "node:path";
import type { ToolName } from "@src/types/config.js";
import type { AdapterConfig, ToolAdapter } from "./base.js";
import { ClaudeCodeAdapter } from "./claude-code.js";
import { CodexAdapter } from "./codex.js";
import { CursorAdapter } from "./cursor.js";
import { OpenCodeAdapter } from "./opencode.js";

/**
 * Adapter constructor type
 */
type AdapterConstructor = new (config: AdapterConfig) => ToolAdapter;

/**
 * Static metadata interface that all adapters must implement
 * Allows inspection without instantiation
 */
export interface AdapterStatic {
  /** Unique tool identifier (e.g., "claude-code", "cursor") */
  readonly TOOL_NAME: string;
  /** Human-readable display name (e.g., "Claude Code", "Cursor") */
  readonly DISPLAY_NAME: string;
  /** Constructor signature */
  new (config: AdapterConfig): ToolAdapter;
}

/**
 * Registry entry for an adapter
 */
interface AdapterEntry {
  toolName: string;
  displayName: string;
  AdapterClass: AdapterConstructor;
}

/**
 * Adapter Registry - Manages adapter lifecycle and discovery
 *
 * Singleton pattern ensures single source of truth for adapters.
 * Supports dynamic registration for plugin ecosystem.
 */
class AdapterRegistry {
  private readonly entries = new Map<string, AdapterEntry>();
  private static instance?: AdapterRegistry;

  /**
   * Private constructor - use getInstance()
   */
  private constructor() {}

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
   * Register an adapter class
   *
   * @param AdapterClass - Adapter class with static metadata
   * @throws Error if adapter with same tool name already registered
   *
   * @example
   * ```typescript
   * class MyAdapter extends BaseAdapter {
   *   static readonly TOOL_NAME = "my-tool";
   *   static readonly DISPLAY_NAME = "My Tool";
   *   // ... implementation
   * }
   *
   * registry.register(MyAdapter);
   * ```
   */
  register(AdapterClass: AdapterStatic): void {
    const toolName = AdapterClass.TOOL_NAME;

    if (this.entries.has(toolName)) {
      throw new Error(
        `Adapter for tool "${toolName}" is already registered. ` +
          `Each tool can only have one adapter.`,
      );
    }

    this.entries.set(toolName, {
      toolName,
      displayName: AdapterClass.DISPLAY_NAME,
      AdapterClass,
    });
  }

  /**
   * Unregister an adapter (useful for testing or hot-reloading)
   *
   * @param toolName - Tool name to unregister
   * @returns True if adapter was removed, false if not found
   */
  unregister(toolName: string): boolean {
    return this.entries.delete(toolName);
  }

  /**
   * Check if adapter is registered
   *
   * @param toolName - Tool name to check
   * @returns True if adapter is registered
   */
  has(toolName: string): boolean {
    return this.entries.has(toolName);
  }

  /**
   * Get adapter entry by tool name
   *
   * @param toolName - Tool name
   * @returns Adapter entry or undefined if not found
   */
  getEntry(toolName: string): AdapterEntry | undefined {
    return this.entries.get(toolName);
  }

  /**
   * Create adapter instance
   *
   * @param config - Adapter configuration
   * @returns Adapter instance
   * @throws Error if tool is not registered
   */
  create(config: AdapterConfig): ToolAdapter {
    const entry = this.entries.get(config.tool);

    if (!entry) {
      const available = Array.from(this.entries.keys()).join(", ");
      throw new Error(
        `Unsupported tool: ${config.tool}. ` +
          `Available tools: ${available || "(none registered)"}`,
      );
    }

    return new entry.AdapterClass(config);
  }

  /**
   * Get all registered tool names
   *
   * @returns Array of tool names sorted alphabetically
   */
  getToolNames(): string[] {
    return Array.from(this.entries.keys()).sort();
  }

  /**
   * Get all adapter entries
   *
   * @returns Array of adapter entries sorted by tool name
   */
  getEntries(): AdapterEntry[] {
    return Array.from(this.entries.values()).sort((a, b) =>
      a.toolName.localeCompare(b.toolName),
    );
  }

  /**
   * Clear all registered adapters (useful for testing)
   */
  clear(): void {
    this.entries.clear();
  }
}

/**
 * Global registry instance
 */
const registry = AdapterRegistry.getInstance();

/**
 * Register core adapters
 * Adapters are imported statically at module load time
 */
function registerCoreAdapters(): void {
  // Register all core adapters
  // These are imported at the top of this file, so they're available synchronously
  registry.register(ClaudeCodeAdapter);
  registry.register(CursorAdapter);
  registry.register(OpenCodeAdapter);
  registry.register(CodexAdapter);
}

// Auto-register core adapters on module load
// This ensures adapters are available before any consumer code runs
registerCoreAdapters();

/**
 * Register a custom adapter (for plugins)
 *
 * @param AdapterClass - Adapter class with static metadata
 *
 * @example
 * ```typescript
 * // In a plugin package
 * import { registerAdapter } from 'vsync';
 *
 * class MyCustomAdapter extends BaseAdapter {
 *   static readonly TOOL_NAME = "my-tool";
 *   static readonly DISPLAY_NAME = "My Tool";
 *   // ... implementation
 * }
 *
 * registerAdapter(MyCustomAdapter);
 * ```
 */
export function registerAdapter(AdapterClass: AdapterStatic): void {
  registry.register(AdapterClass);
}

/**
 * Get adapter instance (factory pattern)
 *
 * @param config - Adapter configuration
 * @returns Adapter instance
 * @throws Error if tool is not registered
 */
export function getAdapter(config: AdapterConfig): ToolAdapter {
  return registry.create(config);
}

/**
 * Get all available tool names
 *
 * @returns Array of registered tool names
 */
export function getAvailableTools(): string[] {
  return registry.getToolNames();
}

/**
 * Check if a tool is supported
 *
 * @param toolName - Tool name to check
 * @returns True if tool has a registered adapter
 */
export function isToolSupported(toolName: string): boolean {
  return registry.has(toolName);
}

/**
 * Create adapter instance (internal use)
 *
 * @param toolName - Tool name
 * @param config - Adapter configuration without tool
 * @returns Adapter instance
 */
function createAdapter(
  toolName: string,
  config: Omit<AdapterConfig, "tool">,
): ToolAdapter {
  return registry.create({ ...config, tool: toolName as ToolName });
}

/**
 * Get configuration directory name for a tool
 *
 * @param toolName - Tool name
 * @returns Config directory name (e.g., ".claude", ".cursor")
 */
function getToolConfigDir(toolName: string): string {
  const adapter = createAdapter(toolName, { baseDir: "", level: "project" });
  return adapter.getConfigDir();
}

/**
 * Get all configuration directories as a map
 *
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
 *
 * @param toolName - Tool name
 * @param baseDir - Base directory
 * @param level - Configuration level
 * @returns Array of config file paths
 */
export function getToolConfigFiles(
  toolName: string,
  baseDir: string,
  level: AdapterConfig["level"] = "project",
): string[] {
  const adapter = createAdapter(toolName, { baseDir, level });
  // Only return MCP config files (JSON) - not directories
  // Full directory tree backup requires transaction mechanism (out of scope)
  return adapter.getMCPConfigPaths().map((p) => join(baseDir, p));
}

/**
 * Get tool choices for CLI prompts
 *
 * @param detectedTools - Already detected tool names
 * @returns Array of choices for inquirer
 */
export function getToolChoices(detectedTools: string[] = []) {
  return registry.getEntries().map((entry) => ({
    name: entry.displayName,
    value: entry.toolName,
    checked: detectedTools.includes(entry.toolName),
  }));
}

/**
 * Get registry instance (for testing)
 *
 * @internal
 */
export function getRegistry(): AdapterRegistry {
  return registry;
}
