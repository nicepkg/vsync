import { describe, it, expect } from "vitest";
import {
  hashContent,
  hashSkill,
  hashMCPServer,
} from "@src/utils/hash.js";
import type { Skill, MCPServer } from "@src/types/models.js";

describe("Hash Utilities", () => {
  describe("hashContent", () => {
    it("should generate consistent SHA256 hash for same content", () => {
      const content = "Hello, World!";
      const hash1 = hashContent(content);
      const hash2 = hashContent(content);

      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64); // SHA256 produces 64 hex chars
    });

    it("should generate different hashes for different content", () => {
      const hash1 = hashContent("content1");
      const hash2 = hashContent("content2");

      expect(hash1).not.toBe(hash2);
    });

    it("should handle empty strings", () => {
      const hash = hashContent("");
      expect(hash).toHaveLength(64);
    });

    it("should handle unicode characters", () => {
      const hash = hashContent("Hello 世界 🚀");
      expect(hash).toHaveLength(64);
    });
  });

  describe("hashSkill", () => {
    it("should hash skill based on content and metadata", () => {
      const skill: Skill = {
        name: "test-skill",
        content: "# Test Skill\n\nDescription",
        metadata: { version: "1.0.0" },
        hash: "", // Will be computed
      };

      const hash = hashSkill(skill);
      expect(hash).toHaveLength(64);
    });

    it("should produce same hash for skills with same content", () => {
      const skill1: Skill = {
        name: "skill1",
        content: "Same content",
        metadata: { author: "test" },
        hash: "",
      };

      const skill2: Skill = {
        name: "skill2", // Different name shouldn't matter
        content: "Same content",
        metadata: { author: "test" },
        hash: "",
      };

      expect(hashSkill(skill1)).toBe(hashSkill(skill2));
    });

    it("should produce different hash when content changes", () => {
      const skill1: Skill = {
        name: "skill",
        content: "Version 1",
        hash: "",
      };

      const skill2: Skill = {
        name: "skill",
        content: "Version 2",
        hash: "",
      };

      expect(hashSkill(skill1)).not.toBe(hashSkill(skill2));
    });

    it("should produce different hash when metadata changes", () => {
      const skill1: Skill = {
        name: "skill",
        content: "Content",
        metadata: { version: "1.0.0" },
        hash: "",
      };

      const skill2: Skill = {
        name: "skill",
        content: "Content",
        metadata: { version: "2.0.0" },
        hash: "",
      };

      expect(hashSkill(skill1)).not.toBe(hashSkill(skill2));
    });

    it("should include support files in hash", () => {
      const skill1: Skill = {
        name: "skill",
        content: "Content",
        supportFiles: { "helper.sh": "echo 'v1'" },
        hash: "",
      };

      const skill2: Skill = {
        name: "skill",
        content: "Content",
        supportFiles: { "helper.sh": "echo 'v2'" },
        hash: "",
      };

      expect(hashSkill(skill1)).not.toBe(hashSkill(skill2));
    });

    it("should normalize whitespace in content", () => {
      const skill1: Skill = {
        name: "skill",
        content: "Line 1\nLine 2\n",
        hash: "",
      };

      const skill2: Skill = {
        name: "skill",
        content: "Line 1\nLine 2\n\n", // Extra newline
        hash: "",
      };

      // Should produce same hash (normalized)
      expect(hashSkill(skill1)).toBe(hashSkill(skill2));
    });
  });

  describe("hashMCPServer", () => {
    it("should hash stdio MCP server", () => {
      const server: MCPServer = {
        name: "postgres",
        type: "stdio",
        command: "npx",
        args: ["-y", "mcp-server-postgres"],
        env: { DB_URL: "${env:DATABASE_URL}" },
        hash: "",
      };

      const hash = hashMCPServer(server);
      expect(hash).toHaveLength(64);
    });

    it("should produce same hash for identical servers", () => {
      const server1: MCPServer = {
        name: "server1",
        type: "stdio",
        command: "cmd",
        args: ["arg1"],
        hash: "",
      };

      const server2: MCPServer = {
        name: "server2", // Different name shouldn't matter
        type: "stdio",
        command: "cmd",
        args: ["arg1"],
        hash: "",
      };

      expect(hashMCPServer(server1)).toBe(hashMCPServer(server2));
    });

    it("should produce different hash when command changes", () => {
      const server1: MCPServer = {
        name: "server",
        type: "stdio",
        command: "cmd1",
        hash: "",
      };

      const server2: MCPServer = {
        name: "server",
        type: "stdio",
        command: "cmd2",
        hash: "",
      };

      expect(hashMCPServer(server1)).not.toBe(hashMCPServer(server2));
    });

    it("should produce different hash when args change", () => {
      const server1: MCPServer = {
        name: "server",
        type: "stdio",
        command: "cmd",
        args: ["arg1"],
        hash: "",
      };

      const server2: MCPServer = {
        name: "server",
        type: "stdio",
        command: "cmd",
        args: ["arg2"],
        hash: "",
      };

      expect(hashMCPServer(server1)).not.toBe(hashMCPServer(server2));
    });

    it("should produce different hash when env changes", () => {
      const server1: MCPServer = {
        name: "server",
        type: "stdio",
        command: "cmd",
        env: { TOKEN: "${env:TOKEN1}" },
        hash: "",
      };

      const server2: MCPServer = {
        name: "server",
        type: "stdio",
        command: "cmd",
        env: { TOKEN: "${env:TOKEN2}" },
        hash: "",
      };

      expect(hashMCPServer(server1)).not.toBe(hashMCPServer(server2));
    });

    it("should hash HTTP MCP server", () => {
      const server: MCPServer = {
        name: "remote",
        type: "http",
        url: "https://api.example.com",
        headers: { Authorization: "Bearer ${env:TOKEN}" },
        hash: "",
      };

      const hash = hashMCPServer(server);
      expect(hash).toHaveLength(64);
    });

    it("should preserve env var format in hash", () => {
      const server1: MCPServer = {
        name: "server",
        type: "stdio",
        command: "cmd",
        env: { VAR: "${env:VALUE}" },
        hash: "",
      };

      const server2: MCPServer = {
        name: "server",
        type: "stdio",
        command: "cmd",
        env: { VAR: "${VALUE}" }, // Different format
        hash: "",
      };

      // Should produce different hashes as format is preserved
      expect(hashMCPServer(server1)).not.toBe(hashMCPServer(server2));
    });
  });
});
