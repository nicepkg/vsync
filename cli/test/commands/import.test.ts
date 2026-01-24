import mockFs from "mock-fs";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { detectSourceTool, importConfigs } from "@src/commands/import.js";
import type { ImportOptions } from "@src/commands/import.js";

describe("Import Command", () => {
  beforeEach(() => {
    mockFs({
      "/source-project": {
        ".claude": {
          skills: {
            "test-skill": {
              "SKILL.md": "Test skill content",
            },
          },
        },
        ".mcp.json": JSON.stringify({
          mcpServers: {
            postgres: {
              command: "npx",
              args: ["-y", "@modelcontextprotocol/server-postgres"],
            },
          },
        }),
      },
      "/target-project": {
        ".claude": {
          skills: {},
        },
        ".mcp.json": JSON.stringify({
          mcpServers: {},
        }),
        ".vibe-sync.json": JSON.stringify({
          version: "1.0.0",
          level: "project",
          source_tool: "claude-code",
          target_tools: ["cursor"],
          sync_config: {
            skills: true,
            mcp: true,
          },
        }),
      },
      "/multi-tool-project": {
        ".claude": {
          skills: {
            skill1: {
              "SKILL.md": "Skill 1",
            },
          },
        },
        ".cursor": {
          skills: {
            skill2: {
              "SKILL.md": "Skill 2",
            },
          },
        },
        ".codex": {
          skills: {
            skill3: {
              "SKILL.md": "Skill 3",
            },
          },
        },
      },
      "/empty-project": {},
    });
  });

  afterEach(() => {
    mockFs.restore();
  });

  describe("detectSourceTool", () => {
    it("should detect Claude Code configuration", async () => {
      const tools = await detectSourceTool("/source-project");

      expect(tools).toContain("claude-code");
      expect(tools.length).toBeGreaterThan(0);
    });

    it("should detect multiple tools", async () => {
      const tools = await detectSourceTool("/multi-tool-project");

      expect(tools).toContain("claude-code");
      expect(tools).toContain("cursor");
      expect(tools).toContain("codex");
      expect(tools.length).toBe(3);
    });

    it("should return empty array for no tools", async () => {
      const tools = await detectSourceTool("/empty-project");

      expect(tools).toEqual([]);
    });

    it("should handle non-existent directory", async () => {
      const tools = await detectSourceTool("/non-existent");

      expect(tools).toEqual([]);
    });
  });

  describe("importConfigs", () => {
    it("should import skills from source tool", async () => {
      mockFs.restore();
      mockFs({
        "/source-project": {
          ".claude": {
            skills: {
              "test-skill": {
                "SKILL.md": "Test skill content",
              },
            },
          },
        },
        "/target-project": {
          ".claude": {
            skills: {},
          },
          ".mcp.json": JSON.stringify({ mcpServers: {} }),
          ".vibe-sync.json": JSON.stringify({
            version: "1.0.0",
            level: "project",
            source_tool: "claude-code",
            target_tools: ["cursor"],
            sync_config: {
              skills: true,
              mcp: true,
            },
          }),
        },
      });

      const options: ImportOptions = {
        sourcePath: "/source-project",
        targetPath: "/target-project",
        sourceTool: "claude-code",
        targetTool: "cursor",
        importSkills: true,
        importMcp: false,
        importAgents: false,
        importCommands: false,
      };

      const result = await importConfigs(options);

      expect(result.success).toBe(true);
      expect(result.skills.imported).toBe(1);
      expect(result.skills.skipped).toBe(0);
    });

    it("should import MCP servers from source tool", async () => {
      mockFs.restore();
      mockFs({
        "/source-project": {
          ".claude": {},
          ".mcp.json": JSON.stringify({
            mcpServers: {
              postgres: {
                command: "npx",
                args: ["-y", "@modelcontextprotocol/server-postgres"],
              },
            },
          }),
        },
        "/target-project": {
          ".claude": {},
          ".mcp.json": JSON.stringify({ mcpServers: {} }),
          ".vibe-sync.json": JSON.stringify({
            version: "1.0.0",
            level: "project",
            source_tool: "claude-code",
            target_tools: ["cursor"],
            sync_config: {
              skills: true,
              mcp: true,
            },
          }),
        },
      });

      const options: ImportOptions = {
        sourcePath: "/source-project",
        targetPath: "/target-project",
        sourceTool: "claude-code",
        targetTool: "cursor",
        importSkills: false,
        importMcp: true,
        importAgents: false,
        importCommands: false,
      };

      const result = await importConfigs(options);

      expect(result.success).toBe(true);
      expect(result.mcp.imported).toBe(1);
      expect(result.mcp.skipped).toBe(0);
    });

    it("should import all types when specified", async () => {
      mockFs.restore();
      mockFs({
        "/full-source": {
          ".claude": {
            skills: {
              skill1: {
                "SKILL.md": "Skill 1",
              },
            },
            agents: {
              agent1: {
                "AGENT.md": "Agent 1",
              },
            },
            commands: {
              cmd1: {
                "COMMAND.md": "Command 1",
              },
            },
          },
          ".mcp.json": JSON.stringify({
            mcpServers: {
              postgres: {
                command: "npx",
              },
            },
          }),
        },
        "/full-target": {
          ".claude": {
            skills: {},
            agents: {},
            commands: {},
          },
          ".mcp.json": JSON.stringify({
            mcpServers: {},
          }),
          ".vibe-sync.json": JSON.stringify({
            version: "1.0.0",
            level: "project",
            source_tool: "claude-code",
            target_tools: ["cursor"],
            sync_config: {
              skills: true,
              mcp: true,
              agents: true,
              commands: true,
            },
          }),
        },
      });

      const options: ImportOptions = {
        sourcePath: "/full-source",
        targetPath: "/full-target",
        sourceTool: "claude-code",
        targetTool: "cursor",
        importSkills: true,
        importMcp: true,
        importAgents: true,
        importCommands: true,
      };

      const result = await importConfigs(options);

      expect(result.success).toBe(true);
      expect(result.skills.imported).toBe(1);
      expect(result.mcp.imported).toBe(1);
      expect(result.agents.imported).toBe(1);
      expect(result.commands.imported).toBe(1);
    });

    it("should skip existing items with same name", async () => {
      mockFs.restore();
      mockFs({
        "/source": {
          ".claude": {
            skills: {
              "existing-skill": {
                "SKILL.md": "Source skill",
              },
            },
          },
        },
        "/target": {
          ".claude": {
            skills: {
              "existing-skill": {
                "SKILL.md": "Target skill",
              },
            },
          },
          ".vibe-sync.json": JSON.stringify({
            version: "1.0.0",
            level: "project",
            source_tool: "claude-code",
            target_tools: ["cursor"],
            sync_config: {
              skills: true,
              mcp: true,
            },
          }),
        },
      });

      const options: ImportOptions = {
        sourcePath: "/source",
        targetPath: "/target",
        sourceTool: "claude-code",
        targetTool: "cursor",
        importSkills: true,
        importMcp: false,
        importAgents: false,
        importCommands: false,
        skipExisting: true,
      };

      const result = await importConfigs(options);

      expect(result.success).toBe(true);
      expect(result.skills.imported).toBe(0);
      expect(result.skills.skipped).toBe(1);
    });

    it("should handle import errors gracefully", async () => {
      const options: ImportOptions = {
        sourcePath: "/non-existent",
        targetPath: "/target-project",
        sourceTool: "claude-code",
        targetTool: "cursor",
        importSkills: true,
        importMcp: false,
        importAgents: false,
        importCommands: false,
      };

      const result = await importConfigs(options);

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it("should preserve metadata and support files", async () => {
      mockFs.restore();
      mockFs({
        "/source": {
          ".claude": {
            skills: {
              "complex-skill": {
                "SKILL.md": `---
description: Complex skill
version: 1.0.0
---
Skill content`,
                "support.txt": "Support file",
                "example.js": "Example code",
              },
            },
          },
        },
        "/target": {
          ".claude": {
            skills: {},
          },
          ".mcp.json": JSON.stringify({ mcpServers: {} }),
          ".vibe-sync.json": JSON.stringify({
            version: "1.0.0",
            level: "project",
            source_tool: "claude-code",
            target_tools: ["cursor"],
            sync_config: {
              skills: true,
              mcp: true,
            },
          }),
        },
      });

      const options: ImportOptions = {
        sourcePath: "/source",
        targetPath: "/target",
        sourceTool: "claude-code",
        targetTool: "cursor",
        importSkills: true,
        importMcp: false,
        importAgents: false,
        importCommands: false,
      };

      const result = await importConfigs(options);

      expect(result.success).toBe(true);
      expect(result.skills.imported).toBe(1);

      // Verify support files were copied
      const { readFile } = await import("node:fs/promises");
      const supportContent = await readFile(
        "/target/.claude/skills/complex-skill/support.txt",
        "utf-8",
      );
      expect(supportContent).toBe("Support file");
    });

    it("should count imported items correctly", async () => {
      mockFs.restore();
      mockFs({
        "/source": {
          ".claude": {
            skills: {
              skill1: { "SKILL.md": "Skill 1" },
              skill2: { "SKILL.md": "Skill 2" },
              skill3: { "SKILL.md": "Skill 3" },
            },
          },
          ".mcp.json": JSON.stringify({
            mcpServers: {
              postgres: { command: "npx" },
              sqlite: { command: "npx" },
            },
          }),
        },
        "/target": {
          ".claude": {
            skills: {},
          },
          ".mcp.json": JSON.stringify({
            mcpServers: {},
          }),
          ".vibe-sync.json": JSON.stringify({
            version: "1.0.0",
            level: "project",
            source_tool: "claude-code",
            target_tools: ["cursor"],
            sync_config: {
              skills: true,
              mcp: true,
            },
          }),
        },
      });

      const options: ImportOptions = {
        sourcePath: "/source",
        targetPath: "/target",
        sourceTool: "claude-code",
        targetTool: "cursor",
        importSkills: true,
        importMcp: true,
        importAgents: false,
        importCommands: false,
      };

      const result = await importConfigs(options);

      expect(result.success).toBe(true);
      expect(result.skills.imported).toBe(3);
      expect(result.mcp.imported).toBe(2);
    });
  });

  describe("Import with different source tools", () => {
    it("should import from Cursor", async () => {
      mockFs.restore();
      mockFs({
        "/cursor-source": {
          ".cursor": {
            skills: {
              "cursor-skill": {
                "SKILL.md": "Cursor skill",
              },
            },
          },
          "mcp.json": JSON.stringify({ mcpServers: {} }),
        },
        "/target": {
          ".cursor": {
            skills: {},
          },
          "mcp.json": JSON.stringify({ mcpServers: {} }),
          ".vibe-sync.json": JSON.stringify({
            version: "1.0.0",
            level: "project",
            source_tool: "cursor",
            target_tools: ["claude-code"],
            sync_config: {
              skills: true,
              mcp: true,
            },
          }),
        },
      });

      const options: ImportOptions = {
        sourcePath: "/cursor-source",
        targetPath: "/target",
        sourceTool: "cursor",
        importSkills: true,
        importMcp: false,
        importAgents: false,
        importCommands: false,
      };

      const result = await importConfigs(options);

      expect(result.success).toBe(true);
      expect(result.skills.imported).toBe(1);
    });

    it("should import from OpenCode", async () => {
      mockFs.restore();
      mockFs({
        "/opencode-source": {
          ".opencode": {
            skills: {
              "opencode-skill": {
                "SKILL.md": "OpenCode skill",
              },
            },
          },
          "opencode.jsonc": JSON.stringify({ mcp: {} }),
        },
        "/target": {
          ".opencode": {
            skills: {},
          },
          "opencode.jsonc": JSON.stringify({ mcp: {} }),
          ".vibe-sync.json": JSON.stringify({
            version: "1.0.0",
            level: "project",
            source_tool: "opencode",
            target_tools: ["cursor"],
            sync_config: {
              skills: true,
              mcp: true,
            },
          }),
        },
      });

      const options: ImportOptions = {
        sourcePath: "/opencode-source",
        targetPath: "/target",
        sourceTool: "opencode",
        importSkills: true,
        importMcp: false,
        importAgents: false,
        importCommands: false,
      };

      const result = await importConfigs(options);

      expect(result.success).toBe(true);
      expect(result.skills.imported).toBe(1);
    });

    it("should import from Codex", async () => {
      mockFs.restore();
      mockFs({
        "/codex-source": {
          ".codex": {
            skills: {
              "codex-skill": {
                "SKILL.md": "Codex skill",
              },
            },
          },
          "config.toml": "",
        },
        "/target": {
          ".claude": {
            skills: {},
          },
          ".vibe-sync.json": JSON.stringify({
            version: "1.0.0",
            level: "project",
            source_tool: "claude-code",
            target_tools: ["cursor"],
            sync_config: {
              skills: true,
              mcp: true,
            },
          }),
        },
      });

      const options: ImportOptions = {
        sourcePath: "/codex-source",
        targetPath: "/target",
        sourceTool: "codex",
        importSkills: true,
        importMcp: false,
        importAgents: false,
        importCommands: false,
      };

      const result = await importConfigs(options);

      expect(result.success).toBe(true);
      expect(result.skills.imported).toBe(1);
    });
  });
});
