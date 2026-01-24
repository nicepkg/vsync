/**
 * Difference calculator
 * Compares source and target configurations to generate sync operations
 */

import type { SyncMode, ToolName } from "../types/config.js";
import type { Manifest } from "../types/manifest.js";
import type { Skill, MCPServer } from "../types/models.js";
import type { DiffResult, Operation, OperationType } from "../types/plan.js";

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
    manifest,
    mode,
    targetTool,
  } = input;

  const toCreate: Operation[] = [];
  const toUpdate: Operation[] = [];
  const toDelete: Operation[] = [];
  const toSkip: Operation[] = [];

  // Create maps for efficient lookup
  const targetSkillMap = new Map(targetSkills.map((s) => [s.name, s]));
  const sourceSkillMap = new Map(sourceSkills.map((s) => [s.name, s]));
  const targetMCPMap = new Map(targetMCPServers.map((m) => [m.name, m]));
  const sourceMCPMap = new Map(sourceMCPServers.map((m) => [m.name, m]));

  // Process skills from source
  for (const sourceSkill of sourceSkills) {
    const targetSkill = targetSkillMap.get(sourceSkill.name);
    const manifestItem = manifest.items[sourceSkill.name];

    const comparison = compareHashes(
      sourceSkill.hash,
      targetSkill?.hash ?? null,
      manifestItem?.hash ?? null,
      mode,
    );

    const operation: Operation = {
      type: comparison.operation,
      itemType: "skill",
      name: sourceSkill.name,
      description: comparison.reason,
      reason: comparison.reason,
    };

    // Add newHash
    if (sourceSkill.hash) {
      operation.newHash = sourceSkill.hash;
    }

    // Add oldHash if exists
    if (targetSkill?.hash) {
      operation.oldHash = targetSkill.hash;
    }

    switch (comparison.operation) {
      case "create":
        toCreate.push(operation);
        break;
      case "update":
        toUpdate.push(operation);
        break;
      case "skip":
        toSkip.push(operation);
        break;
    }
  }

  // Process skills in target but not in source (potential deletes)
  for (const targetSkill of targetSkills) {
    if (!sourceSkillMap.has(targetSkill.name)) {
      const manifestItem = manifest.items[targetSkill.name];

      const comparison = compareHashes(
        null,
        targetSkill.hash,
        manifestItem?.hash ?? null,
        mode,
      );

      if (comparison.operation === "delete") {
        toDelete.push({
          type: "delete",
          itemType: "skill",
          name: targetSkill.name,
          description: comparison.reason,
          oldHash: targetSkill.hash,
          reason: comparison.reason,
        });
      }
    }
  }

  // Process MCP servers from source
  for (const sourceMCP of sourceMCPServers) {
    const targetMCP = targetMCPMap.get(sourceMCP.name);
    const manifestItem = manifest.items[sourceMCP.name];

    const comparison = compareHashes(
      sourceMCP.hash,
      targetMCP?.hash ?? null,
      manifestItem?.hash ?? null,
      mode,
    );

    const operation: Operation = {
      type: comparison.operation,
      itemType: "mcp",
      name: sourceMCP.name,
      description: comparison.reason,
      reason: comparison.reason,
    };

    // Add newHash
    if (sourceMCP.hash) {
      operation.newHash = sourceMCP.hash;
    }

    // Add oldHash if exists
    if (targetMCP?.hash) {
      operation.oldHash = targetMCP.hash;
    }

    switch (comparison.operation) {
      case "create":
        toCreate.push(operation);
        break;
      case "update":
        toUpdate.push(operation);
        break;
      case "skip":
        toSkip.push(operation);
        break;
    }
  }

  // Process MCP servers in target but not in source (potential deletes)
  for (const targetMCP of targetMCPServers) {
    if (!sourceMCPMap.has(targetMCP.name)) {
      const manifestItem = manifest.items[targetMCP.name];

      const comparison = compareHashes(
        null,
        targetMCP.hash,
        manifestItem?.hash ?? null,
        mode,
      );

      if (comparison.operation === "delete") {
        toDelete.push({
          type: "delete",
          itemType: "mcp",
          name: targetMCP.name,
          description: comparison.reason,
          oldHash: targetMCP.hash,
          reason: comparison.reason,
        });
      }
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
