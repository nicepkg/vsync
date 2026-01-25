import { readFile, readdir } from "node:fs/promises";
import mockFs from "mock-fs";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { CursorAdapter } from "@src/adapters/cursor.js";
import type { Skill, MCPServer, Agent, Command } from "@src/types/models.js";

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
      level: "project",
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
        level: "project",
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

    it("should normalize bare env placeholders to ${env:VAR}", async () => {
      const servers: MCPServer[] = [
        {
          name: "normalize-env",
          type: "stdio",
          command: "test-command",
          env: {
            TOKEN: "${GITHUB_TOKEN}",
            PATH: "${workspaceFolder}/bin",
            LOWER: "${token}",
          },
          hash: "norm123",
        },
      ];

      await adapter.writeMCPServers(servers);

      const mcpJson = await readFile("/project/.cursor/mcp.json", "utf-8");
      const config = JSON.parse(mcpJson);

      expect(config.mcpServers["normalize-env"].env.TOKEN).toBe(
        "${env:GITHUB_TOKEN}",
      );
      expect(config.mcpServers["normalize-env"].env.PATH).toBe(
        "${workspaceFolder}/bin",
      );
      expect(config.mcpServers["normalize-env"].env.LOWER).toBe("${token}");
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
            token_endpoint: "https://oauth.example.com/token",
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

    it("should normalize bare env placeholders in headers and auth", async () => {
      const servers: MCPServer[] = [
        {
          name: "remote-auth",
          type: "oauth",
          url: "https://oauth.example.com/mcp",
          headers: {
            Authorization: "Bearer ${API_TOKEN}",
          },
          auth: {
            client_id: "${CLIENT_ID}",
            client_secret: "${CLIENT_SECRET}",
          },
          hash: "hdr123",
        },
      ];

      await adapter.writeMCPServers(servers);

      const mcpJson = await readFile("/project/.cursor/mcp.json", "utf-8");
      const config = JSON.parse(mcpJson);

      expect(config.mcpServers["remote-auth"].headers.Authorization).toBe(
        "Bearer ${env:API_TOKEN}",
      );
      expect(config.mcpServers["remote-auth"].auth.client_id).toBe(
        "${env:CLIENT_ID}",
      );
      expect(config.mcpServers["remote-auth"].auth.client_secret).toBe(
        "${env:CLIENT_SECRET}",
      );
    });

    it("should create .cursor/mcp.json if missing", async () => {
      mockFs({
        "/empty": {},
      });

      const emptyAdapter = new CursorAdapter({
        tool: "cursor",
        baseDir: "/empty",
        level: "project",
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

  describe("Agents", () => {
    it("should write agents to .cursor/agents/*.md", async () => {
      const agents: Agent[] = [
        {
          name: "reviewer",
          description: "Code reviewer",
          content: "Agent content",
          hash: "agent-hash",
        },
      ];

      const result = await adapter.writeAgents(agents);

      expect(result.success).toBe(true);
      expect(result.count).toBe(1);

      const agentMd = await readFile(
        "/project/.cursor/agents/reviewer.md",
        "utf-8",
      );
      expect(agentMd).toContain("description: Code reviewer");
      expect(agentMd).toContain("Agent content");
    });

    it("should read agents from .cursor/agents/*.md", async () => {
      mockFs.restore();
      mockFs({
        "/project": {
          ".cursor": {
            agents: {
              "reviewer.md": `---
description: Code reviewer
---
Agent content`,
              "notes.txt": "Ignore me",
            },
          },
        },
      });

      const readAdapter = new CursorAdapter({
        tool: "cursor",
        baseDir: "/project",
        level: "project",
      });

      const agents = await readAdapter.readAgents();

      expect(agents).toHaveLength(1);
      expect(agents[0]!.name).toBe("reviewer");
      expect(agents[0]!.content).toBe("Agent content");
    });
  });

  describe("Commands", () => {
    it("should write commands to .cursor/commands/*.md", async () => {
      const commands: Command[] = [
        {
          name: "quick-review",
          description: "Quick review",
          content: "Command content",
          hash: "command-hash",
        },
      ];

      const result = await adapter.writeCommands(commands);

      expect(result.success).toBe(true);
      expect(result.count).toBe(1);

      const commandMd = await readFile(
        "/project/.cursor/commands/quick-review.md",
        "utf-8",
      );
      expect(commandMd).toContain("description: Quick review");
      expect(commandMd).toContain("Command content");
    });

    it("should read commands from .cursor/commands/*.md", async () => {
      mockFs.restore();
      mockFs({
        "/project": {
          ".cursor": {
            commands: {
              "quick-review.md": `---
description: Quick review
---
Command content`,
              "notes.txt": "Ignore me",
            },
          },
        },
      });

      const readAdapter = new CursorAdapter({
        tool: "cursor",
        baseDir: "/project",
        level: "project",
      });

      const commands = await readAdapter.readCommands();

      expect(commands).toHaveLength(1);
      expect(commands[0]!.name).toBe("quick-review");
      expect(commands[0]!.content).toBe("Command content");
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
      await expect(adapter.deleteSkill("non-existent")).resolves.not.toThrow();
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

  describe("readMCPServers", () => {
    it("should infer server types from config fields", async () => {
      mockFs.restore();
      mockFs({
        "/project": {
          ".cursor": {
            "mcp.json": JSON.stringify({
              mcpServers: {
                stdio: {
                  command: "npx",
                  args: ["-y", "server"],
                },
                http: {
                  url: "https://api.example.com/mcp",
                  headers: {
                    Authorization: "Bearer token",
                  },
                },
                oauth: {
                  url: "https://oauth.example.com/mcp",
                  auth: {
                    client_id: "id",
                    client_secret: "secret",
                  },
                },
              },
            }),
          },
        },
      });

      const readAdapter = new CursorAdapter({
        tool: "cursor",
        baseDir: "/project",
        level: "project",
      });

      const servers = await readAdapter.readMCPServers();

      const stdio = servers.find((server) => server.name === "stdio");
      const http = servers.find((server) => server.name === "http");
      const oauth = servers.find((server) => server.name === "oauth");

      expect(stdio?.type).toBe("stdio");
      expect(http?.type).toBe("http");
      expect(oauth?.type).toBe("oauth");
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
        level: "project",
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
});
