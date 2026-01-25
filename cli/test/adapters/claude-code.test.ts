import mockFs from "mock-fs";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { ClaudeCodeAdapter } from "@src/adapters/claude-code.js";
import type { MCPServer } from "@src/types/models.js";
import * as fileOps from "@src/utils/file-ops.js";

describe("ClaudeCodeAdapter", () => {
  let adapter: ClaudeCodeAdapter;

  beforeEach(() => {
    mockFs({
      "/project": {
        ".claude": {
          skills: {
            "git-release": {
              "SKILL.md": `---
name: git-release
description: Create releases and changelogs
version: 1.0.0
---

# Git Release Skill

This skill helps create releases.`,
              "template.md": "Release template content",
              scripts: {
                "helper.sh": "echo helper",
              },
            },
            "code-review": {
              "SKILL.md": `# Code Review

No frontmatter, just content.`,
            },
          },
        },
        ".mcp.json": JSON.stringify({
          mcpServers: {
            postgres: {
              command: "npx",
              args: ["-y", "@modelcontextprotocol/server-postgres"],
              env: {
                DATABASE_URL: "${env:DATABASE_URL}",
              },
            },
            sqlite: {
              command: "mcp-server-sqlite",
              env: {
                DB_PATH: "${workspaceFolder}/data.db",
              },
            },
          },
        }),
      },
      "/empty": {},
    });

    adapter = new ClaudeCodeAdapter({
      tool: "claude-code",
      baseDir: "/project",
      level: "project",
    });
  });

  afterEach(() => {
    mockFs.restore();
  });

  describe("readSkills", () => {
    it("should read skills with frontmatter", async () => {
      const skills = await adapter.readSkills();

      const gitRelease = skills.find((s) => s.name === "git-release");
      expect(gitRelease).toBeDefined();
      expect(gitRelease?.description).toBe("Create releases and changelogs");
      expect(gitRelease?.metadata?.version).toBe("1.0.0");
      expect(gitRelease?.content).toContain("# Git Release Skill");
      expect(gitRelease?.hash).toBeTruthy();
      expect(gitRelease?.hash).toHaveLength(64);
    });

    it("should read skills without frontmatter", async () => {
      const skills = await adapter.readSkills();

      const codeReview = skills.find((s) => s.name === "code-review");
      expect(codeReview).toBeDefined();
      expect(codeReview?.description).toBeUndefined();
      expect(codeReview?.content).toContain("# Code Review");
      expect(codeReview?.hash).toBeTruthy();
    });

    it("should include support files", async () => {
      const skills = await adapter.readSkills();

      const gitRelease = skills.find((s) => s.name === "git-release");
      expect(gitRelease?.supportFiles).toBeDefined();
      expect(gitRelease?.supportFiles?.["template.md"]).toBe(
        "Release template content",
      );
      expect(gitRelease?.supportFiles?.["scripts/helper.sh"]).toBe(
        "echo helper",
      );
    });

    it("should return empty array when no skills directory", async () => {
      const emptyAdapter = new ClaudeCodeAdapter({
        tool: "claude-code",
        baseDir: "/empty",
        level: "project",
      });

      const skills = await emptyAdapter.readSkills();
      expect(skills).toEqual([]);
    });

    it("should skip non-directory entries", async () => {
      mockFs({
        "/project": {
          ".claude": {
            skills: {
              skill1: {
                "SKILL.md": "# Skill 1",
              },
              "not-a-dir.txt": "some file",
            },
          },
        },
      });

      const skills = await adapter.readSkills();
      expect(skills).toHaveLength(1);
      expect(skills[0]?.name).toBe("skill1");
    });

    it("should handle missing SKILL.md gracefully", async () => {
      mockFs({
        "/project": {
          ".claude": {
            skills: {
              "incomplete-skill": {
                "other-file.txt": "content",
              },
            },
          },
        },
      });

      const skills = await adapter.readSkills();
      expect(skills).toEqual([]);
    });
  });

  describe("readMCPServers", () => {
    it("should read MCP servers from .mcp.json", async () => {
      const servers = await adapter.readMCPServers();

      expect(servers).toHaveLength(2);
      expect(servers.map((s) => s.name)).toContain("postgres");
      expect(servers.map((s) => s.name)).toContain("sqlite");
    });

    it("should preserve environment variables", async () => {
      const servers = await adapter.readMCPServers();

      const postgres = servers.find((s) => s.name === "postgres");
      expect(postgres?.env?.DATABASE_URL).toBe("${env:DATABASE_URL}");
    });

    it("should preserve ${workspaceFolder} variables", async () => {
      const servers = await adapter.readMCPServers();

      const sqlite = servers.find((s) => s.name === "sqlite");
      expect(sqlite?.env?.DB_PATH).toBe("${workspaceFolder}/data.db");
    });

    it("should set type to stdio for all Claude Code servers", async () => {
      const servers = await adapter.readMCPServers();

      servers.forEach((server) => {
        expect(server.type).toBe("stdio");
      });
    });

    it("should compute hash for each server", async () => {
      const servers = await adapter.readMCPServers();

      servers.forEach((server) => {
        expect(server.hash).toBeTruthy();
        expect(server.hash).toHaveLength(64);
      });
    });

    it("should return empty array when .mcp.json missing", async () => {
      const emptyAdapter = new ClaudeCodeAdapter({
        tool: "claude-code",
        baseDir: "/empty",
        level: "project",
      });

      const servers = await emptyAdapter.readMCPServers();
      expect(servers).toEqual([]);
    });

    it("should read user-level MCP servers from .claude.json", async () => {
      mockFs.restore();
      mockFs({
        "/home/user": {
          ".claude.json": JSON.stringify({
            mcpServers: {
              userPostgres: {
                command: "npx",
                args: ["-y", "@modelcontextprotocol/server-postgres"],
              },
            },
          }),
        },
      });

      const userAdapter = new ClaudeCodeAdapter({
        tool: "claude-code",
        baseDir: "/home/user",
        level: "user",
      });

      const servers = await userAdapter.readMCPServers();

      expect(servers).toHaveLength(1);
      expect(servers[0]?.name).toBe("userPostgres");
    });

    it("should handle invalid JSON gracefully", async () => {
      mockFs({
        "/project": {
          ".mcp.json": "{ invalid json",
        },
      });

      const servers = await adapter.readMCPServers();
      expect(servers).toEqual([]);
    });

    it("should handle empty mcpServers object", async () => {
      mockFs({
        "/project": {
          ".mcp.json": JSON.stringify({ mcpServers: {} }),
        },
      });

      const servers = await adapter.readMCPServers();
      expect(servers).toEqual([]);
    });
  });

  describe("readAgents", () => {
    it("should read agents from .claude/agents/*.md", async () => {
      mockFs.restore();
      mockFs({
        "/project": {
          ".claude": {
            agents: {
              "reviewer.md": `---
description: Code reviewer
---
Agent content`,
            },
          },
        },
      });

      const agents = await adapter.readAgents();

      expect(agents).toHaveLength(1);
      expect(agents[0]!.name).toBe("reviewer");
      expect(agents[0]!.content).toBe("Agent content");
      expect(agents[0]!.description).toBe("Code reviewer");
    });

    it("should skip non-markdown files", async () => {
      mockFs.restore();
      mockFs({
        "/project": {
          ".claude": {
            agents: {
              "reviewer.md": "Agent content",
              "notes.txt": "Ignore me",
            },
          },
        },
      });

      const agents = await adapter.readAgents();

      expect(agents).toHaveLength(1);
      expect(agents[0]!.name).toBe("reviewer");
    });
  });

  describe("readCommands", () => {
    it("should read commands from .claude/commands/*.md", async () => {
      mockFs.restore();
      mockFs({
        "/project": {
          ".claude": {
            commands: {
              "quick-review.md": `---
description: Quick review
---
Command content`,
            },
          },
        },
      });

      const commands = await adapter.readCommands();

      expect(commands).toHaveLength(1);
      expect(commands[0]!.name).toBe("quick-review");
      expect(commands[0]!.content).toBe("Command content");
      expect(commands[0]!.description).toBe("Quick review");
    });

    it("should skip non-markdown files", async () => {
      mockFs.restore();
      mockFs({
        "/project": {
          ".claude": {
            commands: {
              "quick-review.md": "Command content",
              "notes.txt": "Ignore me",
            },
          },
        },
      });

      const commands = await adapter.readCommands();

      expect(commands).toHaveLength(1);
      expect(commands[0]!.name).toBe("quick-review");
    });
  });

  describe("writeMCPServers", () => {
    it("should write stdio MCP servers to .mcp.json", async () => {
      const servers: MCPServer[] = [
        {
          name: "new-server",
          type: "stdio",
          command: "npx",
          args: ["-y", "new-package"],
          env: {
            API_KEY: "${env:API_KEY}",
          },
          hash: "new123",
        },
      ];

      const result = await adapter.writeMCPServers(servers);

      expect(result.success).toBe(true);
      expect(result.count).toBe(1);

      const config = await fileOps.readJSON<{
        mcpServers?: Record<string, unknown>;
      }>("/project/.mcp.json");

      expect(config).toBeDefined();
      expect(config!.mcpServers?.["new-server"]).toBeDefined();
      const serverConfig = config!.mcpServers?.["new-server"] as Record<
        string,
        unknown
      >;
      expect(serverConfig.command).toBe("npx");
      expect(serverConfig.args).toEqual(["-y", "new-package"]);
      expect((serverConfig.env as Record<string, string>).API_KEY).toBe(
        "${env:API_KEY}",
      );
    });

    it("should preserve environment variable formats", async () => {
      const servers: MCPServer[] = [
        {
          name: "env-test",
          type: "stdio",
          command: "test-command",
          env: {
            TOKEN: "${env:GITHUB_TOKEN}",
            PATH: "${workspaceFolder}/bin",
            DB_URL: "${DATABASE_URL}",
          },
          hash: "env456",
        },
      ];

      await adapter.writeMCPServers(servers);

      const config = await fileOps.readJSON<{
        mcpServers?: Record<string, unknown>;
      }>("/project/.mcp.json");

      expect(config).toBeDefined();
      const serverConfig = config!.mcpServers?.["env-test"] as Record<
        string,
        unknown
      >;
      const env = serverConfig.env as Record<string, string>;
      expect(env.TOKEN).toBe("${env:GITHUB_TOKEN}");
      expect(env.PATH).toBe("${workspaceFolder}/bin");
      expect(env.DB_URL).toBe("${DATABASE_URL}");
    });

    it("should preserve existing servers when adding new ones", async () => {
      const servers: MCPServer[] = [
        {
          name: "additional",
          type: "stdio",
          command: "additional-command",
          hash: "add789",
        },
      ];

      await adapter.writeMCPServers(servers);

      const config = await fileOps.readJSON<{
        mcpServers?: Record<string, unknown>;
      }>("/project/.mcp.json");

      expect(config).toBeDefined();
      // Existing servers should still be there
      expect(config!.mcpServers?.["postgres"]).toBeDefined();
      expect(config!.mcpServers?.["sqlite"]).toBeDefined();
      // New server should be added
      expect(config!.mcpServers?.["additional"]).toBeDefined();
    });

    it("should update existing server", async () => {
      const servers: MCPServer[] = [
        {
          name: "postgres",
          type: "stdio",
          command: "updated-command",
          args: ["--updated"],
          hash: "upd012",
        },
      ];

      await adapter.writeMCPServers(servers);

      const config = await fileOps.readJSON<{
        mcpServers?: Record<string, unknown>;
      }>("/project/.mcp.json");

      expect(config).toBeDefined();
      const serverConfig = config!.mcpServers?.["postgres"] as Record<
        string,
        unknown
      >;
      expect(serverConfig.command).toBe("updated-command");
      expect(serverConfig.args).toEqual(["--updated"]);
    });

    it("should handle servers without optional fields", async () => {
      const servers: MCPServer[] = [
        {
          name: "minimal",
          type: "stdio",
          command: "minimal-command",
          hash: "min345",
        },
      ];

      const result = await adapter.writeMCPServers(servers);

      expect(result.success).toBe(true);

      const config = await fileOps.readJSON<{
        mcpServers?: Record<string, unknown>;
      }>("/project/.mcp.json");

      expect(config).toBeDefined();
      const serverConfig = config!.mcpServers?.["minimal"] as Record<
        string,
        unknown
      >;
      expect(serverConfig.command).toBe("minimal-command");
      expect(serverConfig.args).toBeUndefined();
      expect(serverConfig.env).toBeUndefined();
    });

    it("should create .mcp.json if missing", async () => {
      const emptyAdapter = new ClaudeCodeAdapter({
        tool: "claude-code",
        baseDir: "/empty",
        level: "project",
      });

      const servers: MCPServer[] = [
        {
          name: "first-server",
          type: "stdio",
          command: "first-command",
          hash: "first678",
        },
      ];

      const result = await emptyAdapter.writeMCPServers(servers);

      expect(result.success).toBe(true);

      const config = await fileOps.readJSON<{
        mcpServers?: Record<string, unknown>;
      }>("/empty/.mcp.json");

      expect(config).toBeDefined();
      expect(config!.mcpServers?.["first-server"]).toBeDefined();
    });
  });

  describe("deleteMCPServer", () => {
    it("should remove MCP server from config", async () => {
      await adapter.deleteMCPServer("postgres");

      const config = await fileOps.readJSON<{
        mcpServers?: Record<string, unknown>;
      }>("/project/.mcp.json");

      expect(config).toBeDefined();
      expect(config!.mcpServers?.["postgres"]).toBeUndefined();
      // Other server should still exist
      expect(config!.mcpServers?.["sqlite"]).toBeDefined();
    });

    it("should handle deleting non-existent server", async () => {
      await expect(
        adapter.deleteMCPServer("non-existent"),
      ).resolves.not.toThrow();
    });

    it("should preserve other servers when deleting", async () => {
      // Add another server
      await adapter.writeMCPServers([
        {
          name: "to-delete",
          type: "stdio",
          command: "delete-me",
          hash: "del901",
        },
      ]);

      // Delete it
      await adapter.deleteMCPServer("to-delete");

      const config = await fileOps.readJSON<{
        mcpServers?: Record<string, unknown>;
      }>("/project/.mcp.json");

      expect(config).toBeDefined();
      expect(config!.mcpServers?.["to-delete"]).toBeUndefined();
      expect(config!.mcpServers?.["postgres"]).toBeDefined();
      expect(config!.mcpServers?.["sqlite"]).toBeDefined();
    });
  });
});
