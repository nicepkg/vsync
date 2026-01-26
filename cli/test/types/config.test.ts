import { describe, it, expect } from "vitest";
import type {
  VSyncConfig,
  SyncMode,
  ToolName,
  ConfigLevel,
} from "@src/types/config.js";

describe("Config Types", () => {
  describe("SyncMode", () => {
    it("should accept valid sync modes", () => {
      const safeModes: SyncMode[] = ["safe", "prune"];
      expect(safeModes).toHaveLength(2);
    });
  });

  describe("ToolName", () => {
    it("should accept valid tool names", () => {
      const tools: ToolName[] = ["claude-code", "cursor", "opencode"];
      expect(tools).toHaveLength(3);
    });
  });

  describe("ConfigLevel", () => {
    it("should accept valid config levels", () => {
      const levels: ConfigLevel[] = ["project", "user"];
      expect(levels).toHaveLength(2);
    });
  });

  describe("VSyncConfig", () => {
    it("should create a valid minimal config", () => {
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

      expect(config.version).toBe("3.0.0");
      expect(config.level).toBe("project");
      expect(config.source_tool).toBe("claude-code");
      expect(config.target_tools).toContain("cursor");
    });

    it("should create a config with last_sync timestamp", () => {
      const config: VSyncConfig = {
        version: "3.0.0",
        level: "user",
        source_tool: "cursor",
        target_tools: ["opencode"],
        sync_config: {
          skills: false,
          mcp: true,
        },
        last_sync: "2026-01-24T10:30:00Z",
      };

      expect(config.last_sync).toBe("2026-01-24T10:30:00Z");
    });

    it("should allow optional schema field", () => {
      const config: VSyncConfig = {
        $schema: "https://vsync.dev/schema.json",
        version: "3.0.0",
        level: "project",
        source_tool: "claude-code",
        target_tools: ["cursor"],
        sync_config: {
          skills: true,
          mcp: true,
        },
      };

      expect(config.$schema).toBe("https://vsync.dev/schema.json");
    });

    it("should support symlink configuration for skills", () => {
      const config: VSyncConfig = {
        version: "3.0.0",
        level: "project",
        source_tool: "claude-code",
        target_tools: ["cursor", "opencode"],
        sync_config: {
          skills: true,
          mcp: true,
        },
        use_symlinks_for_skills: true,
      };

      expect(config.use_symlinks_for_skills).toBe(true);
    });

    it("should allow config without symlink flag (backwards compatible)", () => {
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

      expect(config.use_symlinks_for_skills).toBeUndefined();
    });

    it("should support language preference in user-level config", () => {
      const config: VSyncConfig = {
        version: "3.0.0",
        level: "user",
        source_tool: "claude-code",
        target_tools: ["cursor"],
        sync_config: {
          skills: true,
          mcp: true,
        },
        language: "zh",
      };

      expect(config.language).toBe("zh");
    });

    it("should support English language preference", () => {
      const config: VSyncConfig = {
        version: "3.0.0",
        level: "user",
        source_tool: "claude-code",
        target_tools: ["cursor"],
        sync_config: {
          skills: true,
          mcp: true,
        },
        language: "en",
      };

      expect(config.language).toBe("en");
    });

    it("should allow config without language preference (backwards compatible)", () => {
      const config: VSyncConfig = {
        version: "3.0.0",
        level: "user",
        source_tool: "claude-code",
        target_tools: ["cursor"],
        sync_config: {
          skills: true,
          mcp: true,
        },
      };

      expect(config.language).toBeUndefined();
    });
  });
});
