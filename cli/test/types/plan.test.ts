import { describe, it, expect } from "vitest";
import type {
  SyncPlan,
  Operation,
  OperationType,
  DiffResult,
} from "../../src/types/plan.js";

describe("Plan Types", () => {
  describe("OperationType", () => {
    it("should accept valid operation types", () => {
      const types: OperationType[] = ["create", "update", "delete", "skip"];
      expect(types).toHaveLength(4);
    });
  });

  describe("Operation", () => {
    it("should create a CREATE operation", () => {
      const op: Operation = {
        type: "create",
        itemType: "skill",
        name: "new-skill",
        description: "A new skill to create",
      };

      expect(op.type).toBe("create");
      expect(op.itemType).toBe("skill");
      expect(op.name).toBe("new-skill");
    });

    it("should create an UPDATE operation with hash change", () => {
      const op: Operation = {
        type: "update",
        itemType: "mcp",
        name: "postgres",
        description: "Update MCP server configuration",
        oldHash: "abc123",
        newHash: "def456",
      };

      expect(op.type).toBe("update");
      expect(op.oldHash).toBe("abc123");
      expect(op.newHash).toBe("def456");
    });

    it("should create a DELETE operation", () => {
      const op: Operation = {
        type: "delete",
        itemType: "skill",
        name: "old-skill",
        description: "Remove skill not in source",
      };

      expect(op.type).toBe("delete");
    });

    it("should create a SKIP operation", () => {
      const op: Operation = {
        type: "skip",
        itemType: "skill",
        name: "unchanged-skill",
        description: "No changes detected",
        reason: "Hash matches",
      };

      expect(op.type).toBe("skip");
      expect(op.reason).toBe("Hash matches");
    });
  });

  describe("DiffResult", () => {
    it("should create a diff result with operations", () => {
      const diff: DiffResult = {
        tool: "cursor",
        toCreate: [
          {
            type: "create",
            itemType: "skill",
            name: "skill1",
            description: "Create skill1",
          },
        ],
        toUpdate: [
          {
            type: "update",
            itemType: "mcp",
            name: "server1",
            description: "Update server1",
            oldHash: "old",
            newHash: "new",
          },
        ],
        toDelete: [],
        toSkip: [
          {
            type: "skip",
            itemType: "skill",
            name: "skill2",
            description: "Skip skill2",
            reason: "Up to date",
          },
        ],
      };

      expect(diff.tool).toBe("cursor");
      expect(diff.toCreate).toHaveLength(1);
      expect(diff.toUpdate).toHaveLength(1);
      expect(diff.toDelete).toHaveLength(0);
      expect(diff.toSkip).toHaveLength(1);
    });

    it("should create an empty diff result", () => {
      const diff: DiffResult = {
        tool: "opencode",
        toCreate: [],
        toUpdate: [],
        toDelete: [],
        toSkip: [],
      };

      expect(diff.toCreate).toHaveLength(0);
      expect(diff.toUpdate).toHaveLength(0);
    });
  });

  describe("SyncPlan", () => {
    it("should create a sync plan for multiple tools", () => {
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
                description: "Create skill",
              },
            ],
            toUpdate: [],
            toDelete: [],
            toSkip: [],
          },
          opencode: {
            tool: "opencode",
            toCreate: [],
            toUpdate: [
              {
                type: "update",
                itemType: "mcp",
                name: "server1",
                description: "Update server",
                oldHash: "old",
                newHash: "new",
              },
            ],
            toDelete: [],
            toSkip: [],
          },
        },
        timestamp: "2026-01-24T10:30:00Z",
      };

      expect(plan.source_tool).toBe("claude-code");
      expect(Object.keys(plan.diffs)).toHaveLength(2);
      expect(plan.diffs.cursor?.toCreate).toHaveLength(1);
      expect(plan.diffs.opencode?.toUpdate).toHaveLength(1);
    });

    it("should create a plan with no operations", () => {
      const plan: SyncPlan = {
        source_tool: "cursor",
        diffs: {},
        timestamp: "2026-01-24T11:00:00Z",
      };

      expect(Object.keys(plan.diffs)).toHaveLength(0);
    });
  });
});
