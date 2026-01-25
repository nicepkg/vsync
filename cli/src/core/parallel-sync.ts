/**
 * Parallel Sync Orchestrator - Coordinates parallel synchronization across multiple targets
 *
 * Responsibilities:
 * - Execute sync for multiple targets in parallel
 * - Handle partial failures gracefully
 * - Coordinate rollback for failed targets
 * - Aggregate results from all targets
 *
 * Design Principles:
 * - Single Responsibility: Only orchestrates parallel execution
 * - Dependency Inversion: Depends on SyncExecutor interface
 * - Fail-Safe: Continues other syncs even if one fails (Promise.allSettled)
 */

import type { ToolAdapter } from "@src/adapters/base.js";
import type { DiffResult } from "@src/types/plan.js";
import {
  createBackup,
  restoreBackup,
  cleanupBackup,
  type BackupInfo,
} from "./rollback.js";
import {
  SyncExecutor,
  type SourceData,
  type SyncResult,
} from "./sync-executor.js";

/**
 * Configuration for a single target sync
 */
export interface TargetSyncConfig {
  /** Target tool adapter */
  adapter: ToolAdapter;
  /** Diff operations for this target */
  diff: DiffResult;
  /** Paths to backup before sync */
  backupPaths: string[];
}

/**
 * Result of parallel sync operation
 */
export interface ParallelSyncResult {
  /** Overall success (true if all targets succeeded) */
  success: boolean;
  /** Results for each target */
  targetResults: Map<string, SyncResult>;
  /** Targets that succeeded */
  succeeded: string[];
  /** Targets that failed */
  failed: string[];
  /** Total items created across all targets */
  totalCreated: number;
  /** Total items updated across all targets */
  totalUpdated: number;
  /** Total items deleted across all targets */
  totalDeleted: number;
}

/**
 * Parallel Sync Orchestrator
 *
 * Orchestrates synchronization across multiple target tools in parallel.
 * Uses Promise.allSettled to ensure all syncs complete (even if some fail).
 * Implements rollback for failed targets.
 */
export class ParallelSyncOrchestrator {
  constructor(private readonly sourceData: SourceData) {}

  /**
   * Execute sync operations for multiple targets in parallel
   *
   * Process:
   * 1. Create backups for all targets
   * 2. Execute syncs in parallel (Promise.allSettled)
   * 3. Rollback failed targets
   * 4. Cleanup backups for succeeded targets
   * 5. Aggregate and return results
   *
   * @param targets - Array of target sync configurations
   * @returns Aggregated results from all targets
   */
  async execute(targets: TargetSyncConfig[]): Promise<ParallelSyncResult> {
    // Phase 1: Create backups for all targets
    const backups = await this.createAllBackups(targets);

    // Phase 2: Execute syncs in parallel
    const syncResults = await this.executeSyncsInParallel(targets);

    // Phase 3: Process results and handle rollbacks
    const result = await this.processResults(syncResults, backups, targets);

    return result;
  }

  /**
   * Create backups for all targets in parallel
   */
  private async createAllBackups(
    targets: TargetSyncConfig[],
  ): Promise<Map<string, BackupInfo[]>> {
    const backupMap = new Map<string, BackupInfo[]>();

    // Create backups in parallel for each target
    const backupPromises = targets.map(async (target) => {
      const toolBackups = await this.createBackupsForTarget(target.backupPaths);
      return { tool: target.adapter.toolName, backups: toolBackups };
    });

    const backupResults = await Promise.allSettled(backupPromises);

    // Collect successful backups
    for (const result of backupResults) {
      if (result.status === "fulfilled") {
        backupMap.set(result.value.tool, result.value.backups);
      }
      // Ignore backup failures - sync will create new files anyway
    }

    return backupMap;
  }

  /**
   * Create backups for a single target's files
   */
  private async createBackupsForTarget(paths: string[]): Promise<BackupInfo[]> {
    const backupPromises = paths.map((path) => createBackup(path));
    const results = await Promise.allSettled(backupPromises);

    return results
      .filter(
        (r): r is PromiseFulfilledResult<BackupInfo> =>
          r.status === "fulfilled",
      )
      .map((r) => r.value);
  }

