/**
 * Tests for IncrementalReader
 */

import mockFs from "mock-fs";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { FileCache } from "@src/core/file-cache.js";
import { IncrementalReader } from "@src/core/incremental-reader.js";

describe("IncrementalReader", () => {
  let fileCache: FileCache;
  let reader: IncrementalReader;

  beforeEach(async () => {
    mockFs({
      "/cache": {},
      "/test/file1.txt": "content1",
      "/test/file2.txt": "content2",
      "/test/file3.json": '{"key": "value"}',
    });

    fileCache = new FileCache("/cache/file-cache.json");
    await fileCache.load();
    reader = new IncrementalReader(fileCache);
  });

  afterEach(() => {
    mockFs.restore();
  });

  describe("readFile", () => {
    it("should read and parse file on first read", async () => {
      const parser = vi.fn(async (content: string) => content.toUpperCase());

      const result = await reader.readFile("/test/file1.txt", parser);

      expect(result.data).toBe("CONTENT1");
      expect(result.hash).toBeTruthy();
      expect(result.fromCache).toBe(false);
      expect(parser).toHaveBeenCalledTimes(1);
    });

    it("should return cached data for unchanged file", async () => {
      const parser = vi.fn(async (content: string) => content.toUpperCase());

      // First read
      const result1 = await reader.readFile("/test/file1.txt", parser);
      expect(result1.fromCache).toBe(false);

      // Second read - should use cache
      const result2 = await reader.readFile("/test/file1.txt", parser);
      expect(result2.fromCache).toBe(true);
      expect(result2.data).toBe("CONTENT1");
      expect(parser).toHaveBeenCalledTimes(1); // Parser not called second time
    });

    it("should re-read file when content changes", async () => {
      const parser = vi.fn(async (content: string) => content.toUpperCase());

      // First read
      await reader.readFile("/test/file1.txt", parser);

      // Modify file
      mockFs.restore();
      mockFs({
        "/cache": {},
        "/test/file1.txt": "modified content",
      });

      // Need to re-load cache after mockFs restore
      await fileCache.load();

      // Second read - should detect change and re-read
      const result = await reader.readFile("/test/file1.txt", parser);
      expect(result.data).toBe("MODIFIED CONTENT");
      expect(result.fromCache).toBe(false);
      expect(parser).toHaveBeenCalledTimes(2);
    });

    it("should work with JSON parser", async () => {
      const parser = async (content: string) => JSON.parse(content);

      const result = await reader.readFile("/test/file3.json", parser);

      expect(result.data).toEqual({ key: "value" });
      expect(result.fromCache).toBe(false);
    });

    it("should update file cache with metadata", async () => {
      const parser = async (content: string) => content;

      await reader.readFile("/test/file1.txt", parser);

      const cached = fileCache.get("/test/file1.txt");
      expect(cached).toBeDefined();
      if (!cached) throw new Error("Cache should be defined");
      expect(cached.hash).toBeTruthy();
      expect(cached.mtime).toBeGreaterThan(0);
      expect(cached.size).toBeGreaterThan(0);
    });

    it("should handle parser errors", async () => {
      const parser = async () => {
        throw new Error("Parse error");
      };

      await expect(reader.readFile("/test/file1.txt", parser)).rejects.toThrow(
        "Parse error",
      );
    });
  });

  describe("readFiles", () => {
    it("should read multiple files", async () => {
      const parser = vi.fn(async (content: string) => content.length);

      const results = await reader.readFiles(
        ["/test/file1.txt", "/test/file2.txt"],
        parser,
      );

      expect(results).toHaveLength(2);
      expect(results[0]?.data).toBe(8); // "content1".length
      expect(results[1]?.data).toBe(8); // "content2".length
      expect(parser).toHaveBeenCalledTimes(2);
    });

    it("should use cache for unchanged files", async () => {
      const parser = vi.fn(async (content: string) => content.length);

      // First read
      await reader.readFiles(["/test/file1.txt", "/test/file2.txt"], parser);

      // Second read - should use cache
      const results = await reader.readFiles(
        ["/test/file1.txt", "/test/file2.txt"],
        parser,
      );

      expect(results[0]?.fromCache).toBe(true);
      expect(results[1]?.fromCache).toBe(true);
      expect(parser).toHaveBeenCalledTimes(2); // Only called on first read
    });

    it("should skip files that fail to read", async () => {
      const parser = async (content: string) => content;

      const results = await reader.readFiles(
        ["/test/file1.txt", "/test/nonexistent.txt", "/test/file2.txt"],
        parser,
      );

      // Should skip nonexistent file
      expect(results).toHaveLength(2);
      expect(results[0]?.data).toBe("content1");
      expect(results[1]?.data).toBe("content2");
    });

    it("should handle empty file list", async () => {
      const parser = async (content: string) => content;

      const results = await reader.readFiles([], parser);

      expect(results).toHaveLength(0);
    });
  });

  describe("getFilesToRead", () => {
    it("should return all files when cache is empty", async () => {
      const files = ["/test/file1.txt", "/test/file2.txt"];
      const toRead = await reader.getFilesToRead(files);

      expect(toRead).toEqual(files);
    });

    it("should return only changed files", async () => {
      const parser = async (content: string) => content;

      // Read file1 - will be cached
      await reader.readFile("/test/file1.txt", parser);

      // Check which files need to be read
      const toRead = await reader.getFilesToRead([
        "/test/file1.txt",
        "/test/file2.txt",
      ]);

      expect(toRead).toEqual(["/test/file2.txt"]); // Only file2 needs reading
    });
  });

  describe("clearDataCache", () => {
    it("should clear in-memory data cache", async () => {
      const parser = async (content: string) => content;

      await reader.readFile("/test/file1.txt", parser);

      expect(reader.getStats().datasCached).toBe(1);

      reader.clearDataCache();

      expect(reader.getStats().datasCached).toBe(0);
    });

    it("should force re-parsing on next read", async () => {
      const parser = vi.fn(async (content: string) => content);

      // First read
      await reader.readFile("/test/file1.txt", parser);

      // Clear cache
      reader.clearDataCache();

      // Second read - should re-parse
      const result = await reader.readFile("/test/file1.txt", parser);

      expect(result.fromCache).toBe(false); // Re-read from disk
      expect(parser).toHaveBeenCalledTimes(2); // Parser called again
    });
  });

  describe("getStats", () => {
    it("should return cache statistics", async () => {
      const parser = async (content: string) => content;

      expect(reader.getStats()).toEqual({
        filesCached: 0,
        datasCached: 0,
      });

      await reader.readFile("/test/file1.txt", parser);
      await reader.readFile("/test/file2.txt", parser);

      expect(reader.getStats()).toEqual({
        filesCached: 2,
        datasCached: 2,
      });
    });
  });

  describe("integration with FileCache", () => {
    it("should persist file cache across reader instances", async () => {
      const parser = async (content: string) => content;

      // Read with first reader
      const result = await reader.readFile("/test/file1.txt", parser);
      expect(result).toBeDefined();
      if (!result) throw new Error("Result should be defined");
      expect(result.data).toBe("content1");

      await fileCache.save();

      // Create new reader with same cache
      const newFileCache = new FileCache("/cache/file-cache.json");
      await newFileCache.load();
      const newReader = new IncrementalReader(newFileCache);

      // File should be detected as unchanged
      const toRead = await newReader.getFilesToRead(["/test/file1.txt"]);
      expect(toRead).toEqual([]); // File hasn't changed
    });
  });
});
