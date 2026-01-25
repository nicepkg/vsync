/**
 * Tests for symlink detection and prompt in sync command
 * Phase 9.2: Symlink Detection & Prompt
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  detectFirstTimeSkillsSync,
  shouldPromptForSymlinks,
} from "@src/commands/sync.js";
import type { VibeConfig } from "@src/types/config.js";
import type { Manifest } from "@src/types/manifest.js";

describe("Symlink Detection & Prompt", () => {
  describe("detectFirstTimeSkillsSync", () => {
    it("should return true when manifest has no skill entries", () => {
      const manifest: Manifest = {
        version: "1.0.0",
        last_synced: "",
        items: {},
      };

      const result = detectFirstTimeSkillsSync(manifest);
      expect(result).toBe(true);
    });

    it("should return true when manifest has only MCP entries", () => {
      const manifest: Manifest = {
        version: "1.0.0",
        last_synced: "2024-01-01T00:00:00Z",
        items: {
          "mcp/test-server": {
            type: "mcp",
            name: "test-server",
            hash: "abc123",
            last_synced: "2024-01-01T00:00:00Z",
            targets: {
              cursor: {
                synced: true,
                hash: "abc123",
                last_synced: "2024-01-01T00:00:00Z",
              },
            },
          },
        },
      };

      const result = detectFirstTimeSkillsSync(manifest);
      expect(result).toBe(true);
    });

    it("should return false when manifest has at least one skill entry", () => {
      const manifest: Manifest = {
        version: "1.0.0",
        last_synced: "2024-01-01T00:00:00Z",
        items: {
          "skill/test-skill": {
            type: "skill",
            name: "test-skill",
            hash: "def456",
            last_synced: "2024-01-01T00:00:00Z",
            targets: {
              cursor: {
                synced: true,
                hash: "def456",
                last_synced: "2024-01-01T00:00:00Z",
              },
            },
          },
        },
      };

      const result = detectFirstTimeSkillsSync(manifest);
      expect(result).toBe(false);
    });

    it("should return false when manifest has mixed skill and MCP entries", () => {
      const manifest: Manifest = {
        version: "1.0.0",
        last_synced: "2024-01-01T00:00:00Z",
        items: {
          "skill/test-skill": {
            type: "skill",
            name: "test-skill",
            hash: "def456",
            last_synced: "2024-01-01T00:00:00Z",
            targets: {},
          },
          "mcp/test-server": {
            type: "mcp",
            name: "test-server",
            hash: "abc123",
            last_synced: "2024-01-01T00:00:00Z",
            targets: {},
          },
        },
      };

      const result = detectFirstTimeSkillsSync(manifest);
      expect(result).toBe(false);
    });
  });

  describe("shouldPromptForSymlinks", () => {
    let manifest: Manifest;

    beforeEach(() => {
      manifest = {
        version: "1.0.0",
        last_synced: "",
        items: {},
      };
    });

    it("should return false when use_symlinks_for_skills is already set to true", () => {
      const config: VibeConfig = {
        version: "1.0.0",
        source_tool: "claude-code",
        target_tools: ["cursor"],
        level: "project",
        sync_config: { skills: true, mcp: false },
        use_symlinks_for_skills: true,
      };

      const result = shouldPromptForSymlinks(config, manifest, ["cursor"]);
      expect(result).toBe(false);
    });

    it("should return false when use_symlinks_for_skills is already set to false", () => {
      const config: VibeConfig = {
        version: "1.0.0",
        source_tool: "claude-code",
        target_tools: ["cursor"],
        level: "project",
        sync_config: { skills: true, mcp: false },
        use_symlinks_for_skills: false,
      };

      const result = shouldPromptForSymlinks(config, manifest, ["cursor"]);
      expect(result).toBe(false);
    });

    it("should return true when use_symlinks_for_skills is undefined and this is first sync", () => {
      const config: VibeConfig = {
        version: "1.0.0",
        source_tool: "claude-code",
        target_tools: ["cursor"],
        level: "project",
        sync_config: { skills: true, mcp: false },
        // use_symlinks_for_skills is undefined
      };

      const result = shouldPromptForSymlinks(config, manifest, ["cursor"]);
      expect(result).toBe(true);
    });

    it("should return false when use_symlinks_for_skills is undefined but not first sync", () => {
      const config: VibeConfig = {
        version: "1.0.0",
        source_tool: "claude-code",
        target_tools: ["cursor"],
        level: "project",
        sync_config: { skills: true, mcp: false },
        // use_symlinks_for_skills is undefined
      };

      const manifestWithSkills: Manifest = {
        version: "1.0.0",
        last_synced: "2024-01-01T00:00:00Z",
        items: {
          "skill/existing": {
            type: "skill",
            name: "existing",
            hash: "abc123",
            last_synced: "2024-01-01T00:00:00Z",
            targets: {},
          },
        },
      };

      const result = shouldPromptForSymlinks(config, manifestWithSkills, [
        "cursor",
      ]);
      expect(result).toBe(false);
    });

    it("should return false when skills are not in sync config", () => {
      const config: VibeConfig = {
        version: "1.0.0",
        source_tool: "claude-code",
        target_tools: ["cursor"],
        level: "project",
        sync_config: { skills: false, mcp: true }, // Only MCP, no skills
        // use_symlinks_for_skills is undefined
      };

      const result = shouldPromptForSymlinks(config, manifest, ["cursor"]);
      expect(result).toBe(false);
    });

    it("should return false when no target tools specified", () => {
      const config: VibeConfig = {
        version: "1.0.0",
        source_tool: "claude-code",
        target_tools: [],
        level: "project",
        sync_config: { skills: true, mcp: false },
        // use_symlinks_for_skills is undefined
      };

      const result = shouldPromptForSymlinks(config, manifest, []);
      expect(result).toBe(false);
    });

    it("should return true for multiple target tools on first sync", () => {
      const config: VibeConfig = {
        version: "1.0.0",
        source_tool: "claude-code",
        target_tools: ["cursor", "opencode"],
        level: "project",
        sync_config: { skills: true, mcp: false },
        // use_symlinks_for_skills is undefined
      };

      const result = shouldPromptForSymlinks(config, manifest, [
        "cursor",
        "opencode",
      ]);
      expect(result).toBe(true);
    });
  });
});
