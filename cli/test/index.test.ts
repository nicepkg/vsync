import { describe, it, expect } from "vitest";
import { mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { pathToFileURL } from "node:url";
import { isMainModule, main } from "@src/index.js";

describe("CLI Entry Point", () => {
  it("should export main function", () => {
    expect(main).toBeDefined();
    expect(typeof main).toBe("function");
  });

  it("should be async function", () => {
    expect(main.constructor.name).toBe("AsyncFunction");
  });

  it("detects main module with relative argv path", async () => {
    const dir = await mkdtemp(join(tmpdir(), "vsync-index-"));
    const filePath = join(dir, "index.js");
    await writeFile(filePath, "console.log('test');");

    try {
      const metaUrl = pathToFileURL(filePath).href;
      const argvPath = relative(process.cwd(), filePath);
      expect(isMainModule(argvPath, metaUrl)).toBe(true);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("detects main module when argv is a symlink", async () => {
    const dir = await mkdtemp(join(tmpdir(), "vsync-index-"));
    const filePath = join(dir, "index.js");
    const linkPath = join(dir, "index-link.js");
    await writeFile(filePath, "console.log('test');");
    await symlink(filePath, linkPath);

    try {
      const metaUrl = pathToFileURL(filePath).href;
      expect(isMainModule(linkPath, metaUrl)).toBe(true);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("returns false when argv is missing", () => {
    expect(isMainModule(undefined, "file:///tmp/index.js")).toBe(false);
  });
});
