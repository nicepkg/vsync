/**
 * Claude Code adapter (source tool)
 * Reads skills and MCP servers from Claude Code configuration
 * This adapter is read-only (source tool)
 */

import { readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import matter from "gray-matter";
import type { Skill, MCPServer } from "../types/models.js";
import { hashSkill, hashMCPServer } from "../utils/hash.js";
import type {
  ToolAdapter,
  AdapterConfig,
  WriteResult,
  ValidationResult,
} from "./base.js";

/**
 * Claude Code adapter
 * Reads from .claude/skills/ and .mcp.json
 */
export class ClaudeCodeAdapter implements ToolAdapter {
  readonly config: AdapterConfig;

  constructor(config: AdapterConfig) {
    this.config = config;
  }

  /**
   * Read all skills from .claude/skills/
   * Each skill is a directory with SKILL.md and optional support files
   */
  async readSkills(): Promise<Skill[]> {
    const skillsDir = join(this.config.baseDir, ".claude", "skills");

    try {
      const entries = await readdir(skillsDir, { withFileTypes: true });
      const skills: Skill[] = [];

      for (const entry of entries) {
        if (!entry.isDirectory()) {
          continue; // Skip non-directories
        }

        const skillName = entry.name;
        const skillDir = join(skillsDir, skillName);
        const skillMdPath = join(skillDir, "SKILL.md");

        try {
          // Read SKILL.md
          const skillContent = await readFile(skillMdPath, "utf-8");

          // Parse frontmatter
          const parsed = matter(skillContent);

          // Read support files
          const supportFiles: Record<string, string> = {};
          const skillFiles = await readdir(skillDir, { withFileTypes: true });

          for (const file of skillFiles) {
            if (file.name === "SKILL.md" || file.isDirectory()) {
              continue;
            }

            const filePath = join(skillDir, file.name);
            const fileContent = await readFile(filePath, "utf-8");
            supportFiles[file.name] = fileContent;
          }

          // Create skill object (omit undefined optional fields)
          const skill: Skill = {
            name: skillName,
            content: parsed.content,
            hash: "", // Will be computed
          };

          // Add optional fields only if they have values
          if (parsed.data.description) {
            skill.description = parsed.data.description as string;
          }
          if (Object.keys(parsed.data).length > 0) {
            skill.metadata = parsed.data;
          }
          if (Object.keys(supportFiles).length > 0) {
            skill.supportFiles = supportFiles;
          }

          // Compute hash
          skill.hash = hashSkill(skill);

          skills.push(skill);
        } catch (error) {
          // Skip skills with missing or invalid SKILL.md
          console.warn(
            `Skipping skill ${skillName}: ${error instanceof Error ? error.message : "Unknown error"}`,
          );
        }
      }

      return skills;
    } catch (error) {
      // Skills directory doesn't exist
      if (
        error instanceof Error &&
        "code" in error &&
        error.code === "ENOENT"
      ) {
        return [];
      }
      throw error;
    }
  }

  /**
   * Read all MCP servers from .mcp.json
   * Claude Code only supports stdio MCP servers
   */
  async readMCPServers(): Promise<MCPServer[]> {
    const mcpJsonPath = join(this.config.baseDir, ".mcp.json");

    try {
      const content = await readFile(mcpJsonPath, "utf-8");
      const config = JSON.parse(content);

      if (!config.mcpServers || typeof config.mcpServers !== "object") {
        return [];
      }

      const servers: MCPServer[] = [];

      for (const [name, serverConfig] of Object.entries(config.mcpServers)) {
        const rawConfig = serverConfig as Record<string, unknown>;

        // Create MCP server object (omit undefined optional fields)
        const server: MCPServer = {
          name,
          type: "stdio", // Claude Code only supports stdio
          hash: "", // Will be computed
        };

        // Add optional fields only if they have values
        if (rawConfig.command) {
          server.command = rawConfig.command as string;
        }
        if (rawConfig.args) {
          server.args = rawConfig.args as string[];
        }
        if (rawConfig.env) {
          server.env = rawConfig.env as Record<string, string>;
        }

        // Compute hash
        server.hash = hashMCPServer(server);

        servers.push(server);
      }

      return servers;
    } catch (error) {
      // .mcp.json doesn't exist or invalid JSON
      if (
        error instanceof Error &&
        "code" in error &&
        error.code === "ENOENT"
      ) {
        return [];
      }
      console.warn(
        `Failed to read .mcp.json: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
      return [];
    }
  }

  /**
   * Validate Claude Code configuration
   */
  async validate(): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check if .claude directory exists
    const claudeDir = join(this.config.baseDir, ".claude");
    try {
      const stats = await stat(claudeDir);
      if (!stats.isDirectory()) {
        warnings.push(".claude exists but is not a directory");
      }
    } catch {
      warnings.push(".claude directory not found");
    }

    // Check if .mcp.json exists
    const mcpJsonPath = join(this.config.baseDir, ".mcp.json");
    try {
      await stat(mcpJsonPath);
    } catch {
      warnings.push(".mcp.json not found");
    }

    const result: ValidationResult = {
      valid: errors.length === 0,
      errors,
    };

    // Add warnings only if present
    if (warnings.length > 0) {
      result.warnings = warnings;
    }

    return result;
  }

  // Write methods - Claude Code is read-only (source tool)
  async writeSkills(_skills: Skill[]): Promise<WriteResult> {
    throw new Error(
      "Claude Code adapter is read-only (source tool). Use as source_tool only.",
    );
  }

  async writeMCPServers(_servers: MCPServer[]): Promise<WriteResult> {
    throw new Error(
      "Claude Code adapter is read-only (source tool). Use as source_tool only.",
    );
  }

  async deleteSkill(_name: string): Promise<void> {
    throw new Error(
      "Claude Code adapter is read-only (source tool). Use as source_tool only.",
    );
  }

  async deleteMCPServer(_name: string): Promise<void> {
    throw new Error(
      "Claude Code adapter is read-only (source tool). Use as source_tool only.",
    );
  }
}
