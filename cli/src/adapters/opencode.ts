/**
 * OpenCode adapter (target tool)
 * Writes skills and MCP servers to OpenCode configuration
 * This adapter is write-only (target tool)
 */

import { mkdir, readFile, rm, stat } from "node:fs/promises";
import { join } from "node:path";
import matter from "gray-matter";
import * as jsonc from "jsonc-parser";
import type { MCPServer, Skill, Agent } from "@src/types/models.js";
import { atomicWrite } from "@src/utils/atomic-write.js";
import { normalizeEnvVar } from "@src/utils/env-vars.js";
import type {
  AdapterConfig,
  ToolAdapter,
  ValidationResult,
  WriteResult,
} from "./base.js";

/**
 * OpenCode adapter
 * Writes to .opencode/skills/ and opencode.jsonc
 */
export class OpenCodeAdapter implements ToolAdapter {
  readonly config: AdapterConfig;

  constructor(config: AdapterConfig) {
    this.config = config;
  }

  /**
   * Write skills to .opencode/skills/
   * Same structure as Cursor
   */
  async writeSkills(skills: Skill[]): Promise<WriteResult> {
    const skillsDir = join(this.config.baseDir, ".opencode", "skills");

    try {
      // Ensure skills directory exists
      await mkdir(skillsDir, { recursive: true });

      for (const skill of skills) {
        const skillDir = join(skillsDir, skill.name);
        await mkdir(skillDir, { recursive: true });

        // Generate SKILL.md content
        let skillContent = skill.content;

        // Add frontmatter if metadata or description exists
        if (skill.metadata || skill.description) {
          const frontmatter: Record<string, unknown> = {
            ...(skill.metadata || {}),
          };

          // Add description to frontmatter if present
          if (skill.description) {
            frontmatter.description = skill.description;
          }

          // Add name to frontmatter
          frontmatter.name = skill.name;

          skillContent = matter.stringify(skill.content, frontmatter);
        }

        // Write SKILL.md
        const skillMdPath = join(skillDir, "SKILL.md");
        await atomicWrite(skillMdPath, skillContent);

        // Write support files
        if (skill.supportFiles) {
          for (const [fileName, fileContent] of Object.entries(
            skill.supportFiles,
          )) {
            const filePath = join(skillDir, fileName);
            await atomicWrite(filePath, fileContent);
          }
        }
      }

      return {
        success: true,
        count: skills.length,
      };
    } catch (error) {
      return {
        success: false,
        count: 0,
        error:
          error instanceof Error
            ? error.message
            : "Unknown error writing skills",
      };
    }
  }

  /**
   * Write MCP servers to opencode.jsonc
   * OpenCode uses:
   * - `mcp` field (not `mcpServers`)
   * - `type` field is required ("stdio" or "remote")
   * - Environment variables use ${VAR} format (not ${env:VAR})
   */
  async writeMCPServers(servers: MCPServer[]): Promise<WriteResult> {
    const jsoncPath = join(this.config.baseDir, "opencode.jsonc");

    try {
      // Read existing config or create new one
      let jsoncText = "{}";

      try {
        jsoncText = await readFile(jsoncPath, "utf-8");
      } catch {
        // File doesn't exist, use empty config
      }

      // Parse to get current structure
      const config = jsonc.parse(jsoncText) || {};

      // Ensure mcp object exists by applying edit if needed
      if (!config.mcp || typeof config.mcp !== "object") {
        const edits = jsonc.modify(
          jsoncText,
          ["mcp"],
          {},
          {
            formattingOptions: {
              insertSpaces: true,
              tabSize: 2,
            },
          },
        );
        jsoncText = jsonc.applyEdits(jsoncText, edits);
      }

      // Add/update each server using targeted edits
      for (const server of servers) {
        const serverConfig: Record<string, unknown> = {};

        // Add type field (required for OpenCode)
        // Map stdio -> "stdio", http/oauth -> "remote"
        if (server.type === "stdio") {
          serverConfig.type = "stdio";
        } else {
          serverConfig.type = "remote";
        }

        // Add other fields
        if (server.command) {
          serverConfig.command = server.command;
        }
        if (server.args) {
          serverConfig.args = server.args;
        }
        if (server.env) {
          // Convert environment variables from ${env:VAR} to ${VAR}
          serverConfig.env = this.convertEnvVars(server.env);
        }
        if (server.url) {
          serverConfig.url = server.url;
        }
        if (server.headers) {
          // Convert environment variables in headers
          serverConfig.headers = this.convertEnvVars(server.headers);
        }
        if (server.auth) {
          // Convert environment variables in auth
          serverConfig.auth = this.convertEnvVars(
            server.auth as unknown as Record<string, unknown>,
          );
        }

        // Apply edit for this specific server (preserves comments)
        const edits = jsonc.modify(
          jsoncText,
          ["mcp", server.name],
          serverConfig,
          {
            formattingOptions: {
              insertSpaces: true,
              tabSize: 2,
            },
          },
        );
        jsoncText = jsonc.applyEdits(jsoncText, edits);
      }

      // Write config
      await atomicWrite(jsoncPath, jsoncText);

      return {
        success: true,
        count: servers.length,
      };
    } catch (error) {
      return {
        success: false,
        count: 0,
        error:
          error instanceof Error
            ? error.message
            : "Unknown error writing MCP servers",
      };
    }
  }

