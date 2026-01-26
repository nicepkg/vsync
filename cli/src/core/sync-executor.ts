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

import type { ToolAdapter, WriteResult } from "@src/adapters/base.js";
import type { ItemType } from "@src/types/manifest.js";
import type { Skill, MCPServer, Agent, Command } from "@src/types/models.js";
import type { DiffResult } from "@src/types/plan.js";
import { isUnsupportedFeature } from "@src/utils/errors.js";

/**
 * Type mapping for ItemType to concrete types
 * Enables type-safe generic operations without type assertions
 */
type ItemTypeMap = {
  skill: Skill;
  mcp: MCPServer;
  agent: Agent;
  command: Command;
};

/**
 * Source data containing all items from the source tool
 * Provides abstraction for data access
 */
export class SourceData {
  /**
   * Collection mapping (config-driven, eliminates switch statement)
   */
  private readonly collections: Record<
    ItemType,
    Array<{ name: string; hash?: string }>
  >;

  constructor(
    public readonly skills: Skill[],
    public readonly mcpServers: MCPServer[],
    public readonly agents: Agent[],
    public readonly commands: Command[],
  ) {
    // Initialize collection mapping once
    this.collections = {
      skill: this.skills,
      mcp: this.mcpServers,
      agent: this.agents,
      command: this.commands,
    };
  }

  /**
   * Get collection by item type (config-driven lookup)
   */
  private getCollection(
    itemType: ItemType,
  ): Array<{ name: string; hash?: string }> {
    return this.collections[itemType];
  }

  /**
   * Get hash for an item (replaces inline if-else chains)
   */
  getHash(itemType: ItemType, name: string): string {
    const collection = this.getCollection(itemType);
    const item = collection.find((i) => i.name === name);
    return item?.hash || "";
  }
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
 * Generic item handler interface
 * Uses type mapping to ensure type safety without assertions
 */
interface ItemHandler<T extends ItemType> {
  displayName: string;
  getSource: () => ItemTypeMap[T][];
  write: (items: ItemTypeMap[T][]) => Promise<WriteResult>;
  delete: (name: string) => Promise<void>;
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

  /**
   * Handler configuration map - fully type-safe without assertions
   * Initialized in constructor to access instance members
   * Each handler is properly typed to its corresponding ItemType
   */
  private readonly handlers: {
    readonly [K in ItemType]: ItemHandler<K>;
  };

  constructor(
    private readonly adapter: ToolAdapter,
    private readonly sourceData: SourceData,
  ) {
    // Initialize handlers with explicit types - no assertions needed
    this.handlers = {
      skill: {
        displayName: "skills",
        getSource: (): Skill[] => this.sourceData.skills,
        write: (items: Skill[]): Promise<WriteResult> =>
          this.adapter.writeSkills(items),
        delete: (name: string): Promise<void> => this.adapter.deleteSkill(name),
      },
      mcp: {
        displayName: "MCP servers",
        getSource: (): MCPServer[] => this.sourceData.mcpServers,
        write: (items: MCPServer[]): Promise<WriteResult> =>
          this.adapter.writeMCPServers(items),
        delete: (name: string): Promise<void> =>
          this.adapter.deleteMCPServer(name),
      },
      agent: {
        displayName: "agents",
        getSource: (): Agent[] => this.sourceData.agents,
        write: (items: Agent[]): Promise<WriteResult> =>
          this.adapter.writeAgents(items),
        delete: (name: string): Promise<void> => this.adapter.deleteAgent(name),
      },
      command: {
        displayName: "commands",
        getSource: (): Command[] => this.sourceData.commands,
        write: (items: Command[]): Promise<WriteResult> =>
          this.adapter.writeCommands(items),
        delete: (name: string): Promise<void> =>
          this.adapter.deleteCommand(name),
      },
    };
  }

  /**
   * Get type-safe handler for specific item type
   * Returns from configuration map - no type assertions needed
   */
  private getItemHandler<T extends ItemType>(itemType: T): ItemHandler<T> {
    return this.handlers[itemType];
  }

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
      // Process each item type (CREATE + UPDATE) using unified logic
      const itemTypes: ItemType[] = ["skill", "mcp", "agent", "command"];
      for (const itemType of itemTypes) {
        await this.writeItemType(diff, result, itemType);
      }

      // Process DELETE operations using unified logic
      for (const itemType of itemTypes) {
        await this.deleteItems(diff, result, itemType);
      }
    } catch (error) {
      result.success = false;
      // Error already added to result.errors in individual methods
      throw error; // Re-throw for rollback handling
    }

    return result;
  }

  /**
   * Unified write handler for any item type (Strategy pattern)
   * Eliminates 4x duplication of write methods
   * Uses generic type parameter to maintain type safety
   */
  private async writeItemType<T extends ItemType>(
    diff: DiffResult,
    result: SyncResult,
    itemType: T,
  ): Promise<void> {
    const handler = this.getItemHandler(itemType);
    const sourceItems = handler.getSource();

    const toCreate = this.collectItemsByType(
      diff.toCreate,
      itemType,
      sourceItems,
    );
    const toUpdate = this.collectItemsByType(
      diff.toUpdate,
      itemType,
      sourceItems,
    );
    const allItems = [...toCreate, ...toUpdate];

    if (allItems.length > 0) {
      await this.writeItems(
        handler.displayName,
        () => handler.write(allItems),
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
        // Use actual write count (may be 0 for symlinked directories)
        if (writeResult.count > 0) {
          result.created += createCount;
          result.updated += updateCount;
        }
      } else {
        // Skip gracefully if the tool doesn't support this feature
        if (isUnsupportedFeature(writeResult)) {
          // Tool doesn't support this feature - skip silently
          return;
        }

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

  /**
   * Delete items of a specific type (Strategy pattern - config-driven)
   * Eliminates switch statement duplication
   */
  private async deleteItems(
    diff: DiffResult,
    result: SyncResult,
    itemType: ItemType,
  ): Promise<void> {
    const toDelete = diff.toDelete.filter((op) => op.itemType === itemType);
    if (toDelete.length === 0) return;

    const names = toDelete.map((op) => op.name);
    const handler = this.getItemHandler(itemType);

    try {
      // Delete all items sequentially
      for (const name of names) {
        await handler.delete(name);
      }

      // All deletes successful
      result.deleted += names.length;
    } catch (error) {
      const errorMsg = `Failed to delete ${itemType}(s): ${
        error instanceof Error ? error.message : String(error)
      }`;

      if (!result.errors.includes(errorMsg)) {
        result.errors.push(errorMsg);
      }
      result.success = false;
      throw error;
    }
  }
}
