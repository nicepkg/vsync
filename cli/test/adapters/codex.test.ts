import { readFile } from "node:fs/promises";
import mockFs from "mock-fs";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { AdapterConfig } from "@src/adapters/base.js";
import { CodexAdapter } from "@src/adapters/codex.js";
import type { MCPServer, Skill } from "@src/types/models.js";

describe("CodexAdapter", () => {
  let adapter: CodexAdapter;
  const baseDir = "/test-project";

  beforeEach(() => {
    mockFs({
      [baseDir]: {
        ".codex": {},
      },
    });

    const config: AdapterConfig = {
      tool: "codex",
      baseDir,
      level: "project",
    };
    adapter = new CodexAdapter(config);
  });

  afterEach(() => {
    mockFs.restore();
  });

  describe("Skills", () => {
    it("should read skills from .codex/skills/", async () => {
      mockFs.restore();
      mockFs({
        [baseDir]: {
          ".codex": {
            skills: {
              "test-skill": {
                "SKILL.md": `---
description: Test skill
---
Skill content here`,
                "support.txt": "Support file",
              },
            },
          },
        },
      });

      const skills = await adapter.readSkills();

      expect(skills).toHaveLength(1);
      expect(skills[0]!.name).toBe("test-skill");
      expect(skills[0]!.content).toBe("Skill content here");
      expect(skills[0]!.description).toBe("Test skill");
      expect(skills[0]!.supportFiles).toHaveProperty("support.txt");
    });

    it("should return empty array if skills directory doesn't exist", async () => {
      const skills = await adapter.readSkills();
      expect(skills).toEqual([]);
    });

    it("should write skills to .codex/skills/", async () => {
      const skills: Skill[] = [
        {
          name: "new-skill",
          description: "New skill",
          content: "Skill content",
          hash: "hash1",
          supportFiles: {
            "example.txt": "Example content",
          },
        },
      ];

      const result = await adapter.writeSkills(skills);

      expect(result.success).toBe(true);
      expect(result.count).toBe(1);

      // Verify files were written
      const skillMd = await readFile(
        `${baseDir}/.codex/skills/new-skill/SKILL.md`,
        "utf-8",
      );
      expect(skillMd).toContain("Skill content");
      expect(skillMd).toContain("description: New skill");

      const supportFile = await readFile(
        `${baseDir}/.codex/skills/new-skill/example.txt`,
        "utf-8",
      );
      expect(supportFile).toBe("Example content");
    });

    it("should delete skill from .codex/skills/", async () => {
      mockFs.restore();
      mockFs({
        [baseDir]: {
          ".codex": {
            skills: {
              "test-skill": {
                "SKILL.md": "Content",
              },
            },
          },
        },
      });

      await adapter.deleteSkill("test-skill");

      // Verify deletion - should not throw
      await expect(
        readFile(`${baseDir}/.codex/skills/test-skill/SKILL.md`, "utf-8"),
      ).rejects.toThrow();
    });
  });

  describe("MCP Servers", () => {
    it("should read MCP servers from config.toml", async () => {
      const tomlContent = `[mcp_servers.postgres]
command = "npx"
args = ["-y", "@modelcontextprotocol/server-postgres"]
env_vars = ["DATABASE_URL"]

[mcp_servers.postgres.env]
PGPASSWORD = "secret"

[mcp_servers.figma]
url = "https://mcp.figma.com/mcp"
bearer_token_env_var = "FIGMA_OAUTH_TOKEN"
http_headers = { "X-Figma-Region" = "us-east-1" }`;

      mockFs.restore();
      mockFs({
        [baseDir]: {
          ".codex": {
            "config.toml": tomlContent,
          },
        },
      });

      const servers = await adapter.readMCPServers();

      expect(servers).toHaveLength(2);
      expect(servers[0]!.name).toBe("postgres");
      expect(servers[0]!.command).toBe("npx");
      expect(servers[0]!.type).toBe("stdio");
      expect(servers[0]!.env?.DATABASE_URL).toBe("${DATABASE_URL}");
      expect(servers[0]!.env?.PGPASSWORD).toBe("secret");
      expect(servers[1]!.name).toBe("figma");
      expect(servers[1]!.type).toBe("http");
      expect(servers[1]!.url).toBe("https://mcp.figma.com/mcp");
      expect(servers[1]!.headers?.Authorization).toBe(
        "Bearer ${FIGMA_OAUTH_TOKEN}",
      );
      expect(servers[1]!.headers?.["X-Figma-Region"]).toBe("us-east-1");
    });

    it("should return empty array if config.toml doesn't exist", async () => {
      const servers = await adapter.readMCPServers();
      expect(servers).toEqual([]);
    });

    it("should write MCP servers to config.toml", async () => {
      const servers: MCPServer[] = [
        {
          name: "postgres",
          type: "stdio",
          command: "npx",
          args: ["-y", "@modelcontextprotocol/server-postgres"],
          env: {
            DATABASE_URL: "${env:DATABASE_URL}",
            PGPASSWORD: "secret",
          },
          hash: "hash1",
        },
        {
          name: "figma",
          type: "http",
          url: "https://mcp.figma.com/mcp",
          headers: {
            Authorization: "Bearer ${FIGMA_OAUTH_TOKEN}",
            "X-Figma-Region": "us-east-1",
          },
          hash: "hash2",
        },
      ];

      const result = await adapter.writeMCPServers(servers);

      expect(result.success).toBe(true);
      expect(result.count).toBe(2);

      // Verify TOML was written
      const configContent = await readFile(
        `${baseDir}/.codex/config.toml`,
        "utf-8",
      );
      expect(configContent).toContain("[mcp_servers.postgres]");
      expect(configContent).toContain('command = "npx"');
      expect(configContent).toMatch(/env_vars\s*=\s*\[\s*"DATABASE_URL"\s*\]/);
      expect(configContent).toContain("[mcp_servers.postgres.env]");
      expect(configContent).toContain('PGPASSWORD = "secret"');
      expect(configContent).toContain("[mcp_servers.figma]");
      expect(configContent).toContain('url = "https://mcp.figma.com/mcp"');
      expect(configContent).toContain(
        'bearer_token_env_var = "FIGMA_OAUTH_TOKEN"',
      );
      expect(configContent).toContain("[mcp_servers.figma.http_headers]");
      expect(configContent).toContain('X-Figma-Region = "us-east-1"');
    });

    it("should preserve existing config when adding servers", async () => {
      mockFs.restore();
      mockFs({
        [baseDir]: {
          ".codex": {
            "config.toml": `[other_section]
key = "value"

[mcp_servers.existing]
command = "existing-cmd"`,
          },
        },
      });

      const servers: MCPServer[] = [
        {
          name: "new-server",
          type: "stdio",
          command: "new-cmd",
          hash: "hash1",
        },
      ];

      await adapter.writeMCPServers(servers);

      const configContent = await readFile(
        `${baseDir}/.codex/config.toml`,
        "utf-8",
      );
      expect(configContent).toContain("[other_section]");
      expect(configContent).toContain("[mcp_servers.new-server]");
    });

    it("should delete MCP server from config.toml", async () => {
      mockFs.restore();
      mockFs({
        [baseDir]: {
          ".codex": {
            "config.toml": `[mcp_servers.postgres]
command = "npx"

[mcp_servers.filesystem]
command = "npx"`,
          },
        },
      });

      await adapter.deleteMCPServer("postgres");

      const configContent = await readFile(
        `${baseDir}/.codex/config.toml`,
        "utf-8",
      );
      expect(configContent).not.toContain("[mcp_servers.postgres]");
      expect(configContent).toContain("[mcp_servers.filesystem]");
    });
  });

  describe("Agents", () => {
    it("should return empty agents (Codex does not support agents)", async () => {
      const agents = await adapter.readAgents();
      expect(agents).toEqual([]);
    });

    it("should report unsupported when writing agents", async () => {
      const result = await adapter.writeAgents([
        {
          name: "new-agent",
          description: "New agent",
          content: "Agent content",
          hash: "hash1",
        },
      ]);

      expect(result.success).toBe(false);
      expect(result.error).toContain("does not support agents");
    });
  });

  describe("Commands", () => {
    it("should return empty commands (Codex does not support commands)", async () => {
      const commands = await adapter.readCommands();
      expect(commands).toEqual([]);
    });

    it("should report unsupported when writing commands", async () => {
      const result = await adapter.writeCommands([
        {
          name: "new-command",
          description: "New command",
          content: "Command content",
          hash: "hash1",
        },
      ]);

      expect(result.success).toBe(false);
      expect(result.error).toContain("does not support commands");
    });
  });

  describe("Validation", () => {
    it("should validate when .codex directory exists", async () => {
      mockFs.restore();
      mockFs({
        [baseDir]: {
          ".codex": {
            "config.toml": "",
          },
        },
      });

      const result = await adapter.validate();

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should warn when .codex directory doesn't exist", async () => {
      mockFs.restore();
      mockFs({
        [baseDir]: {},
      });

      const result = await adapter.validate();

      expect(result.valid).toBe(true);
      expect(result.warnings).toContain(".codex directory not found");
    });

    it("should warn when config.toml doesn't exist", async () => {
      mockFs.restore();
      mockFs({
        [baseDir]: {
          ".codex": {},
        },
      });

      const result = await adapter.validate();

      expect(result.valid).toBe(true);
      expect(result.warnings).toContain("config.toml not found");
    });
  });

  describe("Hash Computation", () => {
    it("should compute hash for skills", async () => {
      mockFs.restore();
      mockFs({
        [baseDir]: {
          ".codex": {
            skills: {
              "test-skill": {
                "SKILL.md": "Content",
              },
            },
          },
        },
      });

      const skills = await adapter.readSkills();

      expect(skills[0]!.hash).toBeTruthy();
      expect(skills[0]!.hash).toHaveLength(64); // SHA256 hash length
    });

    it("should compute hash for MCP servers", async () => {
      mockFs.restore();
      mockFs({
        [baseDir]: {
          ".codex": {
            "config.toml": `[mcp_servers.test]
command = "npx"`,
          },
        },
      });

      const servers = await adapter.readMCPServers();

      expect(servers[0]!.hash).toBeTruthy();
      expect(servers[0]!.hash).toHaveLength(64);
    });
  });
});
