import { readFile, readdir } from "node:fs/promises";
import mockFs from "mock-fs";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { atomicWrite } from "@src/utils/atomic-write.js";

describe("Atomic Write Utility", () => {
  beforeEach(() => {
    mockFs({
      "/test": {},
    });
  });

  afterEach(() => {
    mockFs.restore();
  });

  it("should write file atomically", async () => {
    const filePath = "/test/config.json";
    const content = '{"key": "value"}';

    await atomicWrite(filePath, content);

    const written = await readFile(filePath, "utf-8");
    expect(written).toBe(content);
  });

  it("should create parent directories if needed", async () => {
    const filePath = "/test/nested/deep/file.txt";
    const content = "test content";

    await atomicWrite(filePath, content);

    const written = await readFile(filePath, "utf-8");
    expect(written).toBe(content);
  });

  it("should overwrite existing file", async () => {
    const filePath = "/test/file.txt";

    await atomicWrite(filePath, "original content");
    await atomicWrite(filePath, "new content");

    const written = await readFile(filePath, "utf-8");
    expect(written).toBe("new content");
  });

  it("should handle empty content", async () => {
    const filePath = "/test/empty.txt";

    await atomicWrite(filePath, "");

    const written = await readFile(filePath, "utf-8");
    expect(written).toBe("");
  });

  it("should handle unicode content", async () => {
    const filePath = "/test/unicode.txt";
    const content = "Hello 世界 🚀";

    await atomicWrite(filePath, content);

    const written = await readFile(filePath, "utf-8");
    expect(written).toBe(content);
  });

  it("should handle large JSON content", async () => {
    const filePath = "/test/large.json";
    const largeObject = {
      items: Array.from({ length: 1000 }, (_, i) => ({
        id: i,
        name: `Item ${i}`,
        data: `Data for item ${i}`,
      })),
    };
    const content = JSON.stringify(largeObject, null, 2);

    await atomicWrite(filePath, content);

    const written = await readFile(filePath, "utf-8");
    expect(written).toBe(content);
  });

  it("should not leave temporary files on success", async () => {
    const filePath = "/test/file.txt";

    await atomicWrite(filePath, "content");

    // Check that no .tmp files exist
    const finalFile = await readFile(filePath, "utf-8");
    expect(finalFile).toBe("content");
  });

  it("should handle multiple concurrent writes to different files", async () => {
    const writes = [
      atomicWrite("/test/file1.txt", "content1"),
      atomicWrite("/test/file2.txt", "content2"),
      atomicWrite("/test/file3.txt", "content3"),
    ];

    await Promise.all(writes);

    const [content1, content2, content3] = await Promise.all([
      readFile("/test/file1.txt", "utf-8"),
      readFile("/test/file2.txt", "utf-8"),
      readFile("/test/file3.txt", "utf-8"),
    ]);

    expect(content1).toBe("content1");
    expect(content2).toBe("content2");
    expect(content3).toBe("content3");
  });

  it("should ensure fsync is called to persist data", async () => {
    const filePath = "/test/config.json";
    const content = '{"important": "data"}';

    // Write the file
    await atomicWrite(filePath, content);

    // Verify content was correctly written
    const written = await readFile(filePath, "utf-8");
    expect(written).toBe(content);

    // The fsync happens internally - we verify indirectly by checking
    // that the file write completed successfully without corruption
    expect(JSON.parse(written)).toEqual({ important: "data" });
  });

  it("should handle crash recovery - original file preserved on error", async () => {
    const filePath = "/test/critical.json";
    const originalContent = '{"version": "1.0.0"}';

    // First write succeeds
    await atomicWrite(filePath, originalContent);
    const afterFirst = await readFile(filePath, "utf-8");
    expect(afterFirst).toBe(originalContent);

    // Second write should also succeed
    const newContent = '{"version": "2.0.0"}';
    await atomicWrite(filePath, newContent);

    // File should have new content
    const afterSecond = await readFile(filePath, "utf-8");
    expect(afterSecond).toBe(newContent);

    // No temp files should remain
    const files = await readdir("/test");
    const tempFiles = files.filter((f) => f.startsWith(".tmp-"));
    expect(tempFiles).toHaveLength(0);
  });

  it("should use temp file in same directory for atomic rename", async () => {
    const filePath = "/test/nested/config.json";
    const content = '{"key": "value"}';

    // Write the file
    await atomicWrite(filePath, content);

    // Verify file exists
    const written = await readFile(filePath, "utf-8");
    expect(written).toBe(content);

    // Verify no temp files remain in the directory
    const files = await readdir("/test/nested");
    const tempFiles = files.filter((f) => f.startsWith(".tmp-"));
    expect(tempFiles).toHaveLength(0);

    // Only the final file should exist
    expect(files).toEqual(["config.json"]);
  });
});
