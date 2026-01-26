import mockFs from "mock-fs";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  setupSymlinkForSkills,
  shouldUseSymlinks,
  validateSymlinkSetup,
} from "@src/core/symlink-sync.js";
import type { VSyncConfig } from "@src/types/config.js";

describe("Symlink Sync", () => {
  beforeEach(() => {
    mockFs({
      "/project/.claude/skills": {
        "skill1/SKILL.md": "# Skill 1",
        "skill2/SKILL.md": "# Skill 2",
      },
      "/project/.cursor/skills": {
        "old-skill/SKILL.md": "# Old Skill",
      },
      "/project/.opencode/skills": mockFs.symlink({
        path: "/project/.claude/skills",
      }),
      "/empty": {},
    });
  });

  afterEach(() => {
    mockFs.restore();
  });

  describe("shouldUseSymlinks", () => {
    it("should return true when use_symlinks_for_skills is enabled", () => {
      const config: VSyncConfig = {
        version: "3.0.0",
        level: "project",
        source_tool: "claude-code",
        target_tools: ["cursor"],
        sync_config: { skills: true, mcp: true },
        use_symlinks_for_skills: true,
      };

      const result = shouldUseSymlinks(config);
      expect(result).toBe(true);
    });

    it("should return false when use_symlinks_for_skills is disabled", () => {
      const config: VSyncConfig = {
        version: "3.0.0",
        level: "project",
        source_tool: "claude-code",
        target_tools: ["cursor"],
        sync_config: { skills: true, mcp: true },
        use_symlinks_for_skills: false,
      };

      const result = shouldUseSymlinks(config);
      expect(result).toBe(false);
    });

    it("should return false when use_symlinks_for_skills is undefined", () => {
      const config: VSyncConfig = {
        version: "3.0.0",
        level: "project",
        source_tool: "claude-code",
        target_tools: ["cursor"],
        sync_config: { skills: true, mcp: true },
      };

      const result = shouldUseSymlinks(config);
      expect(result).toBe(false);
    });
  });

  describe("validateSymlinkSetup", () => {
    it("should validate that source directory exists", async () => {
      const result = await validateSymlinkSetup(
        "/project/.claude/skills",
        "/project/.cursor/skills",
      );

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should fail if source directory does not exist", async () => {
      const result = await validateSymlinkSetup(
        "/nonexistent/skills",
        "/project/.cursor/skills",
      );

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Source skills directory does not exist");
    });

    it("should detect circular symlinks", async () => {
      // Create circular symlink: A -> B, B -> A
      mockFs({
        "/project/.cursor/skills": mockFs.symlink({
          path: "/project/.opencode/skills",
        }),
        "/project/.opencode/skills": mockFs.symlink({
          path: "/project/.cursor/skills",
        }),
      });

      const result = await validateSymlinkSetup(
        "/project/.cursor/skills",
        "/project/.opencode/skills",
      );

      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain("Circular symlink");
    });

    it("should allow same source and target (already symlinked)", async () => {
      const result = await validateSymlinkSetup(
        "/project/.claude/skills",
        "/project/.opencode/skills",
      );

      expect(result.valid).toBe(true);
    });
  });

  describe("setupSymlinkForSkills", () => {
    it("should create symlink from target to source", async () => {
      await setupSymlinkForSkills(
        "/project/.claude/skills",
        "/empty/target-skills",
      );

      // Check if symlink was created
      const { isSymlink } = await import("@src/utils/file-ops.js");
      const isLink = await isSymlink("/empty/target-skills");
      expect(isLink).toBe(true);
    });

    // Note: Skipping test for removing existing directory due to mock-fs limitations
    // with recursive directory removal. This functionality is tested in integration tests
    // and works correctly with real filesystems.

    it("should skip if target is already a symlink to source", async () => {
      // opencode/skills already points to claude/skills
      await setupSymlinkForSkills(
        "/project/.claude/skills",
        "/project/.opencode/skills",
      );

      // Should still be a symlink
      const { isSymlink } = await import("@src/utils/file-ops.js");
      const isLink = await isSymlink("/project/.opencode/skills");
      expect(isLink).toBe(true);
    });

    it("should throw error if source does not exist", async () => {
      await expect(
        setupSymlinkForSkills("/nonexistent/skills", "/project/.cursor/skills"),
      ).rejects.toThrow();
    });

    it("should create parent directory if it does not exist", async () => {
      await setupSymlinkForSkills(
        "/project/.claude/skills",
        "/empty/nested/deep/skills",
      );

      const { isSymlink } = await import("@src/utils/file-ops.js");
      const isLink = await isSymlink("/empty/nested/deep/skills");
      expect(isLink).toBe(true);
    });
  });
});
