import { readFile } from "node:fs/promises";
import mockFs from "mock-fs";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { AdapterConfig } from "@src/adapters/base.js";
import { CodexAdapter } from "@src/adapters/codex.js";
import type { Agent, Command, MCPServer, Skill } from "@src/types/models.js";

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

[mcp_servers.filesystem]
command = "npx"
args = ["-y", "@modelcontextprotocol/server-filesystem"]`;

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
      expect(servers[1]!.name).toBe("filesystem");
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
          hash: "hash1",
        },
      ];

      const result = await adapter.writeMCPServers(servers);

      expect(result.success).toBe(true);
      expect(result.count).toBe(1);

      // Verify TOML was written
      const configContent = await readFile(
        `${baseDir}/.codex/config.toml`,
        "utf-8",
      );
      expect(configContent).toContain("[mcp_servers.postgres]");
      expect(configContent).toContain('command = "npx"');
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
    it("should read agents from .codex/agents/", async () => {
      mockFs.restore();
      mockFs({
        [baseDir]: {
          ".codex": {
            agents: {
              "test-agent": {
                "AGENT.md": `---
description: Test agent
---
Agent content`,
              },
            },
          },
        },
      });

      const agents = await adapter.readAgents();

      expect(agents).toHaveLength(1);
      expect(agents[0]!.name).toBe("test-agent");
      expect(agents[0]!.content).toBe("Agent content");
    });

    it("should write agents to .codex/agents/", async () => {
      const agents: Agent[] = [
        {
          name: "new-agent",
          description: "New agent",
          content: "Agent content",
          hash: "hash1",
        },
      ];

      const result = await adapter.writeAgents(agents);

      expect(result.success).toBe(true);
      expect(result.count).toBe(1);

      const agentMd = await readFile(
        `${baseDir}/.codex/agents/new-agent/AGENT.md`,
        "utf-8",
      );
      expect(agentMd).toContain("Agent content");
    });

    it("should delete agent from .codex/agents/", async () => {
      mockFs.restore();
      mockFs({
        [baseDir]: {
          ".codex": {
            agents: {
              "test-agent": {
                "AGENT.md": "Content",
              },
            },
          },
        },
      });

      await adapter.deleteAgent("test-agent");

      await expect(
        readFile(`${baseDir}/.codex/agents/test-agent/AGENT.md`, "utf-8"),
      ).rejects.toThrow();
    });
  });

  describe("Commands", () => {
    it("should read commands from .codex/commands/", async () => {
      mockFs.restore();
      mockFs({
        [baseDir]: {
          ".codex": {
            commands: {
              "test-command": {
                "COMMAND.md": `---
description: Test command
---
Command content`,
              },
            },
          },
        },
      });

      const commands = await adapter.readCommands();

      expect(commands).toHaveLength(1);
      expect(commands[0]!.name).toBe("test-command");
      expect(commands[0]!.content).toBe("Command content");
    });

    it("should write commands to .codex/commands/", async () => {
      const commands: Command[] = [
        {
          name: "new-command",
          description: "New command",
          content: "Command content",
          hash: "hash1",
        },
      ];

      const result = await adapter.writeCommands(commands);

      expect(result.success).toBe(true);
      expect(result.count).toBe(1);

      const commandMd = await readFile(
        `${baseDir}/.codex/commands/new-command/COMMAND.md`,
        "utf-8",
      );
      expect(commandMd).toContain("Command content");
    });

    it("should delete command from .codex/commands/", async () => {
      mockFs.restore();
      mockFs({
        [baseDir]: {
          ".codex": {
            commands: {
              "test-command": {
                "COMMAND.md": "Content",
              },
            },
          },
        },
      });

      await adapter.deleteCommand("test-command");

      await expect(
        readFile(`${baseDir}/.codex/commands/test-command/COMMAND.md`, "utf-8"),
      ).rejects.toThrow();
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

    it("should compute hash for agents", async () => {
      mockFs.restore();
      mockFs({
        [baseDir]: {
          ".codex": {
            agents: {
              "test-agent": {
                "AGENT.md": "Content",
              },
            },
          },
        },
      });

      const agents = await adapter.readAgents();

      expect(agents[0]!.hash).toBeTruthy();
      expect(agents[0]!.hash).toHaveLength(64);
    });

    it("should compute hash for commands", async () => {
      mockFs.restore();
      mockFs({
        [baseDir]: {
          ".codex": {
            commands: {
              "test-command": {
                "COMMAND.md": "Content",
              },
            },
          },
        },
      });

      const commands = await adapter.readCommands();

      expect(commands[0]!.hash).toBeTruthy();
      expect(commands[0]!.hash).toHaveLength(64);
    });
  });
});
