import { describe, it, expect } from "vitest";
import type {
  AdapterConfig,
  WriteResult,
  ValidationResult,
  ToolAdapter,
} from "@src/adapters/base.js";

describe("Adapter Base Types", () => {
  describe("AdapterConfig", () => {
    it("should create valid adapter config", () => {
      const config: AdapterConfig = {
        tool: "claude-code",
        baseDir: "/project",
      };

      expect(config.tool).toBe("claude-code");
      expect(config.baseDir).toBe("/project");
    });
  });

  describe("WriteResult", () => {
    it("should create successful write result", () => {
      const result: WriteResult = {
        success: true,
        count: 5,
      };

      expect(result.success).toBe(true);
      expect(result.count).toBe(5);
    });

    it("should create failed write result", () => {
      const result: WriteResult = {
        success: false,
        count: 0,
        error: "Failed to write",
      };

      expect(result.success).toBe(false);
      expect(result.error).toBe("Failed to write");
    });
  });

  describe("ValidationResult", () => {
    it("should create valid validation result", () => {
      const result: ValidationResult = {
        valid: true,
        errors: [],
      };

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should create invalid validation result", () => {
      const result: ValidationResult = {
        valid: false,
        errors: ["Missing config file", "Invalid JSON"],
        warnings: ["Deprecated field"],
      };

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(2);
      expect(result.warnings).toHaveLength(1);
    });
  });
});
