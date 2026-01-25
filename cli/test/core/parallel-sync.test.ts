/**
 * Tests for ParallelSyncOrchestrator
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import type { ToolAdapter } from "@src/adapters/base.js";
import {
  ParallelSyncOrchestrator,
  type TargetSyncConfig,
} from "@src/core/parallel-sync.js";
import { SourceData } from "@src/core/sync-executor.js";
import type { DiffResult } from "@src/types/plan.js";

describe("ParallelSyncOrchestrator", () => {
  let sourceData: SourceData;
  let mockAdapter1: ToolAdapter;
  let mockAdapter2: ToolAdapter;

  beforeEach(() => {
    sourceData = new SourceData(
      [{ name: "skill1", content: "content1", hash: "hash1" }] as any,
      [{ name: "mcp1", type: "stdio", command: "cmd1", hash: "hash2" }] as any,
      [],
      [],
    );

    // Create mock adapters
    const createMockAdapter = (toolName: string): ToolAdapter => ({
      toolName,
      displayName: toolName,
      config: { tool: toolName as any, baseDir: "/test", level: "project" },
      getConfigDir: vi.fn(() => `.${toolName}`),
      getConfigPaths: vi.fn(() => []),
      getMCPConfigPaths: vi.fn(() => []),
      getSkillsDir: vi.fn(() => `.${toolName}/skills`),
      getAgentsDir: vi.fn(() => `.${toolName}/agents`),
      getCommandsDir: vi.fn(() => `.${toolName}/commands`),
      getCapabilities: vi.fn(() => ({
        skills: true,
        mcp: true,
        agents: true,
        commands: true,
      })),
      readSkills: vi.fn(async () => []),
      readMCPServers: vi.fn(async () => []),
      readAgents: vi.fn(async () => []),
      readCommands: vi.fn(async () => []),
      writeSkills: vi.fn(async () => ({ success: true, count: 1 })),
      writeMCPServers: vi.fn(async () => ({ success: true, count: 1 })),
      writeAgents: vi.fn(async () => ({ success: true, count: 0 })),
      writeCommands: vi.fn(async () => ({ success: true, count: 0 })),
      deleteSkill: vi.fn(async () => {}),
      deleteMCPServer: vi.fn(async () => {}),
      deleteAgent: vi.fn(async () => {}),
      deleteCommand: vi.fn(async () => {}),
    });

    mockAdapter1 = createMockAdapter("cursor");
    mockAdapter2 = createMockAdapter("opencode");
  });

  describe("execute", () => {
    it("should execute syncs in parallel for multiple targets", async () => {
      const diff: DiffResult = {
        tool: "cursor",
        toCreate: [
          {
            type: "create",
            itemType: "skill",
            name: "skill1",
            description: "new",
            reason: "new",
          },
          {
            type: "create",
            itemType: "mcp",
            name: "mcp1",
            description: "new",
            reason: "new",
          },
        ],
        toUpdate: [],
        toDelete: [],
        toSkip: [],
      };

      const targets: TargetSyncConfig[] = [
        { adapter: mockAdapter1, diff, backupPaths: [] },
        { adapter: mockAdapter2, diff, backupPaths: [] },
      ];

      const orchestrator = new ParallelSyncOrchestrator(sourceData);
      const result = await orchestrator.execute(targets);

      expect(result.success).toBe(true);
      expect(result.succeeded).toEqual(["cursor", "opencode"]);
      expect(result.failed).toEqual([]);
      expect(result.totalCreated).toBe(4); // 2 items × 2 targets
      expect(result.totalUpdated).toBe(0);

      // Both adapters should have been called
      expect(mockAdapter1.writeSkills).toHaveBeenCalled();
      expect(mockAdapter2.writeSkills).toHaveBeenCalled();
    });

    it("should handle partial failures (one target fails, others succeed)", async () => {
      // Make adapter2 fail
      vi.mocked(mockAdapter2.writeSkills).mockResolvedValue({
        success: false,
        count: 0,
        error: "Write failed",
      });

      const diff: DiffResult = {
        tool: "cursor",
        toCreate: [
          {
            type: "create",
            itemType: "skill",
            name: "skill1",
            description: "new",
            reason: "new",
          },
        ],
        toUpdate: [],
        toDelete: [],
        toSkip: [],
      };

      const targets: TargetSyncConfig[] = [
        { adapter: mockAdapter1, diff, backupPaths: [] },
        { adapter: mockAdapter2, diff, backupPaths: [] },
      ];

      const orchestrator = new ParallelSyncOrchestrator(sourceData);
      const result = await orchestrator.execute(targets);

      expect(result.success).toBe(false); // Overall failure due to one target failing
      expect(result.succeeded).toEqual(["cursor"]);
      expect(result.failed).toEqual(["opencode"]);
      expect(result.totalCreated).toBe(1); // Only cursor succeeded
    });

    it("should continue other syncs even if one fails", async () => {
      // Make adapter1 fail with exception
      vi.mocked(mockAdapter1.writeSkills).mockRejectedValue(
        new Error("Critical error"),
      );

      const diff: DiffResult = {
        tool: "cursor",
        toCreate: [
          {
            type: "create",
            itemType: "skill",
            name: "skill1",
            description: "new",
            reason: "new",
          },
        ],
        toUpdate: [],
        toDelete: [],
        toSkip: [],
      };

      const targets: TargetSyncConfig[] = [
        { adapter: mockAdapter1, diff, backupPaths: [] },
        { adapter: mockAdapter2, diff, backupPaths: [] },
      ];

      const orchestrator = new ParallelSyncOrchestrator(sourceData);
      const result = await orchestrator.execute(targets);

      // opencode should still succeed
      expect(result.succeeded).toContain("opencode");
      expect(result.failed).toContain("cursor");

      // opencode's write should have been called
      expect(mockAdapter2.writeSkills).toHaveBeenCalled();
    });

    it("should aggregate statistics correctly", async () => {
      const diff1: DiffResult = {
        tool: "cursor",
        toCreate: [
          {
            type: "create",
            itemType: "skill",
            name: "skill1",
            description: "new",
            reason: "new",
          },
        ],
        toUpdate: [
          {
            type: "update",
            itemType: "mcp",
            name: "mcp1",
            description: "modified",
            reason: "modified",
            oldHash: "old",
            newHash: "new",
          },
        ],
        toDelete: [],
        toSkip: [],
      };

      const diff2: DiffResult = {
        tool: "opencode",
        toCreate: [
          {
            type: "create",
            itemType: "skill",
            name: "skill1",
            description: "new",
            reason: "new",
          },
          {
            type: "create",
            itemType: "mcp",
            name: "mcp1",
            description: "new",
            reason: "new",
          },
        ],
        toUpdate: [],
        toDelete: [],
        toSkip: [],
      };

      const targets: TargetSyncConfig[] = [
        { adapter: mockAdapter1, diff: diff1, backupPaths: [] },
        { adapter: mockAdapter2, diff: diff2, backupPaths: [] },
      ];

      const orchestrator = new ParallelSyncOrchestrator(sourceData);
      const result = await orchestrator.execute(targets);

      expect(result.totalCreated).toBe(3); // 1 from cursor + 2 from opencode
      expect(result.totalUpdated).toBe(1); // 1 from cursor
    });

    it("should handle empty target list", async () => {
      const orchestrator = new ParallelSyncOrchestrator(sourceData);
      const result = await orchestrator.execute([]);

      expect(result.success).toBe(true);
      expect(result.succeeded).toEqual([]);
      expect(result.failed).toEqual([]);
      expect(result.totalCreated).toBe(0);
    });

    it("should return individual target results", async () => {
      const diff: DiffResult = {
        tool: "cursor",
        toCreate: [
          {
            type: "create",
            itemType: "skill",
            name: "skill1",
            description: "new",
            reason: "new",
          },
        ],
        toUpdate: [],
        toDelete: [],
        toSkip: [],
      };

      const targets: TargetSyncConfig[] = [
        { adapter: mockAdapter1, diff, backupPaths: [] },
        { adapter: mockAdapter2, diff, backupPaths: [] },
      ];

      const orchestrator = new ParallelSyncOrchestrator(sourceData);
      const result = await orchestrator.execute(targets);

      expect(result.targetResults.size).toBe(2);
      expect(result.targetResults.has("cursor")).toBe(true);
      expect(result.targetResults.has("opencode")).toBe(true);

      const cursorResult = result.targetResults.get("cursor")!;
      expect(cursorResult.tool).toBe("cursor");
      expect(cursorResult.success).toBe(true);
    });

    it("should handle all targets failing", async () => {
      vi.mocked(mockAdapter1.writeSkills).mockRejectedValue(
        new Error("Error 1"),
      );
      vi.mocked(mockAdapter2.writeSkills).mockRejectedValue(
        new Error("Error 2"),
      );

      const diff: DiffResult = {
        tool: "cursor",
        toCreate: [
          {
            type: "create",
            itemType: "skill",
            name: "skill1",
            description: "new",
            reason: "new",
          },
        ],
        toUpdate: [],
        toDelete: [],
        toSkip: [],
      };

      const targets: TargetSyncConfig[] = [
        { adapter: mockAdapter1, diff, backupPaths: [] },
        { adapter: mockAdapter2, diff, backupPaths: [] },
      ];

      const orchestrator = new ParallelSyncOrchestrator(sourceData);
      const result = await orchestrator.execute(targets);

      expect(result.success).toBe(false);
      expect(result.succeeded).toEqual([]);
      expect(result.failed.length).toBe(2);
      expect(result.totalCreated).toBe(0);
    });
  });
});
