/**
 * Cursor adapter (target tool)
 * Writes skills and MCP servers to Cursor configuration
 * This adapter is write-only (target tool)
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { MCPServer, MCPOAuth } from "@src/types/models.js";
import * as fileOps from "@src/utils/file-ops.js";
import { hashMCPServer } from "@src/utils/hash.js";
import type { WriteResult } from "./base.js";
import { BaseAdapter } from "./base.js";

/**
 * Cursor adapter
 * Writes to .cursor/skills/ and .cursor/mcp.json
 */
export class CursorAdapter extends BaseAdapter {
  override readonly toolName = "cursor";
  override readonly displayName = "Cursor";

  override getConfigDir(): string {
    return ".cursor";
  }

  override getConfigPaths(): string[] {
    return [];
  }

  override getMCPConfigPaths(): string[] {
    return [join(this.getConfigDir(), "mcp.json")];
  }

  /**
   * Write MCP servers to .cursor/mcp.json
   * Cursor uses mcpServers field and supports stdio, HTTP, OAuth
   */
  override async writeMCPServers(servers: MCPServer[]): Promise<WriteResult> {
    const mcpJsonPath = await this.getMcpConfigPath();

    try {
      // Ensure .cursor directory exists
      await fileOps.ensureDir(join(this.config.baseDir, this.getConfigDir()));

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

        // Add fields based on server configuration
        if (server.command) {
          serverConfig.command = server.command;
        }
        if (server.args) {
          serverConfig.args = server.args;
        }
        if (server.env) {
          serverConfig.env = this.normalizeCursorVars(server.env) as Record<
            string,
            string
          >;
        }
        if (server.url) {
          serverConfig.url = server.url;
        }
        if (server.headers) {
          serverConfig.headers = this.normalizeCursorVars(
            server.headers,
          ) as Record<string, string>;
        }
        if (server.auth) {
          serverConfig.auth = this.toCursorAuth(server.auth);
        }

        config.mcpServers[server.name] = serverConfig;
      }

      // Write config
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
   * Delete an MCP server from .cursor/mcp.json
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

  private normalizeCursorVars(value: unknown): unknown {
    if (typeof value === "string") {
      return this.normalizeCursorString(value);
    }

    if (Array.isArray(value)) {
      return value.map((item) => this.normalizeCursorVars(item));
    }

    if (value && typeof value === "object") {
      const result: Record<string, unknown> = {};
      for (const [key, item] of Object.entries(value)) {
        result[key] = this.normalizeCursorVars(item);
      }
      return result;
    }

    return value;
  }

  private normalizeCursorString(value: string): string {
    return value.replace(/\$\{([A-Za-z0-9_]+)\}/g, (match, name) => {
      if (this.isCursorReservedVar(name)) {
        return match;
      }
      if (!/^[A-Z0-9_]+$/.test(name)) {
        return match;
      }
      return `\${env:${name}}`;
    });
  }

  private isCursorReservedVar(name: string): boolean {
    return (
      name === "workspaceFolder" ||
      name === "workspaceFolderBasename" ||
      name === "userHome" ||
      name === "pathSeparator"
    );
  }

  private toCursorAuth(auth: MCPOAuth): Record<string, unknown> {
    const cursorAuth: Record<string, unknown> = {};

    if (auth.client_id) {
      cursorAuth.CLIENT_ID = auth.client_id;
    }
    if (auth.client_secret) {
      cursorAuth.CLIENT_SECRET = auth.client_secret;
    }
    if (auth.scopes && auth.scopes.length > 0) {
      cursorAuth.scopes = auth.scopes;
    }

    return this.normalizeCursorVars(cursorAuth) as Record<string, unknown>;
  }

  private fromCursorAuth(
    rawAuth: Record<string, unknown>,
  ): MCPOAuth | undefined {
    const auth: MCPOAuth = {
      client_id: "",
      client_secret: "",
    };

    const clientId = rawAuth.CLIENT_ID ?? rawAuth.client_id;
    const clientSecret = rawAuth.CLIENT_SECRET ?? rawAuth.client_secret;

    if (typeof clientId === "string") {
      auth.client_id = clientId;
    }
    if (typeof clientSecret === "string") {
      auth.client_secret = clientSecret;
    }

    if (Array.isArray(rawAuth.scopes)) {
      auth.scopes = rawAuth.scopes.filter(
        (scope): scope is string => typeof scope === "string",
      );
    } else if (typeof rawAuth.scopes === "string") {
      auth.scopes = rawAuth.scopes.split(/\s+/).filter(Boolean);
    }

    if (!auth.client_id && !auth.client_secret && !auth.scopes?.length) {
      return undefined;
    }

    return auth;
  }

  /**
   * Read MCP servers from .cursor/mcp.json
   */
  override async readMCPServers(): Promise<MCPServer[]> {
    const mcpJsonPath = await this.getMcpConfigPath();

    try {
      const content = await readFile(mcpJsonPath, "utf-8");
      const config = JSON.parse(content);

      if (!config.mcpServers || typeof config.mcpServers !== "object") {
        return [];
      }

      const servers: MCPServer[] = [];

      for (const [name, serverConfig] of Object.entries(config.mcpServers)) {
        const rawConfig = serverConfig as Record<string, unknown>;

        const hasCommand = typeof rawConfig.command === "string";
        const hasAuth =
          rawConfig.auth !== undefined && typeof rawConfig.auth === "object";
        const hasUrl = typeof rawConfig.url === "string";

        let type: MCPServer["type"] = "stdio";
        if (hasCommand) {
          type = "stdio";
        } else if (hasAuth) {
          type = "oauth";
        } else if (hasUrl) {
          type = "http";
        }

        const server: MCPServer = {
          name,
          type,
          hash: "",
        };

        if (rawConfig.command) server.command = rawConfig.command as string;
        if (rawConfig.args) server.args = rawConfig.args as string[];
        if (rawConfig.env) server.env = rawConfig.env as Record<string, string>;
        if (rawConfig.url) server.url = rawConfig.url as string;
        if (rawConfig.headers)
          server.headers = rawConfig.headers as Record<string, string>;
        if (rawConfig.auth && typeof rawConfig.auth === "object") {
          const normalized = this.fromCursorAuth(
            rawConfig.auth as Record<string, unknown>,
          );
          if (normalized) {
            server.auth = normalized;
          }
        }

        server.hash = hashMCPServer(server);
        servers.push(server);
      }

      return servers;
    } catch (error) {
      if (
        error instanceof Error &&
        "code" in error &&
        error.code === "ENOENT"
      ) {
        return [];
      }
      console.warn(
        `Failed to read mcp.json: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
      return [];
    }
  }
}
