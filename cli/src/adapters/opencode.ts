/**
 * OpenCode adapter (target tool)
 * Writes skills and MCP servers to OpenCode configuration
 * This adapter is write-only (target tool)
 */

import { join } from "node:path";
import * as jsonc from "jsonc-parser";
import type { MCPServer, MCPOAuth } from "@src/types/models.js";
import { atomicWrite } from "@src/utils/atomic-write.js";
import * as fileOps from "@src/utils/file-ops.js";
import { hashMCPServer } from "@src/utils/hash.js";
import type { WriteResult } from "./base.js";
import { BaseAdapter } from "./base.js";

/**
 * OpenCode adapter
 * Writes to .opencode/skills/ and opencode.jsonc
 */
export class OpenCodeAdapter extends BaseAdapter {
  override readonly toolName = "opencode";
  override readonly displayName = "OpenCode";

  override getConfigDir(): string {
    return ".opencode";
  }

  override getConfigPaths(): string[] {
    if (this.config.level === "user") {
      return [".opencode/opencode.json", ".opencode/opencode.jsonc"];
    }
    return ["opencode.json", "opencode.jsonc"];
  }

  override getMCPConfigPaths(): string[] {
    return this.getConfigPaths();
  }

  /**
   * Write MCP servers to opencode.jsonc
   * OpenCode uses:
   * - `mcp` field (not `mcpServers`)
   * - `type` field is required ("local" or "remote")
   * - `command` is an array of strings
   * - Environment variables use {env:VAR} format
   */
  override async writeMCPServers(servers: MCPServer[]): Promise<WriteResult> {
    const mcpConfigJsoncPath = await this.getMcpConfigPath();

    try {
      await fileOps.ensureDir(join(this.config.baseDir, this.getConfigDir()));

      // Read existing config or create new one
      const { data: config, text: jsoncText } =
        await fileOps.readJSONC<Record<string, unknown>>(mcpConfigJsoncPath);
      let currentText = jsoncText || "{}";
      const currentConfig = config || {};

      // Ensure mcp object exists by applying edit if needed
      if (!currentConfig.mcp || typeof currentConfig.mcp !== "object") {
        const edits = jsonc.modify(
          currentText,
          ["mcp"],
          {},
          {
            formattingOptions: {
              insertSpaces: true,
              tabSize: 2,
            },
          },
        );
        currentText = jsonc.applyEdits(currentText, edits);
      }

      // Add/update each server using targeted edits
      for (const server of servers) {
        const serverConfig: Record<string, unknown> = {};

        // Add type field (required for OpenCode)
        // Map stdio -> "local", http/oauth -> "remote"
        serverConfig.type = server.type === "stdio" ? "local" : "remote";

        // Add other fields
        if (server.command) {
          serverConfig.command = [
            server.command,
            ...(server.args ? server.args : []),
          ];
        }
        if (server.env) {
          // Convert environment variables to {env:VAR}
          serverConfig.environment = this.toOpenCodeEnvVars(server.env);
        }
        if (server.url) {
          serverConfig.url = server.url;
        }
        if (server.headers) {
          // Convert environment variables in headers
          serverConfig.headers = this.toOpenCodeEnvVars(server.headers);
        }
        if (server.auth) {
          serverConfig.oauth = this.toOpenCodeOAuth(server.auth);
        }

        // Apply edit for this specific server (preserves comments)
        const edits = jsonc.modify(
          currentText,
          ["mcp", server.name],
          serverConfig,
          {
            formattingOptions: {
              insertSpaces: true,
              tabSize: 2,
            },
          },
        );
        currentText = jsonc.applyEdits(currentText, edits);
      }

      // Write config (currentText already has all modifications applied)
      await atomicWrite(mcpConfigJsoncPath, currentText);

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
   * Convert environment variables recursively
   * ${env:VAR} or ${VAR} -> {env:VAR} (OpenCode format)
   */
  private toOpenCodeEnvVars(
    obj: Record<string, unknown>,
  ): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === "string") {
        result[key] = this.toOpenCodeEnvString(value);
      } else if (Array.isArray(value)) {
        result[key] = value.map((item) => {
          if (typeof item === "string") {
            return this.toOpenCodeEnvString(item);
          }
          if (item && typeof item === "object") {
            return this.toOpenCodeEnvVars(item as Record<string, unknown>);
          }
          return item;
        });
      } else if (typeof value === "object" && value !== null) {
        result[key] = this.toOpenCodeEnvVars(value as Record<string, unknown>);
      } else {
        result[key] = value;
      }
    }

