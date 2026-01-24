import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { readFile } from "node:fs/promises";
import mockFs from "mock-fs";
import {
  loadConfig,
  saveConfig,
  validateConfig,
  getConfigPath,
} from "@src/core/config-manager.js";
import type { VibeConfig } from "@src/types/config.js";

describe("Config Manager", () => {
  beforeEach(() => {
    mockFs({
      "/project": {
        ".vibe-sync.json": JSON.stringify({
          version: "3.0.0",
          level: "project",
          source_tool: "claude-code",
          target_tools: ["cursor"],
          sync_config: {
            skills: true,
            mcp: true,
          },
        }),
      },
      "/home/user": {
        ".vibe-sync.json": JSON.stringify({
          version: "3.0.0",
          level: "user",
          source_tool: "cursor",
          target_tools: ["opencode"],
          sync_config: {
            skills: false,
            mcp: true,
          },
        }),
      },
      "/empty": {},
    });
  });

  afterEach(() => {
    mockFs.restore();
  });

  describe("getConfigPath", () => {
    it("should return project config path", () => {
      const path = getConfigPath("project", "/project");
      expect(path).toBe("/project/.vibe-sync.json");
    });

    it("should return user config path", () => {
      const path = getConfigPath("user", undefined, "/home/user");
      expect(path).toBe("/home/user/.vibe-sync.json");
    });
  });

  describe("loadConfig", () => {
    it("should load project-level config", async () => {
      const config = await loadConfig("project", "/project");

      expect(config.version).toBe("3.0.0");
      expect(config.level).toBe("project");
      expect(config.source_tool).toBe("claude-code");
      expect(config.target_tools).toContain("cursor");
    });

    it("should load user-level config", async () => {
      const config = await loadConfig("user", "/empty", "/home/user");

      expect(config.level).toBe("user");
      expect(config.source_tool).toBe("cursor");
    });

    it("should throw error for missing config", async () => {
      await expect(loadConfig("project", "/empty")).rejects.toThrow();
    });

    it("should throw error for invalid JSON", async () => {
      mockFs({
        "/bad": {
          ".vibe-sync.json": "{ invalid json",
        },
      });

      await expect(loadConfig("project", "/bad")).rejects.toThrow();
    });
  });

  describe("saveConfig", () => {
    it("should save project-level config", async () => {
      const config: VibeConfig = {
        version: "3.0.0",
        level: "project",
        source_tool: "claude-code",
        target_tools: ["cursor", "opencode"],
        sync_config: {
          skills: true,
          mcp: true,
        },
      };

      await saveConfig(config, "project", "/empty");

      const saved = await readFile("/empty/.vibe-sync.json", "utf-8");
      const parsed = JSON.parse(saved);

      expect(parsed.version).toBe("3.0.0");
      expect(parsed.target_tools).toHaveLength(2);
    });

    it("should save user-level config", async () => {
      const config: VibeConfig = {
        version: "3.0.0",
        level: "user",
        source_tool: "cursor",
        target_tools: ["claude-code"],
        sync_config: {
          skills: false,
          mcp: true,
        },
      };

      await saveConfig(config, "user", "/empty", "/home/user");

      const saved = await readFile("/home/user/.vibe-sync.json", "utf-8");
      const parsed = JSON.parse(saved);

      expect(parsed.level).toBe("user");
    });

    it("should format JSON with indentation", async () => {
      const config: VibeConfig = {
        version: "3.0.0",
        level: "project",
        source_tool: "claude-code",
        target_tools: ["cursor"],
        sync_config: {
          skills: true,
          mcp: true,
        },
      };

      await saveConfig(config, "project", "/empty");

      const saved = await readFile("/empty/.vibe-sync.json", "utf-8");
      expect(saved).toContain("\n");
      expect(saved).toContain("  ");
    });

  });

  describe("validateConfig", () => {
    it("should validate correct config", () => {
      const config: VibeConfig = {
        version: "3.0.0",
        level: "project",
        source_tool: "claude-code",
        target_tools: ["cursor"],
        sync_config: {
          skills: true,
          mcp: true,
        },
      };

      const result = validateConfig(config);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should reject missing version", () => {
      const config = {
        level: "project",
        source_tool: "claude-code",
        target_tools: ["cursor"],
        sync_config: { skills: true, mcp: true },
      } as VibeConfig;

      const result = validateConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it("should reject invalid tool names", () => {
      const config: VibeConfig = {
        version: "3.0.0",
        level: "project",
        source_tool: "invalid-tool" as any,
        target_tools: ["cursor"],
        sync_config: { skills: true, mcp: true },
      };

      const result = validateConfig(config);
      expect(result.valid).toBe(false);
    });

    it("should reject empty target_tools", () => {
      const config: VibeConfig = {
        version: "3.0.0",
        level: "project",
        source_tool: "claude-code",
        target_tools: [],
        sync_config: { skills: true, mcp: true },
      };

      const result = validateConfig(config);
      expect(result.valid).toBe(false);
    });

    it("should reject source_tool in target_tools", () => {
      const config: VibeConfig = {
        version: "3.0.0",
        level: "project",
        source_tool: "claude-code",
        target_tools: ["claude-code", "cursor"],
        sync_config: { skills: true, mcp: true },
      };

      const result = validateConfig(config);
      expect(result.valid).toBe(false);
    });

    it("should require at least one sync type enabled", () => {
      const config: VibeConfig = {
        version: "3.0.0",
        level: "project",
        source_tool: "claude-code",
        target_tools: ["cursor"],
        sync_config: { skills: false, mcp: false },
      };

      const result = validateConfig(config);
      expect(result.valid).toBe(false);
    });
  });
});
