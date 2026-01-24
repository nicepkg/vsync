/**
 * Hash utilities for content integrity checking
 * Uses SHA256 for consistent, deterministic hashing
 */

import { createHash } from "node:crypto";
import type { Skill, Agent, MCPServer, Command } from "@src/types/models.js";

/**
 * Generate SHA256 hash of string content
 * @param content - Content to hash
 * @returns 64-character hex hash
 */
export function hashContent(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

/**
 * Generate hash for a skill
 * Includes content, metadata, and support files
 * Normalizes whitespace for consistent hashing
 *
 * @param skill - Skill to hash
 * @returns SHA256 hash
 */
export function hashSkill(skill: Skill): string {
  // Normalize content (trim trailing whitespace)
  const normalizedContent = skill.content.trim();

  // Sort and stringify metadata for consistent hashing
  const metadataStr = skill.metadata
    ? JSON.stringify(skill.metadata, Object.keys(skill.metadata).sort())
    : "";

  // Sort and stringify support files
  const supportFilesStr = skill.supportFiles
    ? JSON.stringify(skill.supportFiles, Object.keys(skill.supportFiles).sort())
    : "";

  // Combine all parts
  const combined = `${normalizedContent}\n${metadataStr}\n${supportFilesStr}`;

  return hashContent(combined);
}

/**
 * Generate hash for an agent
 * Includes content, metadata, and support files
 * Normalizes whitespace for consistent hashing
 * Uses the same algorithm as hashSkill since Agent and Skill have identical structure
 *
 * @param agent - Agent to hash
 * @returns SHA256 hash
 */
export function hashAgent(agent: Agent): string {
  // Normalize content (trim trailing whitespace)
  const normalizedContent = agent.content.trim();

  // Sort and stringify metadata for consistent hashing
  const metadataStr = agent.metadata
    ? JSON.stringify(agent.metadata, Object.keys(agent.metadata).sort())
    : "";

  // Sort and stringify support files
  const supportFilesStr = agent.supportFiles
    ? JSON.stringify(agent.supportFiles, Object.keys(agent.supportFiles).sort())
    : "";

  // Combine all parts
  const combined = `${normalizedContent}\n${metadataStr}\n${supportFilesStr}`;

  return hashContent(combined);
}

/**
 * Generate hash for a command
 * Includes content, metadata, and support files
 * Normalizes whitespace for consistent hashing
 * Uses the same algorithm as hashSkill and hashAgent
 *
 * @param command - Command to hash
 * @returns SHA256 hash
 */
export function hashCommand(command: Command): string {
  // Normalize content (trim trailing whitespace)
  const normalizedContent = command.content.trim();

  // Sort and stringify metadata for consistent hashing
  const metadataStr = command.metadata
    ? JSON.stringify(command.metadata, Object.keys(command.metadata).sort())
    : "";

  // Sort and stringify support files
  const supportFilesStr = command.supportFiles
    ? JSON.stringify(
        command.supportFiles,
        Object.keys(command.supportFiles).sort(),
      )
    : "";

  // Combine all parts
  const combined = `${normalizedContent}\n${metadataStr}\n${supportFilesStr}`;

  return hashContent(combined);
}

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
