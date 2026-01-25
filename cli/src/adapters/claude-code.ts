/**
 * Claude Code adapter (source tool)
 * Reads skills and MCP servers from Claude Code configuration
 * This adapter is read-only (source tool)
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import matter from "gray-matter";
import type { Skill, MCPServer, Agent, Command } from "@src/types/models.js";
import * as fileOps from "@src/utils/file-ops.js";
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

  getConfigPaths(): string[] {
    return [join(this.getConfigDir(), "settings.json")];
  }

  /**
   * Get configuration file paths for backup
   */
  getMCPConfigPaths(): string[] {
    if (this.config.level === "user") {
      return [join(this.getConfigDir(), "mcp.json")];
    }

    return [".mcp.json"];
  }

  /**
   * Get skills directory path
   */
  getSkillsDir(): string {
    return join(this.getConfigDir(), "skills");
  }

  /**
   * Get agents directory path
   */
  getAgentsDir(): string {
    return join(this.getConfigDir(), "agents");
  }

  /**
   * Get commands directory path
   */
  getCommandsDir(): string {
    return join(this.getConfigDir(), "commands");
  }

  private async getMcpConfigExitFullPath(): Promise<string> {
    const mcpConfigPath = await fileOps.findFirstExistingPath(
      this.getMCPConfigPaths().map((p) => join(this.config.baseDir, p)),
    );
    if (!mcpConfigPath) {
      throw new Error("Claude Code MCP config path is not configured");
    }
    return mcpConfigPath;
  }

  /**
   * Read all skills from .claude/skills/
   * Each skill is a directory with SKILL.md and optional support files
   */
  async readSkills(): Promise<Skill[]> {
    const skillsDir = join(this.config.baseDir, this.getSkillsDir());

    try {
      const entries = await fileOps.readdir(skillsDir, { withFileTypes: true });
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
          const skillFiles = await fileOps.readdir(skillDir, {
            withFileTypes: true,
          });

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
    const mcpJsonPath = await this.getMcpConfigExitFullPath();

    try {
      const config = await fileOps.readJSON<{
        mcpServers?: Record<string, unknown>;
      }>(mcpJsonPath);

      if (!config?.mcpServers || typeof config.mcpServers !== "object") {
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
      // Invalid JSON
      console.warn(
        `Failed to read .mcp.json: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
      return [];
    }
  }

  /**
   * Read all agents from .claude/agents/
   * Each agent is a single .md file
   */
  async readAgents(): Promise<Agent[]> {
    const agentsDir = join(this.config.baseDir, this.getAgentsDir());

    try {
      const entries = await fileOps.readdir(agentsDir, { withFileTypes: true });
      const agents: Agent[] = [];

      for (const entry of entries) {
        if (!entry.isFile() || !entry.name.endsWith(".md")) {
          continue; // Skip non-markdown files
        }

        const agentName = entry.name.slice(0, -3);
        const agentMdPath = join(agentsDir, entry.name);

        try {
          const agentContent = await readFile(agentMdPath, "utf-8");

          // Parse frontmatter
          const parsed = matter(agentContent);

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

          // Compute hash
          agent.hash = hashAgent(agent);

          agents.push(agent);
        } catch (error) {
          // Skip agents with missing or invalid .md file
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
   * Each command is a single .md file
   */
  async readCommands(): Promise<Command[]> {
    const commandsDir = join(this.config.baseDir, this.getCommandsDir());

    try {
      const entries = await fileOps.readdir(commandsDir, {
        withFileTypes: true,
      });
      const commands: Command[] = [];

      for (const entry of entries) {
        if (!entry.isFile() || !entry.name.endsWith(".md")) {
          continue; // Skip non-markdown files
        }

        const commandName = entry.name.slice(0, -3);
        const commandMdPath = join(commandsDir, entry.name);

        try {
          const commandContent = await readFile(commandMdPath, "utf-8");

          // Parse frontmatter
          const parsed = matter(commandContent);

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

          // Compute hash
          command.hash = hashCommand(command);

          commands.push(command);
        } catch (error) {
          // Skip commands with missing or invalid .md file
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
    const configDirPath = join(this.config.baseDir, this.getConfigDir());
    const configDirStats = await fileOps.stat(configDirPath);
    if (!configDirStats) {
      warnings.push(".claude directory not found");
    } else if (!configDirStats.isDirectory()) {
      warnings.push(".claude exists but is not a directory");
    }

    // Check if .mcp.json exists
    const mcpJsonPath = await this.getMcpConfigExitFullPath();
    const mcpJsonStats = await fileOps.stat(mcpJsonPath);
    if (!mcpJsonStats) {
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
