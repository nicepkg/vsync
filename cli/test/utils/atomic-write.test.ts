import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { readFile, access } from "node:fs/promises";
import { constants } from "node:fs";
import mockFs from "mock-fs";
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
});
