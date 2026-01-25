/**
 * Plan generator
 * Generates sync plans by calculating diffs for all target tools
 */

import type { SyncMode, ToolName } from "@src/types/config.js";
import type { Manifest } from "@src/types/manifest.js";
import type { Skill, MCPServer, Agent, Command } from "@src/types/models.js";
import type { SyncPlan, DiffResult } from "@src/types/plan.js";
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
    manifest,
    mode,
    sourceTool,
    targetTools,
  } = input;

  const diffs: Partial<Record<ToolName, DiffResult>> = {};

  // Calculate diff for each target tool
  for (const targetTool of targetTools) {
    const diffInput: DiffInput = {
      sourceSkills,
      targetSkills: targetSkills[targetTool] || [],
      sourceMCPServers,
      targetMCPServers: targetMCPServers[targetTool] || [],
      sourceAgents,
      targetAgents: targetAgents[targetTool] || [],
      sourceCommands,
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
  lines.push(`Sync Plan - Source: ${plan.source_tool}`);
  lines.push(`Generated: ${plan.timestamp}`);
  lines.push("=".repeat(60));
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
    lines.push("No changes needed - everything is up to date!");
    lines.push("");
    return lines.join("\n");
  }

  // Operations for each target tool
  for (const [toolName, diff] of Object.entries(plan.diffs)) {
    if (!diff) continue;

    lines.push(`Target: ${toolName}`);
    lines.push("-".repeat(60));

    // CREATE operations
    if (diff.toCreate.length > 0) {
      lines.push("");
      lines.push(`CREATE (${diff.toCreate.length}):`);
      for (const op of diff.toCreate) {
        lines.push(`  + [${op.itemType}] ${op.name}`);
        if (op.description) {
          lines.push(`    ${op.description}`);
        }
      }
    }

    // UPDATE operations
    if (diff.toUpdate.length > 0) {
      lines.push("");
      lines.push(`UPDATE (${diff.toUpdate.length}):`);
      for (const op of diff.toUpdate) {
        lines.push(`  ~ [${op.itemType}] ${op.name}`);
        if (op.description) {
          lines.push(`    ${op.description}`);
        }
        if (op.oldHash && op.newHash) {
          lines.push(
            `    ${op.oldHash.substring(0, 8)} → ${op.newHash.substring(0, 8)}`,
          );
        }
      }
    }

    // DELETE operations
    if (diff.toDelete.length > 0) {
      lines.push("");
      lines.push(`DELETE (${diff.toDelete.length}):`);
      for (const op of diff.toDelete) {
        lines.push(`  - [${op.itemType}] ${op.name}`);
        if (op.description) {
          lines.push(`    ${op.description}`);
        }
      }
    }

    // Summary for this tool
    const total =
      diff.toCreate.length + diff.toUpdate.length + diff.toDelete.length;
    lines.push("");
    lines.push(`Summary: ${total} operation(s) for ${toolName}`);
    lines.push("");
  }

  // Overall summary
  let totalCreate = 0;
  let totalUpdate = 0;
  let totalDelete = 0;

  for (const diff of Object.values(plan.diffs)) {
    if (!diff) continue;
    totalCreate += diff.toCreate.length;
    totalUpdate += diff.toUpdate.length;
    totalDelete += diff.toDelete.length;
  }

  lines.push("=".repeat(60));
  lines.push("Overall Summary:");
  lines.push(
    `  ${totalCreate} CREATE, ${totalUpdate} UPDATE, ${totalDelete} DELETE`,
  );
  lines.push("");

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
    errors.push("No target tools specified");
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
      `Plan includes ${deleteCount} delete operation(s). Review carefully before proceeding.`,
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
      `Large number of operations (${totalOps}). Consider reviewing before executing.`,
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
