import { describe, it, expect } from "vitest";
import type {
  Manifest,
  ManifestItem,
  ItemType,
} from "../../src/types/manifest.js";

describe("Manifest Types", () => {
  describe("ItemType", () => {
    it("should accept valid item types", () => {
      const types: ItemType[] = ["skill", "mcp"];
      expect(types).toHaveLength(2);
    });
  });

  describe("ManifestItem", () => {
    it("should create a manifest item for a skill", () => {
      const item: ManifestItem = {
        type: "skill",
        name: "git-release",
        hash: "abc123",
        last_synced: "2026-01-24T10:30:00Z",
        targets: {
          cursor: {
            synced: true,
            hash: "abc123",
            last_sync: "2026-01-24T10:30:00Z",
          },
          opencode: {
            synced: true,
            hash: "abc123",
            last_sync: "2026-01-24T10:30:00Z",
          },
        },
      };

      expect(item.type).toBe("skill");
      expect(item.name).toBe("git-release");
      expect(item.targets.cursor?.synced).toBe(true);
      expect(item.targets.opencode?.synced).toBe(true);
    });

    it("should create a manifest item for an MCP server", () => {
      const item: ManifestItem = {
        type: "mcp",
        name: "postgres",
        hash: "xyz789",
        last_synced: "2026-01-24T11:00:00Z",
        targets: {
          cursor: {
            synced: true,
            hash: "xyz789",
            last_sync: "2026-01-24T11:00:00Z",
          },
        },
      };

      expect(item.type).toBe("mcp");
      expect(item.targets.cursor).toBeDefined();
    });

    it("should allow items with no targets synced yet", () => {
      const item: ManifestItem = {
        type: "skill",
        name: "new-skill",
        hash: "new123",
        last_synced: "2026-01-24T12:00:00Z",
        targets: {},
      };

      expect(Object.keys(item.targets)).toHaveLength(0);
    });

    it("should track failed syncs", () => {
      const item: ManifestItem = {
        type: "mcp",
        name: "failed-server",
        hash: "fail123",
        last_synced: "2026-01-24T13:00:00Z",
        targets: {
          opencode: {
            synced: false,
            hash: "old456",
            last_sync: "2026-01-24T12:00:00Z",
            error: "Connection timeout",
          },
        },
      };

      expect(item.targets.opencode?.synced).toBe(false);
      expect(item.targets.opencode?.error).toBe("Connection timeout");
    });
  });

  describe("Manifest", () => {
    it("should create a valid manifest", () => {
      const manifest: Manifest = {
        version: "1.0.0",
        last_sync: "2026-01-24T10:30:00Z",
        items: {
          "skill/git-release": {
            type: "skill",
            name: "git-release",
            hash: "abc123",
            last_synced: "2026-01-24T10:30:00Z",
            targets: {},
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

      expect(manifest.version).toBe("1.0.0");
      expect(Object.keys(manifest.items)).toHaveLength(2);
      expect(manifest.items["skill/git-release"]?.type).toBe("skill");
      expect(manifest.items["mcp/postgres"]?.type).toBe("mcp");
    });

    it("should create an empty manifest", () => {
      const manifest: Manifest = {
        version: "1.0.0",
        last_sync: "2026-01-24T10:00:00Z",
        items: {},
      };

      expect(Object.keys(manifest.items)).toHaveLength(0);
    });
  });
});
