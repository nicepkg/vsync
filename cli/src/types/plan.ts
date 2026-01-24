/**
 * Sync plan type definitions for vibe-sync
 * Defines the structure of diff results and sync plans
 */

import type { ToolName } from "./config.js";
import type { ItemType } from "./manifest.js";

/**
 * Type of sync operation
 */
export type OperationType = "create" | "update" | "delete" | "skip";

/**
 * A single sync operation to perform on a target tool
 */
export interface Operation {
  /** Operation type */
  type: OperationType;
  /** Type of item (skill or mcp) */
  itemType: ItemType;
  /** Item name */
  name: string;
  /** Human-readable description of the operation */
  description: string;
  /** Old hash (for update operations) */
  oldHash?: string;
  /** New hash (for update operations) */
  newHash?: string;
  /** Reason for skip (for skip operations) */
  reason?: string;
}

/**
 * Diff result for a single target tool
 * Contains all operations to perform
 */
export interface DiffResult {
  /** Target tool name */
  tool: ToolName;
  /** Items to create (not in target) */
  toCreate: Operation[];
  /** Items to update (hash mismatch) */
  toUpdate: Operation[];
  /** Items to delete (in target but not in source, prune mode only) */
  toDelete: Operation[];
  /** Items to skip (no changes needed) */
  toSkip: Operation[];
}

/**
 * Complete sync plan for all target tools
 */
export interface SyncPlan {
  /** Source tool */
  source_tool: ToolName;
  /** Diff results for each target tool */
  diffs: Partial<Record<ToolName, DiffResult>>;
  /** Timestamp when plan was generated (ISO 8601) */
  timestamp: string;
}
