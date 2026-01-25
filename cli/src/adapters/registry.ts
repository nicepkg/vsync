/**
 * Adapter registry - manual registration
 * Add new adapters here to make them available to the CLI.
 */

import type { ToolName } from "../types/config.js";
import type { AdapterConfig, ToolAdapter } from "./base.js";
import { ClaudeCodeAdapter } from "./claude-code.js";
import { CodexAdapter } from "./codex.js";
import { CursorAdapter } from "./cursor.js";
import { OpenCodeAdapter } from "./opencode.js";

type AdapterConstructor = new (config: AdapterConfig) => ToolAdapter;

type AdapterEntry = {
  toolName: string;
  displayName: string;
  AdapterClass: AdapterConstructor;
};

export const ADAPTERS = [
  ClaudeCodeAdapter,
  CursorAdapter,
  OpenCodeAdapter,
  CodexAdapter,
] as const;

function makeEntry(AdapterClass: AdapterConstructor): AdapterEntry {
  const instance = new AdapterClass({
    baseDir: "",
    tool: "" as ToolName,
    level: "project",
  });

  return {
    toolName: instance.toolName,
    displayName: instance.displayName,
    AdapterClass,
  };
}

const adapterEntries = ADAPTERS.map(makeEntry).sort((a, b) =>
  a.toolName.localeCompare(b.toolName),
);
const adapterMap = new Map(
  adapterEntries.map((entry) => [entry.toolName, entry]),
);

export function getAdapter(config: AdapterConfig): ToolAdapter {
  const entry = adapterMap.get(config.tool);
  if (!entry) {
    const available = Array.from(adapterMap.keys()).join(", ");
    throw new Error(
      `Unsupported tool: ${config.tool}. Supported tools: ${available}`,
    );
  }
  return new entry.AdapterClass(config);
}

/**
 * Get all available tool names
 * Convenience function for registry.getToolNames()
 */
export function getAvailableTools(): string[] {
  return adapterEntries.map((entry) => entry.toolName);
}

/**
 * Create adapter instance (factory pattern) - Internal use only
 * Convenience function for registry.create()
 */
function createAdapter(
  toolName: string,
  config: Omit<AdapterConfig, "tool">,
): ToolAdapter {
  return getAdapter({ ...config, tool: toolName as ToolName });
}

/**
 * Get configuration directory name for a tool - Internal use only
 * @param toolName - Tool name
 * @returns Config directory name (e.g., ".claude", ".cursor")
 */
function getToolConfigDir(toolName: string): string {
  const adapter = createAdapter(toolName, { baseDir: "", level: "project" });
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
  level: AdapterConfig["level"] = "project",
): string[] {
  const adapter = createAdapter(toolName, { baseDir, level });
  return adapter.getMCPConfigPaths().map((p) => `${baseDir}/${p}`);
}

/**
 * Get tool choices for CLI prompts
 * @param detectedTools - Already detected tool names
 * @returns Array of choices for inquirer
 */
export function getToolChoices(detectedTools: string[] = []) {
  return adapterEntries.map((entry) => ({
    name: entry.displayName,
    value: entry.toolName,
    checked: detectedTools.includes(entry.toolName),
  }));
}
