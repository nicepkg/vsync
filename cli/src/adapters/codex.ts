/**
 * Codex adapter (target tool)
 * Writes skills and MCP servers to Codex configuration
 * This adapter supports both read and write operations
 */

import { join } from "node:path";
import type { MCPServer, Agent, Command } from "@src/types/models.js";
import { NotSupportError } from "@src/utils/errors.js";
import * as fileOps from "@src/utils/file-ops.js";
import { hashMCPServer } from "@src/utils/hash.js";
import type { WriteResult } from "./base.js";
import { BaseAdapter } from "./base.js";

/**
 * Codex adapter
 * Reads/writes to .codex/ (project) or ~/.codex/ (user)
 * MCP servers in config.toml, skills in directories
 */
export class CodexAdapter extends BaseAdapter {
  override readonly toolName = "codex";
  override readonly displayName = "Codex";

  override getCapabilities() {
    return {
      skills: true,
      mcp: true,
      agents: false, // Codex doesn't support agents
      commands: false, // Codex doesn't support commands
    };
  }

  override getConfigDir(): string {
    return ".codex";
  }

  override getConfigPaths(): string[] {
    return [join(this.getConfigDir(), "config.toml")];
  }

  override getMCPConfigPaths(): string[] {
    return [join(this.getConfigDir(), "config.toml")];
  }

