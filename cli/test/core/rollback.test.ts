import { readFile, readdir } from "node:fs/promises";
import mockFs from "mock-fs";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  createBackup,
  restoreBackup,
  cleanupBackup,
} from "@src/core/rollback.js";
import type { BackupInfo } from "@src/core/rollback.js";

describe("Rollback Mechanism", () => {
  beforeEach(() => {
    mockFs({
      "/project": {
        ".cursor": {
          rules: {
            "skill1.md": "# Skill 1\nOriginal content",
            "skill2.md": "# Skill 2\nOriginal content",
          },
          "mcp.json": '{"postgres": {"command": "npx"}}',
        },
        ".opencode": {
          "claude-code": {
            skills: {
              "skill1.md": "# Skill 1\nOriginal content",
            },
          },
          "mcp.json": '{"sqlite": {"type": "stdio"}}',
        },
      },
      "/empty": {},
    });
  });

  afterEach(() => {
    mockFs.restore();
  });

  describe("createBackup", () => {
    it("should create backup of single file", async () => {
      const filePath = "/project/.cursor/rules/skill1.md";

      const backup = await createBackup(filePath);

      expect(backup.originalPath).toBe(filePath);
      expect(backup.backupPath).toContain(".vibe-sync-backup");
      expect(backup.timestamp).toBeTruthy();

      // Verify backup file exists and has correct content
      const backupContent = await readFile(backup.backupPath, "utf-8");
      expect(backupContent).toBe("# Skill 1\nOriginal content");
    });

    it("should create backup in same directory as original", async () => {
      const filePath = "/project/.cursor/mcp.json";

      const backup = await createBackup(filePath);

      expect(backup.backupPath).toContain("/project/.cursor");
      expect(backup.backupPath).toContain(".vibe-sync-backup");
    });

    it("should handle non-existent file gracefully", async () => {
      const filePath = "/project/.cursor/non-existent.md";

      const backup = await createBackup(filePath);

      expect(backup.originalPath).toBe(filePath);
      expect(backup.existed).toBe(false);
      expect(backup.backupPath).toBe("");
    });

    it("should create unique backup file names", async () => {
      const filePath = "/project/.cursor/rules/skill1.md";

      const backup1 = await createBackup(filePath);
      // Small delay to ensure different timestamps
      await new Promise((resolve) => setTimeout(resolve, 2));
      const backup2 = await createBackup(filePath);

      expect(backup1.backupPath).not.toBe(backup2.backupPath);
    });

    it("should preserve file content exactly", async () => {
      const filePath = "/project/.opencode/mcp.json";
      const originalContent = await readFile(filePath, "utf-8");

      const backup = await createBackup(filePath);

      const backupContent = await readFile(backup.backupPath, "utf-8");
      expect(backupContent).toBe(originalContent);
    });
  });

  describe("restoreBackup", () => {
    it("should restore file from backup", async () => {
      const filePath = "/project/.cursor/rules/skill1.md";

      // Create backup
      const backup = await createBackup(filePath);

      // Modify original file
      const fs = await import("node:fs/promises");
      await fs.writeFile(filePath, "# Skill 1\nModified content");

      // Restore
      await restoreBackup(backup);

      // Verify restored content
      const restored = await readFile(filePath, "utf-8");
      expect(restored).toBe("# Skill 1\nOriginal content");
    });

    it("should delete file if it didn't exist originally", async () => {
      const filePath = "/project/.cursor/new-file.md";

      // Create backup for non-existent file
      const backup: BackupInfo = {
        originalPath: filePath,
        backupPath: "",
        existed: false,
        timestamp: new Date().toISOString(),
      };

      // Create the new file
      const fs = await import("node:fs/promises");
      await fs.mkdir("/project/.cursor", { recursive: true });
      await fs.writeFile(filePath, "New content");

      // Verify file exists
      let exists = true;
      try {
        await fs.access(filePath);
      } catch {
        exists = false;
      }
      expect(exists).toBe(true);

      // Restore (should delete the file)
      await restoreBackup(backup);

      // Verify file no longer exists
      exists = true;
      try {
        await fs.access(filePath);
      } catch {
        exists = false;
      }
      expect(exists).toBe(false);
    });

    it("should handle already deleted files gracefully", async () => {
      const filePath = "/project/.cursor/deleted.md";

      const backup: BackupInfo = {
        originalPath: filePath,
        backupPath: "/project/.cursor/.vibe-sync-backup-deleted.md",
        existed: true,
        timestamp: new Date().toISOString(),
      };

      // File doesn't exist, but we try to restore - should not throw
      await expect(restoreBackup(backup)).resolves.not.toThrow();
    });

    it("should restore atomically using atomic write", async () => {
      const filePath = "/project/.cursor/mcp.json";

      const backup = await createBackup(filePath);

      // Modify original
      const fs = await import("node:fs/promises");
      await fs.writeFile(filePath, '{"modified": true}');

      // Restore
      await restoreBackup(backup);

      // Verify no temp files remain
      const files = await readdir("/project/.cursor");
      const tempFiles = files.filter((f) => f.startsWith(".tmp-"));
      expect(tempFiles).toHaveLength(0);
    });
  });

  describe("cleanupBackup", () => {
    it("should delete backup file after successful sync", async () => {
      const filePath = "/project/.cursor/rules/skill1.md";

      const backup = await createBackup(filePath);

      // Verify backup exists
      let backupExists = true;
      try {
        await readFile(backup.backupPath, "utf-8");
      } catch {
        backupExists = false;
      }
      expect(backupExists).toBe(true);

      // Cleanup
      await cleanupBackup(backup);

      // Verify backup no longer exists
      backupExists = true;
      try {
        await readFile(backup.backupPath, "utf-8");
      } catch {
        backupExists = false;
      }
      expect(backupExists).toBe(false);
    });

    it("should handle non-existent backup gracefully", async () => {
      const backup: BackupInfo = {
        originalPath: "/project/file.txt",
        backupPath: "/project/.vibe-sync-backup-nonexistent",
        existed: false,
        timestamp: new Date().toISOString(),
      };

      // Should not throw
      await expect(cleanupBackup(backup)).resolves.not.toThrow();
    });

    it("should handle empty backup path gracefully", async () => {
      const backup: BackupInfo = {
        originalPath: "/project/file.txt",
        backupPath: "",
        existed: false,
        timestamp: new Date().toISOString(),
      };

      // Should not throw
      await expect(cleanupBackup(backup)).resolves.not.toThrow();
    });

    it("should clean up multiple backups", async () => {
      const file1 = "/project/.cursor/rules/skill1.md";
      const file2 = "/project/.cursor/rules/skill2.md";

      const backup1 = await createBackup(file1);
      const backup2 = await createBackup(file2);

      // Cleanup both
      await cleanupBackup(backup1);
      await cleanupBackup(backup2);

      // Verify neither backup exists
      let backup1Exists = true;
      let backup2Exists = true;

      try {
        await readFile(backup1.backupPath, "utf-8");
      } catch {
        backup1Exists = false;
      }

      try {
        await readFile(backup2.backupPath, "utf-8");
      } catch {
        backup2Exists = false;
      }

      expect(backup1Exists).toBe(false);
      expect(backup2Exists).toBe(false);
    });
  });

  describe("integration - full rollback workflow", () => {
    it("should backup, modify, and restore on error", async () => {
      const filePath = "/project/.cursor/rules/skill1.md";
      const originalContent = await readFile(filePath, "utf-8");

      // 1. Create backup
      const backup = await createBackup(filePath);

      // 2. Modify file (simulating sync)
      const fs = await import("node:fs/promises");
      await fs.writeFile(filePath, "# Skill 1\nNew synced content");

      // 3. Simulate error - restore from backup
      await restoreBackup(backup);

      // 4. Verify original content restored
      const restored = await readFile(filePath, "utf-8");
      expect(restored).toBe(originalContent);

      // 5. Cleanup backup
      await cleanupBackup(backup);
    });

    it("should backup, modify, and cleanup on success", async () => {
      const filePath = "/project/.cursor/rules/skill1.md";

      // 1. Create backup
      const backup = await createBackup(filePath);

      // 2. Modify file successfully
      const fs = await import("node:fs/promises");
      await fs.writeFile(filePath, "# Skill 1\nNew synced content");

      // 3. Success - cleanup backup
      await cleanupBackup(backup);

      // 4. Verify backup removed but new content remains
      const content = await readFile(filePath, "utf-8");
      expect(content).toBe("# Skill 1\nNew synced content");

      let backupExists = true;
      try {
        await readFile(backup.backupPath, "utf-8");
      } catch {
        backupExists = false;
      }
      expect(backupExists).toBe(false);
    });

    it("should handle multiple file backups in batch", async () => {
      const files = [
        "/project/.cursor/rules/skill1.md",
        "/project/.cursor/rules/skill2.md",
        "/project/.cursor/mcp.json",
      ];

      // Create backups
      const backups = await Promise.all(files.map((f) => createBackup(f)));

      // Modify all files
      const fs = await import("node:fs/promises");
      await Promise.all(files.map((f) => fs.writeFile(f, "Modified content")));

      // Rollback all
      await Promise.all(backups.map((b) => restoreBackup(b)));

      // Verify all restored
      const skill1 = await readFile(files[0]!, "utf-8");
      const skill2 = await readFile(files[1]!, "utf-8");
      const mcp = await readFile(files[2]!, "utf-8");

      expect(skill1).toBe("# Skill 1\nOriginal content");
      expect(skill2).toBe("# Skill 2\nOriginal content");
      expect(mcp).toBe('{"postgres": {"command": "npx"}}');

      // Cleanup
      await Promise.all(backups.map((b) => cleanupBackup(b)));
    });
  });
});
