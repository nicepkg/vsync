import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { readFile } from "node:fs/promises";
import mockFs from "mock-fs";
import {
  loadManifest,
  saveManifest,
  getItemHash,
  createEmptyManifest,
  getManifestPath,
} from "../../src/core/manifest-manager.js";
import type { Manifest, ManifestItem } from "../../src/types/manifest.js";

describe("Manifest Manager", () => {
  const sampleManifest: Manifest = {
    version: "1.0.0",
    last_sync: "2026-01-24T10:30:00Z",
    items: {
      "skill/test-skill": {
        type: "skill",
        name: "test-skill",
        hash: "abc123",
        last_synced: "2026-01-24T10:30:00Z",
        targets: {
          cursor: {
            synced: true,
            hash: "abc123",
            last_sync: "2026-01-24T10:30:00Z",
          },
        },
      },
      "mcp/postgres": {
        type: "mcp",
        name: "postgres",
        hash: "xyz789",
        last_synced: "2026-01-24T10:30:00Z",
        targets: {},
      },
    },
  };

  beforeEach(() => {
    mockFs({
      "/project": {
        ".vibe-sync-cache": {
          "manifest.json": JSON.stringify(sampleManifest),
        },
      },
      "/empty": {},
    });
  });

  afterEach(() => {
    mockFs.restore();
  });

  describe("getManifestPath", () => {
    it("should return manifest path in cache directory", () => {
      const path = getManifestPath("/project");
      expect(path).toBe("/project/.vibe-sync-cache/manifest.json");
    });
  });

  describe("createEmptyManifest", () => {
    it("should create empty manifest with current timestamp", () => {
      const manifest = createEmptyManifest();

      expect(manifest.version).toBe("1.0.0");
      expect(manifest.items).toEqual({});
      expect(manifest.last_sync).toBeTruthy();
    });
  });

  describe("loadManifest", () => {
    it("should load existing manifest", async () => {
      const manifest = await loadManifest("/project");

      expect(manifest.version).toBe("1.0.0");
      expect(Object.keys(manifest.items)).toHaveLength(2);
    });

    it("should create empty manifest if file doesn't exist", async () => {
      const manifest = await loadManifest("/empty");

      expect(manifest.version).toBe("1.0.0");
      expect(manifest.items).toEqual({});
    });

    it("should handle corrupted manifest gracefully", async () => {
      mockFs({
        "/bad": {
          ".vibe-sync-cache": {
            "manifest.json": "{ invalid json",
          },
        },
      });

      const manifest = await loadManifest("/bad");
      expect(manifest.items).toEqual({});
    });
  });

  describe("saveManifest", () => {
    it("should save manifest atomically", async () => {
      const manifest: Manifest = {
        version: "1.0.0",
        last_sync: "2026-01-24T11:00:00Z",
        items: {},
      };

      await saveManifest(manifest, "/empty");

      const saved = await readFile(
        "/empty/.vibe-sync-cache/manifest.json",
        "utf-8"
      );
      const parsed = JSON.parse(saved);

      expect(parsed.version).toBe("1.0.0");
    });

    it("should format JSON with indentation", async () => {
      const manifest = createEmptyManifest();
      await saveManifest(manifest, "/empty");

      const saved = await readFile(
        "/empty/.vibe-sync-cache/manifest.json",
        "utf-8"
      );
      expect(saved).toContain("\n");
    });
  });

  describe("getItemHash", () => {
    it("should return hash for existing skill", async () => {
      const manifest = await loadManifest("/project");
      const hash = getItemHash(manifest, "skill", "test-skill");

      expect(hash).toBe("abc123");
    });

    it("should return hash for existing MCP server", async () => {
      const manifest = await loadManifest("/project");
      const hash = getItemHash(manifest, "mcp", "postgres");

      expect(hash).toBe("xyz789");
    });

    it("should return undefined for non-existent item", async () => {
      const manifest = await loadManifest("/project");
      const hash = getItemHash(manifest, "skill", "non-existent");

      expect(hash).toBeUndefined();
    });
  });
});
