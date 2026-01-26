import { describe, it, expect, vi } from "vitest";
import { formatStatus } from "@src/commands/status.js";
import type { VibeConfig } from "@src/types/config.js";
import type { Manifest } from "@src/types/manifest.js";

// Cross-platform test home
const TEST_HOME =
  process.platform === "win32" ? "C:\\Users\\test" : "/home/test";

// Mock os.homedir
vi.mock("node:os", () => ({
  homedir: () => TEST_HOME,
}));

describe("Status Command", () => {
  const sampleConfig: VibeConfig = {
    version: "1.0.0",
    level: "project",
    source_tool: "claude-code",
    target_tools: ["cursor", "opencode"],
    sync_config: {
      skills: true,
      mcp: true,
    },
  };

  const sampleManifest: Manifest = {
    version: "1.0.0",
    last_synced: "2026-01-24T10:30:00.000Z",
    items: {
      "skill/test-skill": {
        type: "skill",
        name: "test-skill",
        hash: "hash123",
        last_synced: "2026-01-24T10:30:00.000Z",
        targets: {
          cursor: {
            synced: true,
            hash: "hash123",
            last_synced: "2026-01-24T10:30:00.000Z",
          },
          opencode: {
            synced: true,
            hash: "hash123",
            last_synced: "2026-01-24T10:30:00.000Z",
          },
        },
      },
      "mcp/postgres": {
        type: "mcp",
        name: "postgres",
        hash: "hash456",
        last_synced: "2026-01-24T10:30:00.000Z",
        targets: {
          cursor: {
            synced: true,
            hash: "hash456",
            last_synced: "2026-01-24T10:30:00.000Z",
          },
        },
      },
    },
  };

  describe("formatStatus", () => {
    it("should format status with source and target tools", () => {
      const output = formatStatus({
        config: sampleConfig,
        manifest: sampleManifest,
        skillCount: 1,
        mcpCount: 1,
        pendingChanges: false,
      });

      expect(output).toContain("Configuration Status");
      expect(output).toContain("Source Tool:");
      expect(output).toContain("claude-code");
      expect(output).toContain("Target Tools:");
      expect(output).toContain("cursor");
      expect(output).toContain("opencode");
    });

    it("should display last sync time", () => {
      const output = formatStatus({
        config: sampleConfig,
        manifest: sampleManifest,
        skillCount: 1,
        mcpCount: 1,
        pendingChanges: false,
      });

      expect(output).toContain("Last Sync:");
      expect(output).toContain("2026-01-24");
    });

    it("should show synced item counts", () => {
      const output = formatStatus({
        config: sampleConfig,
        manifest: sampleManifest,
        skillCount: 1,
        mcpCount: 1,
        pendingChanges: false,
      });

      expect(output).toContain("Synced Items:");
      expect(output).toContain("Skills:");
      expect(output).toContain("1 items");
      expect(output).toContain("MCP Servers:");
      expect(output).toContain("1 items");
    });

    it("should show tool status for all configured tools", () => {
      const output = formatStatus({
        config: sampleConfig,
        manifest: sampleManifest,
        skillCount: 1,
        mcpCount: 1,
        pendingChanges: false,
      });

      expect(output).toContain("Tool Status:");
      expect(output).toContain("claude-code");
      expect(output).toContain("(source)");
      expect(output).toContain("cursor");
      expect(output).toContain("opencode");
    });

    it("should show health status when up-to-date", () => {
      const output = formatStatus({
        config: sampleConfig,
        manifest: sampleManifest,
        skillCount: 1,
        mcpCount: 1,
        pendingChanges: false,
      });

      expect(output).toContain("Health:");
      expect(output).toContain("All targets up-to-date");
      expect(output).toContain("No pending changes");
    });

    it("should warn about pending changes", () => {
      const output = formatStatus({
        config: sampleConfig,
        manifest: sampleManifest,
        skillCount: 1,
        mcpCount: 1,
        pendingChanges: true,
      });

      expect(output).toContain("Pending changes detected");
      expect(output).toContain("vsync plan");
    });

    it("should handle never-synced state", () => {
      const neverSyncedManifest: Manifest = {
        version: "1.0.0",
        last_synced: "",
        items: {},
      };

      const output = formatStatus({
        config: sampleConfig,
        manifest: neverSyncedManifest,
        skillCount: 0,
        mcpCount: 0,
        pendingChanges: false,
      });

      expect(output).toContain("Never synced");
    });

    it("should show config file paths", () => {
      const output = formatStatus({
        config: sampleConfig,
        manifest: sampleManifest,
        skillCount: 1,
        mcpCount: 1,
        pendingChanges: false,
      });

      expect(output).toContain("Configuration:");
      expect(output).toContain(".vsync.json");
      expect(output).toContain("Manifest:");
      expect(output).toContain(".vsync");
      expect(output).toContain("cache");
      expect(output).toContain("manifest.json");
    });

    it("should indicate project vs user level", () => {
      const projectOutput = formatStatus({
        config: sampleConfig,
        manifest: sampleManifest,
        skillCount: 1,
        mcpCount: 1,
        pendingChanges: false,
      });

      expect(projectOutput).toContain("(Project)");

      const userConfig: VibeConfig = {
        ...sampleConfig,
        level: "user",
      };
      const userOutput = formatStatus({
        config: userConfig,
        manifest: sampleManifest,
        skillCount: 1,
        mcpCount: 1,
        pendingChanges: false,
      });

      expect(userOutput).toContain("(User)");
      expect(userOutput).toContain("~/.vsync.json");
    });

    it("should display multiple target tools correctly", () => {
      const multiTargetConfig: VibeConfig = {
        ...sampleConfig,
        target_tools: ["cursor", "opencode"],
      };

      const output = formatStatus({
        config: multiTargetConfig,
        manifest: sampleManifest,
        skillCount: 2,
        mcpCount: 3,
        pendingChanges: false,
      });

      expect(output).toContain("cursor, opencode");
      expect(output).toContain("Skills:          2 items");
      expect(output).toContain("MCP Servers:     3 items");
    });

    it("should format relative time correctly", () => {
      // Test with a recent timestamp (a few hours ago)
      const recentDate = new Date();
      recentDate.setHours(recentDate.getHours() - 2);

      const recentManifest: Manifest = {
        version: "1.0.0",
        last_synced: recentDate.toISOString(),
        items: {},
      };

      const output = formatStatus({
        config: sampleConfig,
        manifest: recentManifest,
        skillCount: 0,
        mcpCount: 0,
        pendingChanges: false,
      });

      expect(output).toMatch(/2 hour.*ago/);
    });
  });
});
