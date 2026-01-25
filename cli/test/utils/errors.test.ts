/**
 * Tests for error utilities
 */

import { describe, it, expect } from "vitest";
import {
  NotSupportError,
  isNotSupportError,
  isUnsupportedFeature,
} from "@src/utils/errors.js";

describe("NotSupportError", () => {
  it("should create error with correct message", () => {
    const error = new NotSupportError("codex", "agents");

    expect(error.message).toBe("codex does not support agents");
    expect(error.name).toBe("NotSupportError");
    expect(error.tool).toBe("codex");
    expect(error.feature).toBe("agents");
  });

  it("should be instance of Error", () => {
    const error = new NotSupportError("codex", "commands");

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(NotSupportError);
  });

  it("should have stack trace", () => {
    const error = new NotSupportError("opencode", "agents");

    expect(error.stack).toBeDefined();
    expect(error.stack).toContain("NotSupportError");
  });
});

describe("isNotSupportError", () => {
  it("should return true for NotSupportError instances", () => {
    const error = new NotSupportError("codex", "agents");

    expect(isNotSupportError(error)).toBe(true);
  });

  it("should return false for regular Error", () => {
    const error = new Error("some error");

    expect(isNotSupportError(error)).toBe(false);
  });

  it("should return false for non-error values", () => {
    expect(isNotSupportError(null)).toBe(false);
    expect(isNotSupportError(undefined)).toBe(false);
    expect(isNotSupportError("error string")).toBe(false);
    expect(isNotSupportError(123)).toBe(false);
    expect(isNotSupportError({})).toBe(false);
  });
});

describe("isUnsupportedFeature", () => {
  it("should return true for unsupported feature error message", () => {
    const result = {
      success: false,
      error: "codex does not support agents",
    };

    expect(isUnsupportedFeature(result)).toBe(true);
  });

  it("should return true for various unsupported patterns", () => {
    expect(
      isUnsupportedFeature({
        success: false,
        error: "Tool does not support this feature",
      }),
    ).toBe(true);

    expect(
      isUnsupportedFeature({
        success: false,
        error: "Codex does not support commands",
      }),
    ).toBe(true);

    expect(
      isUnsupportedFeature({
        success: false,
        error: "opencode does not support agents",
      }),
    ).toBe(true);
  });

  it("should return false for successful results", () => {
    const result = {
      success: true,
    };

    expect(isUnsupportedFeature(result)).toBe(false);
  });

  it("should return false for other error messages", () => {
    const result = {
      success: false,
      error: "Network connection failed",
    };

    expect(isUnsupportedFeature(result)).toBe(false);
  });

  it("should return false when no error message", () => {
    const result = {
      success: false,
    };

    expect(isUnsupportedFeature(result)).toBe(false);
  });

  it("should return false for empty error message", () => {
    const result = {
      success: false,
      error: "",
    };

    expect(isUnsupportedFeature(result)).toBe(false);
  });
});
