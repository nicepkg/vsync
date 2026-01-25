/**
 * Tests for --yes flag in clean command
 */

import { describe, it, expect } from "vitest";
import { createCleanCommand } from "@src/commands/clean.js";

describe("clean --yes flag", () => {
  it("should include --yes option in command definition", () => {
    const cmd = createCleanCommand();
    const yesOption = cmd.options.find((opt) => opt.long === "--yes");

    expect(yesOption).toBeDefined();
    expect(yesOption?.short).toBe("-y");
    expect(yesOption?.description).toContain("Skip confirmation");
  });

  it("should be compatible with --from-source flag", () => {
    const cmd = createCleanCommand();

    // Both flags should be present
    expect(cmd.options.find((opt) => opt.long === "--yes")).toBeDefined();
    expect(
      cmd.options.find((opt) => opt.long === "--from-source"),
    ).toBeDefined();
  });

  it("should be compatible with --user flag", () => {
    const cmd = createCleanCommand();

    // Both flags should be present
    expect(cmd.options.find((opt) => opt.long === "--yes")).toBeDefined();
    expect(cmd.options.find((opt) => opt.long === "--user")).toBeDefined();
  });

  it("should not be required (optional flag)", () => {
    const cmd = createCleanCommand();
    const yesOption = cmd.options.find((opt) => opt.long === "--yes");

    expect(yesOption?.required).toBeFalsy();
  });
});
