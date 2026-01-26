import { readFile } from "node:fs/promises";
import path from "node:path";
import mockFs from "mock-fs";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
// Import for module side-effects (needed for dynamic imports in tests)
import "@src/commands/init.js";
import type { VibeConfig, ToolName } from "@src/types/config.js";

const testRoot = path.join(path.parse(process.cwd()).root, "vsync-test");
const homeDir = path.join(testRoot, "home", "user");

describe("Init Command", () => {
  beforeEach(() => {
    // Mock filesystem
    mockFs({
      "/project": {
        ".claude": {
          skills: {},
        },
        ".cursor": {},
      },
      "/empty": {},
      [homeDir]: {},
    });
  });

  afterEach(() => {
    mockFs.restore();
    vi.restoreAllMocks();
  });

  describe("Tool Detection", () => {
    it("should detect existing Claude Code directory", async () => {
      const detected = await import("@src/commands/init.js").then((m) =>
        m.detectTools("/project"),
      );

      expect(detected).toContain("claude-code");
    });

    it("should detect existing Cursor directory", async () => {
      const detected = await import("@src/commands/init.js").then((m) =>
        m.detectTools("/project"),
      );

      expect(detected).toContain("cursor");
    });

    it("should detect OpenCode directory", async () => {
      mockFs({
        "/project": {
          ".opencode": {},
        },
      });

      const detected = await import("@src/commands/init.js").then((m) =>
        m.detectTools("/project"),
      );

      expect(detected).toContain("opencode");
    });

    it("should return empty array if no tools detected", async () => {
      const detected = await import("@src/commands/init.js").then((m) =>
        m.detectTools("/empty"),
      );

      expect(detected).toEqual([]);
    });
  });

  describe("Config Generation", () => {
    it("should generate valid config with selected options", async () => {
      const options = {
        tools: ["claude-code", "cursor"] as ToolName[],
        source: "claude-code" as ToolName,
        syncItems: ["skills", "mcp"],
        isUserLevel: false,
      };

      const config = await import("@src/commands/init.js").then((m) =>
        m.generateConfig(options),
      );

      expect(config.source_tool).toBe("claude-code");
      expect(config.target_tools).toEqual(["cursor"]);
      expect(config.sync_config!.skills).toBe(true);
      expect(config.sync_config!.mcp).toBe(true);
      expect(config.level).toBe("project");
    });

    it("should exclude source tool from targets", async () => {
      const options = {
        tools: ["claude-code", "cursor", "opencode"] as ToolName[],
        source: "cursor" as ToolName,
        syncItems: ["skills"],
        isUserLevel: false,
      };

      const config = await import("@src/commands/init.js").then((m) =>
        m.generateConfig(options),
      );

      expect(config.source_tool).toBe("cursor");
      expect(config.target_tools).toEqual(["claude-code", "opencode"]);
      expect(config.target_tools).not.toContain("cursor");
    });

    it("should set correct sync flags", async () => {
      const options = {
        tools: ["claude-code", "cursor"] as ToolName[],
        source: "claude-code" as ToolName,
        syncItems: ["skills"],
        isUserLevel: false,
      };

      const config = await import("@src/commands/init.js").then((m) =>
        m.generateConfig(options),
      );

      expect(config.sync_config!.skills).toBe(true);
      expect(config.sync_config!.mcp).toBe(false);
    });
  });

  describe("File Creation", () => {
    it("should create .vsync.json with correct content", async () => {
      const config: VibeConfig = {
        version: "1.0.0",
        level: "project",
        source_tool: "claude-code",
        target_tools: ["cursor"],
        sync_config: {
          skills: true,
          mcp: true,
        },
      };

      await import("@src/commands/init.js").then((m) =>
        m.saveConfig(config, "/project"),
      );

      const content = await readFile("/project/.vsync.json", "utf-8");
      const parsed = JSON.parse(content);

      expect(parsed.source_tool).toBe("claude-code");
      expect(parsed.target_tools).toEqual(["cursor"]);
    });

    it("should format JSON with indentation", async () => {
      const config: VibeConfig = {
        version: "1.0.0",
        level: "project",
        source_tool: "claude-code",
        target_tools: ["cursor"],
        sync_config: {
          skills: true,
          mcp: false,
        },
      };

      await import("@src/commands/init.js").then((m) =>
        m.saveConfig(config, "/project"),
      );

      const content = await readFile("/project/.vsync.json", "utf-8");
      expect(content).toContain("\n");
      expect(content).toContain("  ");
    });
  });

  describe("User-level Config", () => {
    it("should save to user config directory when --user flag", async () => {
      const config: VibeConfig = {
        version: "1.0.0",
        level: "user",
        source_tool: "claude-code",
        target_tools: ["cursor"],
        sync_config: {
          skills: true,
          mcp: true,
        },
      };

      await import("@src/commands/init.js").then((m) =>
        m.saveConfig(config, homeDir),
      );

      const content = await readFile(
        path.join(homeDir, ".vsync.json"),
        "utf-8",
      );
      const parsed = JSON.parse(content);

      expect(parsed.source_tool).toBe("claude-code");
    });
  });

  describe("Error Handling", () => {
    it("should throw error if no tools selected", async () => {
      const options = {
        tools: [] as ToolName[],
        source: "claude-code" as ToolName,
        syncItems: ["skills"],
        isUserLevel: false,
      };

      await expect(
        import("@src/commands/init.js").then((m) => m.generateConfig(options)),
      ).rejects.toThrow("At least one tool must be selected");
    });

    it("should throw error if source not in tools", async () => {
      const options = {
        tools: ["cursor"] as ToolName[],
        source: "claude-code" as ToolName,
        syncItems: ["skills"],
        isUserLevel: false,
      };

      await expect(
        import("@src/commands/init.js").then((m) => m.generateConfig(options)),
      ).rejects.toThrow("Source tool must be one of the selected tools");
    });

    it("should throw error if no sync items selected", async () => {
      const options = {
        tools: ["claude-code", "cursor"] as ToolName[],
        source: "claude-code" as ToolName,
        syncItems: [],
        isUserLevel: false,
      };

      await expect(
        import("@src/commands/init.js").then((m) => m.generateConfig(options)),
      ).rejects.toThrow("At least one sync item must be selected");
    });
  });
});
