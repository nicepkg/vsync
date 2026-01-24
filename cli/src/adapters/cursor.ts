/**
 * Cursor adapter (target tool)
 * Writes skills and MCP servers to Cursor configuration
 * This adapter is write-only (target tool)
 */

import { mkdir, readFile, rm, stat } from "node:fs/promises";
import { join } from "node:path";
import matter from "gray-matter";
import type { MCPServer, Skill, Agent, Command } from "@src/types/models.js";
import { atomicWrite } from "@src/utils/atomic-write.js";
import type {
  AdapterConfig,
  ToolAdapter,
  ValidationResult,
  WriteResult,
} from "./base.js";

/**
 * Cursor adapter
 * Writes to .cursor/skills/ and .cursor/mcp.json
 */
export class CursorAdapter implements ToolAdapter {
  readonly config: AdapterConfig;

  constructor(config: AdapterConfig) {
    this.config = config;
  }

  /**
   * Write skills to .cursor/skills/
   * Each skill is a directory with SKILL.md and optional support files
   */
  async writeSkills(skills: Skill[]): Promise<WriteResult> {
    const skillsDir = join(this.config.baseDir, ".cursor", "skills");

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
   * Write MCP servers to .cursor/mcp.json
   * Cursor uses mcpServers field and supports stdio, HTTP, OAuth
   */
  async writeMCPServers(servers: MCPServer[]): Promise<WriteResult> {
    const mcpJsonPath = join(this.config.baseDir, ".cursor", "mcp.json");

    try {
      // Ensure .cursor directory exists
      await mkdir(join(this.config.baseDir, ".cursor"), { recursive: true });

      // Read existing config or create new one
      let config: { mcpServers: Record<string, unknown> } = {
        mcpServers: {},
      };

      try {
        const existingContent = await readFile(mcpJsonPath, "utf-8");
        config = JSON.parse(existingContent);
        if (!config.mcpServers || typeof config.mcpServers !== "object") {
          config.mcpServers = {};
        }
      } catch {
        // File doesn't exist or invalid JSON, use empty config
      }

      // Add/update servers
      for (const server of servers) {
        const serverConfig: Record<string, unknown> = {};

        // Add fields based on server configuration
        if (server.command) {
          serverConfig.command = server.command;
        }
        if (server.args) {
          serverConfig.args = server.args;
        }
        if (server.env) {
          serverConfig.env = server.env;
        }
        if (server.url) {
          serverConfig.url = server.url;
        }
        if (server.headers) {
          serverConfig.headers = server.headers;
        }
        if (server.auth) {
          serverConfig.auth = server.auth;
        }

        config.mcpServers[server.name] = serverConfig;
      }

      // Write config
      await atomicWrite(mcpJsonPath, JSON.stringify(config, null, 2));

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
   * Write agents to .cursor/agents/
   * Each agent is a directory with AGENT.md and optional support files
   */
  async writeAgents(agents: Agent[]): Promise<WriteResult> {
    const agentsDir = join(this.config.baseDir, ".cursor", "agents");

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
   * Delete a skill from .cursor/skills/
   */
  async deleteSkill(name: string): Promise<void> {
    const skillDir = join(this.config.baseDir, ".cursor", "skills", name);

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
   * Delete an MCP server from .cursor/mcp.json
   */
  async deleteMCPServer(name: string): Promise<void> {
    const mcpJsonPath = join(this.config.baseDir, ".cursor", "mcp.json");

    try {
      const content = await readFile(mcpJsonPath, "utf-8");
      const config = JSON.parse(content);

      if (config.mcpServers && typeof config.mcpServers === "object") {
        delete config.mcpServers[name];
        await atomicWrite(mcpJsonPath, JSON.stringify(config, null, 2));
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
   * Write commands to .cursor/commands/
   * Each command is a directory with COMMAND.md and optional support files
   */
  async writeCommands(commands: Command[]): Promise<WriteResult> {
    const commandsDir = join(this.config.baseDir, ".cursor", "commands");

    try {
      // Ensure commands directory exists
      await mkdir(commandsDir, { recursive: true });

      for (const command of commands) {
        const commandDir = join(commandsDir, command.name);
        await mkdir(commandDir, { recursive: true });

        // Generate COMMAND.md content
        let commandContent = command.content;

        // Add frontmatter if metadata or description exists
        if (command.metadata || command.description) {
          const frontmatter: Record<string, unknown> = {
            ...(command.metadata || {}),
          };

          // Add description to frontmatter if present
          if (command.description) {
            frontmatter.description = command.description;
          }

          // Add name to frontmatter
          frontmatter.name = command.name;

          commandContent = matter.stringify(command.content, frontmatter);
        }

        // Write COMMAND.md
        const commandMdPath = join(commandDir, "COMMAND.md");
        await atomicWrite(commandMdPath, commandContent);

        // Write support files
        if (command.supportFiles) {
          for (const [fileName, fileContent] of Object.entries(
            command.supportFiles,
          )) {
            const filePath = join(commandDir, fileName);
            await atomicWrite(filePath, fileContent);
          }
        }
      }

      return {
        success: true,
        count: commands.length,
      };
    } catch (error) {
      return {
        success: false,
        count: 0,
        error:
          error instanceof Error
            ? error.message
            : "Unknown error writing commands",
      };
    }
  }

  /**
   * Delete an agent from .cursor/agents/
   */
  async deleteAgent(name: string): Promise<void> {
    const agentDir = join(this.config.baseDir, ".cursor", "agents", name);

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
   * Validate Cursor configuration
   */
  async validate(): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check if .cursor directory exists
    const cursorDir = join(this.config.baseDir, ".cursor");
    try {
      const stats = await stat(cursorDir);
      if (!stats.isDirectory()) {
        warnings.push(".cursor exists but is not a directory");
      }
    } catch {
      warnings.push(".cursor directory not found");
    }

    // Check if mcp.json exists
    const mcpJsonPath = join(this.config.baseDir, ".cursor", "mcp.json");
    try {
      await stat(mcpJsonPath);
    } catch {
      warnings.push("mcp.json not found");
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

  // Read methods - Cursor is write-only (target tool)
  async readSkills(): Promise<Skill[]> {
    throw new Error(
      "Cursor adapter is write-only (target tool). Use as target_tool only.",
    );
  }

  async readMCPServers(): Promise<MCPServer[]> {
    throw new Error(
      "Cursor adapter is write-only (target tool). Use as target_tool only.",
    );
  }

  async readAgents(): Promise<Agent[]> {
    throw new Error(
      "Cursor adapter is write-only (target tool). Use as target_tool only.",
    );
  }

  /**
   * Delete a command from .cursor/commands/
   */
  async deleteCommand(name: string): Promise<void> {
    const commandDir = join(this.config.baseDir, ".cursor", "commands", name);

    try {
      await rm(commandDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore errors for non-existent commands
      if (
        error instanceof Error &&
        "code" in error &&
        error.code !== "ENOENT"
      ) {
        throw error;
      }
    }
  }

  async readCommands(): Promise<Command[]> {
    throw new Error(
      "Cursor adapter is write-only (target tool). Use as target_tool only.",
    );
  }
}
