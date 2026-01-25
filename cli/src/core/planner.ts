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

  for (const [toolName, diff] of Object.entries(plan.diffs)) {
    if (!diff) continue;

    // Process CREATE operations
    for (const op of diff.toCreate) {
      const key = `CREATE:${op.itemType}:${op.name}`;
      if (!itemOperations.has(key)) {
        itemOperations.set(key, {
          type: op.itemType,
          name: op.name,
          targets: [],
          operation: "CREATE",
          description: op.description,
        });
      }
      itemOperations.get(key)!.targets.push(toolName);
    }

    // Process UPDATE operations
    for (const op of diff.toUpdate) {
      const key = `UPDATE:${op.itemType}:${op.name}`;
      if (!itemOperations.has(key)) {
        itemOperations.set(key, {
          type: op.itemType,
          name: op.name,
          targets: [],
          operation: "UPDATE",
          description: op.description,
        });
      }
      itemOperations.get(key)!.targets.push(toolName);
    }

    // Process DELETE operations
    for (const op of diff.toDelete) {
      const key = `DELETE:${op.itemType}:${op.name}`;
      if (!itemOperations.has(key)) {
        itemOperations.set(key, {
          type: op.itemType,
          name: op.name,
          targets: [],
          operation: "DELETE",
          description: op.description,
        });
      }
      itemOperations.get(key)!.targets.push(toolName);
    }
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

  // Old detailed format (commented out, can be enabled with --verbose flag)
  /*
  for (const [toolName, diff] of Object.entries(plan.diffs)) {
    if (!diff) continue;
    lines.push(`Target: ${toolName}`);
    lines.push("-".repeat(60));
    // ... rest of old format
  }
  */

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

  if (totalOps > 50) {
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
