import { describe, it, expect } from "vitest";
import {
  calculateDiff,
  compareHashes,
  type DiffInput,
} from "@src/core/diff.js";
import type { Skill, MCPServer } from "@src/types/models.js";
import type { Manifest } from "@src/types/manifest.js";

describe("Diff Calculator", () => {
  describe("compareHashes", () => {
    it("should return CREATE when item not in target", () => {
      const result = compareHashes("hash123", null, null, "safe");

      expect(result.operation).toBe("create");
      expect(result.reason).toContain("not in target");
    });

    it("should return SKIP when hashes match", () => {
      const result = compareHashes("hash123", "hash123", "hash123", "safe");

      expect(result.operation).toBe("skip");
      expect(result.reason).toContain("up to date");
    });

    it("should return UPDATE when source hash differs from target", () => {
      const result = compareHashes("hash456", "hash123", "hash123", "safe");

      expect(result.operation).toBe("update");
      expect(result.reason).toContain("content changed");
    });

    it("should return UPDATE when target hash differs from manifest", () => {
      const result = compareHashes("hash123", "hash456", "hash123", "safe");

      expect(result.operation).toBe("update");
      expect(result.reason).toContain("modified in target");
    });

    it("should return DELETE in prune mode when item not in source", () => {
      const result = compareHashes(null, "hash123", "hash123", "prune");

      expect(result.operation).toBe("delete");
      expect(result.reason).toContain("removed from source");
    });

    it("should return SKIP in safe mode when item not in source", () => {
      const result = compareHashes(null, "hash123", "hash123", "safe");

      expect(result.operation).toBe("skip");
      expect(result.reason).toContain("safe mode");
    });

    it("should return UPDATE when manifest is missing but hashes differ", () => {
      const result = compareHashes("hash456", "hash123", null, "safe");

      expect(result.operation).toBe("update");
      expect(result.reason).toContain("content changed");
    });

    it("should return CREATE when manifest exists but target missing", () => {
      const result = compareHashes("hash123", null, "hash123", "safe");

      expect(result.operation).toBe("create");
      expect(result.reason).toContain("not in target");
    });
  });

  describe("calculateDiff", () => {
    const sourceSkills: Skill[] = [
      {
        name: "skill1",
        content: "Skill 1 content",
        hash: "hash-skill1",
      },
      {
        name: "skill2",
        content: "Skill 2 content",
        hash: "hash-skill2-new",
      },
      {
        name: "skill4",
        content: "Skill 4 content",
        hash: "hash-skill4",
      },
    ];

    const targetSkills: Skill[] = [
      {
        name: "skill1",
        content: "Skill 1 content",
        hash: "hash-skill1",
      },
      {
        name: "skill2",
        content: "Skill 2 old content",
        hash: "hash-skill2-old",
      },
      {
        name: "skill3",
        content: "Skill 3 content",
        hash: "hash-skill3",
      },
    ];

    const sourceMCPServers: MCPServer[] = [
      {
        name: "postgres",
        type: "stdio",
        command: "npx",
        hash: "hash-postgres",
      },
      {
        name: "sqlite",
        type: "stdio",
        command: "mcp-sqlite",
        hash: "hash-sqlite-new",
      },
    ];

    const targetMCPServers: MCPServer[] = [
      {
        name: "postgres",
        type: "stdio",
        command: "npx",
        hash: "hash-postgres",
      },
      {
        name: "sqlite",
        type: "stdio",
        command: "mcp-sqlite-old",
        hash: "hash-sqlite-old",
      },
      {
        name: "redis",
        type: "stdio",
        command: "mcp-redis",
        hash: "hash-redis",
      },
    ];

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
            cursor: { synced: true, hash: "hash-placeholder", last_synced: "2026-01-24T10:00:00Z" },
          },
        },
        skill2: {
          type: "skill",
          name: "skill2",
          hash: "hash-skill2-old",
          last_synced: "2026-01-24T10:00:00Z",
          targets: {
            cursor: { synced: true, hash: "hash-placeholder", last_synced: "2026-01-24T10:00:00Z" },
          },
        },
        skill3: {
          type: "skill",
          name: "skill3",
          hash: "hash-skill3",
          last_synced: "2026-01-24T10:00:00Z",
          targets: {
            cursor: { synced: true, hash: "hash-placeholder", last_synced: "2026-01-24T10:00:00Z" },
          },
        },
        postgres: {
          type: "mcp",
          name: "postgres",
          hash: "hash-postgres",
          last_synced: "2026-01-24T10:00:00Z",
          targets: {
            cursor: { synced: true, hash: "hash-placeholder", last_synced: "2026-01-24T10:00:00Z" },
          },
        },
        sqlite: {
          type: "mcp",
          name: "sqlite",
          hash: "hash-sqlite-old",
          last_synced: "2026-01-24T10:00:00Z",
          targets: {
            cursor: { synced: true, hash: "hash-placeholder", last_synced: "2026-01-24T10:00:00Z" },
          },
        },
      },
    };

    describe("safe mode", () => {
      it("should identify CREATE operations for new skills", () => {
        const input: DiffInput = {
          sourceSkills,
          targetSkills,
          sourceMCPServers,
          targetMCPServers,
          manifest,
          mode: "safe",
          targetTool: "cursor",
        };

        const result = calculateDiff(input);

        const createOps = result.toCreate.filter((op) => op.itemType === "skill");
        expect(createOps).toHaveLength(1);
        expect(createOps[0]?.name).toBe("skill4");
      });

      it("should identify UPDATE operations for changed skills", () => {
        const input: DiffInput = {
          sourceSkills,
          targetSkills,
          sourceMCPServers,
          targetMCPServers,
          manifest,
          mode: "safe",
          targetTool: "cursor",
        };

        const result = calculateDiff(input);

        const updateOps = result.toUpdate.filter((op) => op.itemType === "skill");
        expect(updateOps).toHaveLength(1);
        expect(updateOps[0]?.name).toBe("skill2");
      });

      it("should identify SKIP operations for unchanged skills", () => {
        const input: DiffInput = {
          sourceSkills,
          targetSkills,
          sourceMCPServers,
          targetMCPServers,
          manifest,
          mode: "safe",
          targetTool: "cursor",
        };

        const result = calculateDiff(input);

        const skipOps = result.toSkip.filter((op) => op.itemType === "skill");
        expect(skipOps).toHaveLength(1);
        expect(skipOps[0]?.name).toBe("skill1");
      });

      it("should NOT delete items in safe mode", () => {
        const input: DiffInput = {
          sourceSkills,
          targetSkills,
          sourceMCPServers,
          targetMCPServers,
          manifest,
          mode: "safe",
          targetTool: "cursor",
        };

        const result = calculateDiff(input);

        const deleteOps = result.toDelete.filter((op) => op.itemType === "skill");
        expect(deleteOps).toHaveLength(0);
      });

      it("should handle MCP servers correctly", () => {
        const input: DiffInput = {
          sourceSkills,
          targetSkills,
          sourceMCPServers,
          targetMCPServers,
          manifest,
          mode: "safe",
          targetTool: "cursor",
        };

        const result = calculateDiff(input);

        // postgres: unchanged
        const postgresOp = result.toSkip.find((op) => op.itemType === "mcp" && op.name === "postgres");
        expect(postgresOp?.type).toBe("skip");

        // sqlite: updated
        const sqliteOp = result.toUpdate.find((op) => op.itemType === "mcp" && op.name === "sqlite");
        expect(sqliteOp?.type).toBe("update");

        // redis: not deleted (safe mode)
        const redisOp = result.toDelete.find((op) => op.itemType === "mcp" && op.name === "redis");
        expect(redisOp).toBeUndefined();
      });
    });

    describe("prune mode", () => {
      it("should identify DELETE operations for removed skills", () => {
        const input: DiffInput = {
          sourceSkills,
          targetSkills,
          sourceMCPServers,
          targetMCPServers,
          manifest,
          mode: "prune",
          targetTool: "cursor",
        };

        const result = calculateDiff(input);

        const deleteOps = result.toDelete.filter((op) => op.itemType === "skill");
        expect(deleteOps).toHaveLength(1);
        expect(deleteOps[0]?.name).toBe("skill3");
      });

      it("should delete MCP servers not in source", () => {
        const input: DiffInput = {
          sourceSkills,
          targetSkills,
          sourceMCPServers,
          targetMCPServers,
          manifest,
          mode: "prune",
          targetTool: "cursor",
        };

        const result = calculateDiff(input);

        const deleteOps = result.toDelete.filter((op) => op.itemType === "mcp");
        expect(deleteOps).toHaveLength(1);
        expect(deleteOps[0]?.name).toBe("redis");
      });

      it("should still CREATE, UPDATE, and SKIP correctly", () => {
        const input: DiffInput = {
          sourceSkills,
          targetSkills,
          sourceMCPServers,
          targetMCPServers,
          manifest,
          mode: "prune",
          targetTool: "cursor",
        };

        const result = calculateDiff(input);

        expect(result.toCreate.filter((op) => op.itemType === "skill")).toHaveLength(1);
        expect(result.toUpdate.filter((op) => op.itemType === "skill")).toHaveLength(1);
        expect(result.toSkip.filter((op) => op.itemType === "skill")).toHaveLength(1);
        expect(result.toDelete.filter((op) => op.itemType === "skill")).toHaveLength(1);
      });
    });

    describe("edge cases", () => {
      it("should handle empty source", () => {
        const input: DiffInput = {
          sourceSkills: [],
          targetSkills,
          sourceMCPServers: [],
          targetMCPServers,
          manifest,
          mode: "prune",
          targetTool: "cursor",
        };

        const result = calculateDiff(input);

        // All target items should be deleted in prune mode
        expect(result.toDelete.filter((op) => op.itemType === "skill")).toHaveLength(
          targetSkills.length,
        );
        expect(result.toDelete.filter((op) => op.itemType === "mcp")).toHaveLength(
          targetMCPServers.length,
        );
      });

      it("should handle empty target", () => {
        const input: DiffInput = {
          sourceSkills,
          targetSkills: [],
          sourceMCPServers,
          targetMCPServers: [],
          manifest,
          mode: "safe",
          targetTool: "cursor",
        };

        const result = calculateDiff(input);

        // All source items should be created
        expect(result.toCreate.filter((op) => op.itemType === "skill")).toHaveLength(
          sourceSkills.length,
        );
        expect(result.toCreate.filter((op) => op.itemType === "mcp")).toHaveLength(
          sourceMCPServers.length,
        );
      });

      it("should handle empty manifest", () => {
        const emptyManifest: Manifest = {
          version: "1.0.0",
          last_synced: "",
          items: {},
        };

        const input: DiffInput = {
          sourceSkills: [sourceSkills[0]!],
          targetSkills: [
            { ...sourceSkills[0]!, hash: "different-hash" },
          ],
          sourceMCPServers: [],
          targetMCPServers: [],
          manifest: emptyManifest,
          mode: "safe",
          targetTool: "cursor",
        };

        const result = calculateDiff(input);

        // Should detect UPDATE based on hash mismatch
        expect(result.toUpdate[0]?.type).toBe("update");
      });

      it("should handle manifest with missing items", () => {
        const partialManifest: Manifest = {
          version: "1.0.0",
          last_synced: "2026-01-24T10:00:00Z",
          items: {
            skill1: {
              type: "skill",
              name: "skill1",
              hash: "hash-skill1",
              last_synced: "2026-01-24T10:00:00Z",
              targets: {},
            },
          },
        };

        const input: DiffInput = {
          sourceSkills,
          targetSkills,
          sourceMCPServers,
          targetMCPServers,
          manifest: partialManifest,
          mode: "safe",
          targetTool: "cursor",
        };

        const result = calculateDiff(input);

        // Should handle missing manifest items gracefully
        const totalSkillOps = result.toCreate.filter((op) => op.itemType === "skill").length +
          result.toUpdate.filter((op) => op.itemType === "skill").length +
          result.toSkip.filter((op) => op.itemType === "skill").length;
        const totalMCPOps = result.toCreate.filter((op) => op.itemType === "mcp").length +
          result.toUpdate.filter((op) => op.itemType === "mcp").length +
          result.toSkip.filter((op) => op.itemType === "mcp").length;
        expect(totalSkillOps).toBeGreaterThan(0);
        expect(totalMCPOps).toBeGreaterThan(0);
      });
    });

    describe("hash comparison edge cases", () => {
      it("should detect target modifications (target hash != manifest hash)", () => {
        const modifiedManifest: Manifest = {
          version: "1.0.0",
          last_synced: "2026-01-24T10:00:00Z",
          items: {
            skill1: {
              type: "skill",
              name: "skill1",
              hash: "original-hash",
              last_synced: "2026-01-24T10:00:00Z",
              targets: {
                cursor: { synced: true, hash: "hash-placeholder", last_synced: "2026-01-24T10:00:00Z" },
              },
            },
          },
        };

        const input: DiffInput = {
          sourceSkills: [
            {
              name: "skill1",
              content: "Content",
              hash: "original-hash",
            },
          ],
          targetSkills: [
            {
              name: "skill1",
              content: "Modified content",
              hash: "modified-hash",
            },
          ],
          sourceMCPServers: [],
          targetMCPServers: [],
          manifest: modifiedManifest,
          mode: "safe",
          targetTool: "cursor",
        };

        const result = calculateDiff(input);

        expect(result.toUpdate[0]?.type).toBe("update");
        expect(result.toUpdate[0]?.reason).toContain("modified in target");
      });
    });
  });
});
