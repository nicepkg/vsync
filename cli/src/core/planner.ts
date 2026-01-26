/**
 * Plan generator
 * Generates sync plans by calculating diffs for all target tools
 */

import type { AdapterCapabilities } from "@src/adapters/base.js";
import type { SyncMode, ToolName } from "@src/types/config.js";
import type { Manifest } from "@src/types/manifest.js";
import type { Skill, MCPServer, Agent, Command } from "@src/types/models.js";
import type { SyncPlan, DiffResult } from "@src/types/plan.js";
import { t } from "@src/utils/i18n.js";
import { calculateDiff, type DiffInput } from "./diff.js";

/**
 * Validation thresholds
 */
const VALIDATION_THRESHOLDS = {
  /** Warn when total operations exceed this threshold */
  LARGE_OPERATION_COUNT: 50,
  /** Warn when delete operations exceed this threshold in prune mode */
  MAX_DELETES_WITHOUT_WARNING: 10,
} as const;

/**
 * Input for plan generation
 */
export interface PlanInput {
  /** Skills from source tool */
  sourceSkills: Skill[];
  /** MCP servers from source tool */
  sourceMCPServers: MCPServer[];
  /** Agents from source tool */
  sourceAgents: Agent[];
  /** Commands from source tool */
  sourceCommands: Command[];
  /** Skills from each target tool */
  targetSkills: Partial<Record<ToolName, Skill[]>>;
  /** MCP servers from each target tool */
  targetMCPServers: Partial<Record<ToolName, MCPServer[]>>;
  /** Agents from each target tool */
  targetAgents: Partial<Record<ToolName, Agent[]>>;
  /** Commands from each target tool */
  targetCommands: Partial<Record<ToolName, Command[]>>;
  /** Capabilities of each target tool */
  targetCapabilities: Partial<Record<ToolName, AdapterCapabilities>>;
  /** Current manifest */
  manifest: Manifest;
  /** Sync mode */
  mode: SyncMode;
  /** Source tool name */
  sourceTool: ToolName;
  /** Target tool names */
  targetTools: ToolName[];
}

/**
 * Plan validation result
 */
export interface PlanValidation {
  /** Whether the plan is valid */
  valid: boolean;
  /** Validation errors */
  errors: string[];
  /** Validation warnings */
  warnings?: string[];
}

/**
 * Generate sync plan for all target tools
 *
 * @param input - Plan input parameters
 * @returns Complete sync plan
 */
