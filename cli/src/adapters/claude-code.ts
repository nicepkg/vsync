/**
 * Claude Code adapter (source tool)
 * Reads skills and MCP servers from Claude Code configuration
 * This adapter is read-only (source tool)
 */

import { readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import matter from "gray-matter";
import type { Skill, MCPServer, Agent, Command } from "@src/types/models.js";
import {
  hashSkill,
  hashMCPServer,
  hashAgent,
  hashCommand,
} from "@src/utils/hash.js";
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
  readonly toolName = "claude-code";
  readonly displayName = "Claude Code";
  readonly configFormat = "json" as const;
  readonly capabilities = {
    skills: true,
    mcp: true,
    agents: true,
    commands: true,
  } as const;
  readonly isReadOnly = true;

  constructor(config: AdapterConfig) {
    this.config = config;
  }

  /**
   * Get configuration directory name
   */
  getConfigDir(): string {
    return ".claude";
  }

  /**
   * Get configuration file paths for backup
   */
  getConfigFiles(): string[] {
    return [".mcp.json"];
  }

  /**
   * Get skills directory path
   */
  getSkillsDir(): string {
    return `${this.config.baseDir}/.claude/skills`;
  }

  /**
   * Get agents directory path
   */
  getAgentsDir(): string {
    return `${this.config.baseDir}/.claude/agents`;
  }

  /**
   * Get commands directory path
   */
  getCommandsDir(): string {
    return `${this.config.baseDir}/.claude/commands`;
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
   * Read all agents from .claude/agents/
   * Each agent is a directory with AGENT.md and optional support files
   */
  async readAgents(): Promise<Agent[]> {
    const agentsDir = join(this.config.baseDir, ".claude", "agents");

    try {
      const entries = await readdir(agentsDir, { withFileTypes: true });
      const agents: Agent[] = [];

      for (const entry of entries) {
        if (!entry.isDirectory()) {
          continue; // Skip non-directories
        }

        const agentName = entry.name;
        const agentDir = join(agentsDir, agentName);
        const agentMdPath = join(agentDir, "AGENT.md");

        try {
          // Read AGENT.md
          const agentContent = await readFile(agentMdPath, "utf-8");

          // Parse frontmatter
          const parsed = matter(agentContent);

          // Read support files
          const supportFiles: Record<string, string> = {};
          const agentFiles = await readdir(agentDir, { withFileTypes: true });

          for (const file of agentFiles) {
            if (file.name === "AGENT.md" || file.isDirectory()) {
              continue;
            }

            const filePath = join(agentDir, file.name);
            const fileContent = await readFile(filePath, "utf-8");
            supportFiles[file.name] = fileContent;
          }

          // Create agent object (omit undefined optional fields)
          const agent: Agent = {
            name: agentName,
            content: parsed.content,
            hash: "", // Will be computed
          };

          // Add optional fields only if they have values
          if (parsed.data.description) {
            agent.description = parsed.data.description as string;
          }
          if (Object.keys(parsed.data).length > 0) {
            agent.metadata = parsed.data;
          }
          if (Object.keys(supportFiles).length > 0) {
            agent.supportFiles = supportFiles;
          }

          // Compute hash
          agent.hash = hashAgent(agent);

          agents.push(agent);
        } catch (error) {
          // Skip agents with missing or invalid AGENT.md
          console.warn(
            `Skipping agent ${agentName}: ${error instanceof Error ? error.message : "Unknown error"}`,
          );
        }
      }

      return agents;
    } catch (error) {
      // Agents directory doesn't exist
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
   * Read all commands from .claude/commands/
   * Each command is a directory with COMMAND.md and optional support files
   */
  async readCommands(): Promise<Command[]> {
    const commandsDir = join(this.config.baseDir, ".claude", "commands");

    try {
      const entries = await readdir(commandsDir, { withFileTypes: true });
      const commands: Command[] = [];

      for (const entry of entries) {
        if (!entry.isDirectory()) {
          continue; // Skip non-directories
        }

        const commandName = entry.name;
        const commandDir = join(commandsDir, commandName);
        const commandMdPath = join(commandDir, "COMMAND.md");

        try {
          // Read COMMAND.md
          const commandContent = await readFile(commandMdPath, "utf-8");

          // Parse frontmatter
          const parsed = matter(commandContent);

          // Read support files
          const supportFiles: Record<string, string> = {};
          const commandFiles = await readdir(commandDir, {
            withFileTypes: true,
          });

          for (const file of commandFiles) {
            if (file.name === "COMMAND.md" || file.isDirectory()) {
              continue;
            }

            const filePath = join(commandDir, file.name);
            const fileContent = await readFile(filePath, "utf-8");
            supportFiles[file.name] = fileContent;
          }

          // Create command object (omit undefined optional fields)
          const command: Command = {
            name: commandName,
            content: parsed.content,
            hash: "", // Will be computed
          };

          // Add optional fields only if they have values
          if (parsed.data.description) {
            command.description = parsed.data.description as string;
          }
          if (Object.keys(parsed.data).length > 0) {
            command.metadata = parsed.data;
          }
          if (Object.keys(supportFiles).length > 0) {
            command.supportFiles = supportFiles;
          }

          // Compute hash
          command.hash = hashCommand(command);

          commands.push(command);
        } catch (error) {
          // Skip commands with missing or invalid COMMAND.md
          console.warn(
            `Skipping command ${commandName}: ${error instanceof Error ? error.message : "Unknown error"}`,
          );
        }
      }

      return commands;
    } catch (error) {
      // Commands directory doesn't exist
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

  async writeAgents(_agents: Agent[]): Promise<WriteResult> {
    throw new Error(
      "Claude Code adapter is read-only (source tool). Use as source_tool only.",
    );
  }

  async deleteAgent(_name: string): Promise<void> {
    throw new Error(
      "Claude Code adapter is read-only (source tool). Use as source_tool only.",
    );
  }

  async writeCommands(_commands: Command[]): Promise<WriteResult> {
    throw new Error(
      "Claude Code adapter is read-only (source tool). Use as source_tool only.",
    );
  }

  async deleteCommand(_name: string): Promise<void> {
    throw new Error(
      "Claude Code adapter is read-only (source tool). Use as source_tool only.",
    );
  }
}
