import { describe, it, expect } from "vitest";
import { ClaudeCodeAdapter } from "@src/adapters/claude-code.js";
import { CursorAdapter } from "@src/adapters/cursor.js";
import { OpenCodeAdapter } from "@src/adapters/opencode.js";
import { getAdapter } from "@src/adapters/registry.js";

describe("Adapter Registry", () => {
  describe("getAdapter", () => {
    it("should create ClaudeCodeAdapter for claude-code tool", () => {
      const adapter = getAdapter({
        tool: "claude-code",
        baseDir: "/test",
      });

      expect(adapter).toBeInstanceOf(ClaudeCodeAdapter);
      expect(adapter.config.tool).toBe("claude-code");
      expect(adapter.config.baseDir).toBe("/test");
    });

    it("should create CursorAdapter for cursor tool", () => {
      const adapter = getAdapter({
        tool: "cursor",
        baseDir: "/test",
      });

      expect(adapter).toBeInstanceOf(CursorAdapter);
      expect(adapter.config.tool).toBe("cursor");
      expect(adapter.config.baseDir).toBe("/test");
    });

    it("should create OpenCodeAdapter for opencode tool", () => {
      const adapter = getAdapter({
        tool: "opencode",
        baseDir: "/test",
      });

      expect(adapter).toBeInstanceOf(OpenCodeAdapter);
      expect(adapter.config.tool).toBe("opencode");
      expect(adapter.config.baseDir).toBe("/test");
    });

    it("should throw error for unsupported tool", () => {
      expect(() =>
        getAdapter({
          // @ts-expect-error - Testing invalid tool name
          tool: "invalid-tool",
          baseDir: "/test",
        }),
      ).toThrow("Unsupported tool");
    });

    it("should create adapter with different baseDir", () => {
      const adapter = getAdapter({
        tool: "cursor",
        baseDir: "/custom/path",
      });

      expect(adapter.config.baseDir).toBe("/custom/path");
    });
  });
});
