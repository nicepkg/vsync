/**
 * Configuration type definitions for vibe-sync
 * Defines the structure of .vibe-sync.json
 */

/**
 * Sync mode
 * - safe: Only create/update, never delete
 * - prune: Strict mirror, delete items not in source
 */
export type SyncMode = "safe" | "prune";

/**
 * Supported AI coding tools
 */
export type ToolName = "claude-code" | "cursor" | "opencode";

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
