import { describe, it, expect } from "vitest";
import { formatDetailedPlan } from "../../src/commands/plan.js";
import type { SyncPlan } from "../../src/types/plan.js";

describe("Plan Command", () => {
  describe("formatDetailedPlan", () => {
    it("should format plan with CREATE operations", () => {
      const plan: SyncPlan = {
        source_tool: "claude-code",
        diffs: {
          cursor: {
            tool: "cursor",
            toCreate: [
              {
                type: "create",
                itemType: "skill",
                name: "test-skill",
                description: "New skill to create",
                reason: "Does not exist in target",
                newHash: "abc123def456",
              },
            ],
            toUpdate: [],
            toDelete: [],
            toSkip: [],
          },
        },
        timestamp: new Date().toISOString(),
      };

      const output = formatDetailedPlan(plan);

      expect(output).toContain("Sync Plan");
      expect(output).toContain("cursor:");
      expect(output).toContain("CREATE:");
      expect(output).toContain("skill/test-skill");
      expect(output).toContain("Does not exist in target");
      expect(output).toContain("abc123def456");
      expect(output).toContain("vibe-sync sync");
    });

    it("should format plan with UPDATE operations showing hash changes", () => {
      const plan: SyncPlan = {
        source_tool: "claude-code",
        diffs: {
          cursor: {
            tool: "cursor",
            toCreate: [],
            toUpdate: [
              {
                type: "update",
                itemType: "mcp",
                name: "postgres",
                description: "Update MCP server",
                reason: "Hash mismatch",
                oldHash: "old123abc",
                newHash: "new456def",
              },
            ],
            toDelete: [],
            toSkip: [],
          },
        },
        timestamp: new Date().toISOString(),
      };

      const output = formatDetailedPlan(plan);

      expect(output).toContain("UPDATE:");
      expect(output).toContain("mcp/postgres");
      expect(output).toContain("Hash mismatch");
      expect(output).toContain("Old: old123abc");
      expect(output).toContain("New: new456def");
    });

    it("should format plan with DELETE operations in prune mode", () => {
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
                name: "old-skill",
                description: "Remove old skill",
                reason: "Not in source",
                oldHash: "old789xyz",
              },
            ],
            toSkip: [],
          },
        },
        timestamp: new Date().toISOString(),
      };

      const output = formatDetailedPlan(plan);

      expect(output).toContain("DELETE:");
      expect(output).toContain("skill/old-skill");
      expect(output).toContain("Not in source");
      expect(output).toContain("old789xyz");
    });

    it("should show SKIP count without listing all items", () => {
      const plan: SyncPlan = {
        source_tool: "claude-code",
        diffs: {
          cursor: {
            tool: "cursor",
            toCreate: [],
            toUpdate: [],
            toDelete: [],
            toSkip: [
              {
                type: "skip",
                itemType: "skill",
                name: "unchanged-1",
                description: "Skip",
                reason: "Hash matches",
              },
              {
                type: "skip",
                itemType: "skill",
                name: "unchanged-2",
                description: "Skip",
                reason: "Hash matches",
              },
            ],
          },
        },
        timestamp: new Date().toISOString(),
      };

      const output = formatDetailedPlan(plan);

      expect(output).toContain("SKIP: 2 items (unchanged)");
      expect(output).not.toContain("unchanged-1");
      expect(output).not.toContain("unchanged-2");
    });

    it("should display helpful message to run sync command", () => {
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
        timestamp: new Date().toISOString(),
      };

      const output = formatDetailedPlan(plan);

      expect(output).toContain("vibe-sync sync");
    });

    it("should handle multiple targets in plan", () => {
      const plan: SyncPlan = {
        source_tool: "claude-code",
        diffs: {
          cursor: {
            tool: "cursor",
            toCreate: [
              {
                type: "create",
                itemType: "skill",
                name: "skill-1",
                description: "Create skill 1",
                reason: "New skill",
                newHash: "hash1",
              },
            ],
            toUpdate: [],
            toDelete: [],
            toSkip: [],
          },
          opencode: {
            tool: "opencode",
            toCreate: [
              {
                type: "create",
                itemType: "mcp",
                name: "server-1",
                description: "Create server 1",
                reason: "New server",
                newHash: "hash2",
              },
            ],
            toUpdate: [],
            toDelete: [],
            toSkip: [],
          },
        },
        timestamp: new Date().toISOString(),
      };

      const output = formatDetailedPlan(plan);

      expect(output).toContain("cursor:");
      expect(output).toContain("opencode:");
      expect(output).toContain("skill/skill-1");
      expect(output).toContain("mcp/server-1");
    });
  });
});
