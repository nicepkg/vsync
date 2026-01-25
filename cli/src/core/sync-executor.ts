/**
 * Sync Executor - Handles synchronization for a single target tool
 *
 * Responsibilities:
 * - Collect items to sync based on diff operations
 * - Write items to target tool using adapter
 * - Track sync results (created, updated, deleted counts)
 * - Handle errors with detailed context
 *
 * Design Principles:
 * - Single Responsibility: Only executes sync for one target
 * - High Cohesion: All sync execution logic in one place
 * - Low Coupling: Depends on adapter interface, not concrete implementations
 */

import type { ToolAdapter } from "@src/adapters/base.js";
import type { Skill, MCPServer, Agent, Command } from "@src/types/models.js";
import type { DiffResult } from "@src/types/plan.js";

/**
 * Source data containing all items from the source tool
 */
export interface SourceData {
  skills: Skill[];
  mcpServers: MCPServer[];
  agents: Agent[];
  commands: Command[];
}

/**
 * Result of syncing a single target tool
 */
export interface SyncResult {
  /** Target tool name */
  tool: string;
  /** Whether sync was successful */
  success: boolean;
  /** Number of items created */
  created: number;
  /** Number of items updated */
  updated: number;
  /** Number of items deleted */
  deleted: number;
  /** List of error messages */
  errors: string[];
}

/**
 * Item type identifier
 */
type ItemType = "skill" | "mcp" | "agent" | "command";

/**
 * Generic item collector - DRY principle
 * Collects items of a specific type from source data based on operation names
 */
class ItemCollector {
  /**
   * Collect items for CREATE or UPDATE operations
   * @param operations - Operation names to collect
   * @param sourceItems - Source items to filter from
   * @returns Filtered items
   */
  collect<T extends { name: string }>(
    operations: Array<{ name: string }>,
    sourceItems: T[],
  ): T[] {
    return operations
      .map((op) => sourceItems.find((item) => item.name === op.name))
      .filter((item): item is T => item !== undefined);
  }
}

/**
 * Sync Executor - Executes sync operations for a single target
 *
 * This class encapsulates all sync execution logic, making it:
 * - Testable (can mock adapter)
 * - Reusable (works with any adapter)
 * - Maintainable (single place to update sync logic)
 */
export class SyncExecutor {
  private collector = new ItemCollector();

  constructor(
    private readonly adapter: ToolAdapter,
    private readonly sourceData: SourceData,
  ) {}

  /**
   * Execute sync operations for this target
   *
   * Process:
   * 1. Collect items to write (CREATE + UPDATE)
   * 2. Write each item type sequentially (preserve atomicity within type)
   * 3. Track results
   * 4. Propagate errors for rollback
   *
   * @param diff - Diff result containing operations to execute
   * @returns Sync result with counts and errors
   */
  async execute(diff: DiffResult): Promise<SyncResult> {
    const result: SyncResult = {
      tool: this.adapter.toolName,
      success: true,
      created: 0,
      updated: 0,
      deleted: 0,
      errors: [],
    };

    try {
      // Process each item type
      await this.writeSkills(diff, result);
      await this.writeMCPServers(diff, result);
      await this.writeAgents(diff, result);
      await this.writeCommands(diff, result);

      // TODO: Handle DELETE operations in future (prune mode)
    } catch (error) {
      result.success = false;
      // Error already added to result.errors in individual methods
      throw error; // Re-throw for rollback handling
    }

    return result;
  }

  /**
   * Write skills to target (DRY: extracted from duplicate code)
   */
  private async writeSkills(
    diff: DiffResult,
    result: SyncResult,
  ): Promise<void> {
    const toCreate = this.collectItemsByType(
      diff.toCreate,
      "skill",
      this.sourceData.skills,
    );
    const toUpdate = this.collectItemsByType(
      diff.toUpdate,
      "skill",
      this.sourceData.skills,
    );
    const allItems = [...toCreate, ...toUpdate];

    if (allItems.length > 0) {
      await this.writeItems(
        "skills",
        () => this.adapter.writeSkills(allItems),
        toCreate.length,
        toUpdate.length,
        result,
      );
    }
  }

  /**
   * Write MCP servers to target (DRY: extracted from duplicate code)
   */
  private async writeMCPServers(
    diff: DiffResult,
    result: SyncResult,
  ): Promise<void> {
    const toCreate = this.collectItemsByType(
      diff.toCreate,
      "mcp",
      this.sourceData.mcpServers,
    );
    const toUpdate = this.collectItemsByType(
      diff.toUpdate,
      "mcp",
      this.sourceData.mcpServers,
    );
    const allItems = [...toCreate, ...toUpdate];

    if (allItems.length > 0) {
      await this.writeItems(
        "MCP servers",
        () => this.adapter.writeMCPServers(allItems),
        toCreate.length,
        toUpdate.length,
        result,
      );
    }
  }

  /**
   * Write agents to target (DRY: extracted from duplicate code)
   */
  private async writeAgents(
    diff: DiffResult,
    result: SyncResult,
  ): Promise<void> {
    const toCreate = this.collectItemsByType(
      diff.toCreate,
      "agent",
      this.sourceData.agents,
    );
    const toUpdate = this.collectItemsByType(
      diff.toUpdate,
      "agent",
      this.sourceData.agents,
    );
    const allItems = [...toCreate, ...toUpdate];

    if (allItems.length > 0) {
      await this.writeItems(
        "agents",
        () => this.adapter.writeAgents(allItems),
        toCreate.length,
        toUpdate.length,
        result,
      );
    }
  }

  /**
   * Write commands to target (DRY: extracted from duplicate code)
   */
  private async writeCommands(
    diff: DiffResult,
    result: SyncResult,
  ): Promise<void> {
    const toCreate = this.collectItemsByType(
      diff.toCreate,
      "command",
      this.sourceData.commands,
    );
    const toUpdate = this.collectItemsByType(
      diff.toUpdate,
      "command",
      this.sourceData.commands,
    );
    const allItems = [...toCreate, ...toUpdate];

    if (allItems.length > 0) {
      await this.writeItems(
        "commands",
        () => this.adapter.writeCommands(allItems),
        toCreate.length,
        toUpdate.length,
        result,
      );
    }
  }

  /**
   * Generic write handler - DRY principle
   * Handles write operation with consistent error handling
   */
  private async writeItems(
    itemTypeName: string,
    writeFn: () => Promise<{ success: boolean; count: number; error?: string }>,
    createCount: number,
    updateCount: number,
    result: SyncResult,
  ): Promise<void> {
    try {
      const writeResult = await writeFn();

      if (writeResult.success) {
        result.created += createCount;
        result.updated += updateCount;
      } else {
        const errorMsg = writeResult.error || `Failed to write ${itemTypeName}`;
        result.errors.push(errorMsg);
        result.success = false;
        throw new Error(`${itemTypeName} write failed - initiating rollback`);
      }
    } catch (error) {
      const errorMsg = `Failed to write ${itemTypeName}: ${
        error instanceof Error ? error.message : String(error)
      }`;

      // Avoid duplicate error messages
      if (!result.errors.includes(errorMsg)) {
        result.errors.push(errorMsg);
      }
      result.success = false;
      throw error;
    }
  }

  /**
   * Collect items by type from operations - DRY principle
   * Type-safe generic function to filter items
   */
  private collectItemsByType<T extends { name: string }>(
    operations: Array<{ itemType: string; name: string }>,
    itemType: ItemType,
    sourceItems: T[],
  ): T[] {
    const filtered = operations.filter((op) => op.itemType === itemType);
    return this.collector.collect<T>(filtered, sourceItems);
  }
}
