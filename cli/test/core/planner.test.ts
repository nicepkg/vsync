import { describe, it, expect } from "vitest";
import {
  generatePlan,
  formatPlan,
  validatePlan,
  type PlanInput,
} from "@src/core/planner.js";
import type { Manifest } from "@src/types/manifest.js";
import type { Skill, MCPServer } from "@src/types/models.js";
import type { SyncPlan } from "@src/types/plan.js";

describe("Plan Generator", () => {
  const sourceSkills: Skill[] = [
    {
      name: "skill1",
      content: "Skill 1 content",
      hash: "hash-skill1",
    },
    {
      name: "skill2",
      content: "Skill 2 new",
      hash: "hash-skill2-new",
    },
  ];

  const sourceMCPServers: MCPServer[] = [
    {
      name: "postgres",
      type: "stdio",
      command: "npx",
      hash: "hash-postgres",
    },
  ];

  const targetSkills = {
    cursor: [
      {
        name: "skill1",
        content: "Skill 1 content",
        hash: "hash-skill1",
      },
      {
        name: "skill2",
        content: "Skill 2 old",
        hash: "hash-skill2-old",
      },
    ],
    opencode: [
      {
        name: "skill1",
        content: "Skill 1 content",
        hash: "hash-skill1",
      },
    ],
  };

  const targetMCPServers = {
    cursor: [
      {
        name: "postgres",
        type: "stdio" as const,
        command: "npx",
        hash: "hash-postgres",
      },
    ],
    opencode: [],
  };

  const targetAgents = {
    cursor: [],
    opencode: [],
  };

  const manifest: Manifest = {
    version: "1.0.0",
    last_synced: "2026-01-24T10:00:00Z",
    items: {
      skill1: {
        type: "skill",
        name: "skill1",
        hash: "hash-skill1",
        last_synced: "2026-01-24T10:00:00Z",
        targets: {
          cursor: {
            synced: true,
            hash: "hash-placeholder",
            last_synced: "2026-01-24T10:00:00Z",
          },
          opencode: {
            synced: true,
            hash: "hash-placeholder",
            last_synced: "2026-01-24T10:00:00Z",
          },
        },
      },
      skill2: {
        type: "skill",
        name: "skill2",
        hash: "hash-skill2-old",
        last_synced: "2026-01-24T10:00:00Z",
        targets: {
          cursor: {
            synced: true,
            hash: "hash-placeholder",
            last_synced: "2026-01-24T10:00:00Z",
          },
        },
      },
      postgres: {
        type: "mcp",
        name: "postgres",
        hash: "hash-postgres",
        last_synced: "2026-01-24T10:00:00Z",
        targets: {
          cursor: {
            synced: true,
            hash: "hash-placeholder",
            last_synced: "2026-01-24T10:00:00Z",
          },
        },
      },
    },
  };

  describe("generatePlan", () => {
    it("should generate plan for all target tools", () => {
      const input: PlanInput = {
        sourceSkills,
        sourceMCPServers,
        sourceAgents: [],
        targetSkills,
        targetMCPServers,
        targetAgents,
        manifest,
        mode: "safe",
        sourceTool: "claude-code",
        targetTools: ["cursor", "opencode"],
      };

      const plan = generatePlan(input);

      expect(plan.source_tool).toBe("claude-code");
      expect(plan.diffs.cursor).toBeDefined();
      expect(plan.diffs.opencode).toBeDefined();
      expect(plan.timestamp).toBeTruthy();
    });

    it("should generate correct operations for cursor", () => {
      const input: PlanInput = {
        sourceSkills,
        sourceMCPServers,
        sourceAgents: [],
        targetSkills,
        targetMCPServers,
        targetAgents,
        manifest,
        mode: "safe",
        sourceTool: "claude-code",
        targetTools: ["cursor"],
      };

      const plan = generatePlan(input);
      const cursorDiff = plan.diffs.cursor!;

      // skill1: unchanged (SKIP)
      const skill1Ops = cursorDiff.toSkip.filter((op) => op.name === "skill1");
      expect(skill1Ops.length).toBeGreaterThan(0);

      // skill2: updated
      const skill2Ops = cursorDiff.toUpdate.filter(
        (op) => op.name === "skill2",
      );
      expect(skill2Ops.length).toBeGreaterThan(0);

      // postgres: unchanged (SKIP)
      const postgresOps = cursorDiff.toSkip.filter(
        (op) => op.name === "postgres",
      );
      expect(postgresOps.length).toBeGreaterThan(0);
    });

    it("should generate correct operations for opencode", () => {
      const input: PlanInput = {
        sourceSkills,
        sourceMCPServers,
        sourceAgents: [],
        targetSkills,
        targetMCPServers,
        targetAgents,
        manifest,
        mode: "safe",
        sourceTool: "claude-code",
        targetTools: ["opencode"],
      };

      const plan = generatePlan(input);
      const opencodeDiff = plan.diffs.opencode!;

      // skill2: new to opencode (CREATE)
      const skill2Ops = opencodeDiff.toCreate.filter(
        (op) => op.name === "skill2",
      );
      expect(skill2Ops.length).toBeGreaterThan(0);

      // postgres: new to opencode (CREATE)
      const postgresOps = opencodeDiff.toCreate.filter(
        (op) => op.name === "postgres",
      );
      expect(postgresOps.length).toBeGreaterThan(0);
    });

    it("should respect safe mode (no deletes)", () => {
      const input: PlanInput = {
        sourceSkills: [],
        sourceMCPServers: [],
        sourceAgents: [],
        targetSkills,
        targetMCPServers,
        targetAgents,
        manifest,
        mode: "safe",
        sourceTool: "claude-code",
        targetTools: ["cursor"],
      };

      const plan = generatePlan(input);
      const cursorDiff = plan.diffs.cursor!;

      expect(cursorDiff.toDelete).toHaveLength(0);
    });

    it("should respect prune mode (with deletes)", () => {
      const input: PlanInput = {
        sourceSkills: [],
        sourceMCPServers: [],
        sourceAgents: [],
        targetSkills,
        targetMCPServers,
        targetAgents,
        manifest,
        mode: "prune",
        sourceTool: "claude-code",
        targetTools: ["cursor"],
      };

      const plan = generatePlan(input);
      const cursorDiff = plan.diffs.cursor!;

      expect(cursorDiff.toDelete.length).toBeGreaterThan(0);
    });

    it("should set timestamp in ISO format", () => {
      const input: PlanInput = {
        sourceSkills,
        sourceMCPServers,
        sourceAgents: [],
        targetSkills,
        targetMCPServers,
        targetAgents,
        manifest,
        mode: "safe",
        sourceTool: "claude-code",
        targetTools: ["cursor"],
      };

      const plan = generatePlan(input);

      expect(plan.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });
  });

  describe("formatPlan", () => {
    it("should format plan with summary", () => {
      const plan: SyncPlan = {
        source_tool: "claude-code",
        diffs: {
          cursor: {
            tool: "cursor",
            toCreate: [
              {
                type: "create",
                itemType: "skill",
                name: "new-skill",
                description: "New skill",
              },
            ],
            toUpdate: [
              {
                type: "update",
                itemType: "skill",
                name: "updated-skill",
                description: "Updated skill",
                oldHash: "old-hash",
                newHash: "new-hash",
              },
            ],
            toDelete: [],
            toSkip: [
              {
                type: "skip",
                itemType: "skill",
                name: "unchanged-skill",
                description: "Unchanged",
              },
            ],
          },
        },
        timestamp: "2026-01-24T10:00:00Z",
      };

      const formatted = formatPlan(plan);

      expect(formatted).toContain("claude-code");
      expect(formatted).toContain("cursor");
      expect(formatted).toContain("new-skill");
      expect(formatted).toContain("updated-skill");
    });

    it("should use color codes for operations", () => {
      const plan: SyncPlan = {
        source_tool: "claude-code",
        diffs: {
          cursor: {
            tool: "cursor",
            toCreate: [
              {
                type: "create",
                itemType: "skill",
                name: "new-skill",
                description: "New",
              },
            ],
            toUpdate: [
              {
                type: "update",
                itemType: "mcp",
                name: "updated-mcp",
                description: "Updated",
              },
            ],
            toDelete: [
              {
                type: "delete",
                itemType: "skill",
                name: "removed-skill",
                description: "Removed",
              },
            ],
            toSkip: [],
          },
        },
        timestamp: "2026-01-24T10:00:00Z",
      };

      const formatted = formatPlan(plan);

      // Should contain operation indicators
      expect(formatted).toContain("CREATE");
      expect(formatted).toContain("UPDATE");
      expect(formatted).toContain("DELETE");
    });

    it("should show summary statistics", () => {
      const plan: SyncPlan = {
        source_tool: "claude-code",
        diffs: {
          cursor: {
            tool: "cursor",
            toCreate: [
              {
                type: "create",
                itemType: "skill",
                name: "skill1",
                description: "New",
              },
              {
                type: "create",
                itemType: "skill",
                name: "skill2",
                description: "New",
              },
            ],
            toUpdate: [
              {
                type: "update",
                itemType: "mcp",
                name: "mcp1",
                description: "Updated",
              },
            ],
            toDelete: [],
            toSkip: [
              {
                type: "skip",
                itemType: "skill",
                name: "skill3",
                description: "Unchanged",
              },
            ],
          },
        },
        timestamp: "2026-01-24T10:00:00Z",
      };

      const formatted = formatPlan(plan);

      // Should show counts
      expect(formatted).toMatch(/2.*create/i);
      expect(formatted).toMatch(/1.*update/i);
    });

    it("should handle empty plan", () => {
      const plan: SyncPlan = {
        source_tool: "claude-code",
        diffs: {
          cursor: {
            tool: "cursor",
            toCreate: [],
            toUpdate: [],
            toDelete: [],
            toSkip: [],
          },
        },
        timestamp: "2026-01-24T10:00:00Z",
      };

      const formatted = formatPlan(plan);

      expect(formatted).toContain("No changes");
    });
  });

  describe("validatePlan", () => {
    it("should validate safe plan", () => {
      const plan: SyncPlan = {
        source_tool: "claude-code",
        diffs: {
          cursor: {
            tool: "cursor",
            toCreate: [
              {
                type: "create",
                itemType: "skill",
                name: "new-skill",
                description: "New",
              },
            ],
            toUpdate: [],
            toDelete: [],
            toSkip: [],
          },
        },
        timestamp: "2026-01-24T10:00:00Z",
      };

      const result = validatePlan(plan);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should warn about deletes", () => {
      const plan: SyncPlan = {
        source_tool: "claude-code",
        diffs: {
          cursor: {
            tool: "cursor",
            toCreate: [],
            toUpdate: [],
            toDelete: [
              {
                type: "delete",
                itemType: "skill",
                name: "removed-skill",
                description: "Removed",
              },
            ],
            toSkip: [],
          },
        },
        timestamp: "2026-01-24T10:00:00Z",
      };

      const result = validatePlan(plan);

      expect(result.valid).toBe(true);
      expect(result.warnings).toBeDefined();
      expect(result.warnings?.some((w) => w.includes("delete"))).toBe(true);
    });

    it("should error on empty plan with no targets", () => {
      const plan: SyncPlan = {
        source_tool: "claude-code",
        diffs: {},
        timestamp: "2026-01-24T10:00:00Z",
      };

      const result = validatePlan(plan);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("No target tools specified");
    });

    it("should count total operations correctly", () => {
      const plan: SyncPlan = {
        source_tool: "claude-code",
        diffs: {
          cursor: {
            tool: "cursor",
            toCreate: [
              {
                type: "create",
                itemType: "skill",
                name: "skill1",
                description: "New",
              },
            ],
            toUpdate: [
              {
                type: "update",
                itemType: "skill",
                name: "skill2",
                description: "Updated",
              },
            ],
            toDelete: [],
            toSkip: [],
          },
          opencode: {
            tool: "opencode",
            toCreate: [
              {
                type: "create",
                itemType: "mcp",
                name: "mcp1",
                description: "New",
              },
            ],
            toUpdate: [],
            toDelete: [],
            toSkip: [],
          },
        },
        timestamp: "2026-01-24T10:00:00Z",
      };

      const result = validatePlan(plan);

      expect(result.valid).toBe(true);
      // Should have validated 3 total operations (1+1+1)
    });
  });
});
