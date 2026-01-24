import { describe, it, expect, beforeEach, afterEach } from "vitest";
import mockFs from "mock-fs";
import { ClaudeCodeAdapter } from "@src/adapters/claude-code.js";

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
        "Release template content"
      );
    });

    it("should return empty array when no skills directory", async () => {
      const emptyAdapter = new ClaudeCodeAdapter({
        tool: "claude-code",
        baseDir: "/empty",
      });

      const skills = await emptyAdapter.readSkills();
      expect(skills).toEqual([]);
    });

    it("should skip non-directory entries", async () => {
      mockFs({
        "/project": {
          ".claude": {
            skills: {
              "skill1": {
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
      });

      const servers = await emptyAdapter.readMCPServers();
      expect(servers).toEqual([]);
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

  describe("validate", () => {
    it("should validate existing configuration", async () => {
      const result = await adapter.validate();

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should warn when .claude directory missing", async () => {
      const emptyAdapter = new ClaudeCodeAdapter({
        tool: "claude-code",
        baseDir: "/empty",
      });

      const result = await emptyAdapter.validate();

      expect(result.warnings).toBeDefined();
      expect(result.warnings?.length).toBeGreaterThan(0);
    });

    it("should warn when .mcp.json missing", async () => {
      mockFs({
        "/project": {
          ".claude": {
            skills: {},
          },
        },
      });

      const result = await adapter.validate();

      expect(result.warnings).toBeDefined();
      expect(result.warnings?.some((w) => w.includes("mcp.json"))).toBe(true);
    });
  });

  describe("write methods", () => {
    it("should throw error for writeSkills (read-only)", async () => {
      await expect(adapter.writeSkills([])).rejects.toThrow(
        "Claude Code adapter is read-only"
      );
    });

    it("should throw error for writeMCPServers (read-only)", async () => {
      await expect(adapter.writeMCPServers([])).rejects.toThrow(
        "Claude Code adapter is read-only"
      );
    });

    it("should throw error for deleteSkill (read-only)", async () => {
      await expect(adapter.deleteSkill("test")).rejects.toThrow(
        "Claude Code adapter is read-only"
      );
    });

    it("should throw error for deleteMCPServer (read-only)", async () => {
      await expect(adapter.deleteMCPServer("test")).rejects.toThrow(
        "Claude Code adapter is read-only"
      );
    });
  });
});
