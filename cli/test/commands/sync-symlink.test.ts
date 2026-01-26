import mockFs from "mock-fs";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { executeSyncPlan, syncWithSymlinks } from "@src/commands/sync.js";
import type { VibeConfig } from "@src/types/config.js";
import type { SyncPlan } from "@src/types/plan.js";

describe("Sync Command - Symlink Support", () => {
  beforeEach(() => {
    mockFs({
      "/project/.vsync.json": JSON.stringify({
        version: "3.0.0",
        level: "project",
        source_tool: "claude-code",
        target_tools: ["cursor"],
        sync_config: { skills: true, mcp: true },
        use_symlinks_for_skills: true,
      }),
      "/project/.claude/skills": {
        "skill1/SKILL.md": "# Skill 1",
        "skill2/SKILL.md": "# Skill 2",
      },
      "/project/.cursor": {},
      "/project/.vibe-manifest.json": JSON.stringify({
        version: "3.0.0",
        source_tool: "claude-code",
        items: {},
      }),
    });
  });

  afterEach(() => {
    mockFs.restore();
  });

  describe("syncWithSymlinks", () => {
    it("should setup symlinks when use_symlinks_for_skills is true", async () => {
      const config: VibeConfig = {
        version: "3.0.0",
        level: "project",
        source_tool: "claude-code",
        target_tools: ["cursor"],
        sync_config: { skills: true, mcp: true },
        use_symlinks_for_skills: true,
      };

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

      await syncWithSymlinks(config, plan, "/project");

      // Verify symlink was created
      const { isSymlink } = await import("@src/utils/file-ops.js");
      const isLink = await isSymlink("/project/.cursor/skills");
      expect(isLink).toBe(true);
    });

    it("should skip symlink setup when use_symlinks_for_skills is false", async () => {
      const config: VibeConfig = {
        version: "3.0.0",
        level: "project",
        source_tool: "claude-code",
        target_tools: ["cursor"],
        sync_config: { skills: true, mcp: true },
        use_symlinks_for_skills: false,
      };

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

      await syncWithSymlinks(config, plan, "/project");

      // Verify symlink was NOT created
      const { isSymlink } = await import("@src/utils/file-ops.js");
      const isLink = await isSymlink("/project/.cursor/skills");
      expect(isLink).toBe(false);
    });

    it("should skip symlink setup when use_symlinks_for_skills is undefined", async () => {
      const config: VibeConfig = {
        version: "3.0.0",
        level: "project",
        source_tool: "claude-code",
        target_tools: ["cursor"],
        sync_config: { skills: true, mcp: true },
      };

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

      await syncWithSymlinks(config, plan, "/project");

      // Verify symlink was NOT created
      const { isSymlink } = await import("@src/utils/file-ops.js");
      const isLink = await isSymlink("/project/.cursor/skills");
      expect(isLink).toBe(false);
    });

    it("should setup symlinks for multiple target tools", async () => {
      mockFs({
        "/project/.claude/skills": {
          "skill1/SKILL.md": "# Skill 1",
        },
        "/project/.cursor": {},
        "/project/.opencode": {},
      });

      const config: VibeConfig = {
        version: "3.0.0",
        level: "project",
        source_tool: "claude-code",
        target_tools: ["cursor", "opencode"],
        sync_config: { skills: true, mcp: true },
        use_symlinks_for_skills: true,
      };

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
          opencode: {
            tool: "opencode",
            toCreate: [],
            toUpdate: [],
            toDelete: [],
            toSkip: [],
          },
        },
        timestamp: new Date().toISOString(),
      };

      await syncWithSymlinks(config, plan, "/project");

      // Verify both symlinks were created
      const { isSymlink } = await import("@src/utils/file-ops.js");
      const cursorIsLink = await isSymlink("/project/.cursor/skills");
      const opencodeIsLink = await isSymlink("/project/.opencode/skills");

      expect(cursorIsLink).toBe(true);
      expect(opencodeIsLink).toBe(true);
    });

    it("should handle symlink creation errors gracefully", async () => {
      const config: VibeConfig = {
        version: "3.0.0",
        level: "project",
        source_tool: "claude-code",
        target_tools: ["cursor"],
        sync_config: { skills: true, mcp: true },
        use_symlinks_for_skills: true,
      };

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

      // Mock source directory not existing
      mockFs({
        "/project/.cursor": {},
      });

      await expect(
        syncWithSymlinks(config, plan, "/project"),
      ).rejects.toThrow();
    });
  });

  describe("Integration with executeSyncPlan", () => {
    it("should skip writing skills when target directory is symlinked", async () => {
      // Setup: cursor/skills is already a symlink to claude/skills
      mockFs({
        "/project/.claude/skills": {
          "skill1/SKILL.md": "# Skill 1",
        },
        "/project/.cursor/skills": mockFs.symlink({
          path: "/project/.claude/skills",
        }),
      });

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
                description: "Create skill1",
                newHash: "hash1",
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
        skills: [
          {
            name: "skill1",
            description: "Skill 1",
            content: "# Skill 1",
            hash: "hash1",
          },
        ],
        mcpServers: [],
        agents: [],
        commands: [],
      };

      const results = await executeSyncPlan(
        plan,
        sourceData,
        "/project",
        "project",
      );

      // Should succeed but with 0 created (skipped due to symlink)
      expect(results.cursor?.success).toBe(true);
      expect(results.cursor?.created).toBe(0);
    });
  });
});
