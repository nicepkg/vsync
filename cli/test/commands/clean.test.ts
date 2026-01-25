import { describe, it, expect } from "vitest";
import { formatCleanPlan, parseItemName } from "@src/commands/clean.js";

describe("Clean Command", () => {
  describe("parseItemName", () => {
    it("should parse skill item name", () => {
      const result = parseItemName("skill/test-skill");

      expect(result.type).toBe("skill");
      expect(result.name).toBe("test-skill");
    });

    it("should parse MCP item name", () => {
      const result = parseItemName("mcp/postgres");

      expect(result.type).toBe("mcp");
      expect(result.name).toBe("postgres");
    });

    it("should throw error for invalid format", () => {
      expect(() => parseItemName("invalid")).toThrow(
        "Invalid item name format",
      );
    });

    it("should throw error for invalid type", () => {
      expect(() => parseItemName("agent/test")).toThrow(
        "Invalid item type. Use 'skill' or 'mcp'",
      );
    });
  });

  describe("formatCleanPlan", () => {
    it("should format clean plan for targets only", () => {
      const output = formatCleanPlan({
        itemName: "skill/old-skill",
        type: "skill",
        name: "old-skill",
        targetTools: ["cursor", "opencode"],
        fromSource: false,
        sourceTool: "claude-code",
      });

      expect(output).toContain(
        "This will remove from target tools only (source unchanged)",
      );
      expect(output).toContain("Will remove from:");
      expect(output).toContain("cursor");
      expect(output).toContain("opencode");
      expect(output).toContain("Source (claude-code) will NOT be affected");
    });

    it("should format clean plan for source and targets", () => {
      const output = formatCleanPlan({
        itemName: "mcp/postgres",
        type: "mcp",
        name: "postgres",
        targetTools: ["cursor"],
        fromSource: true,
        sourceTool: "claude-code",
      });

      expect(output).toContain("DANGER ZONE");
      expect(output).toContain("This will delete from the SOURCE tool");
      expect(output).toContain("This action CANNOT be undone");
      expect(output).toContain("Will delete from:");
      expect(output).toContain("claude-code");
      expect(output).toContain("SOURCE");
      expect(output).toContain("cursor");
    });

    it("should show skill directory paths", () => {
      const output = formatCleanPlan({
        itemName: "skill/test",
        type: "skill",
        name: "test",
        targetTools: ["cursor"],
        fromSource: false,
        sourceTool: "claude-code",
      });

      expect(output).toContain(".cursor/skills/test");
    });

    it("should show MCP file paths", () => {
      const output = formatCleanPlan({
        itemName: "mcp/postgres",
        type: "mcp",
        name: "postgres",
        targetTools: ["cursor"],
        fromSource: false,
        sourceTool: "claude-code",
      });

      expect(output).toContain("mcp server: postgres");
    });

    it("should handle empty target tools list", () => {
      const output = formatCleanPlan({
        itemName: "skill/test",
        type: "skill",
        name: "test",
        targetTools: [],
        fromSource: false,
        sourceTool: "claude-code",
      });

      expect(output).toContain("Not synced to any targets");
    });

    it("should show multiple target tools", () => {
      const output = formatCleanPlan({
        itemName: "skill/test",
        type: "skill",
        name: "test",
        targetTools: ["cursor", "opencode"],
        fromSource: false,
        sourceTool: "claude-code",
      });

      expect(output).toContain("cursor");
      expect(output).toContain("opencode");
    });
  });
});
