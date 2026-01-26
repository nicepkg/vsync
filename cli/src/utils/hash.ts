/**
 * Hash utilities for content integrity checking
 * Uses SHA256 for consistent, deterministic hashing
 */

import { createHash } from "node:crypto";
import type {
  Skill,
  Agent,
  MCPServer,
  Command,
  BaseItem,
} from "@src/types/models.js";

/**
 * Generate SHA256 hash of string content
 * @param content - Content to hash
 * @returns 64-character hex hash
 */
export function hashContent(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

/**
 * Generic hash function for content-based items (Skill, Agent, Command)
 * Includes content, metadata, and support files
 * Normalizes whitespace for consistent hashing
 *
 * DRY: Single implementation for all BaseItem types
 *
 * @param item - Item to hash (Skill, Agent, or Command)
 * @returns SHA256 hash
 */
function hashBaseItem<T extends BaseItem>(item: T): string {
  // Normalize content (trim trailing whitespace)
  const normalizedContent = item.content.trim();

  // Sort and stringify metadata for consistent hashing
  const metadataStr = item.metadata
    ? JSON.stringify(item.metadata, Object.keys(item.metadata).sort())
    : "";

  // Sort and stringify support files
  const supportFilesStr = item.supportFiles
    ? JSON.stringify(item.supportFiles, Object.keys(item.supportFiles).sort())
    : "";

  // Combine all parts
  const combined = `${normalizedContent}\n${metadataStr}\n${supportFilesStr}`;

  return hashContent(combined);
}

/**
 * Generate hash for a skill
 * @param skill - Skill to hash
 * @returns SHA256 hash
 */
export const hashSkill = (skill: Skill): string => hashBaseItem(skill);

/**
 * Generate hash for an agent
 * @param agent - Agent to hash
 * @returns SHA256 hash
 */
export const hashAgent = (agent: Agent): string => hashBaseItem(agent);

/**
 * Generate hash for a command
 * @param command - Command to hash
 * @returns SHA256 hash
 */
export const hashCommand = (command: Command): string => hashBaseItem(command);

/**
 * Generate hash for an MCP server configuration
 * Includes all configuration fields except name
 * Preserves environment variable format
 *
 * @param server - MCP server to hash
 * @returns SHA256 hash
 */
export function hashMCPServer(server: MCPServer): string {
  // Create a stable representation of the server config
  const config: Record<string, unknown> = {
    type: server.type,
  };

  // Add stdio-specific fields
  if (server.command !== undefined) {
    config.command = server.command;
  }
  if (server.args !== undefined) {
    config.args = server.args;
  }

  // Add HTTP/OAuth-specific fields
  if (server.url !== undefined) {
    config.url = server.url;
  }
  if (server.headers !== undefined) {
    // Sort headers for consistent hashing
    config.headers = JSON.stringify(
      server.headers,
      Object.keys(server.headers).sort(),
    );
  }
  if (server.auth !== undefined) {
    // Sort auth fields for consistent hashing
    config.auth = JSON.stringify(server.auth, Object.keys(server.auth).sort());
  }

  // Add env vars (sorted for consistency)
  if (server.env !== undefined) {
    config.env = JSON.stringify(server.env, Object.keys(server.env).sort());
  }

  // Stringify with sorted keys for deterministic output
  const configStr = JSON.stringify(config, Object.keys(config).sort());

  return hashContent(configStr);
}
