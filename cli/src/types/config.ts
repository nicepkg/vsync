/**
 * Configuration type definitions for vibe-sync
 * Defines the structure of .vibe-sync.json
 */

import type { ADAPTERS } from "../adapters/registry.js";

/**
 * Sync mode
 * - safe: Only create/update, never delete
 * - prune: Strict mirror, delete items not in source
 */
export type SyncMode = "safe" | "prune";

/**
 * Infer adapter instance type from ADAPTERS array
 */
type AdapterInstance = InstanceType<(typeof ADAPTERS)[number]>;

/**
 * Supported AI coding tools
 * Auto-inferred from adapter registry - no manual maintenance needed!
 */
export type ToolName = AdapterInstance["toolName"];

/**
 * Configuration level
 * - project: Project-specific config (.vibe-sync.json)
 * - user: Global user config (~/.vibe-sync.json)
 */
export type ConfigLevel = "project" | "user";

/**
 * Sync configuration - what to synchronize
 */
export interface SyncConfig {
  /** Synchronize skills */
  skills: boolean;
  /** Synchronize MCP servers */
  mcp: boolean;
  /** Synchronize agents (optional, v1.1+) */
  agents?: boolean;
  /** Synchronize commands (optional, v1.1+) */
  commands?: boolean;
}

/**
 * Main vibe-sync configuration
 * Stored in .vibe-sync.json (project) or ~/.vibe-sync.json (user)
 */
export interface VibeConfig {
  /** JSON schema URL (optional) */
  $schema?: string;
  /** Config version */
  version: string;
  /** Configuration level */
  level: ConfigLevel;
  /** Source tool to read configuration from */
  source_tool: ToolName;
  /** Target tools to sync configuration to */
  target_tools: ToolName[];
  /** What to synchronize */
  sync_config: SyncConfig;
  /** Last successful sync timestamp (ISO 8601) */
  last_sync?: string;
}
