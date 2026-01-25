/**
 * Tests for debug logging utility
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  setDebugMode,
  isDebugEnabled,
  debug,
  debugError,
  debugObject,
  debugTiming,
} from "@src/utils/logger.js";

describe("Logger Utility", () => {
  // Capture console output
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // Reset debug mode
    setDebugMode(false);

    // Spy on console methods
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    consoleLogSpy.mockRestore();
  });

  describe("setDebugMode", () => {
    it("should enable debug mode", () => {
      setDebugMode(true);
      expect(isDebugEnabled()).toBe(true);
    });

    it("should disable debug mode", () => {
      setDebugMode(true);
      setDebugMode(false);
      expect(isDebugEnabled()).toBe(false);
    });
  });

  describe("isDebugEnabled", () => {
    it("should return false by default", () => {
      expect(isDebugEnabled()).toBe(false);
    });

    it("should return true when debug is enabled", () => {
      setDebugMode(true);
      expect(isDebugEnabled()).toBe(true);
    });
  });

  describe("debug", () => {
    it("should not log when debug mode is disabled", () => {
      setDebugMode(false);
      debug("test message");
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it("should log when debug mode is enabled", () => {
      setDebugMode(true);
      debug("test message");
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("[DEBUG]"),
        "test message",
      );
    });

    it("should include timestamp in debug output", () => {
      setDebugMode(true);
      debug("test message");
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringMatching(/\[\d{2}:\d{2}:\d{2}\.\d{3}\]/),
        "test message",
      );
    });

    it("should support multiple arguments", () => {
      setDebugMode(true);
      debug("message", "arg1", "arg2");
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("[DEBUG]"),
        "message",
        "arg1",
        "arg2",
      );
    });
  });

  describe("debugError", () => {
    it("should not log when debug mode is disabled", () => {
      setDebugMode(false);
      const error = new Error("test error");
      debugError("operation failed", error);
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it("should log error with stack trace when debug mode is enabled", () => {
      setDebugMode(true);
      const error = new Error("test error");
      debugError("operation failed", error);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("[ERROR]"),
        "operation failed",
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("Error: test error"),
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("at "),
      );
    });

    it("should handle non-Error objects", () => {
      setDebugMode(true);
      debugError("operation failed", "string error");

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("[ERROR]"),
        "operation failed",
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith("string error");
    });
  });

  describe("debugObject", () => {
    it("should not log when debug mode is disabled", () => {
      setDebugMode(false);
      debugObject("config", { foo: "bar" });
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it("should log formatted object when debug mode is enabled", () => {
      setDebugMode(true);
      const obj = { foo: "bar", nested: { baz: 123 } };
      debugObject("config", obj);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("[DEBUG]"),
        "config:",
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('"foo": "bar"'),
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('"baz": 123'),
      );
    });

    it("should handle circular references gracefully", () => {
      setDebugMode(true);
      const obj: Record<string, unknown> = { foo: "bar" };
      obj.self = obj; // Create circular reference

      expect(() => debugObject("circular", obj)).not.toThrow();
      expect(consoleErrorSpy).toHaveBeenCalled();
    });
  });

  describe("debugTiming", () => {
    it("should not log when debug mode is disabled", () => {
      setDebugMode(false);
      const end = debugTiming("operation");
      end();
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it("should log timing when debug mode is enabled", () => {
      setDebugMode(true);
      const end = debugTiming("operation");

      // Wait a bit
      const startTime = Date.now();
      while (Date.now() - startTime < 10) {
        // Busy wait
      }

      end();

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("[TIMING]"),
        expect.stringMatching(/operation took \d+ms/),
      );
    });

    it("should return a no-op function when debug is disabled", () => {
      setDebugMode(false);
      const end = debugTiming("operation");
      expect(() => end()).not.toThrow();
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });
  });

  describe("sensitive data handling", () => {
    it("should redact common sensitive keys in objects", () => {
      setDebugMode(true);
      const obj = {
        username: "user",
        password: "secret123",
        token: "abc123",
        apiKey: "key456",
      };

      debugObject("credentials", obj);

      const calls = consoleErrorSpy.mock.calls.flat().join(" ");
      expect(calls).not.toContain("secret123");
      expect(calls).not.toContain("abc123");
      expect(calls).not.toContain("key456");
      expect(calls).toContain("***");
    });

    it("should preserve non-sensitive data", () => {
      setDebugMode(true);
      const obj = {
        username: "user",
        password: "secret",
        config: { timeout: 5000 },
      };

      debugObject("data", obj);

      const calls = consoleErrorSpy.mock.calls.flat().join(" ");
      expect(calls).toContain("user");
      expect(calls).toContain("5000");
    });
  });
});
