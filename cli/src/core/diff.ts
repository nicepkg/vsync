/**
 * Difference calculator
 * Compares source and target configurations to generate sync operations
 */

import type { SyncMode, ToolName } from "@src/types/config.js";
import type { Manifest, ItemType } from "@src/types/manifest.js";
import type { Skill, MCPServer, Agent, Command } from "@src/types/models.js";
import type { DiffResult, Operation, OperationType } from "@src/types/plan.js";

/**
 * Input for diff calculation
 */
export interface DiffInput {
  /** Skills from source tool */
  sourceSkills: Skill[];
  /** Skills from target tool */
  targetSkills: Skill[];
  /** MCP servers from source tool */
  sourceMCPServers: MCPServer[];
  /** MCP servers from target tool */
  targetMCPServers: MCPServer[];
  /** Agents from source tool */
  sourceAgents: Agent[];
  /** Agents from target tool */
  targetAgents: Agent[];
  /** Commands from source tool */
  sourceCommands: Command[];
  /** Commands from target tool */
  targetCommands: Command[];
  /** Current manifest */
  manifest: Manifest;
  /** Sync mode */
  mode: SyncMode;
  /** Target tool name */
  targetTool: ToolName;
}

/**
 * Hash comparison result
 */
export interface HashComparison {
  /** Operation to perform */
  operation: OperationType;
  /** Reason for the operation */
  reason: string;
}

/**
 * Compare hashes to determine operation
 *
 * @param sourceHash - Hash from source tool (null if not in source)
 * @param targetHash - Hash from target tool (null if not in target)
 * @param manifestHash - Hash from manifest (null if not in manifest)
 * @param mode - Sync mode (safe or prune)
 * @returns Hash comparison result
 */
export function compareHashes(
  sourceHash: string | null,
  targetHash: string | null,
  manifestHash: string | null,
  mode: SyncMode,
): HashComparison {
  // Case 1: Item not in source
  if (sourceHash === null) {
    if (mode === "prune") {
      return {
        operation: "delete" as OperationType,
        reason: "Item removed from source (prune mode)",
      };
    }
    return {
      operation: "skip" as OperationType,
      reason: "Item not in source (safe mode - skipped)",
    };
  }

  // Case 2: Item not in target
  if (targetHash === null) {
    return {
      operation: "create" as OperationType,
      reason: "Item not in target",
    };
  }

  // Case 3: All hashes match
  if (sourceHash === targetHash && sourceHash === manifestHash) {
    return {
      operation: "skip" as OperationType,
      reason: "Item up to date",
    };
  }

  // Case 4: Source and target match (but manifest different or missing)
  if (sourceHash === targetHash) {
    return {
      operation: "skip" as OperationType,
      reason: "Item up to date",
    };
  }

  // Case 5: Target modified (target hash != manifest hash)
  if (manifestHash !== null && targetHash !== manifestHash) {
    return {
      operation: "update" as OperationType,
      reason: "Item modified in target - will overwrite with source",
    };
  }

  // Case 6: Source changed (source hash != target hash)
  return {
    operation: "update" as OperationType,
    reason: "Item content changed in source",
  };
}

/**
 * Calculate difference between source and target
 *
 * @param input - Diff input parameters
 * @returns Diff result with operations for skills and MCP servers
 */