export function generatePlan(input: PlanInput): SyncPlan {
  const {
    sourceSkills,
    sourceMCPServers,
    sourceAgents,
    sourceCommands,
    targetSkills,
    targetMCPServers,
    targetAgents,
    targetCommands,
    targetCapabilities,
    manifest,
    mode,
    sourceTool,
    targetTools,
  } = input;

  const diffs: Partial<Record<ToolName, DiffResult>> = {};

  // Calculate diff for each target tool
  for (const targetTool of targetTools) {
    const capabilities = targetCapabilities[targetTool] || {
      skills: true,
      mcp: true,
      agents: true,
      commands: true,
    };

    // Filter source data based on target capabilities
    // Don't generate operations for unsupported features
    const diffInput: DiffInput = {
      sourceSkills: capabilities.skills ? sourceSkills : [],
      targetSkills: targetSkills[targetTool] || [],
      sourceMCPServers: capabilities.mcp ? sourceMCPServers : [],
      targetMCPServers: targetMCPServers[targetTool] || [],
      sourceAgents: capabilities.agents ? sourceAgents : [],
      targetAgents: targetAgents[targetTool] || [],
      sourceCommands: capabilities.commands ? sourceCommands : [],
      targetCommands: targetCommands[targetTool] || [],
      manifest,
      mode,
      targetTool,
      targetCapabilities: capabilities,
    };

    diffs[targetTool] = calculateDiff(diffInput);
  }

  return {
    source_tool: sourceTool,
    diffs,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Format plan for display
 * Uses ANSI colors for terminal output
 *
 * @param plan - Sync plan to format
 * @returns Formatted plan string
 */
export function formatPlan(plan: SyncPlan): string {
  const lines: string[] = [];

  // Header
  lines.push("");
  lines.push(t("planner.header", { source: plan.source_tool }));
  lines.push(t("planner.separator").repeat(60));
  lines.push("");

  // Check if plan is empty
  const hasOperations = Object.values(plan.diffs).some(
    (diff) =>
      diff &&
      (diff.toCreate.length > 0 ||
        diff.toUpdate.length > 0 ||
        diff.toDelete.length > 0),
  );

  if (!hasOperations) {
    lines.push(t("planner.noChanges"));
    lines.push("");
    return lines.join("\n");
  }

  // Calculate totals first
  let totalCreate = 0;
  let totalUpdate = 0;
  let totalDelete = 0;
  const targetTools = Object.keys(plan.diffs);

  for (const diff of Object.values(plan.diffs)) {
    if (!diff) continue;
    totalCreate += diff.toCreate.length;
    totalUpdate += diff.toUpdate.length;
    totalDelete += diff.toDelete.length;
  }

  // Show summary first
  lines.push(
    t("planner.targetsInfo", {
      tools: targetTools.join(", "),
      count: targetTools.length.toString(),
    }),
  );
  lines.push("");

  // Group operations by item (when same items go to multiple targets)
  const itemOperations = new Map<
    string,
    {
      type: string;
      name: string;
      targets: string[];
      operation: "CREATE" | "UPDATE" | "DELETE";
      description?: string;
    }
  >();

  // DRY: Generic operation processor (eliminates 3x duplication)
  const processOperations = (
    operations: Array<{
      itemType: string;
      name: string;
      description?: string;
    }>,
    operationType: "CREATE" | "UPDATE" | "DELETE",
    toolName: string,
  ) => {
    for (const op of operations) {
      const key = `${operationType}:${op.itemType}:${op.name}`;
      if (!itemOperations.has(key)) {
        const item: {
          type: string;
          name: string;
          targets: string[];
          operation: "CREATE" | "UPDATE" | "DELETE";
          description?: string;
        } = {
          type: op.itemType,
          name: op.name,
          targets: [],
          operation: operationType,
        };
        // Only set description if it exists (exactOptionalPropertyTypes compliance)
        if (op.description !== undefined) {
          item.description = op.description;
        }
        itemOperations.set(key, item);
      }
      itemOperations.get(key)!.targets.push(toolName);
    }
  };

  for (const [toolName, diff] of Object.entries(plan.diffs)) {
    if (!diff) continue;

    // Process all operation types using unified logic
    processOperations(diff.toCreate, "CREATE", toolName);
    processOperations(diff.toUpdate, "UPDATE", toolName);
    processOperations(diff.toDelete, "DELETE", toolName);
  }

  // Format grouped operations
  const createOps = Array.from(itemOperations.values()).filter(
    (op) => op.operation === "CREATE",
  );
  const updateOps = Array.from(itemOperations.values()).filter(
    (op) => op.operation === "UPDATE",
  );
  const deleteOps = Array.from(itemOperations.values()).filter(
    (op) => op.operation === "DELETE",
  );

  if (createOps.length > 0) {
    // Calculate actual operation count (items × targets for each item)
    const createOpCount = createOps.reduce(
      (sum, op) => sum + op.targets.length,
      0,
    );
    lines.push(
      `✨ CREATE (${createOpCount} ${createOpCount === 1 ? "operation" : "operations"}):`,
    );
    for (const op of createOps) {
      const targetStr =
        op.targets.length === targetTools.length
          ? t("planner.allTargets")
          : op.targets.join(", ");
      lines.push(`   + [${op.type}] ${op.name} → ${targetStr}`);
    }
    lines.push("");
  }

  if (updateOps.length > 0) {
    // Calculate actual operation count (items × targets for each item)
    const updateOpCount = updateOps.reduce(
      (sum, op) => sum + op.targets.length,
      0,
    );
    lines.push(
      `🔄 UPDATE (${updateOpCount} ${updateOpCount === 1 ? "operation" : "operations"}):`,
    );
    for (const op of updateOps) {
      const targetStr =
        op.targets.length === targetTools.length
          ? t("planner.allTargets")
          : op.targets.join(", ");
      lines.push(`   ~ [${op.type}] ${op.name} → ${targetStr}`);
    }
    lines.push("");
  }

  if (deleteOps.length > 0) {
    // Calculate actual operation count (items × targets for each item)
    const deleteOpCount = deleteOps.reduce(
      (sum, op) => sum + op.targets.length,
      0,
    );
    lines.push(
      `🗑️  DELETE (${deleteOpCount} ${deleteOpCount === 1 ? "operation" : "operations"}):`,
    );
    for (const op of deleteOps) {
      const targetStr =
        op.targets.length === targetTools.length
          ? t("planner.allTargets")
          : op.targets.join(", ");
      lines.push(`   - [${op.type}] ${op.name} → ${targetStr}`);
    }
    lines.push("");
  }

  // Show total operations summary
  lines.push(t("planner.separator").repeat(60));
  lines.push(
    t("planner.totalSummary", {
      create: totalCreate.toString(),
      update: totalUpdate.toString(),
      delete: totalDelete.toString(),
    }),
  );

  return lines.join("\n");
}

/**
 * Validate plan safety
 *
 * @param plan - Sync plan to validate
 * @returns Validation result
 */
export function validatePlan(plan: SyncPlan): PlanValidation {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check if plan has target tools
  if (Object.keys(plan.diffs).length === 0) {
    errors.push(t("planner.validation.noTargets"));
  }

  // Check for delete operations
  let hasDeletes = false;
  let deleteCount = 0;

  for (const diff of Object.values(plan.diffs)) {
    if (!diff) continue;

    if (diff.toDelete.length > 0) {
      hasDeletes = true;
      deleteCount += diff.toDelete.length;
    }
  }

  if (hasDeletes) {
    warnings.push(
      t("planner.validation.deleteWarning", { count: deleteCount.toString() }),
    );
  }

  // Check for large operations
  let totalOps = 0;
  for (const diff of Object.values(plan.diffs)) {
    if (!diff) continue;
    totalOps +=
      diff.toCreate.length + diff.toUpdate.length + diff.toDelete.length;
  }

  if (totalOps > VALIDATION_THRESHOLDS.LARGE_OPERATION_COUNT) {
    warnings.push(
      t("planner.validation.largeOperations", { count: totalOps.toString() }),
    );
  }

  const result: PlanValidation = {
    valid: errors.length === 0,
    errors,
  };

  if (warnings.length > 0) {
    result.warnings = warnings;
  }

  return result;
}
