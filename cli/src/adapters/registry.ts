/**
 * Adapter registry
 * Factory function to create the correct adapter for a tool
 */

import type { AdapterConfig, ToolAdapter } from "./base.js";
import { ClaudeCodeAdapter } from "./claude-code.js";
import { CodexAdapter } from "./codex.js";
import { CursorAdapter } from "./cursor.js";
import { OpenCodeAdapter } from "./opencode.js";

/**
 * Get adapter for a specific tool
 * Factory function to instantiate the correct adapter
 *
 * @param config - Adapter configuration
 * @returns Tool adapter instance
 * @throws Error if tool is not supported
 */
export function getAdapter(config: AdapterConfig): ToolAdapter {
  switch (config.tool) {
    case "claude-code":
      return new ClaudeCodeAdapter(config);

    case "cursor":
      return new CursorAdapter(config);

    case "opencode":
      return new OpenCodeAdapter(config);

    case "codex":
      return new CodexAdapter(config);

    default:
      throw new Error(
        `Unsupported tool: ${config.tool}. Supported tools: claude-code, cursor, opencode, codex`,
      );
  }
}