export function calculateDiff(input: DiffInput): DiffResult {
  const {
    sourceSkills,
    targetSkills,
    sourceMCPServers,
    targetMCPServers,
    sourceAgents,
    targetAgents,
    sourceCommands,
    targetCommands,
    manifest,
    mode,
    targetTool,
  } = input;

  // Arrays to collect operations (will be populated by pure functions)
  const toCreate: Operation[] = [];
  const toUpdate: Operation[] = [];
  const toDelete: Operation[] = [];
  const toSkip: Operation[] = [];

  // Create maps for efficient lookup
  const targetSkillMap = new Map(targetSkills.map((s) => [s.name, s]));
  const sourceSkillMap = new Map(sourceSkills.map((s) => [s.name, s]));
  const targetMCPMap = new Map(targetMCPServers.map((m) => [m.name, m]));
  const sourceMCPMap = new Map(sourceMCPServers.map((m) => [m.name, m]));
  const targetAgentMap = new Map(targetAgents.map((a) => [a.name, a]));
  const sourceAgentMap = new Map(sourceAgents.map((a) => [a.name, a]));
  const targetCommandMap = new Map(targetCommands.map((c) => [c.name, c]));
  const sourceCommandMap = new Map(sourceCommands.map((c) => [c.name, c]));

  /**
   * Pure function to process source items
   * Returns operations instead of modifying external state
   */
  function processSourceItems<T extends { name: string; hash: string }>(
    sourceItems: T[],
    targetMap: Map<string, T>,
    itemType: ItemType,
  ): {
    toCreate: Operation[];
    toUpdate: Operation[];
    toSkip: Operation[];
  } {
    const result = {
      toCreate: [] as Operation[],
      toUpdate: [] as Operation[],
      toSkip: [] as Operation[],
    };

    for (const sourceItem of sourceItems) {
      const targetItem = targetMap.get(sourceItem.name);
      const manifestItem = manifest.items[`${itemType}/${sourceItem.name}`];

      const comparison = compareHashes(
        sourceItem.hash,
        targetItem?.hash ?? null,
        manifestItem?.targets[targetTool]?.hash ?? null,
        mode,
      );

      const operation: Operation = {
        type: comparison.operation,
        itemType,
        name: sourceItem.name,
        description: comparison.reason,
        reason: comparison.reason,
      };

      if (sourceItem.hash) {
        operation.newHash = sourceItem.hash;
      }

      if (targetItem?.hash) {
        operation.oldHash = targetItem.hash;
      }

      // Dispatch to appropriate array
      switch (comparison.operation) {
        case "create":
          result.toCreate.push(operation);
          break;
        case "update":
          result.toUpdate.push(operation);
          break;
        case "skip":
          result.toSkip.push(operation);
          break;
      }
    }

    return result;
  }

  /**
   * Pure function to process target items for deletion
   * Returns operations instead of modifying external state
   */
  function processTargetItems<T extends { name: string; hash: string }>(
    targetItems: T[],
    sourceMap: Map<string, T>,
    itemType: ItemType,
  ): Operation[] {
    const toDelete: Operation[] = [];

    for (const targetItem of targetItems) {
      if (!sourceMap.has(targetItem.name)) {
        const manifestItem = manifest.items[`${itemType}/${targetItem.name}`];

        const comparison = compareHashes(
          null,
          targetItem.hash,
          manifestItem?.targets[targetTool]?.hash ?? null,
          mode,
        );

        if (comparison.operation === "delete") {
          toDelete.push({
            type: "delete",
            itemType,
            name: targetItem.name,
            description: comparison.reason,
            oldHash: targetItem.hash,
            reason: comparison.reason,
          });
        }
      }
    }

    return toDelete;
  }

  // Process all item types using pure functions (returns results)
  const skillsResult = processSourceItems(
    sourceSkills,
    targetSkillMap,
    "skill",
  );
  toCreate.push(...skillsResult.toCreate);
  toUpdate.push(...skillsResult.toUpdate);
  toSkip.push(...skillsResult.toSkip);
  toDelete.push(...processTargetItems(targetSkills, sourceSkillMap, "skill"));

  const mcpResult = processSourceItems(sourceMCPServers, targetMCPMap, "mcp");
  toCreate.push(...mcpResult.toCreate);
  toUpdate.push(...mcpResult.toUpdate);
  toSkip.push(...mcpResult.toSkip);
  toDelete.push(...processTargetItems(targetMCPServers, sourceMCPMap, "mcp"));

  const agentsResult = processSourceItems(
    sourceAgents,
    targetAgentMap,
    "agent",
  );
  toCreate.push(...agentsResult.toCreate);
  toUpdate.push(...agentsResult.toUpdate);
  toSkip.push(...agentsResult.toSkip);
  toDelete.push(...processTargetItems(targetAgents, sourceAgentMap, "agent"));

  const commandsResult = processSourceItems(
    sourceCommands,
    targetCommandMap,
    "command",
  );
  toCreate.push(...commandsResult.toCreate);
  toUpdate.push(...commandsResult.toUpdate);
  toSkip.push(...commandsResult.toSkip);
  toDelete.push(
    ...processTargetItems(targetCommands, sourceCommandMap, "command"),
  );

  // Process manifest items for this target that are not in source or target
  // This handles delete detection for write-only targets where we can't read
  for (const item of Object.values(manifest.items)) {
    // Check if this item was synced to this target
    if (!item.targets[targetTool]?.synced) {
      continue;
    }

    // Check if item is already processed (in source or target)
    let inSource = false;
    let inTarget = false;

    if (item.type === "skill") {
      inSource = sourceSkillMap.has(item.name);
      inTarget = targetSkillMap.has(item.name);
    } else if (item.type === "mcp") {
      inSource = sourceMCPMap.has(item.name);
      inTarget = targetMCPMap.has(item.name);
    } else if (item.type === "agent") {
      inSource = sourceAgentMap.has(item.name);
      inTarget = targetAgentMap.has(item.name);
    } else if (item.type === "command") {
      inSource = sourceCommandMap.has(item.name);
      inTarget = targetCommandMap.has(item.name);
    }

    // Skip if already in source or target (already processed above)
    if (inSource || inTarget) {
      continue;
    }

    // Item was synced to target, not in source, not in target
    // This means it should be deleted (if prune mode)
    const comparison = compareHashes(null, null, item.hash, mode);

    if (comparison.operation === "delete") {
      toDelete.push({
        type: "delete",
        itemType: item.type,
        name: item.name,
        description: comparison.reason,
        oldHash: item.hash,
        reason: comparison.reason,
      });
    }
  }

  return {
    tool: targetTool,
    toCreate,
    toUpdate,
    toDelete,
    toSkip,
  };
}