  /**
   * Read all MCP servers from config.toml
   * Format: [mcp_servers.<name>]
   */
  override async readMCPServers(): Promise<MCPServer[]> {
    const mcpConfigPath = await this.getMcpConfigPath();

    const config =
      await fileOps.readTOML<Record<string, unknown>>(mcpConfigPath);

    if (!config?.mcp_servers || typeof config.mcp_servers !== "object") {
      return [];
    }

    try {
      const servers: MCPServer[] = [];
      const mcpServers = config.mcp_servers as Record<string, unknown>;

      for (const [name, serverConfig] of Object.entries(mcpServers)) {
        const rawConfig = serverConfig as Record<string, unknown>;
        const hasUrl = typeof rawConfig.url === "string";

        const server: MCPServer = {
          name,
          type: hasUrl ? "http" : "stdio",
          hash: "",
        };

        if (rawConfig.command) {
          server.command = rawConfig.command as string;
        }
        if (rawConfig.args) {
          server.args = rawConfig.args as string[];
        }

        if (rawConfig.url) {
          server.url = rawConfig.url as string;
        }

        const env: Record<string, string> = {};
        if (Array.isArray(rawConfig.env_vars)) {
          for (const entry of rawConfig.env_vars) {
            if (typeof entry === "string") {
              env[entry] = "${" + entry + "}";
            }
          }
        }
        if (rawConfig.env && typeof rawConfig.env === "object") {
          for (const [key, value] of Object.entries(rawConfig.env)) {
            if (typeof value === "string") {
              env[key] = value;
            }
          }
        }
        if (Object.keys(env).length > 0) {
          server.env = env;
        }

        const headers: Record<string, string> = {};
        if (
          rawConfig.http_headers &&
          typeof rawConfig.http_headers === "object"
        ) {
          for (const [key, value] of Object.entries(
            rawConfig.http_headers as Record<string, unknown>,
          )) {
            if (typeof value === "string") {
              headers[key] = value;
            }
          }
        }
        if (
          rawConfig.env_http_headers &&
          typeof rawConfig.env_http_headers === "object"
        ) {
          for (const [key, value] of Object.entries(
            rawConfig.env_http_headers as Record<string, unknown>,
          )) {
            if (typeof value === "string") {
              headers[key] = "${" + value + "}";
            }
          }
        }
        if (typeof rawConfig.bearer_token_env_var === "string") {
          headers.Authorization =
            "Bearer ${" + rawConfig.bearer_token_env_var + "}";
        }
        if (Object.keys(headers).length > 0) {
          server.headers = headers;
        }

        server.hash = hashMCPServer(server);
        servers.push(server);
      }

      return servers;
    } catch (error) {
      // Invalid TOML
      console.warn(
        `Failed to read config.toml: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
      return [];
    }
  }

  /**
   * Write MCP servers to config.toml
   */
  override async writeMCPServers(servers: MCPServer[]): Promise<WriteResult> {
    const mcpConfigPath = await this.getMcpConfigPath();

    try {
      // Ensure .codex directory exists
      await fileOps.ensureDir(join(this.config.baseDir, this.getConfigDir()));

      // Read existing config or create new one
      const existingMCPConfig =
        await fileOps.readTOML<Record<string, unknown>>(mcpConfigPath);
      const config: Record<string, unknown> = existingMCPConfig || {};

      // Ensure mcp_servers section exists
      if (!config.mcp_servers || typeof config.mcp_servers !== "object") {
        config.mcp_servers = {};
      }

      const mcpServers = config.mcp_servers as Record<string, unknown>;

      // Add/update each server
      for (const server of servers) {
        const serverConfig: Record<string, unknown> = {};

        if (server.command) {
          serverConfig.command = server.command;
        }
        if (server.args) {
          serverConfig.args = server.args;
        }
        if (server.url) {
          serverConfig.url = server.url;
        }

        if (server.env) {
          const envVars = new Set<string>();
          const envTable: Record<string, string> = {};

          for (const [key, value] of Object.entries(server.env)) {
            const envVar = this.extractEnvVarName(value);
            if (envVar) {
              envVars.add(envVar);
            } else {
              envTable[key] = value;
            }
          }

          if (envVars.size > 0) {
            serverConfig.env_vars = Array.from(envVars);
          }
          if (Object.keys(envTable).length > 0) {
            serverConfig.env = envTable;
          }
        }

        if (server.headers) {
          const httpHeaders: Record<string, string> = {};
          const envHttpHeaders: Record<string, string> = {};
          let bearerTokenEnvVar: string | undefined;

          for (const [key, value] of Object.entries(server.headers)) {
            const bearerEnvVar = this.extractBearerTokenEnvVar(value);
            if (key.toLowerCase() === "authorization" && bearerEnvVar) {
              bearerTokenEnvVar = bearerEnvVar;
              continue;
            }

            const envVar = this.extractEnvVarName(value);
            if (envVar) {
              envHttpHeaders[key] = envVar;
            } else {
              httpHeaders[key] = value;
            }
          }

          if (bearerTokenEnvVar) {
            serverConfig.bearer_token_env_var = bearerTokenEnvVar;
          }
          if (Object.keys(httpHeaders).length > 0) {
            serverConfig.http_headers = httpHeaders;
          }
          if (Object.keys(envHttpHeaders).length > 0) {
            serverConfig.env_http_headers = envHttpHeaders;
          }
        }

        mcpServers[server.name] = serverConfig;
      }

      // Write MCP config back as TOML
      await fileOps.writeTOML(mcpConfigPath, config);

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
   * Delete an MCP server from config.toml
   */
  override async deleteMCPServer(name: string): Promise<void> {
    const mcpConfigPath = await this.getMcpConfigPath();

    const config =
      await fileOps.readTOML<Record<string, unknown>>(mcpConfigPath);

    if (config?.mcp_servers && typeof config.mcp_servers === "object") {
      const mcpServers = config.mcp_servers as Record<string, unknown>;

      if (mcpServers[name] !== undefined) {
        delete mcpServers[name];
        await fileOps.writeTOML(mcpConfigPath, config);
      }
    }
  }

  /**
   * Read all agents from .codex/agents/
   */
  override async readAgents(): Promise<Agent[]> {
    return [];
  }

  /**
   * Write agents to .codex/agents/
   */
  override async writeAgents(agents: Agent[]): Promise<WriteResult> {
    void agents;
    const error = new NotSupportError(this.toolName, "agents");
    return {
      success: false,
      count: 0,
      error: error.message,
    };
  }

  /**
   * Delete an agent from .codex/agents/
   */
  override async deleteAgent(name: string): Promise<void> {
    void name;
    throw new NotSupportError(this.toolName, "agents");
  }

  /**
   * Read all commands from .codex/commands/
   */
  override async readCommands(): Promise<Command[]> {
    return [];
  }

  /**
   * Write commands to .codex/commands/
   */
  override async writeCommands(commands: Command[]): Promise<WriteResult> {
    void commands;
    const error = new NotSupportError(this.toolName, "commands");
    return {
      success: false,
      count: 0,
      error: error.message,
    };
  }

  /**
   * Delete a command from .codex/commands/
   */
  override async deleteCommand(name: string): Promise<void> {
    void name;
    throw new NotSupportError(this.toolName, "commands");
  }

  private extractEnvVarName(value: string): string | null {
    const envMatch =
      value.match(/^\$\{env:([A-Z0-9_]+)\}$/) ||
      value.match(/^\$\{([A-Z0-9_]+)\}$/);
    return envMatch?.[1] ?? null;
  }

  private extractBearerTokenEnvVar(value: string): string | null {
    const bearerMatch =
      value.match(/^Bearer\s+\$\{env:([A-Z0-9_]+)\}$/) ||
      value.match(/^Bearer\s+\$\{([A-Z0-9_]+)\}$/);
    return bearerMatch?.[1] ?? null;
  }
}
