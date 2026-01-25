/**
 * Basic E2E workflow tests
 * Tests simple, happy-path workflows to verify core functionality
 */

import fs from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  generateConfig,
  saveConfig as saveInitConfig,
  createCacheDirectory,
} from "@src/commands/init.js";
import { syncCommand } from "@src/commands/sync.js";
import type { ToolName } from "@src/types/config.js";

/**
 * E2E test utilities - high cohesion, single responsibility
 */
class E2ETestHelper {
  /**
   * Create a unique temporary project directory
   */
  static async createTempProject(): Promise<string> {
    const tempDir = path.join(
      tmpdir(),
      `vibe-sync-e2e-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    );
    await fs.mkdir(tempDir, { recursive: true });
    return tempDir;
  }

  /**
   * Clean up temporary project directory
   */
  static async cleanupTempProject(dir: string): Promise<void> {
    try {
      await fs.rm(dir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  }

  /**
   * Check if a file exists
   */
  static async fileExists(filePath: string): Promise<boolean> {
    return fs
      .access(filePath)
      .then(() => true)
      .catch(() => false);
  }

  /**
   * Get skill path for a given tool
   */
  static getSkillPath(
    projectDir: string,
    tool: ToolName,
    skillName: string,
  ): string {
    const toolConfigDirs: Record<ToolName, string> = {
      "claude-code": ".claude",
      cursor: ".cursor",
      opencode: ".opencode",
      codex: ".codex",
    };

    const configDir = toolConfigDirs[tool];
    return path.join(projectDir, configDir, "skills", skillName, "SKILL.md");
  }

  /**
   * Get skills directory path for a given tool
   */
  static getSkillsDir(projectDir: string, tool: ToolName): string {
    const toolConfigDirs: Record<ToolName, string> = {
      "claude-code": ".claude",
      cursor: ".cursor",
      opencode: ".opencode",
      codex: ".codex",
    };

    const configDir = toolConfigDirs[tool];
    return path.join(projectDir, configDir, "skills");
  }

  /**
   * Check if a path is a symlink
   */
  static async isSymlink(filePath: string): Promise<boolean> {
    try {
      const stats = await fs.lstat(filePath);
      return stats.isSymbolicLink();
    } catch {
      return false;
    }
  }

  /**
   * Get the target of a symlink
   */
  static async getSymlinkTarget(filePath: string): Promise<string | null> {
    try {
      return await fs.readlink(filePath);
    } catch {
      return null;
    }
  }
}

/**
 * Test fixture builder - follows builder pattern
 */
class E2ETestFixture {
  private projectDir: string;

  constructor(projectDir: string) {
    this.projectDir = projectDir;
  }

  /**
   * Initialize vibe-sync configuration
   */
  async initVibeSync(
    source: ToolName,
    targets: ToolName[],
    options?: { useSymlinks?: boolean },
  ): Promise<void> {
    const config = await generateConfig({
      tools: [source, ...targets],
      source,
      syncItems: ["skills", "mcp"],
      isUserLevel: false,
    });

    // Configure symlinks (default: disabled for E2E tests to avoid prompts)
    config.use_symlinks_for_skills = options?.useSymlinks ?? false;

    await saveInitConfig(config, this.projectDir);
    await createCacheDirectory(this.projectDir);
  }

  /**
   * Create a skill in Claude Code source
   */
  async createSkill(skillName: string, content?: string): Promise<void> {
    const skillDir = path.join(this.projectDir, ".claude", "skills", skillName);
    await fs.mkdir(skillDir, { recursive: true });

    const skillContent =
      content ||
      `---
name: ${skillName}
description: ${skillName} skill
---
# ${skillName}
`;

    await fs.writeFile(path.join(skillDir, "SKILL.md"), skillContent);
  }

  /**
   * Remove a skill from Claude Code source
   */
  async removeSkill(skillName: string): Promise<void> {
    const skillDir = path.join(this.projectDir, ".claude", "skills", skillName);
    await fs.rm(skillDir, { recursive: true, force: true });
  }
}

describe("Basic E2E Workflows", () => {
  let testDir: string;
  let originalCwd: string;
  let fixture: E2ETestFixture;

  beforeEach(async () => {
    originalCwd = process.cwd();
    testDir = await E2ETestHelper.createTempProject();
    fixture = new E2ETestFixture(testDir);
    process.chdir(testDir);
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await E2ETestHelper.cleanupTempProject(testDir);
  });

  describe("Basic Sync", () => {
    it("should sync from Claude Code to Cursor", async () => {
      // Arrange
      await fixture.createSkill("demo", "---\nname: demo\n---\n# Demo Skill\n");
      await fixture.initVibeSync("claude-code", ["cursor"]);

      // Act
      await syncCommand({ yes: true });

      // Assert
      const skillPath = E2ETestHelper.getSkillPath(testDir, "cursor", "demo");
      const skillContent = await fs.readFile(skillPath, "utf-8");
      expect(skillContent).toContain("Demo Skill");
    });

    it("should sync to multiple targets in parallel", async () => {
      // Arrange
      await fixture.createSkill("demo");
      await fixture.initVibeSync("claude-code", ["cursor", "opencode"]);

      // Act
      await syncCommand({ yes: true });

      // Assert - DRY: use helper for multiple tools
      const targets: ToolName[] = ["cursor", "opencode"];
      for (const target of targets) {
        const skillPath = E2ETestHelper.getSkillPath(testDir, target, "demo");
        const exists = await E2ETestHelper.fileExists(skillPath);
        expect(exists).toBe(true);
      }
    });
  });

  describe("Prune Mode", () => {
    it("should delete orphaned items", async () => {
      // Arrange - setup and first sync
      await fixture.createSkill("demo");
      await fixture.initVibeSync("claude-code", ["cursor"]);
      await syncCommand({ yes: true });

      const skillPath = E2ETestHelper.getSkillPath(testDir, "cursor", "demo");

      // Verify initial sync
      expect(await E2ETestHelper.fileExists(skillPath)).toBe(true);

      // Act - remove from source and sync in prune mode
      await fixture.removeSkill("demo");
      await syncCommand({ yes: true, prune: true });

      // Assert
      expect(await E2ETestHelper.fileExists(skillPath)).toBe(false);
    });
  });

  describe("Symlink Mode", () => {
    it("should create symlinks when enabled", async () => {
      // Arrange
      await fixture.createSkill("demo");
      await fixture.initVibeSync("claude-code", ["cursor"], {
        useSymlinks: true,
      });

      // Act
      await syncCommand({ yes: true });

      // Assert - skills directory should be a symlink
      const cursorSkillsDir = E2ETestHelper.getSkillsDir(testDir, "cursor");
      const isSymlink = await E2ETestHelper.isSymlink(cursorSkillsDir);
      expect(isSymlink).toBe(true);
    });

    it("should point to source skills directory", async () => {
      // Arrange
      await fixture.createSkill("demo");
      await fixture.initVibeSync("claude-code", ["cursor"], {
        useSymlinks: true,
      });

      // Act
      await syncCommand({ yes: true });

      // Assert - symlink target should be source skills directory
      const cursorSkillsDir = E2ETestHelper.getSkillsDir(testDir, "cursor");
      const symlinkTarget =
        await E2ETestHelper.getSymlinkTarget(cursorSkillsDir);
      const sourceSkillsDir = E2ETestHelper.getSkillsDir(
        testDir,
        "claude-code",
      );

      // Resolve real paths for comparison (handles /var vs /private/var on macOS)
      const realSymlinkTarget = symlinkTarget
        ? await fs.realpath(symlinkTarget)
        : null;
      const realSourceDir = await fs.realpath(sourceSkillsDir);

      expect(realSymlinkTarget).toBe(realSourceDir);
    });

    it("should allow accessing files through symlink", async () => {
      // Arrange
      await fixture.createSkill("demo", "---\nname: demo\n---\n# Symlinked!");
      await fixture.initVibeSync("claude-code", ["cursor"], {
        useSymlinks: true,
      });

      // Act
      await syncCommand({ yes: true });

      // Assert - can read file through symlink
      const cursorSkillPath = E2ETestHelper.getSkillPath(
        testDir,
        "cursor",
        "demo",
      );
      const content = await fs.readFile(cursorSkillPath, "utf-8");
      expect(content).toContain("Symlinked!");
    });

    it("should reflect source changes immediately", async () => {
      // Arrange - setup symlink
      await fixture.createSkill("demo", "---\nname: demo\n---\n# Original");
      await fixture.initVibeSync("claude-code", ["cursor"], {
        useSymlinks: true,
      });
      await syncCommand({ yes: true });

      const cursorSkillPath = E2ETestHelper.getSkillPath(
        testDir,
        "cursor",
        "demo",
      );

      // Verify initial content
      let content = await fs.readFile(cursorSkillPath, "utf-8");
      expect(content).toContain("Original");

      // Act - modify source directly (no sync needed!)
      const sourceSkillPath = E2ETestHelper.getSkillPath(
        testDir,
        "claude-code",
        "demo",
      );
      await fs.writeFile(sourceSkillPath, "---\nname: demo\n---\n# Modified!");

      // Assert - change visible immediately through symlink
      content = await fs.readFile(cursorSkillPath, "utf-8");
      expect(content).toContain("Modified!");
    });

    it("should work with multiple targets", async () => {
      // Arrange
      await fixture.createSkill("demo");
      await fixture.initVibeSync("claude-code", ["cursor", "opencode"], {
        useSymlinks: true,
      });

      // Act
      await syncCommand({ yes: true });

      // Assert - both targets should have symlinks
      const targets: ToolName[] = ["cursor", "opencode"];
      const sourceSkillsDir = E2ETestHelper.getSkillsDir(
        testDir,
        "claude-code",
      );
      const realSourceDir = await fs.realpath(sourceSkillsDir);

      for (const target of targets) {
        const targetSkillsDir = E2ETestHelper.getSkillsDir(testDir, target);
        const isSymlink = await E2ETestHelper.isSymlink(targetSkillsDir);
        const symlinkTarget =
          await E2ETestHelper.getSymlinkTarget(targetSkillsDir);

        // Resolve real path for comparison
        const realSymlinkTarget = symlinkTarget
          ? await fs.realpath(symlinkTarget)
          : null;

        expect(isSymlink).toBe(true);
        expect(realSymlinkTarget).toBe(realSourceDir);
      }
    });
  });
});