  /**
   * Write agents to .opencode/agents/
   * Same structure as Cursor
   */
  async writeAgents(agents: Agent[]): Promise<WriteResult> {
    const agentsDir = join(this.config.baseDir, ".opencode", "agents");

    try {
      // Ensure agents directory exists
      await mkdir(agentsDir, { recursive: true });

      for (const agent of agents) {
        const agentDir = join(agentsDir, agent.name);
        await mkdir(agentDir, { recursive: true });

        // Generate AGENT.md content
        let agentContent = agent.content;

        // Add frontmatter if metadata or description exists
        if (agent.metadata || agent.description) {
          const frontmatter: Record<string, unknown> = {
            ...(agent.metadata || {}),
          };

          // Add description to frontmatter if present
          if (agent.description) {
            frontmatter.description = agent.description;
          }

          // Add name to frontmatter
          frontmatter.name = agent.name;

          agentContent = matter.stringify(agent.content, frontmatter);
        }

        // Write AGENT.md
        const agentMdPath = join(agentDir, "AGENT.md");
        await atomicWrite(agentMdPath, agentContent);

        // Write support files
        if (agent.supportFiles) {
          for (const [fileName, fileContent] of Object.entries(
            agent.supportFiles,
          )) {
            const filePath = join(agentDir, fileName);
            await atomicWrite(filePath, fileContent);
          }
        }
      }

      return {
        success: true,
        count: agents.length,
      };
    } catch (error) {
      return {
        success: false,
        count: 0,
        error:
          error instanceof Error
            ? error.message
            : "Unknown error writing agents",
      };
    }
  }

  /**
   * Convert environment variables recursively
   * ${env:VAR} -> ${VAR}
   */
  private convertEnvVars(
    obj: Record<string, unknown>,
  ): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === "string") {
        result[key] = normalizeEnvVar(value, "opencode");
      } else if (typeof value === "object" && value !== null) {
        result[key] = this.convertEnvVars(value as Record<string, unknown>);
      } else {
        result[key] = value;
      }
    }

    return result;
  }

  /**
   * Delete a skill from .opencode/skills/
   */
  async deleteSkill(name: string): Promise<void> {
    const skillDir = join(this.config.baseDir, ".opencode", "skills", name);

    try {
      await rm(skillDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore errors for non-existent skills
      if (
        error instanceof Error &&
        "code" in error &&
        error.code !== "ENOENT"
      ) {
        throw error;
      }
    }
  }

  /**
   * Delete an MCP server from opencode.jsonc
   */
  async deleteMCPServer(name: string): Promise<void> {
    const jsoncPath = join(this.config.baseDir, "opencode.jsonc");

    try {
      let jsoncText = await readFile(jsoncPath, "utf-8");
      const config = jsonc.parse(jsoncText) || {};

      if (config.mcp && typeof config.mcp === "object") {
        const mcpObj = config.mcp as Record<string, unknown>;

        // Check if server exists
        if (mcpObj[name] !== undefined) {
          // Use jsonc.modify to remove the server (preserves comments)
          const edits = jsonc.modify(jsoncText, ["mcp", name], undefined, {
            formattingOptions: {
              insertSpaces: true,
              tabSize: 2,
            },
          });
          jsoncText = jsonc.applyEdits(jsoncText, edits);

          await atomicWrite(jsoncPath, jsoncText);
        }
      }
    } catch (error) {
      // Ignore errors for non-existent file
      if (
        error instanceof Error &&
        "code" in error &&
        error.code !== "ENOENT"
      ) {
        throw error;
      }
    }
  }

  /**
   * Delete an agent from .opencode/agents/
   */
  async deleteAgent(name: string): Promise<void> {
    const agentDir = join(this.config.baseDir, ".opencode", "agents", name);

    try {
      await rm(agentDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore errors for non-existent agents
      if (
        error instanceof Error &&
        "code" in error &&
        error.code !== "ENOENT"
      ) {
        throw error;
      }
    }
  }

  /**
   * Validate OpenCode configuration
   */
  async validate(): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check if .opencode directory exists
    const opencodeDir = join(this.config.baseDir, ".opencode");
    try {
      const stats = await stat(opencodeDir);
      if (!stats.isDirectory()) {
        warnings.push(".opencode exists but is not a directory");
      }
    } catch {
      warnings.push(".opencode directory not found");
    }

    // Check if opencode.jsonc exists
    const jsoncPath = join(this.config.baseDir, "opencode.jsonc");
    try {
      await stat(jsoncPath);
    } catch {
      warnings.push("opencode.jsonc not found");
    }

    const result: ValidationResult = {
      valid: errors.length === 0,
      errors,
    };

    if (warnings.length > 0) {
      result.warnings = warnings;
    }

    return result;
  }

  // Read methods - OpenCode is write-only (target tool)
  async readSkills(): Promise<Skill[]> {
    throw new Error(
      "OpenCode adapter is write-only (target tool). Use as target_tool only.",
    );
  }

  async readMCPServers(): Promise<MCPServer[]> {
    throw new Error(
      "OpenCode adapter is write-only (target tool). Use as target_tool only.",
    );
  }

  async readAgents(): Promise<Agent[]> {
    throw new Error(
      "OpenCode adapter is write-only (target tool). Use as target_tool only.",
    );
  }
}
