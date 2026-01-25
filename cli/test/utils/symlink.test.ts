import { symlink as fsSymlink } from "node:fs/promises";
import mockFs from "mock-fs";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  createSymlink,
  isSymlink,
  resolveSymlink,
  removeSymlink,
} from "@src/utils/file-ops.js";

describe("Symlink Utils", () => {
  beforeEach(() => {
    mockFs({
      "/source": {
        "file.txt": "source content",
      },
      "/existing-symlink": mockFs.symlink({
        path: "/source",
      }),
      "/regular-dir": {
        "file.txt": "regular content",
      },
      "/empty": {},
    });
  });

  afterEach(() => {
    mockFs.restore();
  });

  describe("isSymlink", () => {
    it("should return true for symlinks", async () => {
      const result = await isSymlink("/existing-symlink");
      expect(result).toBe(true);
    });

    it("should return false for regular directories", async () => {
      const result = await isSymlink("/regular-dir");
      expect(result).toBe(false);
    });

    it("should return false for regular files", async () => {
      const result = await isSymlink("/source/file.txt");
      expect(result).toBe(false);
    });

    it("should return false for non-existent paths", async () => {
      const result = await isSymlink("/nonexistent");
      expect(result).toBe(false);
    });
  });

  describe("resolveSymlink", () => {
    it("should resolve symlink to real path", async () => {
      const result = await resolveSymlink("/existing-symlink");
      expect(result).toBe("/source");
    });

    it("should return original path for non-symlinks", async () => {
      const result = await resolveSymlink("/regular-dir");
      expect(result).toBe("/regular-dir");
    });

    it("should throw error for non-existent paths", async () => {
      await expect(resolveSymlink("/nonexistent")).rejects.toThrow();
    });
  });

  describe("createSymlink", () => {
    it("should create symlink from target to source", async () => {
      await createSymlink("/empty/new-link", "/source");

      const isLink = await isSymlink("/empty/new-link");
      expect(isLink).toBe(true);

      const resolved = await resolveSymlink("/empty/new-link");
      expect(resolved).toBe("/source");
    });

    it("should create symlink with absolute paths", async () => {
      await createSymlink("/empty/abs-link", "/source");

      const resolved = await resolveSymlink("/empty/abs-link");
      expect(resolved).toBe("/source");
    });

    it("should throw error if target already exists as regular directory", async () => {
      await expect(createSymlink("/regular-dir", "/source")).rejects.toThrow();
    });

    it("should throw error if target already exists as symlink", async () => {
      await expect(
        createSymlink("/existing-symlink", "/source"),
      ).rejects.toThrow();
    });

    it("should throw error if source does not exist", async () => {
      await expect(
        createSymlink("/empty/link", "/nonexistent"),
      ).rejects.toThrow();
    });

    it("should create parent directories if they don't exist", async () => {
      await createSymlink("/empty/nested/deep/link", "/source");

      const isLink = await isSymlink("/empty/nested/deep/link");
      expect(isLink).toBe(true);
    });
  });

  describe("removeSymlink", () => {
    it("should remove symlink without affecting source", async () => {
      await removeSymlink("/existing-symlink");

      const exists = await isSymlink("/existing-symlink");
      expect(exists).toBe(false);

      // Source should still exist
      const sourceExists = await isSymlink("/source");
      expect(sourceExists).toBe(false); // It's a directory, not a symlink
    });

    it("should throw error for regular directories", async () => {
      await expect(removeSymlink("/regular-dir")).rejects.toThrow(
        "Path is not a symlink",
      );
    });

    it("should throw error for non-existent paths", async () => {
      await expect(removeSymlink("/nonexistent")).rejects.toThrow();
    });

    it("should handle broken symlinks", async () => {
      // Create a symlink to non-existent source
      await fsSymlink("/nonexistent-source", "/empty/broken-link");

      // Should still be able to remove it
      await removeSymlink("/empty/broken-link");

      const exists = await isSymlink("/empty/broken-link");
      expect(exists).toBe(false);
    });
  });
});
