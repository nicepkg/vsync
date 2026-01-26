/**
 * Manifest type definitions for vsync
 * Tracks sync status and hashes for all items
 * Stored in ~/.vsync/cache/<project-hash>/manifest.json
 */

import type { ToolName } from "./config.js";

/**
 * Type of configuration item
 */
export type ItemType = "skill" | "mcp" | "agent" | "command";

/**
 * Sync status for a specific target tool
 */
export interface TargetStatus {
  /** Whether the item was successfully synced */
  synced: boolean;
  /** Hash of the synced content */
  hash: string;
  /** Last sync timestamp (ISO 8601) */
  last_synced: string;
  /** Error message if sync failed */
  error?: string;
}

/**
 * Manifest item tracking a single skill, agent, or MCP server
 */
export interface ManifestItem {
  /** Item type */
  type: ItemType;
  /** Item name */
  name: string;
  /** Current hash from source */
  hash: string;
  /** Last time this item was synced */
  last_synced: string;
  /** Sync status for each target tool */
  targets: Partial<Record<ToolName, TargetStatus>>;
}

/**
 * Sync manifest
 * Records the sync state of all configuration items
 * Used for fast diff calculation
 */
export interface Manifest {
  /** Manifest format version */
  version: string;
  /** Last successful sync timestamp (ISO 8601) */
  last_synced: string;
  /** All tracked items, keyed by "type/name" */
  items: Record<string, ManifestItem>;
}
