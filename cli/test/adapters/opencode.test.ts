import { readFile, readdir } from "node:fs/promises";
import * as jsonc from "jsonc-parser";
import mockFs from "mock-fs";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { OpenCodeAdapter } from "@src/adapters/opencode.js";
import type { Skill, MCPServer, Agent, Command } from "@src/types/models.js";

describe("OpenCodeAdapter", () => {
  let adapter: OpenCodeAdapter;

  beforeEach(() => {
    mockFs({
      "/project": {
        ".opencode": {
          skills: {},
        },
        "opencode.jsonc": `{
  // OpenCode configuration
  "mcp": {
    /* Existing server */
    "existing": {
      "type": "local",
      "command": ["existing-command"]
    }
  },
  // Other settings
  "editor": {
    "fontSize": 14
  }
}`,
      },
      "/empty": {},
    });

    adapter = new OpenCodeAdapter({
      tool: "opencode",
      baseDir: "/project",
      level: "project",
    });
  });

  afterEach(() => {
    mockFs.restore();
  });

  describe("writeSkills", () => {
    it("should write skills to .opencode/skills/", async () => {
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
        "/project/.opencode/skills/test-skill/SKILL.md",
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
            "scripts/helper.sh": "echo helper",
          },
          hash: "def456",
        },
      ];

      const result = await adapter.writeSkills(skills);

      expect(result.success).toBe(true);

      // Verify support files were created
      const template = await readFile(
        "/project/.opencode/skills/complex-skill/template.md",
        "utf-8",
      );
      expect(template).toBe("Template content");

      const config = await readFile(
        "/project/.opencode/skills/complex-skill/config.json",
        "utf-8",
      );
      expect(config).toBe('{"key": "value"}');

      const helper = await readFile(
        "/project/.opencode/skills/complex-skill/scripts/helper.sh",
        "utf-8",
      );
      expect(helper).toBe("echo helper");
    });

    it("should create .opencode/skills directory if missing", async () => {
      const emptyAdapter = new OpenCodeAdapter({
        tool: "opencode",
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
        "/empty/.opencode/skills/new-skill/SKILL.md",
        "utf-8",
      );
      expect(skillMd).toBe("Content");
    });
  });

  describe("writeMCPServers", () => {
    it("should write servers to mcp field (not mcpServers)", async () => {
      const servers: MCPServer[] = [
        {
          name: "postgres",
          type: "stdio",
          command: "npx",
          args: ["-y", "@modelcontextprotocol/server-postgres"],
          hash: "mno345",
        },
      ];

      const result = await adapter.writeMCPServers(servers);

      expect(result.success).toBe(true);
      expect(result.count).toBe(1);

      const jsoncText = await readFile("/project/opencode.jsonc", "utf-8");
      expect(jsoncText).toContain('"mcp"');
      expect(jsoncText).not.toContain('"mcpServers"');

      // Parse and verify structure
      const config = jsonc.parse(jsoncText);
      expect(config.mcp.postgres).toBeDefined();
      expect(config.mcp.postgres.command).toEqual([
        "npx",
        "-y",
        "@modelcontextprotocol/server-postgres",
      ]);
    });

    it("should add type field to all servers", async () => {
      const servers: MCPServer[] = [
        {
          name: "stdio-server",
          type: "stdio",
          command: "stdio-cmd",
          hash: "pqr678",
        },
        {
          name: "http-server",
          type: "http",
          url: "https://api.example.com",
          hash: "stu901",
        },
      ];

      await adapter.writeMCPServers(servers);

      const jsoncText = await readFile("/project/opencode.jsonc", "utf-8");
      const config = jsonc.parse(jsoncText);

      expect(config.mcp["stdio-server"].type).toBe("local");
      expect(config.mcp["http-server"].type).toBe("remote");
    });

    it("should convert environment variable format to {env:VAR}", async () => {
      const servers: MCPServer[] = [
        {
          name: "test",
          type: "stdio",
          command: "test-command",
          env: {
            TOKEN: "${env:GITHUB_TOKEN}",
            API_KEY: "${env:API_KEY}",
          },
          hash: "vwx234",
        },
      ];

      await adapter.writeMCPServers(servers);

      const jsoncText = await readFile("/project/opencode.jsonc", "utf-8");
      const config = jsonc.parse(jsoncText);

      expect(config.mcp.test.environment.TOKEN).toBe("{env:GITHUB_TOKEN}");
      expect(config.mcp.test.environment.API_KEY).toBe("{env:API_KEY}");
    });

    it("should preserve JSONC comments", async () => {
      const servers: MCPServer[] = [
        {
          name: "new-server",
          type: "stdio",
          command: "new-command",
          hash: "yz567",
        },
      ];

      await adapter.writeMCPServers(servers);

      const jsoncText = await readFile("/project/opencode.jsonc", "utf-8");

      // Verify original comments are preserved
      expect(jsoncText).toContain("// OpenCode configuration");
      expect(jsoncText).toContain("/* Existing server */");
      expect(jsoncText).toContain("// Other settings");
    });

    it("should preserve other config fields (editor settings)", async () => {
      const servers: MCPServer[] = [
        {
          name: "new-server",
          type: "stdio",
          command: "new-command",
          hash: "abc890",
        },
      ];

      await adapter.writeMCPServers(servers);

      const jsoncText = await readFile("/project/opencode.jsonc", "utf-8");
      const config = jsonc.parse(jsoncText);

      // Verify editor settings are preserved
      expect(config.editor).toBeDefined();
      expect(config.editor.fontSize).toBe(14);
    });

    it("should preserve existing MCP servers", async () => {
      const servers: MCPServer[] = [
        {
          name: "new-server",
          type: "stdio",
          command: "new-command",
          hash: "def123",
        },
      ];

      await adapter.writeMCPServers(servers);

      const jsoncText = await readFile("/project/opencode.jsonc", "utf-8");
      const config = jsonc.parse(jsoncText);

      // Verify existing server is preserved
      expect(config.mcp.existing).toBeDefined();
      expect(config.mcp.existing.command).toEqual(["existing-command"]);

      // Verify new server is added
      expect(config.mcp["new-server"]).toBeDefined();
    });

    it("should create opencode.json if missing", async () => {
      mockFs({
        "/empty": {},
      });

      const emptyAdapter = new OpenCodeAdapter({
        tool: "opencode",
        baseDir: "/empty",
        level: "project",
      });

      const servers: MCPServer[] = [
        {
          name: "new-server",
          type: "stdio",
          command: "new-command",
          hash: "ghi456",
        },
      ];

      const result = await emptyAdapter.writeMCPServers(servers);

      expect(result.success).toBe(true);

      const jsonText = await readFile("/empty/opencode.json", "utf-8");
      const config = jsonc.parse(jsonText);

      expect(config.mcp["new-server"]).toBeDefined();
    });

    it("should write user config to .opencode/opencode.json", async () => {
      mockFs({
        "/home": {
          ".opencode": {},
        },
      });

      const userAdapter = new OpenCodeAdapter({
        tool: "opencode",
        baseDir: "/home",
        level: "user",
      });

      const servers: MCPServer[] = [
        {
          name: "user-server",
          type: "stdio",
          command: "user-command",
          hash: "user123",
        },
      ];

      const result = await userAdapter.writeMCPServers(servers);

      expect(result.success).toBe(true);

      const jsonText = await readFile("/home/.opencode/opencode.json", "utf-8");
      const config = jsonc.parse(jsonText);

      expect(config.mcp["user-server"]).toBeDefined();
    });

    it("should map OAuth type to remote", async () => {
      const servers: MCPServer[] = [
        {
          name: "oauth-server",
          type: "oauth",
          url: "https://oauth.example.com",
          auth: {
            client_id: "${CLIENT_ID}",
            client_secret: "${CLIENT_SECRET}",
            scopes: ["tools:read", "tools:write"],
          },
          hash: "jkl789",
        },
      ];

      await adapter.writeMCPServers(servers);

      const jsoncText = await readFile("/project/opencode.jsonc", "utf-8");
      const config = jsonc.parse(jsoncText);

      expect(config.mcp["oauth-server"].type).toBe("remote");
      expect(config.mcp["oauth-server"].oauth.clientId).toBe("{env:CLIENT_ID}");
      expect(config.mcp["oauth-server"].oauth.clientSecret).toBe(
        "{env:CLIENT_SECRET}",
      );
      expect(config.mcp["oauth-server"].oauth.scope).toBe(
        "tools:read tools:write",
      );
    });

    it("should handle servers without env vars", async () => {
      const servers: MCPServer[] = [
        {
          name: "simple",
          type: "stdio",
          command: "simple-command",
          args: ["--flag"],
          hash: "mno012",
        },
      ];

      const result = await adapter.writeMCPServers(servers);

      expect(result.success).toBe(true);

      const jsoncText = await readFile("/project/opencode.jsonc", "utf-8");
      const config = jsonc.parse(jsoncText);

      expect(config.mcp.simple.command).toEqual(["simple-command", "--flag"]);
    });

    it("should handle nested env var conversions in complex objects", async () => {
      const servers: MCPServer[] = [
        {
          name: "complex",
          type: "http",
          url: "https://api.example.com",
          headers: {
            Authorization: "Bearer ${env:API_TOKEN}",
            "X-Custom": "${env:CUSTOM_HEADER}",
          },
          hash: "pqr345",
        },
      ];

      await adapter.writeMCPServers(servers);

      const jsoncText = await readFile("/project/opencode.jsonc", "utf-8");
      const config = jsonc.parse(jsoncText);

      expect(config.mcp.complex.headers.Authorization).toBe(
        "Bearer {env:API_TOKEN}",
      );
      expect(config.mcp.complex.headers["X-Custom"]).toBe(
        "{env:CUSTOM_HEADER}",
      );
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

      const dirs = await readdir("/project/.opencode/skills");
      expect(dirs).not.toContain("to-delete");
    });

    it("should handle deleting non-existent skill", async () => {
      await expect(adapter.deleteSkill("non-existent")).resolves.not.toThrow();
    });
  });

  describe("deleteMCPServer", () => {
    it("should remove MCP server from mcp object", async () => {
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

      const jsoncText = await readFile("/project/opencode.jsonc", "utf-8");
      const config = jsonc.parse(jsoncText);

      expect(config.mcp["to-remove"]).toBeUndefined();
    });

    it("should preserve JSONC comments when deleting", async () => {
      await adapter.writeMCPServers([
        {
          name: "temp",
          type: "stdio",
          command: "temp",
          hash: "temp789",
        },
      ]);

      await adapter.deleteMCPServer("temp");

      const jsoncText = await readFile("/project/opencode.jsonc", "utf-8");

      // Verify comments are still there
      expect(jsoncText).toContain("// OpenCode configuration");
      expect(jsoncText).toContain("// Other settings");
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
          hash: "keep012",
        },
        {
          name: "delete-this",
          type: "stdio",
          command: "delete",
          hash: "del345",
        },
      ]);

      await adapter.deleteMCPServer("delete-this");

      const jsoncText = await readFile("/project/opencode.jsonc", "utf-8");
      const config = jsonc.parse(jsoncText);

      expect(config.mcp["keep-this"]).toBeDefined();
      expect(config.mcp["delete-this"]).toBeUndefined();
    });
  });

  describe("readMCPServers", () => {
    it("should map OpenCode types and fields", async () => {
      mockFs.restore();
      mockFs({
        "/project": {
          "opencode.json": `{
  "mcp": {
    "stdio": {
      "type": "local",
      "command": ["npx", "-y", "server"],
      "environment": {
        "TOKEN": "{env:API_TOKEN}"
      }
    },
    "http": {
      "type": "remote",
      "url": "https://api.example.com/mcp",
      "headers": {
        "Authorization": "Bearer token"
      }
    },
    "oauth": {
      "type": "remote",
      "url": "https://oauth.example.com/mcp",
      "oauth": {
        "clientId": "{env:CLIENT_ID}",
        "clientSecret": "{env:CLIENT_SECRET}",
        "scope": "tools:read tools:write"
      }
    }
  }
}`,
        },
      });

      const readAdapter = new OpenCodeAdapter({
        tool: "opencode",
        baseDir: "/project",
        level: "project",
      });

      const servers = await readAdapter.readMCPServers();

      const stdio = servers.find((server) => server.name === "stdio");
      const http = servers.find((server) => server.name === "http");
      const oauth = servers.find((server) => server.name === "oauth");

      expect(stdio?.type).toBe("stdio");
      expect(stdio?.command).toBe("npx");
      expect(stdio?.args).toEqual(["-y", "server"]);
      expect(stdio?.env?.TOKEN).toBe("${API_TOKEN}");
      expect(http?.type).toBe("http");
      expect(http?.url).toBe("https://api.example.com/mcp");
      expect(oauth?.type).toBe("oauth");
      expect(oauth?.auth?.client_id).toBe("${CLIENT_ID}");
      expect(oauth?.auth?.client_secret).toBe("${CLIENT_SECRET}");
      expect(oauth?.auth?.scopes).toEqual(["tools:read", "tools:write"]);
    });
  });

  describe("Agents", () => {
    it("should write agents to .opencode/agents/*.md", async () => {
      const agents: Agent[] = [
        {
          name: "security-auditor",
          description: "Security auditor",
          content: "Agent content",
          hash: "agent-hash",
        },
      ];

      const result = await adapter.writeAgents(agents);

      expect(result.success).toBe(true);
      expect(result.count).toBe(1);

      const agentMd = await readFile(
        "/project/.opencode/agents/security-auditor.md",
        "utf-8",
      );
      expect(agentMd).toContain("description: Security auditor");
      expect(agentMd).toContain("Agent content");
    });

    it("should read agents from .opencode/agents/*.md", async () => {
      mockFs.restore();
      mockFs({
        "/project": {
          ".opencode": {
            agents: {
              "security-auditor.md": `---
description: Security auditor
---
Agent content`,
              "notes.txt": "Ignore me",
            },
          },
        },
      });

      const readAdapter = new OpenCodeAdapter({
        tool: "opencode",
        baseDir: "/project",
        level: "project",
      });

      const agents = await readAdapter.readAgents();

      expect(agents).toHaveLength(1);
      expect(agents[0]!.name).toBe("security-auditor");
      expect(agents[0]!.content).toBe("Agent content");
    });
  });

  describe("Commands", () => {
    it("should write commands to .opencode/commands/*.md", async () => {
      const commands: Command[] = [
        {
          name: "deploy",
          description: "Deploy command",
          content: "Command content",
          hash: "command-hash",
        },
      ];

      const result = await adapter.writeCommands(commands);

      expect(result.success).toBe(true);
      expect(result.count).toBe(1);

      const commandMd = await readFile(
        "/project/.opencode/commands/deploy.md",
        "utf-8",
      );
      expect(commandMd).toContain("description: Deploy command");
      expect(commandMd).toContain("Command content");
    });

    it("should read commands from .opencode/commands/*.md", async () => {
      mockFs.restore();
      mockFs({
        "/project": {
          ".opencode": {
            commands: {
              "deploy.md": `---
description: Deploy command
---
Command content`,
              "notes.txt": "Ignore me",
            },
          },
        },
      });

      const readAdapter = new OpenCodeAdapter({
        tool: "opencode",
        baseDir: "/project",
        level: "project",
      });

      const commands = await readAdapter.readCommands();

      expect(commands).toHaveLength(1);
      expect(commands[0]!.name).toBe("deploy");
      expect(commands[0]!.content).toBe("Command content");
    });
  });

  describe("validate", () => {
    it("should validate existing configuration", async () => {
      const result = await adapter.validate();

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should warn when .opencode directory missing", async () => {
      const emptyAdapter = new OpenCodeAdapter({
        tool: "opencode",
        baseDir: "/empty",
        level: "project",
      });

      const result = await emptyAdapter.validate();

      expect(result.warnings).toBeDefined();
      expect(result.warnings?.some((w) => w.includes(".opencode"))).toBe(true);
    });

    it("should warn when opencode.json is missing", async () => {
      mockFs({
        "/project": {
          ".opencode": {
            skills: {},
          },
        },
      });

      const result = await adapter.validate();

      expect(result.warnings).toBeDefined();
      expect(result.warnings?.some((w) => w.includes("opencode.json"))).toBe(
        true,
      );
    });
  });
});
