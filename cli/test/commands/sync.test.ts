import { readFile } from "node:fs/promises";
import mockFs from "mock-fs";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  loadSyncConfig,
  readSourceConfig,
  calculateSyncDiff,
  executeSyncPlan,
  syncCommand,
  updateManifestAfterSync,
} from "@src/commands/sync.js";
import type { VibeConfig, ToolName } from "@src/types/config.js";

describe("Sync Command", () => {
  const sampleConfig: VibeConfig = {
    version: "1.0.0",
    level: "project",
    source_tool: "claude-code",
    target_tools: ["cursor"],
    sync_config: {
      skills: true,
      mcp: true,
    },
  };

  beforeEach(() => {
    mockFs({
      "/project": {
        ".vibe-sync.json": JSON.stringify(sampleConfig),
        ".vibe-sync-cache": {
          "manifest.json": JSON.stringify({
            version: "1.0.0",
            last_synced: "",
            items: {},
          }),
        },
        ".claude": {
          skills: {
            "test-skill": {
              "SKILL.md": "# Test Skill\n\nA test skill",
            },
          },
          ".mcp.json": JSON.stringify({
            mcpServers: {
              postgres: {
                command: "npx",
                args: ["-y", "@modelcontextprotocol/server-postgres"],
              },
            },
          }),
        },
        ".cursor": {},
      },
    });
  });

  afterEach(() => {
    mockFs.restore();
    vi.restoreAllMocks();
  });

  describe("Configuration Loading", () => {
    it("should load project config", async () => {
      const config = await loadSyncConfig("/project", false);

      expect(config.source_tool).toBe("claude-code");
      expect(config.target_tools).toEqual(["cursor"]);
    });

    it("should throw error if config not found", async () => {
      mockFs({
        "/empty": {},
      });

      await expect(loadSyncConfig("/empty", false)).rejects.toThrow();
    });
  });

  describe("Sync Execution", () => {
    it("should read source configurations", async () => {
      const result = await readSourceConfig(
        "claude-code",
        "/project",
        "project",
      );

      expect(result.skills.length).toBeGreaterThan(0);
      expect(result.skills[0]?.name).toBe("test-skill");
    });

    it("should calculate diff for targets", async () => {
      const sourceSkills = [
        { name: "test-skill", content: "test", hash: "hash123" },
      ];
      const sourceMCP = [
        {
          name: "postgres",
          type: "stdio" as const,
          command: "npx",
          hash: "hash456",
        },
      ];

      const plan = await calculateSyncDiff(
        {
          skills: sourceSkills,
          mcpServers: sourceMCP,
          agents: [],
          commands: [],
        },
        ["cursor"],
        {
          version: "1.0.0",
          last_synced: "",
          items: {},
        },
        "safe",
        { skills: true, mcp: true, agents: false, commands: false },
      );

      expect(plan.diffs.cursor).toBeDefined();
    });

    it("should execute sync operations for safe mode", async () => {
      const plan = {
        source_tool: "claude-code" as ToolName,
        diffs: {
          cursor: {
            tool: "cursor" as const,
            toCreate: [
              {
                type: "create" as const,
                itemType: "skill" as const,
                name: "test-skill",
                description: "New skill",
              },
            ],
            toUpdate: [],
            toDelete: [],
            toSkip: [],
          },
        },
        timestamp: new Date().toISOString(),
      };

      const sourceData = {
        skills: [{ name: "test-skill", content: "# Test", hash: "hash123" }],
        mcpServers: [],
        agents: [],
        commands: [],
      };

      const result = await executeSyncPlan(
        plan,
        sourceData,
        "/project",
        "project",
      );

      expect(result.cursor?.success).toBe(true);
    });
  });

  describe("Dry Run Mode", () => {
    it("should not execute operations in dry-run mode", async () => {
      // Mock console and process.exit to suppress output
      vi.spyOn(console, "log").mockImplementation(() => {});
      vi.spyOn(console, "error").mockImplementation(() => {});
      vi.spyOn(process, "exit").mockImplementation(() => undefined as never);

      await syncCommand({
        dryRun: true,
        prune: false,
        user: false,
      });

      // Verify no files were written to cursor
      await expect(
        readFile("/project/.cursor/skills/test-skill/SKILL.md", "utf-8"),
      ).rejects.toThrow();
    });
  });

  describe("Prune Mode", () => {
    it("should include delete operations in prune mode", async () => {
      const manifest = {
        version: "1.0.0",
        last_synced: "",
        items: {
          "skill/old-skill": {
            type: "skill" as const,
            name: "old-skill",
            hash: "old-hash",
            last_synced: "",
            targets: {
              cursor: {
                synced: true,
                hash: "old-hash",
                last_synced: "",
              },
            },
          },
        },
      };

      const plan = await calculateSyncDiff(
        {
          skills: [], // No skills in source
          mcpServers: [],
          agents: [],
          commands: [],
        },
        ["cursor"],
        manifest,
        "prune",
        { skills: true, mcp: true, agents: false, commands: false },
      );

      expect(plan.diffs.cursor?.toDelete.length).toBeGreaterThan(0);
    });
  });

  describe("Manifest Updates", () => {
    it("should update manifest after successful sync", async () => {
      const operations = {
        created: [
          { type: "skill" as const, name: "test-skill", hash: "hash123" },
        ],
        updated: [],
        deleted: [],
      };

      await updateManifestAfterSync(operations, "cursor", "/project");

      const content = await readFile(
        "/project/.vibe-sync-cache/manifest.json",
        "utf-8",
      );
      const manifest = JSON.parse(content);

      expect(manifest.items["skill/test-skill"]).toBeDefined();
    });
  });

  describe("Error Handling", () => {
    it("should handle missing source directory gracefully", async () => {
      const invalidConfig: VibeConfig = {
        version: "1.0.0",
        level: "project",
        source_tool: "claude-code",
        target_tools: ["cursor"],
        sync_config: {
          skills: true,
          mcp: true,
        },
      };

      mockFs({
        "/invalid": {
          ".vibe-sync.json": JSON.stringify(invalidConfig),
          // No .claude directory - adapters should return empty arrays
        },
      });

      const result = await readSourceConfig(
        "claude-code",
        "/invalid",
        "project",
      );

      // Adapters gracefully return empty arrays when directories don't exist
      expect(result.skills).toEqual([]);
      expect(result.mcpServers).toEqual([]);
    });

    it("should handle manifest load errors gracefully", async () => {
      mockFs({
        "/project": {
          ".vibe-sync.json": JSON.stringify(sampleConfig),
          ".vibe-sync-cache": {
            "manifest.json": "{ invalid json",
          },
          ".claude": {
            skills: {},
          },
        },
      });

      // Should not throw, should handle gracefully
      const config = await loadSyncConfig("/project", false);
      expect(config).toBeDefined();
    });
  });
});
