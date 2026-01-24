import { describe, it, expect, beforeEach, afterEach } from "vitest";
import mockFs from "mock-fs";
import { readFile, readdir } from "node:fs/promises";
import { CursorAdapter } from "../../src/adapters/cursor.js";
import type { Skill, MCPServer } from "../../src/types/models.js";

describe("CursorAdapter", () => {
  let adapter: CursorAdapter;

  beforeEach(() => {
    mockFs({
      "/project": {
        ".cursor": {
          skills: {},
        },
        "mcp.json": JSON.stringify({
          mcpServers: {
            existing: {
              command: "existing-command",
            },
          },
        }),
      },
      "/empty": {},
    });

    adapter = new CursorAdapter({
      tool: "cursor",
      baseDir: "/project",
    });
  });

  afterEach(() => {
    mockFs.restore();
  });

  describe("writeSkills", () => {
    it("should write skills to .cursor/skills/", async () => {
      const skills: Skill[] = [
        {
          name: "test-skill",
          description: "A test skill",
          content: "# Test Skill\n\nSkill content here.",
          metadata: { version: "1.0.0", author: "Test" },
          hash: "abc123",
        },
      ];

      const result = await adapter.writeSkills(skills);

      expect(result.success).toBe(true);
      expect(result.count).toBe(1);

      // Verify SKILL.md was created
      const skillMd = await readFile(
        "/project/.cursor/skills/test-skill/SKILL.md",
        "utf-8",
      );
      expect(skillMd).toContain("---");
      expect(skillMd).toContain("description: A test skill");
      expect(skillMd).toContain("version: 1.0.0");
      expect(skillMd).toContain("# Test Skill");
    });

    it("should write skills with support files", async () => {
      const skills: Skill[] = [
        {
          name: "complex-skill",
          content: "# Complex Skill",
          supportFiles: {
            "template.md": "Template content",
            "config.json": '{"key": "value"}',
          },
          hash: "def456",
        },
      ];

      const result = await adapter.writeSkills(skills);

      expect(result.success).toBe(true);

      // Verify support files were created
      const template = await readFile(
        "/project/.cursor/skills/complex-skill/template.md",
        "utf-8",
      );
      expect(template).toBe("Template content");

      const config = await readFile(
        "/project/.cursor/skills/complex-skill/config.json",
        "utf-8",
      );
      expect(config).toBe('{"key": "value"}');
    });

    it("should handle skills without frontmatter metadata", async () => {
      const skills: Skill[] = [
        {
          name: "simple-skill",
          content: "Simple content",
          hash: "ghi789",
        },
      ];

      const result = await adapter.writeSkills(skills);

      expect(result.success).toBe(true);

      const skillMd = await readFile(
        "/project/.cursor/skills/simple-skill/SKILL.md",
        "utf-8",
      );
      expect(skillMd).toBe("Simple content");
    });

    it("should create .cursor/skills directory if missing", async () => {
      const emptyAdapter = new CursorAdapter({
        tool: "cursor",
        baseDir: "/empty",
      });

      const skills: Skill[] = [
        {
          name: "new-skill",
          content: "Content",
          hash: "jkl012",
        },
      ];

      const result = await emptyAdapter.writeSkills(skills);

      expect(result.success).toBe(true);

      const skillMd = await readFile(
        "/empty/.cursor/skills/new-skill/SKILL.md",
        "utf-8",
      );
      expect(skillMd).toBe("Content");
    });
  });

  describe("writeMCPServers", () => {
    it("should write stdio MCP servers", async () => {
      const servers: MCPServer[] = [
        {
          name: "postgres",
          type: "stdio",
          command: "npx",
          args: ["-y", "@modelcontextprotocol/server-postgres"],
          env: {
            DATABASE_URL: "${env:DATABASE_URL}",
          },
          hash: "mno345",
        },
      ];

      const result = await adapter.writeMCPServers(servers);

      expect(result.success).toBe(true);
      expect(result.count).toBe(1);

      const mcpJson = await readFile("/project/.cursor/mcp.json", "utf-8");
      const config = JSON.parse(mcpJson);

      expect(config.mcpServers.postgres).toBeDefined();
      expect(config.mcpServers.postgres.command).toBe("npx");
      expect(config.mcpServers.postgres.args).toEqual([
        "-y",
        "@modelcontextprotocol/server-postgres",
      ]);
      expect(config.mcpServers.postgres.env.DATABASE_URL).toBe(
        "${env:DATABASE_URL}",
      );
    });

    it("should preserve environment variable formats", async () => {
      const servers: MCPServer[] = [
        {
          name: "test",
          type: "stdio",
          command: "test-command",
          env: {
            TOKEN: "${env:GITHUB_TOKEN}",
            PATH: "${workspaceFolder}/bin",
            HOME: "${userHome}",
          },
          hash: "pqr678",
        },
      ];

      await adapter.writeMCPServers(servers);

      const mcpJson = await readFile("/project/.cursor/mcp.json", "utf-8");
      const config = JSON.parse(mcpJson);

      expect(config.mcpServers.test.env.TOKEN).toBe("${env:GITHUB_TOKEN}");
      expect(config.mcpServers.test.env.PATH).toBe("${workspaceFolder}/bin");
      expect(config.mcpServers.test.env.HOME).toBe("${userHome}");
    });

    it("should write HTTP MCP servers", async () => {
      const servers: MCPServer[] = [
        {
          name: "remote-api",
          type: "http",
          url: "https://api.example.com/mcp",
          headers: {
            Authorization: "Bearer ${env:API_TOKEN}",
          },
          hash: "stu901",
        },
      ];

      const result = await adapter.writeMCPServers(servers);

      expect(result.success).toBe(true);

      const mcpJson = await readFile("/project/.cursor/mcp.json", "utf-8");
      const config = JSON.parse(mcpJson);

      expect(config.mcpServers["remote-api"].url).toBe(
        "https://api.example.com/mcp",
      );
      expect(config.mcpServers["remote-api"].headers.Authorization).toBe(
        "Bearer ${env:API_TOKEN}",
      );
    });

    it("should write OAuth MCP servers", async () => {
      const servers: MCPServer[] = [
        {
          name: "oauth-service",
          type: "oauth",
          url: "https://oauth.example.com/mcp",
          auth: {
            client_id: "${env:CLIENT_ID}",
            client_secret: "${env:CLIENT_SECRET}",
            token_url: "https://oauth.example.com/token",
          },
          hash: "vwx234",
        },
      ];

      const result = await adapter.writeMCPServers(servers);

      expect(result.success).toBe(true);

      const mcpJson = await readFile("/project/.cursor/mcp.json", "utf-8");
      const config = JSON.parse(mcpJson);

      expect(config.mcpServers["oauth-service"].auth).toBeDefined();
      expect(config.mcpServers["oauth-service"].auth.client_id).toBe(
        "${env:CLIENT_ID}",
      );
    });

    it("should create .cursor/mcp.json if missing", async () => {
      mockFs({
        "/empty": {},
      });

      const emptyAdapter = new CursorAdapter({
        tool: "cursor",
        baseDir: "/empty",
      });

      const servers: MCPServer[] = [
        {
          name: "new-server",
          type: "stdio",
          command: "new-command",
          hash: "yz567",
        },
      ];

      const result = await emptyAdapter.writeMCPServers(servers);

      expect(result.success).toBe(true);

      const mcpJson = await readFile("/empty/.cursor/mcp.json", "utf-8");
      const config = JSON.parse(mcpJson);

      expect(config.mcpServers["new-server"]).toBeDefined();
    });

    it("should handle servers without optional fields", async () => {
      const servers: MCPServer[] = [
        {
          name: "minimal",
          type: "stdio",
          command: "minimal-command",
          hash: "abc890",
        },
      ];

      const result = await adapter.writeMCPServers(servers);

      expect(result.success).toBe(true);

      const mcpJson = await readFile("/project/.cursor/mcp.json", "utf-8");
      const config = JSON.parse(mcpJson);

      expect(config.mcpServers.minimal.command).toBe("minimal-command");
      expect(config.mcpServers.minimal.args).toBeUndefined();
      expect(config.mcpServers.minimal.env).toBeUndefined();
    });
  });

  describe("deleteSkill", () => {
    beforeEach(async () => {
      // Create a skill to delete
      await adapter.writeSkills([
        {
          name: "to-delete",
          content: "Content",
          hash: "del123",
        },
      ]);
    });

    it("should delete skill directory", async () => {
      await adapter.deleteSkill("to-delete");

      const dirs = await readdir("/project/.cursor/skills");
      expect(dirs).not.toContain("to-delete");
    });

    it("should handle deleting non-existent skill", async () => {
      await expect(
        adapter.deleteSkill("non-existent"),
      ).resolves.not.toThrow();
    });
  });

  describe("deleteMCPServer", () => {
    it("should remove MCP server from config", async () => {
      // First add a server
      await adapter.writeMCPServers([
        {
          name: "to-remove",
          type: "stdio",
          command: "test",
          hash: "rem456",
        },
      ]);

      // Then delete it
      await adapter.deleteMCPServer("to-remove");

      const mcpJson = await readFile("/project/.cursor/mcp.json", "utf-8");
      const config = JSON.parse(mcpJson);

      expect(config.mcpServers["to-remove"]).toBeUndefined();
    });

    it("should handle deleting non-existent server", async () => {
      await expect(
        adapter.deleteMCPServer("non-existent"),
      ).resolves.not.toThrow();
    });

    it("should preserve other servers when deleting", async () => {
      await adapter.writeMCPServers([
        {
          name: "keep-this",
          type: "stdio",
          command: "keep",
          hash: "keep789",
        },
        {
          name: "delete-this",
          type: "stdio",
          command: "delete",
          hash: "del012",
        },
      ]);

      await adapter.deleteMCPServer("delete-this");

      const mcpJson = await readFile("/project/.cursor/mcp.json", "utf-8");
      const config = JSON.parse(mcpJson);

      expect(config.mcpServers["keep-this"]).toBeDefined();
      expect(config.mcpServers["delete-this"]).toBeUndefined();
    });
  });

  describe("validate", () => {
    it("should validate existing configuration", async () => {
      const result = await adapter.validate();

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should warn when .cursor directory missing", async () => {
      const emptyAdapter = new CursorAdapter({
        tool: "cursor",
        baseDir: "/empty",
      });

      const result = await emptyAdapter.validate();

      expect(result.warnings).toBeDefined();
      expect(result.warnings?.some((w) => w.includes(".cursor"))).toBe(true);
    });

    it("should warn when mcp.json missing", async () => {
      mockFs({
        "/project": {
          ".cursor": {
            skills: {},
          },
        },
      });

      const result = await adapter.validate();

      expect(result.warnings).toBeDefined();
      expect(result.warnings?.some((w) => w.includes("mcp.json"))).toBe(true);
    });
  });

  describe("read methods", () => {
    it("should throw error for readSkills (write-only)", async () => {
      await expect(adapter.readSkills()).rejects.toThrow(
        "Cursor adapter is write-only",
      );
    });

    it("should throw error for readMCPServers (write-only)", async () => {
      await expect(adapter.readMCPServers()).rejects.toThrow(
        "Cursor adapter is write-only",
      );
    });
  });
});