    return result;
  }

  private toOpenCodeEnvString(value: string): string {
    const withEnvPrefix = value.replace(/\$\{env:([^}]+)\}/g, "{env:$1}");
    return withEnvPrefix.replace(/\$\{([A-Z0-9_]+)\}/g, "{env:$1}");
  }

  private fromOpenCodeEnvString(value: string): string {
    return value.replace(/\{env:([^}]+)\}/g, "${$1}");
  }

  private fromOpenCodeEnvVars(
    obj: Record<string, unknown>,
  ): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === "string") {
        result[key] = this.fromOpenCodeEnvString(value);
      } else if (Array.isArray(value)) {
        result[key] = value.map((item) => {
          if (typeof item === "string") {
            return this.fromOpenCodeEnvString(item);
          }
          if (item && typeof item === "object") {
            return this.fromOpenCodeEnvVars(item as Record<string, unknown>);
          }
          return item;
        });
      } else if (typeof value === "object" && value !== null) {
        result[key] = this.fromOpenCodeEnvVars(
          value as Record<string, unknown>,
        );
      } else {
        result[key] = value;
      }
    }

    return result;
  }

  private toOpenCodeOAuth(auth: MCPOAuth): Record<string, unknown> {
    const oauth: Record<string, unknown> = {};
    if (auth.client_id) {
      oauth.clientId = this.toOpenCodeEnvString(auth.client_id);
    }
    if (auth.client_secret) {
      oauth.clientSecret = this.toOpenCodeEnvString(auth.client_secret);
    }
    if (auth.scopes && auth.scopes.length > 0) {
      oauth.scope = auth.scopes.join(" ");
    }
    return oauth;
  }

  private fromOpenCodeOAuth(
    oauth: Record<string, unknown>,
  ): MCPOAuth | undefined {
    const auth: MCPOAuth = {
      client_id: "",
      client_secret: "",
    };

    if (typeof oauth.clientId === "string") {
      auth.client_id = this.fromOpenCodeEnvString(oauth.clientId);
    }
    if (typeof oauth.clientSecret === "string") {
      auth.client_secret = this.fromOpenCodeEnvString(oauth.clientSecret);
    }
    if (typeof oauth.scope === "string") {
      auth.scopes = oauth.scope.split(/\s+/).filter(Boolean);
    } else if (Array.isArray(oauth.scopes)) {
      auth.scopes = oauth.scopes.filter(
        (scope): scope is string => typeof scope === "string",
      );
    }

    if (!auth.client_id && !auth.client_secret && !auth.scopes?.length) {
      return undefined;
    }

    return auth;
  }

  /**
   * Delete an MCP server from opencode.jsonc
   */
  override async deleteMCPServer(name: string): Promise<void> {
    const mcpConfigJsoncPath = await this.getMcpConfigPath();

    const { data: config, text: jsoncText } =
      await fileOps.readJSONC<Record<string, unknown>>(mcpConfigJsoncPath);

    if (config?.mcp && typeof config.mcp === "object") {
      const mcpObj = config.mcp as Record<string, unknown>;

      // Check if server exists
      if (mcpObj[name] !== undefined) {
        // Use jsonc.modify to remove the server (preserves comments)
        const edits = jsonc.modify(jsoncText, ["mcp", name], undefined, {
          formattingOptions: {
            insertSpaces: true,
            tabSize: 2,
          },
        });
        const updatedText = jsonc.applyEdits(jsoncText, edits);

        await atomicWrite(mcpConfigJsoncPath, updatedText);
      }
    }
  }

  override async readMCPServers(): Promise<MCPServer[]> {
    const mcpConfigJsoncPath = await this.getMcpConfigPath();

    const { data: config } =
      await fileOps.readJSONC<Record<string, unknown>>(mcpConfigJsoncPath);

    if (!config?.mcp || typeof config.mcp !== "object") {
      return [];
    }

    const servers: MCPServer[] = [];
    for (const [name, serverConfig] of Object.entries(
      config.mcp as Record<string, unknown>,
    )) {
      const raw = serverConfig as Record<string, unknown>;
      const rawType =
        raw.type === "local" || raw.type === "remote" ? raw.type : null;
      if (!rawType) {
        console.warn(`Skipping MCP server ${name}: invalid type`);
        continue;
      }

      const isRemote = rawType === "remote";
      const server: MCPServer = {
        name,
        type: isRemote && raw.oauth ? "oauth" : isRemote ? "http" : "stdio",
        hash: "",
      };

      if (rawType === "local") {
        if (!Array.isArray(raw.command)) {
          console.warn(`Skipping MCP server ${name}: invalid command`);
          continue;
        }
        const [command, ...args] = raw.command;
        if (typeof command !== "string") {
          console.warn(`Skipping MCP server ${name}: invalid command`);
          continue;
        }
        server.command = command;
        const safeArgs = args.filter(
          (arg): arg is string => typeof arg === "string",
        );
        if (safeArgs.length > 0) {
          server.args = safeArgs;
        }
      } else {
        if (typeof raw.url !== "string") {
          console.warn(`Skipping MCP server ${name}: invalid url`);
          continue;
        }
        server.url = raw.url;
      }

      if (raw.environment && typeof raw.environment === "object") {
        server.env = this.fromOpenCodeEnvVars(
          raw.environment as Record<string, unknown>,
        ) as Record<string, string>;
      }
      if (raw.headers && typeof raw.headers === "object") {
        server.headers = this.fromOpenCodeEnvVars(
          raw.headers as Record<string, unknown>,
        ) as Record<string, string>;
      }
      if (isRemote && raw.oauth && typeof raw.oauth === "object") {
        const auth = this.fromOpenCodeOAuth(
          raw.oauth as Record<string, unknown>,
        );
        if (auth) {
          server.auth = auth;
        }
      }
      server.hash = hashMCPServer(server);
      servers.push(server);
    }
    return servers;
  }
}
