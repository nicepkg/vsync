/**
 * Tests for FileCache - Incremental sync optimization
 */

import { promises as fs } from "node:fs";
import mockFs from "mock-fs";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { FileCache, type CacheEntry } from "@src/core/file-cache.js";

describe("FileCache", () => {
  let cache: FileCache;

  beforeEach(() => {
    mockFs({
      "/test": {},
      "/cache": {},
    });
    cache = new FileCache("/cache/file-cache.json");
  });

  afterEach(() => {
    mockFs.restore();
  });

  describe("initialization", () => {
    it("should create empty cache if cache file doesn't exist", async () => {
      await cache.load();
      expect(cache.size()).toBe(0);
    });

    it("should load existing cache from file", async () => {
      const existingCache = {
        entries: {
          "/test/file.txt": {
            path: "/test/file.txt",
            hash: "abc123",
            mtime: 1000,
            size: 100,
          },
        },
      };

      mockFs({
        "/cache/file-cache.json": JSON.stringify(existingCache),
      });

      await cache.load();
      expect(cache.size()).toBe(1);
      expect(cache.get("/test/file.txt")?.hash).toBe("abc123");
    });

    it("should handle corrupted cache file gracefully", async () => {
      mockFs({
        "/cache/file-cache.json": "invalid json{",
      });

      await cache.load();
      expect(cache.size()).toBe(0);
    });
  });

  describe("cache operations", () => {
    beforeEach(async () => {
      await cache.load();
    });

    it("should store file metadata", async () => {
      const entry: CacheEntry = {
        path: "/test/file.txt",
        hash: "abc123",
        mtime: Date.now(),
        size: 100,
      };

      cache.set("/test/file.txt", entry);
      expect(cache.get("/test/file.txt")).toEqual(entry);
    });

    it("should update existing entry", async () => {
      const entry1: CacheEntry = {
        path: "/test/file.txt",
        hash: "abc123",
        mtime: 1000,
        size: 100,
      };

      const entry2: CacheEntry = {
        path: "/test/file.txt",
        hash: "def456",
        mtime: 2000,
        size: 200,
      };

      cache.set("/test/file.txt", entry1);
      cache.set("/test/file.txt", entry2);

      expect(cache.get("/test/file.txt")?.hash).toBe("def456");
      expect(cache.get("/test/file.txt")?.mtime).toBe(2000);
    });

    it("should delete entry", () => {
      cache.set("/test/file.txt", {
        path: "/test/file.txt",
        hash: "abc123",
        mtime: 1000,
        size: 100,
      });

      expect(cache.has("/test/file.txt")).toBe(true);
      cache.delete("/test/file.txt");
      expect(cache.has("/test/file.txt")).toBe(false);
    });

    it("should clear all entries", () => {
      cache.set("/test/file1.txt", {
        path: "/test/file1.txt",
        hash: "abc",
        mtime: 1000,
        size: 100,
      });
      cache.set("/test/file2.txt", {
        path: "/test/file2.txt",
        hash: "def",
        mtime: 1000,
        size: 100,
      });

      expect(cache.size()).toBe(2);
      cache.clear();
      expect(cache.size()).toBe(0);
    });
  });

  describe("cache persistence", () => {
    beforeEach(async () => {
      await cache.load();
    });

    it("should save cache to disk", async () => {
      cache.set("/test/file.txt", {
        path: "/test/file.txt",
        hash: "abc123",
        mtime: 1000,
        size: 100,
      });

      await cache.save();

      const savedData = await fs.readFile("/cache/file-cache.json", "utf-8");
      const parsed = JSON.parse(savedData);

      expect(parsed.entries["/test/file.txt"].hash).toBe("abc123");
    });

    it("should create cache directory if it doesn't exist", async () => {
      mockFs.restore();
      mockFs({
        "/test": {},
      });

      const newCache = new FileCache("/newcache/file-cache.json");
      await newCache.load();
      newCache.set("/test/file.txt", {
        path: "/test/file.txt",
        hash: "abc",
        mtime: 1000,
        size: 100,
      });

      await newCache.save();

      const exists = await fs
        .access("/newcache/file-cache.json")
        .then(() => true)
        .catch(() => false);
      expect(exists).toBe(true);
    });
  });

  describe("file change detection", () => {
    beforeEach(async () => {
      mockFs({
        "/test/unchanged.txt": "content",
        "/test/modified.txt": "old content",
        "/test/new.txt": "new content",
      });
      await cache.load();
    });

    it("should detect unchanged file", async () => {
      const stat = await fs.stat("/test/unchanged.txt");

      cache.set("/test/unchanged.txt", {
        path: "/test/unchanged.txt",
        hash: "hash123",
        mtime: stat.mtimeMs,
        size: stat.size,
      });

      const isChanged = await cache.isFileChanged("/test/unchanged.txt");
      expect(isChanged).toBe(false);
    });

    it("should detect modified file (mtime changed)", async () => {
      cache.set("/test/modified.txt", {
        path: "/test/modified.txt",
        hash: "hash123",
        mtime: 1000, // Old mtime
        size: 100,
      });

      const isChanged = await cache.isFileChanged("/test/modified.txt");
      expect(isChanged).toBe(true);
    });

    it("should detect modified file (size changed)", async () => {
      const stat = await fs.stat("/test/modified.txt");

      cache.set("/test/modified.txt", {
        path: "/test/modified.txt",
        hash: "hash123",
        mtime: stat.mtimeMs,
        size: 999, // Wrong size
      });

      const isChanged = await cache.isFileChanged("/test/modified.txt");
      expect(isChanged).toBe(true);
    });

    it("should detect new file (not in cache)", async () => {
      const isChanged = await cache.isFileChanged("/test/new.txt");
      expect(isChanged).toBe(true);
    });

    it("should detect deleted file", async () => {
      cache.set("/test/deleted.txt", {
        path: "/test/deleted.txt",
        hash: "hash123",
        mtime: 1000,
        size: 100,
      });

      const isChanged = await cache.isFileChanged("/test/deleted.txt");
      expect(isChanged).toBe(true); // File doesn't exist
    });
  });

  describe("batch operations", () => {
    beforeEach(async () => {
      await cache.load();
    });

    it("should get changed files from a list", async () => {
      mockFs({
        "/test/file1.txt": "content1",
        "/test/file2.txt": "content2",
        "/test/file3.txt": "content3",
      });

      const stat1 = await fs.stat("/test/file1.txt");
      const stat2 = await fs.stat("/test/file2.txt");

      // file1 and file2 in cache, file3 is new
      cache.set("/test/file1.txt", {
        path: "/test/file1.txt",
        hash: "hash1",
        mtime: stat1.mtimeMs,
        size: stat1.size,
      });

      cache.set("/test/file2.txt", {
        path: "/test/file2.txt",
        hash: "hash2",
        mtime: 1000, // Old mtime - changed
        size: stat2.size,
      });

      const files = ["/test/file1.txt", "/test/file2.txt", "/test/file3.txt"];
      const changed = await cache.getChangedFiles(files);

      expect(changed).toEqual([
        "/test/file2.txt", // Modified
        "/test/file3.txt", // New
      ]);
    });

    it("should return all files if cache is empty", async () => {
      mockFs({
        "/test/file1.txt": "content1",
        "/test/file2.txt": "content2",
      });

      const files = ["/test/file1.txt", "/test/file2.txt"];
      const changed = await cache.getChangedFiles(files);

      expect(changed).toEqual(files);
    });
  });

  describe("cache invalidation", () => {
    beforeEach(async () => {
      await cache.load();
    });

    it("should invalidate entries older than threshold", () => {
      const now = Date.now();
      const oldTime = now - 30 * 24 * 60 * 60 * 1000; // 30 days ago
      const recentTime = now - 1 * 24 * 60 * 60 * 1000; // 1 day ago

      cache.set("/test/old.txt", {
        path: "/test/old.txt",
        hash: "old",
        mtime: oldTime,
        size: 100,
      });

      cache.set("/test/recent.txt", {
        path: "/test/recent.txt",
        hash: "recent",
        mtime: recentTime,
        size: 100,
      });

      const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days
      cache.invalidateOld(maxAge);

      expect(cache.has("/test/old.txt")).toBe(false);
      expect(cache.has("/test/recent.txt")).toBe(true);
    });
  });
});