  /**
   * Execute syncs for all targets in parallel using Promise.allSettled
   *
   * Why allSettled instead of all?
   * - Ensures all syncs complete even if some fail
   * - Allows us to rollback failed targets while keeping successful ones
   * - Better for user experience (partial success > total failure)
   */
  private async executeSyncsInParallel(
    targets: TargetSyncConfig[],
  ): Promise<PromiseSettledResult<{ tool: string; result: SyncResult }>[]> {
    const syncPromises = targets.map(async (target) => {
      const executor = new SyncExecutor(target.adapter, this.sourceData);
      const result = await executor.execute(target.diff);
      return { tool: target.adapter.toolName, result };
    });

    return Promise.allSettled(syncPromises);
  }

  /**
   * Process sync results and handle rollbacks
   */
  private async processResults(
    syncResults: PromiseSettledResult<{ tool: string; result: SyncResult }>[],
    backups: Map<string, BackupInfo[]>,
    targets: TargetSyncConfig[],
  ): Promise<ParallelSyncResult> {
    const targetResults = new Map<string, SyncResult>();
    const succeeded: string[] = [];
    const failed: string[] = [];

    // Collect all cleanup/rollback operations to run in parallel
    const cleanupOperations: Promise<void>[] = [];

    // Categorize results - use index to map back to targets
    syncResults.forEach((settledResult, index) => {
      const target = targets[index];
      if (!target) {
        return; // Skip if somehow index is out of bounds
      }

      const tool = target.adapter.toolName;

      if (settledResult.status === "fulfilled") {
        const { result } = settledResult.value;
        targetResults.set(tool, result);

        if (result.success) {
          succeeded.push(tool);
          // Cleanup backups for successful sync
          const toolBackups = backups.get(tool) || [];
          cleanupOperations.push(this.cleanupBackups(toolBackups));
        } else {
          failed.push(tool);
          // Rollback failed sync
          const toolBackups = backups.get(tool) || [];
          cleanupOperations.push(this.rollbackTarget(tool, toolBackups));
        }
      } else {
        // Promise rejected - treat as failed sync
        const error = settledResult.reason;

        failed.push(tool);
        targetResults.set(tool, {
          tool,
          success: false,
          created: 0,
          updated: 0,
          deleted: 0,
          errors: [error instanceof Error ? error.message : String(error)],
        });

        // Rollback
        const toolBackups = backups.get(tool) || [];
        cleanupOperations.push(this.rollbackTarget(tool, toolBackups));
      }
    });

    // Wait for all cleanup/rollback operations to complete
    await Promise.all(cleanupOperations);

    // Aggregate statistics
    const { totalCreated, totalUpdated, totalDeleted } =
      this.aggregateStats(targetResults);

    return {
      success: failed.length === 0,
      targetResults,
      succeeded,
      failed,
      totalCreated,
      totalUpdated,
      totalDeleted,
    };
  }

  /**
   * Rollback a single target's changes
   */
  private async rollbackTarget(
    tool: string,
    backups: BackupInfo[],
  ): Promise<void> {
    try {
      await Promise.all(backups.map((backup) => restoreBackup(backup)));
    } catch (error) {
      // Log rollback failure but don't throw
      console.error(
        `Failed to rollback ${tool}:`,
        error instanceof Error ? error.message : error,
      );
    }
  }

  /**
   * Cleanup backups for successful sync
   */
  private async cleanupBackups(backups: BackupInfo[]): Promise<void> {
    await Promise.all(backups.map((backup) => cleanupBackup(backup)));
  }

  /**
   * Aggregate statistics from all target results
   */
  private aggregateStats(results: Map<string, SyncResult>): {
    totalCreated: number;
    totalUpdated: number;
    totalDeleted: number;
  } {
    let totalCreated = 0;
    let totalUpdated = 0;
    let totalDeleted = 0;

    for (const result of results.values()) {
      if (result.success) {
        totalCreated += result.created;
        totalUpdated += result.updated;
        totalDeleted += result.deleted;
      }
    }

    return { totalCreated, totalUpdated, totalDeleted };
  }
}
