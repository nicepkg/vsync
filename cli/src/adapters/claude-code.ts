/**
 * Claude Code adapter (source tool)
 * Reads skills and MCP servers from Claude Code configuration
 * This adapter is read-only (source tool)
 */

import { join } from "node:path";
import type { MCPServer } from "@src/types/models.js";
import * as fileOps from "@src/utils/file-ops.js";
import { hashMCPServer } from "@src/utils/hash.js";
import type { WriteResult } from "./base.js";
import { BaseAdapter } from "./base.js";

/**
 * Claude Code adapter
 * Reads from .claude/skills/ and .mcp.json
 */
export class ClaudeCodeAdapter extends BaseAdapter {
  // Static metadata (for registry without instantiation)
  static readonly TOOL_NAME = "claude-code";
  static readonly DISPLAY_NAME = "Claude Code";

  override readonly toolName = ClaudeCodeAdapter.TOOL_NAME;
  override readonly displayName = ClaudeCodeAdapter.DISPLAY_NAME;

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
   * Claude Code supports stdio, HTTP, and OAuth MCP servers
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

        // Infer server type from configuration fields
        const hasCommand = typeof rawConfig.command === "string";
        const hasUrl = typeof rawConfig.url === "string";
        const hasAuth =
          rawConfig.auth !== undefined && typeof rawConfig.auth === "object";

        let type: MCPServer["type"] = "stdio";
        if (hasCommand) {
          type = "stdio";
        } else if (hasAuth) {
          type = "oauth";
        } else if (hasUrl) {
          type = "http";
        }

        // Create MCP server object (omit undefined optional fields)
        const server: MCPServer = {
          name,
          type,
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
        if (rawConfig.url) {
          server.url = rawConfig.url as string;
        }
        if (rawConfig.headers) {
          server.headers = rawConfig.headers as Record<string, string>;
        }
        if (hasAuth) {
          const rawAuth = rawConfig.auth as Record<string, unknown>;
          const auth: MCPServer["auth"] = {
            client_id: (rawAuth.client_id as string) || "",
            client_secret: (rawAuth.client_secret as string) || "",
          };
          if (Array.isArray(rawAuth.scopes)) {
            auth.scopes = rawAuth.scopes.filter(
              (s): s is string => typeof s === "string",
            );
          }
          server.auth = auth;
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
   * Write MCP servers to .mcp.json
   * Claude Code format:
   * - mcpServers field
   * - stdio only
   * - Environment variables: ${VAR} or ${env:VAR} (preserve as-is)
   */
  override async writeMCPServers(servers: MCPServer[]): Promise<WriteResult> {
    const mcpJsonPath = await this.getMcpConfigPath();

    try {
      // Read existing config or create new one
      const existingConfig = await fileOps.readJSON<{
        mcpServers?: Record<string, unknown>;
      }>(mcpJsonPath);
      const config: { mcpServers: Record<string, unknown> } = {
        mcpServers: existingConfig?.mcpServers || {},
      };

      // Add/update servers
      for (const server of servers) {
        const serverConfig: Record<string, unknown> = {};

        // Add fields (only stdio supported by Claude Code)
        if (server.command) {
          serverConfig.command = server.command;
        }
        if (server.args) {
          serverConfig.args = server.args;
        }
        if (server.env) {
          // Preserve environment variables as-is (no transformation)
          serverConfig.env = server.env;
        }

        config.mcpServers[server.name] = serverConfig;
      }

      // Write config using atomic write
      await fileOps.writeJSON(mcpJsonPath, config);

      return {
        success: true,
        count: servers.length,
      };
    } catch (error) {
      return {
        success: false,
        count: 0,
        error:
          error instanceof Error
            ? error.message
            : "Unknown error writing MCP servers",
      };
    }
  }

  /**
   * Delete an MCP server from .mcp.json
   */
  override async deleteMCPServer(name: string): Promise<void> {
    const mcpJsonPath = await this.getMcpConfigPath();

    const config = await fileOps.readJSON<{
      mcpServers?: Record<string, unknown>;
    }>(mcpJsonPath);

    if (config?.mcpServers && typeof config.mcpServers === "object") {
      delete config.mcpServers[name];
      await fileOps.writeJSON(mcpJsonPath, config);
    }
  }
}
