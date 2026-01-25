/**
 * Claude Code adapter (source tool)
 * Reads skills and MCP servers from Claude Code configuration
 * This adapter is read-only (source tool)
 */

import { join } from "node:path";
import type { Skill, MCPServer, Agent, Command } from "@src/types/models.js";
import * as fileOps from "@src/utils/file-ops.js";
import { hashMCPServer } from "@src/utils/hash.js";
import type { WriteResult, ValidationResult } from "./base.js";
import { BaseAdapter } from "./base.js";

/**
 * Claude Code adapter
 * Reads from .claude/skills/ and .mcp.json
 */
export class ClaudeCodeAdapter extends BaseAdapter {
  override readonly toolName = "claude-code";
  override readonly displayName = "Claude Code";

  /**
   * Get configuration directory name
   */
  override getConfigDir(): string {
    return ".claude";
  }

  override getConfigPaths(): string[] {
    return [join(this.getConfigDir(), "settings.json")];
  }

  /**
   * Get configuration file paths for backup
   */
  override getMCPConfigPaths(): string[] {
    if (this.config.level === "user") {
      return [".claude.json"];
    }

    return [".mcp.json"];
  }

  /**
   * Read all MCP servers from .mcp.json
   * Claude Code only supports stdio MCP servers
   */
  override async readMCPServers(): Promise<MCPServer[]> {
    const mcpJsonPath = await this.getMcpConfigPath();

    try {
      const config = await fileOps.readJSON<{
        mcpServers?: Record<string, unknown>;
      }>(mcpJsonPath);

      if (!config?.mcpServers || typeof config.mcpServers !== "object") {
        return [];
      }

      const servers: MCPServer[] = [];

      for (const [name, serverConfig] of Object.entries(config.mcpServers)) {
        const rawConfig = serverConfig as Record<string, unknown>;

        // Create MCP server object (omit undefined optional fields)
        const server: MCPServer = {
          name,
          type: "stdio", // Claude Code only supports stdio
          hash: "", // Will be computed
        };

        // Add optional fields only if they have values
        if (rawConfig.command) {
          server.command = rawConfig.command as string;
        }
        if (rawConfig.args) {
          server.args = rawConfig.args as string[];
        }
        if (rawConfig.env) {
          server.env = rawConfig.env as Record<string, string>;
        }

        // Compute hash
        server.hash = hashMCPServer(server);

        servers.push(server);
      }

      return servers;
    } catch (error) {
      // Invalid JSON
      console.warn(
        `Failed to read .mcp.json: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
      return [];
    }
  }

  /**
   * Validate Claude Code configuration
   */
  override async validate(): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check if .claude directory exists
    const configDirPath = join(this.config.baseDir, this.getConfigDir());
    const configDirStats = await fileOps.stat(configDirPath);
    if (!configDirStats) {
      warnings.push(".claude directory not found");
    } else if (!configDirStats.isDirectory()) {
      warnings.push(".claude exists but is not a directory");
    }

    // Check if .mcp.json exists
    const mcpJsonPath = await this.getMcpConfigPath();
    const mcpJsonStats = await fileOps.stat(mcpJsonPath);
    if (!mcpJsonStats) {
      warnings.push(".mcp.json not found");
    }

    const result: ValidationResult = {
      valid: errors.length === 0,
      errors,
    };

    // Add warnings only if present
    if (warnings.length > 0) {
      result.warnings = warnings;
    }

    return result;
  }

  // Write methods - Claude Code is read-only (source tool)
  override async writeSkills(_skills: Skill[]): Promise<WriteResult> {
    throw new Error(
      "Claude Code adapter is read-only (source tool). Use as source_tool only.",
    );
  }

  override async writeMCPServers(_servers: MCPServer[]): Promise<WriteResult> {
    throw new Error(
      "Claude Code adapter is read-only (source tool). Use as source_tool only.",
    );
  }

  override async deleteSkill(_name: string): Promise<void> {
    throw new Error(
      "Claude Code adapter is read-only (source tool). Use as source_tool only.",
    );
  }

  override async deleteMCPServer(_name: string): Promise<void> {
    throw new Error(
      "Claude Code adapter is read-only (source tool). Use as source_tool only.",
    );
  }

  override async writeAgents(_agents: Agent[]): Promise<WriteResult> {
    throw new Error(
      "Claude Code adapter is read-only (source tool). Use as source_tool only.",
    );
  }

  override async deleteAgent(_name: string): Promise<void> {
    throw new Error(
      "Claude Code adapter is read-only (source tool). Use as source_tool only.",
    );
  }

  override async writeCommands(_commands: Command[]): Promise<WriteResult> {
    throw new Error(
      "Claude Code adapter is read-only (source tool). Use as source_tool only.",
    );
  }

  override async deleteCommand(_name: string): Promise<void> {
    throw new Error(
      "Claude Code adapter is read-only (source tool). Use as source_tool only.",
    );
  }
}
