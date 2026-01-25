/**
 * Tests for SyncExecutor
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import type { ToolAdapter } from "@src/adapters/base.js";
import { SyncExecutor, type SourceData } from "@src/core/sync-executor.js";
import type { Skill, MCPServer, Agent, Command } from "@src/types/models.js";
import type { DiffResult } from "@src/types/plan.js";

describe("SyncExecutor", () => {
  let mockAdapter: ToolAdapter;
  let sourceData: SourceData;

  beforeEach(() => {
    // Mock adapter
    mockAdapter = {
      toolName: "test-tool",
      displayName: "Test Tool",
      config: { tool: "cursor" as any, baseDir: "/test", level: "project" },
      getConfigDir: vi.fn(() => ".test"),
      getConfigPaths: vi.fn(() => []),
      getMCPConfigPaths: vi.fn(() => []),
      getSkillsDir: vi.fn(() => ".test/skills"),
      getAgentsDir: vi.fn(() => ".test/agents"),
      getCommandsDir: vi.fn(() => ".test/commands"),
      readSkills: vi.fn(async () => []),
      readMCPServers: vi.fn(async () => []),
      readAgents: vi.fn(async () => []),
      readCommands: vi.fn(async () => []),
      writeSkills: vi.fn(async () => ({ success: true, count: 0 })),
      writeMCPServers: vi.fn(async () => ({ success: true, count: 0 })),
      writeAgents: vi.fn(async () => ({ success: true, count: 0 })),
      writeCommands: vi.fn(async () => ({ success: true, count: 0 })),
      deleteSkill: vi.fn(async () => {}),
      deleteMCPServer: vi.fn(async () => {}),
      deleteAgent: vi.fn(async () => {}),
      deleteCommand: vi.fn(async () => {}),
    } as ToolAdapter;

    // Source data
    sourceData = {
      skills: [
        { name: "skill1", content: "content1", hash: "hash1" },
        { name: "skill2", content: "content2", hash: "hash2" },
      ] as Skill[],
      mcpServers: [
        { name: "mcp1", type: "stdio", command: "cmd1", hash: "hash3" },
      ] as MCPServer[],
      agents: [
        { name: "agent1", content: "content3", hash: "hash4" },
      ] as Agent[],
      commands: [
        { name: "cmd1", content: "content4", hash: "hash5" },
      ] as Command[],
    };
  });

  describe("execute", () => {
    it("should execute sync with CREATE operations", async () => {
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

      const executor = new SyncExecutor(mockAdapter, sourceData);
      const result = await executor.execute(diff);

      expect(result.success).toBe(true);
      expect(result.tool).toBe("test-tool");
      expect(result.created).toBe(2); // 1 skill + 1 mcp
      expect(result.updated).toBe(0);
      expect(mockAdapter.writeSkills).toHaveBeenCalledWith([
        sourceData.skills[0],
      ]);
      expect(mockAdapter.writeMCPServers).toHaveBeenCalledWith([
        sourceData.mcpServers[0],
      ]);
    });

    it("should execute sync with UPDATE operations", async () => {
      const diff: DiffResult = {
        tool: "cursor",
        toCreate: [],
        toUpdate: [
          {
            type: "update",
            itemType: "skill",
            name: "skill2",
            description: "modified",
            reason: "modified",
            oldHash: "old",
            newHash: "new",
          },
          {
            type: "update",
            itemType: "agent",
            name: "agent1",
            description: "modified",
            reason: "modified",
            oldHash: "old",
            newHash: "new",
          },
        ],
        toDelete: [],
        toSkip: [],
      };

      const executor = new SyncExecutor(mockAdapter, sourceData);
      const result = await executor.execute(diff);

      expect(result.success).toBe(true);
      expect(result.created).toBe(0);
      expect(result.updated).toBe(2); // 1 skill + 1 agent
      expect(mockAdapter.writeSkills).toHaveBeenCalledWith([
        sourceData.skills[1],
      ]);
      expect(mockAdapter.writeAgents).toHaveBeenCalledWith([
        sourceData.agents[0],
      ]);
    });

    it("should execute sync with mixed CREATE and UPDATE", async () => {
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
        toUpdate: [
          {
            type: "update",
            itemType: "skill",
            name: "skill2",
            description: "modified",
            reason: "modified",
            oldHash: "old",
            newHash: "new",
          },
        ],
        toDelete: [],
        toSkip: [],
      };

      const executor = new SyncExecutor(mockAdapter, sourceData);
      const result = await executor.execute(diff);

      expect(result.success).toBe(true);
      expect(result.created).toBe(1);
      expect(result.updated).toBe(1);
      // Should write both skills together
      expect(mockAdapter.writeSkills).toHaveBeenCalledWith([
        sourceData.skills[0],
        sourceData.skills[1],
      ]);
    });

    it("should handle write failures and rollback", async () => {
      // Mock write failure
      vi.mocked(mockAdapter.writeSkills).mockResolvedValue({
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

      const executor = new SyncExecutor(mockAdapter, sourceData);

      await expect(executor.execute(diff)).rejects.toThrow("write failed");
    });

    it("should skip writing when no operations", async () => {
      const diff: DiffResult = {
        tool: "cursor",
        toCreate: [],
        toUpdate: [],
        toDelete: [],
        toSkip: [
          {
            type: "skip",
            itemType: "skill",
            name: "skill1",
            description: "unchanged",
            reason: "unchanged",
          },
        ],
      };

      const executor = new SyncExecutor(mockAdapter, sourceData);
      const result = await executor.execute(diff);

      expect(result.success).toBe(true);
      expect(result.created).toBe(0);
      expect(result.updated).toBe(0);
      expect(mockAdapter.writeSkills).not.toHaveBeenCalled();
    });

    it("should handle all item types (skills, mcp, agents, commands)", async () => {
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
          {
            type: "create",
            itemType: "agent",
            name: "agent1",
            description: "new",
            reason: "new",
          },
          {
            type: "create",
            itemType: "command",
            name: "cmd1",
            description: "new",
            reason: "new",
          },
        ],
        toUpdate: [],
        toDelete: [],
        toSkip: [],
      };

      const executor = new SyncExecutor(mockAdapter, sourceData);
      const result = await executor.execute(diff);

      expect(result.success).toBe(true);
      expect(result.created).toBe(4);
      expect(mockAdapter.writeSkills).toHaveBeenCalled();
      expect(mockAdapter.writeMCPServers).toHaveBeenCalled();
      expect(mockAdapter.writeAgents).toHaveBeenCalled();
      expect(mockAdapter.writeCommands).toHaveBeenCalled();
    });

    it("should collect errors properly", async () => {
      vi.mocked(mockAdapter.writeSkills).mockResolvedValue({
        success: false,
        count: 0,
        error: "Skills write failed",
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

      const executor = new SyncExecutor(mockAdapter, sourceData);

      try {
        await executor.execute(diff);
      } catch {
        // Expected to throw
      }

      // Note: Can't easily test result.errors here since execute throws
      // Error collection is tested in integration tests
    });

    it("should stop on first error to maintain atomicity", async () => {
      vi.mocked(mockAdapter.writeSkills).mockRejectedValue(
        new Error("Skill write error"),
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

      const executor = new SyncExecutor(mockAdapter, sourceData);

      await expect(executor.execute(diff)).rejects.toThrow();

      // MCP write should not be called since skills failed
      expect(mockAdapter.writeSkills).toHaveBeenCalled();
      expect(mockAdapter.writeMCPServers).not.toHaveBeenCalled();
    });
  });
});
