import { describe, it, expect } from "vitest";
import { formatSkillsTable, formatMCPTable } from "@src/commands/list.js";
import type { Manifest } from "@src/types/manifest.js";
import type { Skill, MCPServer } from "@src/types/models.js";

describe("List Command", () => {
  const sampleManifest: Manifest = {
    version: "1.0.0",
    last_synced: "2026-01-24T10:30:00.000Z",
    items: {
      "skill/git-release": {
        type: "skill",
        name: "git-release",
        hash: "abc123def456",
        last_synced: "2026-01-24T10:30:00.000Z",
        targets: {
          cursor: {
            synced: true,
            hash: "abc123def456",
            last_synced: "2026-01-24T10:30:00.000Z",
          },
          opencode: {
            synced: true,
            hash: "abc123def456",
            last_synced: "2026-01-24T10:30:00.000Z",
          },
        },
      },
      "skill/api-conventions": {
        type: "skill",
        name: "api-conventions",
        hash: "def456ghi789",
        last_synced: "2026-01-24T10:30:00.000Z",
        targets: {
          cursor: {
            synced: true,
            hash: "def456ghi789",
            last_synced: "2026-01-24T10:30:00.000Z",
          },
        },
      },
      "mcp/postgres": {
        type: "mcp",
        name: "postgres",
        hash: "mcp123hash",
        last_synced: "2026-01-24T10:30:00.000Z",
        targets: {
          cursor: {
            synced: true,
            hash: "mcp123hash",
            last_synced: "2026-01-24T10:30:00.000Z",
          },
        },
      },
    },
  };

  describe("formatSkillsTable", () => {
    it("should format skills in table format", () => {
      const skills: Skill[] = [
        {
          name: "git-release",
          content: "# Git Release\n\nCreate releases and changelogs",
          hash: "abc123def456",
        },
        {
          name: "api-conventions",
          content: "# API Conventions\n\nAPI design patterns",
          hash: "def456ghi789",
        },
      ];

      const output = formatSkillsTable(skills, sampleManifest, "claude-code");

      expect(output).toContain("Skills");
      expect(output).toContain("2 items");
      expect(output).toContain("Source: claude-code");
      expect(output).toContain("git-release");
      expect(output).toContain("api-conventions");
      expect(output).toContain("Create releases"); // Truncated in table
      expect(output).toContain("API design patterns");
      expect(output).toContain("cursor");
      expect(output).toContain("abc123");
    });

    it("should show synced targets for each skill", () => {
      const skills: Skill[] = [
        {
          name: "git-release",
          content: "# Git Release",
          hash: "abc123def456",
        },
      ];

      const output = formatSkillsTable(skills, sampleManifest, "claude-code");

      // Targets may be truncated in table
      expect(output).toContain("cursor");
    });

    it("should handle skills with no description", () => {
      const skills: Skill[] = [
        {
          name: "no-desc",
          content: "Some content without title",
          hash: "hash123",
        },
      ];

      const manifest: Manifest = {
        version: "1.0.0",
        last_synced: "",
        items: {},
      };

      const output = formatSkillsTable(skills, manifest, "claude-code");

      expect(output).toContain("no-desc");
      expect(output).toContain("-");
    });

    it("should handle empty skills list", () => {
      const skills: Skill[] = [];
      const manifest: Manifest = {
        version: "1.0.0",
        last_synced: "",
        items: {},
      };

      const output = formatSkillsTable(skills, manifest, "claude-code");

      expect(output).toContain("0 items");
      expect(output).toContain("No skills found");
    });

    it("should truncate long descriptions", () => {
      const skills: Skill[] = [
        {
          name: "long-desc",
          content:
            "# Long Description\n\nThis is a very long description that should be truncated in the table output to fit properly",
          hash: "hash456",
        },
      ];

      const manifest: Manifest = {
        version: "1.0.0",
        last_synced: "",
        items: {},
      };

      const output = formatSkillsTable(skills, manifest, "claude-code");

      expect(output).toContain("long-desc");
      expect(output.length).toBeLessThan(600); // Should be reasonably sized with table formatting
    });

    it("should show not synced when skill has no targets", () => {
      const skills: Skill[] = [
        {
          name: "unsynced",
          content: "# Unsynced",
          hash: "hash789",
        },
      ];

      const manifest: Manifest = {
        version: "1.0.0",
        last_synced: "",
        items: {},
      };

      const output = formatSkillsTable(skills, manifest, "claude-code");

      expect(output).toContain("Not synced");
    });
  });

  describe("formatMCPTable", () => {
    it("should format MCP servers in table format", () => {
      const mcpServers: MCPServer[] = [
        {
          name: "postgres",
          type: "stdio",
          command: "npx",
          args: ["-y", "@modelcontextprotocol/server-postgres"],
          hash: "mcp123hash",
        },
        {
          name: "sqlite",
          type: "stdio",
          command: "uvx",
          args: ["mcp-server-sqlite"],
          hash: "mcp456hash",
        },
      ];

      const output = formatMCPTable(mcpServers, sampleManifest, "claude-code");

      expect(output).toContain("MCP Servers");
      expect(output).toContain("2 items");
      expect(output).toContain("Source: claude-code");
      expect(output).toContain("postgres");
      expect(output).toContain("sqlite");
      expect(output).toContain("stdio");
      expect(output).toContain("npx");
      expect(output).toContain("uvx");
    });

    it("should show synced targets for each MCP server", () => {
      const mcpServers: MCPServer[] = [
        {
          name: "postgres",
          type: "stdio",
          command: "npx",
          hash: "mcp123hash",
        },
      ];

      const output = formatMCPTable(mcpServers, sampleManifest, "claude-code");

      expect(output).toContain("cursor");
    });

    it("should handle empty MCP servers list", () => {
      const mcpServers: MCPServer[] = [];
      const manifest: Manifest = {
        version: "1.0.0",
        last_synced: "",
        items: {},
      };

      const output = formatMCPTable(mcpServers, manifest, "claude-code");

      expect(output).toContain("0 items");
      expect(output).toContain("No MCP servers found");
    });

    it("should show command with args", () => {
      const mcpServers: MCPServer[] = [
        {
          name: "postgres",
          type: "stdio",
          command: "npx",
          args: ["-y", "@modelcontextprotocol/server-postgres"],
          hash: "mcp123hash",
        },
      ];

      const manifest: Manifest = {
        version: "1.0.0",
        last_synced: "",
        items: {},
      };

      const output = formatMCPTable(mcpServers, manifest, "claude-code");

      // Command may be truncated in table
      expect(output).toContain("npx -y @modelcontextprotocol/serv");
    });

    it("should handle HTTP type servers with URL", () => {
      const mcpServers: MCPServer[] = [
        {
          name: "weather",
          type: "http",
          url: "https://api.weather.com/mcp",
          hash: "http123hash",
        },
      ];

      const manifest: Manifest = {
        version: "1.0.0",
        last_synced: "",
        items: {},
      };

      const output = formatMCPTable(mcpServers, manifest, "claude-code");

      expect(output).toContain("weather");
      expect(output).toContain("http");
      expect(output).toContain("https://api.weather.com/mcp");
    });

    it("should show not synced when MCP has no targets", () => {
      const mcpServers: MCPServer[] = [
        {
          name: "unsynced",
          type: "stdio",
          command: "test",
          hash: "hash999",
        },
      ];

      const manifest: Manifest = {
        version: "1.0.0",
        last_synced: "",
        items: {},
      };

      const output = formatMCPTable(mcpServers, manifest, "claude-code");

      expect(output).toContain("Not synced");
    });
  });
});
