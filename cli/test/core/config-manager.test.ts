import { readFile } from "node:fs/promises";
import path from "node:path";
import mockFs from "mock-fs";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  loadConfig,
  saveConfig,
  validateConfig,
  getConfigPath,
  mergeConfigs,
  loadMergedConfig,
} from "@src/core/config-manager.js";
import type { VSyncConfig } from "@src/types/config.js";
import { isSamePath } from "../utils/path.js";

const testRoot = path.join(path.parse(process.cwd()).root, "vsync-test");
const homeDir = path.join(testRoot, "home", "user");

describe("Config Manager", () => {
  beforeEach(() => {
    mockFs({
      "/project": {
        ".vsync.json": JSON.stringify({
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
      [homeDir]: {
        ".vsync.json": JSON.stringify({
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
      const configPath = getConfigPath("project", "/project");
      expect(isSamePath(configPath, path.join("/project", ".vsync.json"))).toBe(
        true,
      );
    });

    it("should return user config path", () => {
      const configPath = getConfigPath("user", undefined, homeDir);
      expect(isSamePath(configPath, path.join(homeDir, ".vsync.json"))).toBe(
        true,
      );
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
      const config = await loadConfig("user", "/empty", homeDir);

      expect(config.level).toBe("user");
      expect(config.source_tool).toBe("cursor");
    });

    it("should throw error for missing config", async () => {
      await expect(loadConfig("project", "/empty")).rejects.toThrow();
    });

    it("should throw error for invalid JSON", async () => {
      mockFs({
        "/bad": {
          ".vsync.json": "{ invalid json",
        },
      });

      await expect(loadConfig("project", "/bad")).rejects.toThrow();
    });
  });

  describe("saveConfig", () => {
    it("should save project-level config", async () => {
      const config: VSyncConfig = {
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

      const saved = await readFile("/empty/.vsync.json", "utf-8");
      const parsed = JSON.parse(saved);

      expect(parsed.version).toBe("3.0.0");
      expect(parsed.target_tools).toHaveLength(2);
    });

    it("should save user-level config", async () => {
      const config: VSyncConfig = {
        version: "3.0.0",
        level: "user",
        source_tool: "cursor",
        target_tools: ["claude-code"],
        sync_config: {
          skills: false,
          mcp: true,
        },
      };

      await saveConfig(config, "user", "/empty", homeDir);

      const saved = await readFile(path.join(homeDir, ".vsync.json"), "utf-8");
      const parsed = JSON.parse(saved);

      expect(parsed.level).toBe("user");
    });

    it("should format JSON with indentation", async () => {
      const config: VSyncConfig = {
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

      const saved = await readFile("/empty/.vsync.json", "utf-8");
      expect(saved).toContain("\n");
      expect(saved).toContain("  ");
    });
  });

  describe("validateConfig", () => {
    it("should validate correct config", () => {
      const config: VSyncConfig = {
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
      } as VSyncConfig;

      const result = validateConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it("should reject invalid tool names", () => {
      const config: VSyncConfig = {
        version: "3.0.0",
        level: "project",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        source_tool: "invalid-tool" as any,
        target_tools: ["cursor"],
        sync_config: { skills: true, mcp: true },
      };

      const result = validateConfig(config);
      expect(result.valid).toBe(false);
    });

    it("should reject empty target_tools", () => {
      const config: VSyncConfig = {
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
      const config: VSyncConfig = {
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
      const config: VSyncConfig = {
        version: "3.0.0",
        level: "project",
        source_tool: "claude-code",
        target_tools: ["cursor"],
        sync_config: { skills: false, mcp: false },
      };

      const result = validateConfig(config);
      expect(result.valid).toBe(false);
    });

    it("should accept valid symlink configuration", () => {
      const config: VSyncConfig = {
        version: "3.0.0",
        level: "project",
        source_tool: "claude-code",
        target_tools: ["cursor", "opencode"],
        sync_config: { skills: true, mcp: true },
        use_symlinks_for_skills: true,
      };

      const result = validateConfig(config);
      expect(result.valid).toBe(true);
    });

    it("should accept config without symlink fields (backwards compatible)", () => {
      const config: VSyncConfig = {
        version: "3.0.0",
        level: "project",
        source_tool: "claude-code",
        target_tools: ["cursor"],
        sync_config: { skills: true, mcp: true },
      };

      const result = validateConfig(config);
      expect(result.valid).toBe(true);
    });

    it("should reject invalid use_symlinks_for_skills type", () => {
      const config = {
        version: "3.0.0",
        level: "project",
        source_tool: "claude-code",
        target_tools: ["cursor"],
        sync_config: { skills: true, mcp: true },
        use_symlinks_for_skills: "yes", // Should be boolean
      } as any;

      const result = validateConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        "use_symlinks_for_skills must be a boolean",
      );
    });

    it("should accept valid language preference", () => {
      const config: VSyncConfig = {
        version: "3.0.0",
        level: "user",
        source_tool: "claude-code",
        target_tools: ["cursor"],
        sync_config: { skills: true, mcp: true },
        language: "zh",
      };

      const result = validateConfig(config);
      expect(result.valid).toBe(true);
    });

    it("should accept config without language (backwards compatible)", () => {
      const config: VSyncConfig = {
        version: "3.0.0",
        level: "user",
        source_tool: "claude-code",
        target_tools: ["cursor"],
        sync_config: { skills: true, mcp: true },
      };

      const result = validateConfig(config);
      expect(result.valid).toBe(true);
    });

    it("should reject invalid language value", () => {
      const config = {
        version: "3.0.0",
        level: "user",
        source_tool: "claude-code",
        target_tools: ["cursor"],
        sync_config: { skills: true, mcp: true },
        language: "fr", // Should be 'en' or 'zh'
      } as any;

      const result = validateConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("language must be 'en' or 'zh'");
    });

    it("should reject language with invalid type", () => {
      const config = {
        version: "3.0.0",
        level: "user",
        source_tool: "claude-code",
        target_tools: ["cursor"],
        sync_config: { skills: true, mcp: true },
        language: 123, // Should be string
      } as any;

      const result = validateConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("language must be 'en' or 'zh'");
    });
  });

  describe("mergeConfigs", () => {
    it("should merge user and project configs with project taking precedence", () => {
      const userConfig: VSyncConfig = {
        version: "3.0.0",
        level: "user",
        source_tool: "cursor",
        target_tools: ["opencode"],
        sync_config: {
          skills: false,
          mcp: true,
        },
      };

      const projectConfig: VSyncConfig = {
        version: "3.0.0",
        level: "project",
        source_tool: "claude-code",
        target_tools: ["cursor"],
        sync_config: {
          skills: true,
          mcp: true,
        },
      };

      const merged = mergeConfigs(userConfig, projectConfig);

      // Project config should override user config
      expect(merged.source_tool).toBe("claude-code");
      expect(merged.target_tools).toEqual(["cursor"]);
      expect(merged.sync_config!.skills).toBe(true);
      expect(merged.sync_config!.mcp).toBe(true);
      expect(merged.level).toBe("project");
    });

    it("should use user config when project config is undefined", () => {
      const userConfig: VSyncConfig = {
        version: "3.0.0",
        level: "user",
        source_tool: "cursor",
        target_tools: ["opencode"],
        sync_config: {
          skills: true,
          mcp: false,
        },
      };

      const merged = mergeConfigs(userConfig, undefined);

      expect(merged.source_tool).toBe("cursor");
      expect(merged.target_tools).toEqual(["opencode"]);
      expect(merged.sync_config!.skills).toBe(true);
      expect(merged.sync_config!.mcp).toBe(false);
      expect(merged.level).toBe("user");
    });

    it("should use project config when user config is undefined", () => {
      const projectConfig: VSyncConfig = {
        version: "3.0.0",
        level: "project",
        source_tool: "claude-code",
        target_tools: ["cursor", "opencode"],
        sync_config: {
          skills: true,
          mcp: true,
        },
      };

      const merged = mergeConfigs(undefined, projectConfig);

      expect(merged.source_tool).toBe("claude-code");
      expect(merged.target_tools).toEqual(["cursor", "opencode"]);
      expect(merged.level).toBe("project");
    });

    it("should preserve last_sync from most recent config", () => {
      const userConfig: VSyncConfig = {
        version: "3.0.0",
        level: "user",
        source_tool: "cursor",
        target_tools: ["opencode"],
        sync_config: { skills: true, mcp: true },
        last_sync: "2026-01-20T10:00:00Z",
      };

      const projectConfig: VSyncConfig = {
        version: "3.0.0",
        level: "project",
        source_tool: "claude-code",
        target_tools: ["cursor"],
        sync_config: { skills: true, mcp: true },
        last_sync: "2026-01-24T12:00:00Z",
      };

      const merged = mergeConfigs(userConfig, projectConfig);

      // Project config's last_sync should be used
      expect(merged.last_sync).toBe("2026-01-24T12:00:00Z");
    });

    it("should merge target_tools arrays from both configs", () => {
      const userConfig: VSyncConfig = {
        version: "3.0.0",
        level: "user",
        source_tool: "claude-code",
        target_tools: ["cursor"],
        sync_config: { skills: true, mcp: true },
      };

      const projectConfig: VSyncConfig = {
        version: "3.0.0",
        level: "project",
        source_tool: "claude-code",
        target_tools: ["opencode"],
        sync_config: { skills: true, mcp: false },
      };

      const merged = mergeConfigs(userConfig, projectConfig);

      // Project should override completely
      expect(merged.target_tools).toEqual(["opencode"]);
    });

    it("should throw error if both configs are undefined", () => {
      expect(() => mergeConfigs(undefined, undefined)).toThrow(
        "At least one config must be provided",
      );
    });

    it("should merge symlink configuration with project taking precedence", () => {
      const userConfig: VSyncConfig = {
        version: "3.0.0",
        level: "user",
        source_tool: "claude-code",
        target_tools: ["cursor"],
        sync_config: { skills: true, mcp: true },
        use_symlinks_for_skills: true,
      };

      const projectConfig: VSyncConfig = {
        version: "3.0.0",
        level: "project",
        source_tool: "claude-code",
        target_tools: ["cursor", "opencode"],
        sync_config: { skills: true, mcp: false },
        use_symlinks_for_skills: false,
      };

      const merged = mergeConfigs(userConfig, projectConfig);

      // Project config takes precedence
      expect(merged.use_symlinks_for_skills).toBe(false);
    });

    it("should inherit symlink configuration from user config if project doesn't have it", () => {
      const userConfig: VSyncConfig = {
        version: "3.0.0",
        level: "user",
        source_tool: "claude-code",
        target_tools: ["cursor"],
        sync_config: { skills: true, mcp: true },
        use_symlinks_for_skills: true,
      };

      const projectConfig: VSyncConfig = {
        version: "3.0.0",
        level: "project",
        source_tool: "claude-code",
        target_tools: ["cursor", "opencode"],
        sync_config: { skills: true, mcp: false },
      };

      const merged = mergeConfigs(userConfig, projectConfig);

      // Should inherit from user config
      expect(merged.use_symlinks_for_skills).toBe(true);
    });

    it("should preserve language preference from user config", () => {
      const userConfig: VSyncConfig = {
        version: "3.0.0",
        level: "user",
        source_tool: "claude-code",
        target_tools: ["cursor"],
        sync_config: { skills: true, mcp: true },
        language: "zh",
      };

      const projectConfig: VSyncConfig = {
        version: "3.0.0",
        level: "project",
        source_tool: "claude-code",
        target_tools: ["cursor", "opencode"],
        sync_config: { skills: true, mcp: false },
      };

      const merged = mergeConfigs(userConfig, projectConfig);

      // Language should come from user config (user preference)
      expect(merged.language).toBe("zh");
    });

    it("should not have language if neither config has it", () => {
      const userConfig: VSyncConfig = {
        version: "3.0.0",
        level: "user",
        source_tool: "claude-code",
        target_tools: ["cursor"],
        sync_config: { skills: true, mcp: true },
      };

      const projectConfig: VSyncConfig = {
        version: "3.0.0",
        level: "project",
        source_tool: "claude-code",
        target_tools: ["cursor", "opencode"],
        sync_config: { skills: true, mcp: false },
      };

      const merged = mergeConfigs(userConfig, projectConfig);

      expect(merged.language).toBeUndefined();
    });

    it("should merge agents and commands config fields (not drop them)", () => {
      const userConfig: VSyncConfig = {
        version: "3.0.0",
        level: "user",
        source_tool: "claude-code",
        target_tools: ["cursor"],
        sync_config: {
          skills: true,
          mcp: true,
          agents: false,
          commands: false,
        },
      };

      const projectConfig: VSyncConfig = {
        version: "3.0.0",
        level: "project",
        source_tool: "claude-code",
        target_tools: ["codex"],
        sync_config: {
          skills: false,
          mcp: false,
          agents: true,
          commands: true,
        },
      };

      const merged = mergeConfigs(userConfig, projectConfig);

      // Project config takes precedence for all fields
      expect(merged.sync_config!.skills).toBe(false);
      expect(merged.sync_config!.mcp).toBe(false);
      expect(merged.sync_config!.agents).toBe(true);
      expect(merged.sync_config!.commands).toBe(true);
    });

    it("should default agents and commands to true if not specified", () => {
      const userConfig: VSyncConfig = {
        version: "3.0.0",
        level: "user",
        source_tool: "claude-code",
        target_tools: ["cursor"],
        sync_config: {
          skills: true,
          mcp: true,
          // agents and commands not specified
        },
      };

      const projectConfig: VSyncConfig = {
        version: "3.0.0",
        level: "project",
        source_tool: "claude-code",
        target_tools: ["codex"],
        sync_config: {
          skills: false,
          mcp: false,
          // agents and commands not specified
        },
      };

      const merged = mergeConfigs(userConfig, projectConfig);

      // Should default to true
      expect(merged.sync_config!.agents).toBe(true);
      expect(merged.sync_config!.commands).toBe(true);
    });
  });

  describe("loadMergedConfig", () => {
    it("should load and merge user and project configs", async () => {
      const merged = await loadMergedConfig("/project", homeDir);

      // Project config should take precedence
      expect(merged.source_tool).toBe("claude-code");
      expect(merged.target_tools).toEqual(["cursor"]);
      expect(merged.sync_config!.skills).toBe(true);
    });

    it("should work with only project config", async () => {
      const merged = await loadMergedConfig("/project", "/nonexistent");

      expect(merged.source_tool).toBe("claude-code");
      expect(merged.level).toBe("project");
    });

    it("should work with only user config", async () => {
      const merged = await loadMergedConfig("/nonexistent", homeDir);

      expect(merged.source_tool).toBe("cursor");
      expect(merged.level).toBe("user");
    });

    it("should throw error if neither config exists", async () => {
      await expect(loadMergedConfig("/empty", "/empty")).rejects.toThrow();
    });
  });
});
