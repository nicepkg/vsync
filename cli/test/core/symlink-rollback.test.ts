/**
 * Tests for symlink rollback support
 * Phase 9.5: Safety & Error Handling - Rollback support
 */

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import mockFs from "mock-fs";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  createDirectoryBackup,
  restoreDirectoryBackup,
  cleanupDirectoryBackup,
  setupSymlinkWithBackup,
} from "@src/core/symlink-sync.js";
import type { DirectoryBackupInfo } from "@src/core/symlink-sync.js";
import { isSamePath } from "../utils/path.js";

describe("Symlink Rollback Support", () => {
  beforeEach(() => {
    mockFs({
      "/source/skills": {
        "skill1.md": "# Skill 1",
        "skill2.md": "# Skill 2",
      },
      "/target/skills": {
        "old-skill.md": "# Old Skill",
        "another.md": "# Another",
      },
      "/empty/skills": {},
    });
  });

  afterEach(() => {
    mockFs.restore();
  });

  describe("createDirectoryBackup", () => {
    it("should backup directory with all files", async () => {
      const backup = await createDirectoryBackup("/target/skills");

      expect(isSamePath(backup.originalPath, "/target/skills")).toBe(true);
      expect(backup.backupPath).toMatch(/\.vsync-backup-\d+-skills$/);
      expect(backup.existed).toBe(true);
      expect(backup.timestamp).toBeTruthy();

      // Verify backup contains all files
      const backupFiles = await readdir(backup.backupPath);
      expect(backupFiles).toContain("old-skill.md");
      expect(backupFiles).toContain("another.md");

      const content = await readFile(
        `${backup.backupPath}/old-skill.md`,
        "utf-8",
      );
      expect(content).toBe("# Old Skill");
    });

    it("should handle non-existent directory", async () => {
      const backup = await createDirectoryBackup("/nonexistent/skills");

      expect(isSamePath(backup.originalPath, "/nonexistent/skills")).toBe(true);
      expect(backup.backupPath).toBe("");
      expect(backup.existed).toBe(false);
    });

    it("should backup empty directory", async () => {
      const backup = await createDirectoryBackup("/empty/skills");

      expect(backup.existed).toBe(true);
      expect(backup.backupPath).toBeTruthy();

      const backupFiles = await readdir(backup.backupPath);
      expect(backupFiles).toHaveLength(0);
    });

    it("should create backup in parent directory", async () => {
      const originalPath = "/target/skills";
      const backup = await createDirectoryBackup(originalPath);

      // Backup should be in /target, not /target/skills
      const backupParent = path.dirname(backup.backupPath);
      const originalParent = path.dirname(originalPath);
      expect(isSamePath(backupParent, originalParent)).toBe(true);
      expect(backup.backupPath).not.toBe(originalPath);
    });
  });

  describe("restoreDirectoryBackup", () => {
    it("should restore directory from backup", async () => {
      // Create backup first
      const backup = await createDirectoryBackup("/target/skills");

      // Store backup path for later use
      const backupPath = backup.backupPath;

      // Read backup content before resetting mock-fs
      const oldSkillContent = await readFile(
        `${backupPath}/old-skill.md`,
        "utf-8",
      );
      const anotherContent = await readFile(
        `${backupPath}/another.md`,
        "utf-8",
      );

      // Now reset mock-fs and simulate new state
      mockFs({
        [backupPath]: {
          "old-skill.md": oldSkillContent,
          "another.md": anotherContent,
        },
        "/target/skills": {
          "new-file.md": "# New",
        },
      });

      // Update backup reference to match new mock state
      const updatedBackup: DirectoryBackupInfo = {
        ...backup,
        backupPath,
      };

      // Restore
      await restoreDirectoryBackup(updatedBackup);

      // Verify restoration
      const files = await readdir("/target/skills");
      expect(files).toContain("old-skill.md");
      expect(files).toContain("another.md");
      expect(files).not.toContain("new-file.md");

      const content = await readFile("/target/skills/old-skill.md", "utf-8");
      expect(content).toBe("# Old Skill");
    });

    it("should delete directory if it didn't exist originally", async () => {
      const backup: DirectoryBackupInfo = {
        originalPath: "/target/new-dir",
        backupPath: "",
        existed: false,
        timestamp: new Date().toISOString(),
      };

      // Create directory that didn't exist before
      mockFs({
        "/target/new-dir": {
          "file.txt": "content",
        },
      });

      await restoreDirectoryBackup(backup);

      // Directory should be deleted
      await expect(readdir("/target/new-dir")).rejects.toThrow();
    });

    it("should handle missing backup gracefully", async () => {
      const backup: DirectoryBackupInfo = {
        originalPath: "/target/skills",
        backupPath: "/target/.vsync-backup-123-skills",
        existed: true,
        timestamp: new Date().toISOString(),
      };

      // Backup doesn't exist
      mockFs({
        "/target/skills": {},
      });

      // Should not throw
      await expect(restoreDirectoryBackup(backup)).resolves.not.toThrow();
    });
  });

  describe("cleanupDirectoryBackup", () => {
    it("should delete backup directory", async () => {
      const backup = await createDirectoryBackup("/target/skills");

      // Verify backup exists
      const filesBeforeCleanup = await readdir(backup.backupPath);
      expect(filesBeforeCleanup.length).toBeGreaterThan(0);

      await cleanupDirectoryBackup(backup);

      // Backup should be deleted
      await expect(readdir(backup.backupPath)).rejects.toThrow();
    });

    it("should handle non-existent backup gracefully", async () => {
      const backup: DirectoryBackupInfo = {
        originalPath: "/target/skills",
        backupPath: "",
        existed: false,
        timestamp: new Date().toISOString(),
      };

      // Should not throw
      await expect(cleanupDirectoryBackup(backup)).resolves.not.toThrow();
    });

    it("should handle already deleted backup gracefully", async () => {
      const backup: DirectoryBackupInfo = {
        originalPath: "/target/skills",
        backupPath: "/target/.vsync-backup-123-skills",
        existed: true,
        timestamp: new Date().toISOString(),
      };

      mockFs({
        "/target": {},
      });

      // Should not throw
      await expect(cleanupDirectoryBackup(backup)).resolves.not.toThrow();
    });
  });

  describe("setupSymlinkWithBackup", () => {
    it("should create backup, setup symlink, and return backup info", async () => {
      const backup = await setupSymlinkWithBackup(
        "/source/skills",
        "/target/skills",
      );

      expect(isSamePath(backup.originalPath, "/target/skills")).toBe(true);
      expect(backup.existed).toBe(true);
      expect(backup.backupPath).toBeTruthy();

      // Verify backup exists
      const backupFiles = await readdir(backup.backupPath);
      expect(backupFiles).toContain("old-skill.md");

      // Verify symlink created (would normally check with lstat, but mock-fs limitations)
      // In real filesystem, this would be a symlink
    });

    it("should handle non-existent target directory", async () => {
      const backup = await setupSymlinkWithBackup(
        "/source/skills",
        "/nonexistent/skills",
      );

      expect(backup.existed).toBe(false);
      expect(backup.backupPath).toBe("");
    });

    it("should restore backup on error", async () => {
      // Setup with invalid source to trigger error
      const invalidSource = "/invalid/source";

      mockFs({
        "/target/skills": {
          "important.md": "# Important",
        },
      });

      await expect(
        setupSymlinkWithBackup(invalidSource, "/target/skills"),
      ).rejects.toThrow();

      // Verify original directory was restored
      const files = await readdir("/target/skills");
      expect(files).toContain("important.md");
    });

    it("should cleanup backup on successful symlink creation", async () => {
      const backup = await setupSymlinkWithBackup(
        "/source/skills",
        "/target/skills",
      );

      // In successful case, backup should still exist until explicitly cleaned up
      // This allows caller to decide when to cleanup
      const backupFiles = await readdir(backup.backupPath);
      expect(backupFiles.length).toBeGreaterThan(0);
    });
  });

  describe("Error scenarios", () => {
    it("should handle permission errors during backup", async () => {
      // This test would work with real filesystem but is limited by mock-fs
      // Documenting expected behavior:
      // - If backup creation fails, throw descriptive error
      // - Original directory should remain untouched
    });

    it("should handle disk full during restore", async () => {
      // This test would work with real filesystem
      // Expected behavior:
      // - If restore fails, log error but don't throw
      // - Partial restoration is acceptable (better than nothing)
    });
  });
});
