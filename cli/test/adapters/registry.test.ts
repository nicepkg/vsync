import { describe, it, expect } from "vitest";
import { ClaudeCodeAdapter } from "@src/adapters/claude-code.js";
import { CodexAdapter } from "@src/adapters/codex.js";
import { CursorAdapter } from "@src/adapters/cursor.js";
import { OpenCodeAdapter } from "@src/adapters/opencode.js";
import { getAdapter, getAvailableTools } from "@src/adapters/registry.js";
import { isSamePath } from "../utils/path.js";

describe("Adapter Registry", () => {
  describe("getAvailableTools", () => {
    it("should include built-in tool names", () => {
      const tools = getAvailableTools();
      expect(tools).toContain("claude-code");
      expect(tools).toContain("cursor");
      expect(tools).toContain("opencode");
      expect(tools).toContain("codex");
    });
  });

  describe("getAdapter", () => {
    it("should create ClaudeCodeAdapter for claude-code tool", () => {
      const adapter = getAdapter({
        tool: "claude-code",
        baseDir: "/test",
        level: "project",
      });

      expect(adapter).toBeInstanceOf(ClaudeCodeAdapter);
      expect(adapter.config.tool).toBe("claude-code");
      expect(isSamePath(adapter.config.baseDir, "/test")).toBe(true);
    });

    it("should create CursorAdapter for cursor tool", () => {
      const adapter = getAdapter({
        tool: "cursor",
        baseDir: "/test",
        level: "project",
      });

      expect(adapter).toBeInstanceOf(CursorAdapter);
      expect(adapter.config.tool).toBe("cursor");
      expect(isSamePath(adapter.config.baseDir, "/test")).toBe(true);
    });

    it("should create OpenCodeAdapter for opencode tool", () => {
      const adapter = getAdapter({
        tool: "opencode",
        baseDir: "/test",
        level: "project",
      });

      expect(adapter).toBeInstanceOf(OpenCodeAdapter);
      expect(adapter.config.tool).toBe("opencode");
      expect(isSamePath(adapter.config.baseDir, "/test")).toBe(true);
    });

    it("should create CodexAdapter for codex tool", () => {
      const adapter = getAdapter({
        tool: "codex",
        baseDir: "/test",
        level: "project",
      });

      expect(adapter).toBeInstanceOf(CodexAdapter);
      expect(adapter.config.tool).toBe("codex");
      expect(isSamePath(adapter.config.baseDir, "/test")).toBe(true);
    });

    it("should throw error for unsupported tool", () => {
      expect(() =>
        getAdapter({
          // @ts-expect-error - Testing invalid tool name
          tool: "invalid-tool",
          baseDir: "/test",
          level: "project",
        }),
      ).toThrow("Unsupported tool");
    });

    it("should create adapter with different baseDir", () => {
      const adapter = getAdapter({
        tool: "cursor",
        baseDir: "/custom/path",
        level: "project",
      });

      expect(isSamePath(adapter.config.baseDir, "/custom/path")).toBe(true);
    });
  });
});
