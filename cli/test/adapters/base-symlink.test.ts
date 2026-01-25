import mockFs from "mock-fs";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { BaseAdapter } from "@src/adapters/base.js";
import type { AdapterConfig } from "@src/adapters/base.js";
import type { Skill } from "@src/types/models.js";

// Concrete test adapter that extends BaseAdapter
class TestAdapter extends BaseAdapter {
  override readonly toolName = "test-tool" as const;
  override readonly displayName = "Test Tool";

  override getConfigDir(): string {
    return ".test";
  }

  override getConfigPaths(): string[] {
    return [".test/config.json"];
  }

  override getMCPConfigPaths(): string[] {
    return [".test/.mcp.json"];
  }

  override getSkillsDir(): string {
    return ".test/skills";
  }

  override getAgentsDir(): string {
    return ".test/agents";
  }

  override getCommandsDir(): string {
    return ".test/commands";
  }

  override async readMCPServers() {
    return [];
  }

  override async writeMCPServers() {
    return { success: true, count: 0 };
  }

  override async deleteMCPServer() {}
}

describe("BaseAdapter Symlink Handling", () => {
  let adapter: TestAdapter;
  const config: AdapterConfig = {
    tool: "claude-code",
    baseDir: "/project",
    level: "project",
  };

  beforeEach(() => {
    mockFs({
      "/project/.test/skills": {
        "existing-skill/SKILL.md": "# Existing Skill",
      },
      "/project/.claude/skills": {
        "skill1/SKILL.md": "# Skill 1",
        "skill2/SKILL.md": "# Skill 2",
      },
      "/project/.cursor/skills": mockFs.symlink({
        path: "/project/.claude/skills",
      }),
    });

    adapter = new TestAdapter(config);
  });

  afterEach(() => {
    mockFs.restore();
  });

  describe("writeSkills", () => {
    it("should skip writing if target directory is a symlink", async () => {
      // Create a symlinked skills directory for this test
      mockFs({
        "/project/.test/skills": mockFs.symlink({
          path: "/project/.claude/skills",
        }),
        "/project/.claude/skills": {
          "skill1/SKILL.md": "# Skill 1",
        },
      });

      const testAdapter = new TestAdapter(config);

      const skills: Skill[] = [
        {
          name: "new-skill",
          description: "New skill",
          content: "# New Skill Content",
          hash: "hash1",
        },
      ];

      const result = await testAdapter.writeSkills(skills);

      // Should skip writing and return success with 0 count
      expect(result.success).toBe(true);
      expect(result.count).toBe(0);

      // Verify the skills directory is still a symlink
      const { isSymlink } = await import("@src/utils/symlink.js");
      const isLink = await isSymlink("/project/.test/skills");
      expect(isLink).toBe(true);
    });

    it("should write normally to non-symlink directories", async () => {
      const skills: Skill[] = [
        {
          name: "new-skill",
          description: "New skill",
          content: "# New Skill Content",
          hash: "hash1",
        },
      ];

      const result = await adapter.writeSkills(skills);

      expect(result.success).toBe(true);
      expect(result.count).toBe(1);
    });
  });

  // Note: readSkills already works correctly with symlinks since it just reads
  // from the directory transparently. mock-fs has limitations with symlink
  // readdir traversal, so we test the actual behavior we care about: write and delete.

  describe("deleteSkill", () => {
    it("should throw error when trying to delete from symlinked directory", async () => {
      // Create a symlinked skills directory
      mockFs({
        "/project/.test/skills": mockFs.symlink({
          path: "/project/.claude/skills",
        }),
        "/project/.claude/skills": {
          "skill1/SKILL.md": "# Skill 1",
        },
      });

      const testAdapter = new TestAdapter(config);

      await expect(testAdapter.deleteSkill("skill1")).rejects.toThrow(
        "Cannot delete individual skills from symlinked directory",
      );
    });

    it("should delete normally from non-symlink directories", async () => {
      await adapter.deleteSkill("existing-skill");

      const skills = await adapter.readSkills();
      expect(skills).toHaveLength(0);
    });
  });
});
