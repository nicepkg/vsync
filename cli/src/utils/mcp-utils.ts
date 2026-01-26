/**
 * MCP Server utilities
 * Shared logic for MCP server operations across adapters
 *
 * DRY: Centralizes MCP type inference to eliminate duplicate logic in adapters
 */

import type { MCPServer, MCPType } from "@src/types/models.js";

/**
 * Infer MCP server type from raw configuration
 * Determines whether server is stdio, http, or oauth based on config fields
 *
 * @param config - Raw server configuration object
 * @returns Inferred MCP type
 */
export function inferMCPType(config: Record<string, unknown>): MCPType {
  const hasCommand = typeof config.command === "string";
  const hasAuth = config.auth !== undefined && typeof config.auth === "object";
  const hasUrl = typeof config.url === "string";

  // Priority: command (stdio) > auth (oauth) > url (http) > default (stdio)
  if (hasCommand) return "stdio";
  if (hasAuth) return "oauth";
  if (hasUrl) return "http";
  return "stdio";
}

/**
 * Build common optional fields for MCP server from raw config
 * Extracts command, args, env, url, headers fields if present
 *
 * @param server - MCP server object to populate
 * @param rawConfig - Raw configuration object
 */
export function populateCommonMCPFields(
  server: MCPServer,
  rawConfig: Record<string, unknown>,
): void {
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
}
