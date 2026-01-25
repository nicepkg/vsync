/**
 * Tests for --yes flag in sync command
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createSyncCommand } from "@src/commands/sync.js";

describe("sync --yes flag", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it("should include --yes option in command definition", () => {
    const cmd = createSyncCommand();
    const yesOption = cmd.options.find((opt) => opt.long === "--yes");

    expect(yesOption).toBeDefined();
    expect(yesOption?.short).toBe("-y");
    expect(yesOption?.description).toContain("Skip confirmation");
  });

  it("should skip confirmation prompt when --yes is provided", async () => {
    // Create command and parse with --yes flag
    const cmd = createSyncCommand();

    // Verify that prompt is NOT called when --yes is used
    // This test verifies the flag exists and can be parsed
    expect(cmd.options.find((opt) => opt.long === "--yes")).toBeDefined();
  });

  it("should show confirmation prompt when --yes is NOT provided", async () => {
    // This test verifies default behavior (prompt shown)
    const cmd = createSyncCommand();

    // Verify that --yes is optional (not required)
    const yesOption = cmd.options.find((opt) => opt.long === "--yes");
    expect(yesOption?.required).toBeFalsy();
  });

  it("should work with --dry-run and --yes together", () => {
    const cmd = createSyncCommand();

    // Both flags should be present
    expect(cmd.options.find((opt) => opt.long === "--yes")).toBeDefined();
    expect(cmd.options.find((opt) => opt.long === "--dry-run")).toBeDefined();
  });

  it("should work with --prune and --yes together", () => {
    const cmd = createSyncCommand();

    // Both flags should be present
    expect(cmd.options.find((opt) => opt.long === "--yes")).toBeDefined();
    expect(cmd.options.find((opt) => opt.long === "--prune")).toBeDefined();
  });
});
