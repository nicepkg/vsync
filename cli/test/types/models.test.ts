import { describe, it, expect } from "vitest";
import type { Skill, MCPServer, MCPType } from "@src/types/models.js";

describe("Model Types", () => {
  describe("MCPType", () => {
    it("should accept valid MCP types", () => {
      const types: MCPType[] = ["stdio", "http", "oauth"];
      expect(types).toHaveLength(3);
    });
  });

  describe("Skill", () => {
    it("should create a valid skill with minimal fields", () => {
      const skill: Skill = {
        name: "git-release",
        content: "# Git Release\n\nCreate releases",
        hash: "abc123def456",
      };

      expect(skill.name).toBe("git-release");
      expect(skill.content).toContain("Git Release");
      expect(skill.hash).toBe("abc123def456");
    });

    it("should create a skill with all fields", () => {
      const skill: Skill = {
        name: "code-review",
        description: "Review code changes",
        content: "# Code Review\n\nReview the code",
        metadata: {
          author: "test",
          version: "1.0.0",
        },
        supportFiles: {
          "template.md": "Review template",
          "scripts/helper.sh": "#!/bin/bash\necho 'helper'",
        },
        hash: "xyz789",
      };

      expect(skill.description).toBe("Review code changes");
      expect(skill.metadata?.author).toBe("test");
      expect(skill.supportFiles?.["template.md"]).toBe("Review template");
    });
  });

  describe("MCPServer", () => {
    it("should create a stdio MCP server", () => {
      const server: MCPServer = {
        name: "postgres",
        type: "stdio",
        command: "npx",
        args: ["-y", "@modelcontextprotocol/server-postgres"],
        env: {
          DATABASE_URL: "${env:DATABASE_URL}",
        },
        hash: "hash123",
      };

      expect(server.type).toBe("stdio");
      expect(server.command).toBe("npx");
      expect(server.args).toHaveLength(2);
      expect(server.env?.DATABASE_URL).toBe("${env:DATABASE_URL}");
    });

    it("should create an HTTP MCP server", () => {
      const server: MCPServer = {
        name: "remote-api",
        type: "http",
        url: "https://api.example.com/mcp",
        headers: {
          Authorization: "Bearer ${env:API_TOKEN}",
        },
        hash: "hash456",
      };

      expect(server.type).toBe("http");
      expect(server.url).toBe("https://api.example.com/mcp");
      expect(server.headers?.Authorization).toContain("${env:API_TOKEN}");
    });

    it("should create an OAuth MCP server", () => {
      const server: MCPServer = {
        name: "github",
        type: "oauth",
        url: "https://api.github.com/mcp",
        auth: {
          client_id: "${env:GITHUB_CLIENT_ID}",
          client_secret: "${env:GITHUB_SECRET}",
        },
        hash: "hash789",
      };

      expect(server.type).toBe("oauth");
      expect(server.auth?.client_id).toBe("${env:GITHUB_CLIENT_ID}");
    });

    it("should allow stdio server without args and env", () => {
      const server: MCPServer = {
        name: "simple",
        type: "stdio",
        command: "mcp-server-simple",
        hash: "simple123",
      };

      expect(server.args).toBeUndefined();
      expect(server.env).toBeUndefined();
    });
  });
});
