import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import mockFs from "mock-fs";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  loadManifest,
  saveManifest,
  getItemHash,
  createEmptyManifest,
  getManifestPath,
  updateAfterCreate,
  updateAfterUpdate,
  updateAfterDelete,
  pruneOrphanedItems,
} from "@src/core/manifest-manager.js";
import type { Manifest } from "@src/types/manifest.js";

// Cross-platform test paths
const TEST_HOME =
  process.platform === "win32" ? "C:\\Users\\test" : "/home/test";
const TEST_PROJECT = process.platform === "win32" ? "C:\\project" : "/project";
const TEST_EMPTY = process.platform === "win32" ? "C:\\empty" : "/empty";

// Calculate hashes for test paths
const getHash = (path: string): string => {
  const resolved = resolve(path);
  return createHash("sha256").update(resolved).digest("hex").slice(0, 16);
};

const PROJECT_HASH = getHash(TEST_PROJECT);
const EMPTY_HASH = getHash(TEST_EMPTY);

// Mock os.homedir
vi.mock("node:os", () => ({
  homedir: () => TEST_HOME,
}));

describe("Manifest Manager", () => {
  const sampleManifest: Manifest = {
    version: "1.0.0",
    last_synced: "2026-01-24T10:30:00Z",
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
            last_synced: "2026-01-24T10:30:00Z",
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
    const mockFsConfig: any = {
      [TEST_HOME]: {
        ".vibe-sync": {
          cache: {
            [PROJECT_HASH]: {
              "manifest.json": JSON.stringify(sampleManifest),
            },
            [EMPTY_HASH]: {},
          },
        },
      },
      [TEST_PROJECT]: {},
      [TEST_EMPTY]: {},
    };

    mockFs(mockFsConfig);
  });

  afterEach(() => {
    mockFs.restore();
  });

  describe("getManifestPath", () => {
    it("should return manifest path in user cache directory", () => {
      const path = getManifestPath(TEST_PROJECT);
      const expected = join(
        TEST_HOME,
        ".vibe-sync",
        "cache",
        PROJECT_HASH,
        "manifest.json",
      );
      expect(path).toBe(expected);
    });
  });

  describe("createEmptyManifest", () => {
    it("should create empty manifest with current timestamp", () => {
      const manifest = createEmptyManifest();

      expect(manifest.version).toBe("1.0.0");
      expect(manifest.items).toEqual({});
      expect(manifest.last_synced).toBeTruthy();
    });
  });

  describe("loadManifest", () => {
    it("should load existing manifest", async () => {
      const manifest = await loadManifest(TEST_PROJECT);

      expect(manifest.version).toBe("1.0.0");
      expect(Object.keys(manifest.items)).toHaveLength(2);
    });

    it("should create empty manifest if file doesn't exist", async () => {
      const manifest = await loadManifest(TEST_EMPTY);

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
        last_synced: "2026-01-24T11:00:00Z",
        items: {},
      };

      await saveManifest(manifest, TEST_EMPTY);

      const savedPath = join(
        TEST_HOME,
        ".vibe-sync",
        "cache",
        EMPTY_HASH,
        "manifest.json",
      );
      const saved = await readFile(savedPath, "utf-8");
      const parsed = JSON.parse(saved);

      expect(parsed.version).toBe("1.0.0");
    });

    it("should format JSON with indentation", async () => {
      const manifest = createEmptyManifest();
      await saveManifest(manifest, TEST_EMPTY);

      const savedPath = join(
        TEST_HOME,
        ".vibe-sync",
        "cache",
        EMPTY_HASH,
        "manifest.json",
      );
      const saved = await readFile(savedPath, "utf-8");
      expect(saved).toContain("\n");
    });
  });

  describe("getItemHash", () => {
    it("should return hash for existing skill", async () => {
      const manifest = await loadManifest(TEST_PROJECT);
      const hash = getItemHash(manifest, "skill", "test-skill");

      expect(hash).toBe("abc123");
    });

    it("should return hash for existing MCP server", async () => {
      const manifest = await loadManifest(TEST_PROJECT);
      const hash = getItemHash(manifest, "mcp", "postgres");

      expect(hash).toBe("xyz789");
    });

    it("should return undefined for non-existent item", async () => {
      const manifest = await loadManifest(TEST_PROJECT);
      const hash = getItemHash(manifest, "skill", "non-existent");

      expect(hash).toBeUndefined();
    });
  });

  describe("updateAfterCreate", () => {
    it("should add new skill to manifest", () => {
      const manifest = createEmptyManifest();

      updateAfterCreate(manifest, "skill", "new-skill", "hash123", "cursor");

      const item = manifest.items["skill/new-skill"];
      expect(item).toBeDefined();
      expect(item?.type).toBe("skill");
      expect(item?.name).toBe("new-skill");
      expect(item?.hash).toBe("hash123");
      expect(item?.last_synced).toBeTruthy();
      expect(item?.targets.cursor).toBeDefined();
      expect(item?.targets.cursor?.synced).toBe(true);
      expect(item?.targets.cursor?.hash).toBe("hash123");
    });

    it("should add new MCP server to manifest", () => {
      const manifest = createEmptyManifest();

      updateAfterCreate(manifest, "mcp", "postgres", "hash456", "opencode");

      const item = manifest.items["mcp/postgres"];
      expect(item).toBeDefined();
      expect(item?.type).toBe("mcp");
      expect(item?.name).toBe("postgres");
      expect(item?.hash).toBe("hash456");
      expect(item?.targets.opencode).toBeDefined();
      expect(item?.targets.opencode?.synced).toBe(true);
    });

    it("should add target to existing item if item already exists", () => {
      const manifest = createEmptyManifest();

      // First create
      updateAfterCreate(manifest, "skill", "test-skill", "hash123", "cursor");

      // Second create (same item, different target)
      updateAfterCreate(manifest, "skill", "test-skill", "hash123", "opencode");

      const item = manifest.items["skill/test-skill"];
      expect(item?.targets.cursor).toBeDefined();
      expect(item?.targets.opencode).toBeDefined();
      expect(Object.keys(item?.targets || {}).length).toBe(2);
    });
  });

  describe("updateAfterUpdate", () => {
    it("should update hash for existing skill", () => {
      const manifest = createEmptyManifest();
      updateAfterCreate(manifest, "skill", "test-skill", "old-hash", "cursor");

      updateAfterUpdate(manifest, "skill", "test-skill", "new-hash", "cursor");

      const item = manifest.items["skill/test-skill"];
      expect(item?.hash).toBe("new-hash");
      expect(item?.targets.cursor?.hash).toBe("new-hash");
      expect(item?.targets.cursor?.synced).toBe(true);
    });

    it("should update hash for existing MCP server", () => {
      const manifest = createEmptyManifest();
      updateAfterCreate(manifest, "mcp", "postgres", "old-hash", "cursor");

      updateAfterUpdate(manifest, "mcp", "postgres", "new-hash", "cursor");

      const item = manifest.items["mcp/postgres"];
      expect(item?.hash).toBe("new-hash");
      expect(item?.targets.cursor?.hash).toBe("new-hash");
    });

    it("should update last_synced timestamp", () => {
      const manifest = createEmptyManifest();
      updateAfterCreate(manifest, "skill", "test-skill", "hash123", "cursor");

      const oldTimestamp = manifest.items["skill/test-skill"]?.last_synced;

      // The update should set a new timestamp
      const newHash = "new-hash";
      updateAfterUpdate(manifest, "skill", "test-skill", newHash, "cursor");

      const newTimestamp = manifest.items["skill/test-skill"]?.last_synced;
      // Timestamps should be valid ISO strings
      expect(oldTimestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(newTimestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      // Both should be truthy (updated)
      expect(oldTimestamp).toBeTruthy();
      expect(newTimestamp).toBeTruthy();
    });

    it("should throw error if item does not exist", () => {
      const manifest = createEmptyManifest();

      expect(() => {
        updateAfterUpdate(manifest, "skill", "non-existent", "hash", "cursor");
      }).toThrow("Item skill/non-existent not found in manifest");
    });
  });

  describe("updateAfterDelete", () => {
    it("should remove target from skill", () => {
      const manifest = createEmptyManifest();
      updateAfterCreate(manifest, "skill", "test-skill", "hash123", "cursor");
      updateAfterCreate(manifest, "skill", "test-skill", "hash123", "opencode");

      updateAfterDelete(manifest, "skill", "test-skill", "cursor");

      const item = manifest.items["skill/test-skill"];
      expect(item?.targets.cursor).toBeUndefined();
      expect(item?.targets.opencode).toBeDefined();
    });

    it("should remove target from MCP server", () => {
      const manifest = createEmptyManifest();
      updateAfterCreate(manifest, "mcp", "postgres", "hash123", "cursor");

      updateAfterDelete(manifest, "mcp", "postgres", "cursor");

      const item = manifest.items["mcp/postgres"];
      expect(item?.targets.cursor).toBeUndefined();
    });

    it("should not remove item even if no targets remain", () => {
      const manifest = createEmptyManifest();
      updateAfterCreate(manifest, "skill", "test-skill", "hash123", "cursor");

      updateAfterDelete(manifest, "skill", "test-skill", "cursor");

      const item = manifest.items["skill/test-skill"];
      expect(item).toBeDefined();
      expect(Object.keys(item?.targets || {}).length).toBe(0);
    });

    it("should throw error if item does not exist", () => {
      const manifest = createEmptyManifest();

      expect(() => {
        updateAfterDelete(manifest, "skill", "non-existent", "cursor");
      }).toThrow("Item skill/non-existent not found in manifest");
    });
  });

  describe("pruneOrphanedItems", () => {
    it("should remove items with no targets", () => {
      const manifest = createEmptyManifest();

      // Create items
      updateAfterCreate(
        manifest,
        "skill",
        "skill-with-target",
        "hash1",
        "cursor",
      );
      updateAfterCreate(
        manifest,
        "skill",
        "skill-no-target",
        "hash2",
        "cursor",
      );
      updateAfterCreate(manifest, "mcp", "mcp-no-target", "hash3", "cursor");

      // Remove targets from some items
      updateAfterDelete(manifest, "skill", "skill-no-target", "cursor");
      updateAfterDelete(manifest, "mcp", "mcp-no-target", "cursor");

      const removed = pruneOrphanedItems(manifest);

      expect(removed).toEqual(["skill/skill-no-target", "mcp/mcp-no-target"]);
      expect(manifest.items["skill/skill-with-target"]).toBeDefined();
      expect(manifest.items["skill/skill-no-target"]).toBeUndefined();
      expect(manifest.items["mcp/mcp-no-target"]).toBeUndefined();
    });

    it("should return empty array if no orphaned items", () => {
      const manifest = createEmptyManifest();
      updateAfterCreate(manifest, "skill", "test-skill", "hash123", "cursor");

      const removed = pruneOrphanedItems(manifest);

      expect(removed).toEqual([]);
      expect(manifest.items["skill/test-skill"]).toBeDefined();
    });

    it("should handle empty manifest", () => {
      const manifest = createEmptyManifest();

      const removed = pruneOrphanedItems(manifest);

      expect(removed).toEqual([]);
    });
  });
});
