/**
 * Tests for error formatting utility
 */

import { describe, it, expect } from "vitest";
import {
  formatError,
  createConfigError,
  createFileError,
  createSyncError,
  createAdapterError,
  ErrorCategory,
} from "@src/utils/error-formatter.js";

describe("Error Formatter", () => {
  describe("formatError", () => {
    it("should format basic error with message", () => {
      const error = new Error("Test error");
      const formatted = formatError(error);

      expect(formatted).toContain("Test error");
    });

    it("should include file path when provided", () => {
      const error = new Error("File not found");
      const formatted = formatError(error, { filePath: "/path/to/file.json" });

      expect(formatted).toContain("/path/to/file.json");
    });

    it("should include suggestion when provided", () => {
      const error = new Error("Config invalid");
      const formatted = formatError(error, {
        suggestion: "Run 'vibe-sync init' first",
      });

      expect(formatted).toContain("Run 'vibe-sync init' first");
    });

    it("should format non-Error objects", () => {
      const formatted = formatError("String error");

      expect(formatted).toContain("String error");
    });
  });

  describe("createConfigError", () => {
    it("should create config not found error", () => {
      const error = createConfigError("notFound", {
        filePath: ".vibe-sync.json",
      });

      expect(error.message).toContain(".vibe-sync.json");
      expect(error.message).toContain("not found");
      expect(error.category).toBe(ErrorCategory.CONFIG);
    });

    it("should suggest running init for missing config", () => {
      const error = createConfigError("notFound", {
        filePath: ".vibe-sync.json",
      });

      expect(error.suggestion).toContain("vibe-sync init");
    });

    it("should create invalid config error", () => {
      const error = createConfigError("invalid", {
        reason: "source_tool is required",
      });

      expect(error.message).toContain("Invalid configuration");
      expect(error.message).toContain("source_tool is required");
    });

    it("should suggest checking config for invalid format", () => {
      const error = createConfigError("invalid", {
        reason: "Invalid JSON",
      });

      expect(error.suggestion).toBeTruthy();
    });
  });

  describe("createFileError", () => {
    it("should create file not found error", () => {
      const error = createFileError("notFound", {
        filePath: "/path/to/skill.md",
      });

      expect(error.message).toContain("/path/to/skill.md");
      expect(error.message).toContain("not found");
      expect(error.category).toBe(ErrorCategory.FILE);
    });

    it("should create permission denied error", () => {
      const error = createFileError("permissionDenied", {
        filePath: "/root/protected.json",
        operation: "write",
      });

      expect(error.message).toContain("Permission denied");
      expect(error.message).toContain("/root/protected.json");
      expect(error.suggestion).toContain("permissions");
    });

    it("should create invalid JSON error", () => {
      const error = createFileError("invalidJSON", {
        filePath: "config.json",
        lineNumber: 5,
      });

      expect(error.message).toContain("config.json");
      expect(error.message).toContain("line 5");
    });
  });

  describe("createSyncError", () => {
    it("should create no targets error", () => {
      const error = createSyncError("noTargets");

      expect(error.message).toContain("No target tools");
      expect(error.suggestion).toContain("target_tools");
    });

    it("should create tool not found error", () => {
      const error = createSyncError("toolNotFound", {
        tool: "cursor",
        directory: ".cursor",
      });

      expect(error.message).toContain("cursor");
      expect(error.message).toContain(".cursor");
      expect(error.suggestion).toBeTruthy();
    });

    it("should create hash mismatch error", () => {
      const error = createSyncError("hashMismatch", {
        item: "skill/test",
        expected: "abc123",
        actual: "def456",
      });

      expect(error.message).toContain("skill/test");
      expect(error.message).toContain("abc123");
      expect(error.message).toContain("def456");
    });
  });

  describe("createAdapterError", () => {
    it("should create unsupported tool error", () => {
      const error = createAdapterError("unsupportedTool", {
        tool: "invalid-tool",
      });

      expect(error.message).toContain("invalid-tool");
      expect(error.suggestion).toContain("claude-code");
      expect(error.suggestion).toContain("cursor");
    });

    it("should create read failed error", () => {
      const error = createAdapterError("readFailed", {
        tool: "claude-code",
        itemType: "skills",
        reason: "Directory not found",
      });

      expect(error.message).toContain("claude-code");
      expect(error.message).toContain("skills");
      expect(error.message).toContain("Directory not found");
    });

    it("should create write failed error", () => {
      const error = createAdapterError("writeFailed", {
        tool: "cursor",
        itemType: "mcp",
        reason: "Invalid format",
      });

      expect(error.message).toContain("cursor");
      expect(error.message).toContain("MCP");
      expect(error.message).toContain("Invalid format");
    });
  });

  describe("FormattedError properties", () => {
    it("should have category property", () => {
      const error = createConfigError("notFound", {
        filePath: ".vibe-sync.json",
      });

      expect(error.category).toBe(ErrorCategory.CONFIG);
    });

    it("should have suggestion property", () => {
      const error = createConfigError("notFound", {
        filePath: ".vibe-sync.json",
      });

      expect(error.suggestion).toBeTruthy();
      expect(typeof error.suggestion).toBe("string");
    });

    it("should have optional filePath property", () => {
      const error = createFileError("notFound", {
        filePath: "/test/file.json",
      });

      expect(error.filePath).toBe("/test/file.json");
    });

    it("should have optional lineNumber property", () => {
      const error = createFileError("invalidJSON", {
        filePath: "test.json",
        lineNumber: 10,
      });

      expect(error.lineNumber).toBe(10);
    });
  });
});
