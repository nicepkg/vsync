/**
 * Codex adapter (target tool)
 * Writes skills, agents, commands, and MCP servers to Codex configuration
 * This adapter supports both read and write operations
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import matter from "gray-matter";
import type { Skill, MCPServer, Agent, Command } from "@src/types/models.js";
import { atomicWrite } from "@src/utils/atomic-write.js";
import * as fileOps from "@src/utils/file-ops.js";
import {
  hashSkill,
  hashMCPServer,
  hashAgent,
  hashCommand,
} from "@src/utils/hash.js";
import type {
  AdapterConfig,
  ToolAdapter,
  ValidationResult,
  WriteResult,
} from "./base.js";

/**
 * Codex adapter
 * Reads/writes to .codex/ (project) or ~/.codex/ (user)
 * MCP servers in config.toml, skills/agents/commands in directories
 */
export class CodexAdapter implements ToolAdapter {
  readonly config: AdapterConfig;
  readonly toolName = "codex";
  readonly displayName = "Codex";
  readonly configFormat = "toml" as const;
  readonly capabilities = {
    skills: true,
    mcp: true,
    agents: true,
    commands: true,
  } as const;
  readonly isReadOnly = false;

  constructor(config: AdapterConfig) {
    this.config = config;
  }

  getConfigDir(): string {
    return ".codex";
  }

  getConfigFiles(): string[] {
    return [".codex/config.toml"];
  }

  getSkillsDir(): string {
    return `${this.config.baseDir}/.codex/skills`;
  }

  getAgentsDir(): string {
    return `${this.config.baseDir}/.codex/agents`;
  }

  getCommandsDir(): string {
    return `${this.config.baseDir}/.codex/commands`;
  }

  /**
   * Get Codex base directory
   * Uses baseDir from config (can be project or user directory)
   */
  private getCodexDir(): string {
    return join(this.config.baseDir, ".codex");
  }

  /**
   * Get path to config.toml
   */
  private getConfigPath(): string {
    return join(this.getCodexDir(), "config.toml");
  }

  /**
   * Read all skills from .codex/skills/
   * Same structure as Claude Code: each skill is a directory with SKILL.md
   */
  async readSkills(): Promise<Skill[]> {
    const skillsDir = join(this.getCodexDir(), "skills");

    try {
      const entries = await fileOps.readdir(skillsDir, { withFileTypes: true });
      const skills: Skill[] = [];

      for (const entry of entries) {
        if (!entry.isDirectory()) {
          continue;
        }

        const skillName = entry.name;
        const skillDir = join(skillsDir, skillName);
        const skillMdPath = join(skillDir, "SKILL.md");

        try {
          const skillContent = await readFile(skillMdPath, "utf-8");
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

          const skill: Skill = {
            name: skillName,
            content: parsed.content,
            hash: "",
          };

          if (parsed.data.description) {
            skill.description = parsed.data.description as string;
          }
          if (Object.keys(parsed.data).length > 0) {
            skill.metadata = parsed.data;
          }
          if (Object.keys(supportFiles).length > 0) {
            skill.supportFiles = supportFiles;
          }

          skill.hash = hashSkill(skill);
          skills.push(skill);
        } catch (error) {
          console.warn(
            `Skipping skill ${skillName}: ${error instanceof Error ? error.message : "Unknown error"}`,
          );
        }
      }

      return skills;
    } catch (error) {
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
   * Read all MCP servers from config.toml
   * Format: [mcp_servers.<name>]
   */
  async readMCPServers(): Promise<MCPServer[]> {
    const configPath = this.getConfigPath();

    const config = await fileOps.readTOML<Record<string, unknown>>(configPath);

    if (!config?.mcp_servers || typeof config.mcp_servers !== "object") {
      return [];
    }

    try {
      const servers: MCPServer[] = [];
      const mcpServers = config.mcp_servers as Record<string, unknown>;

      for (const [name, serverConfig] of Object.entries(mcpServers)) {
        const rawConfig = serverConfig as Record<string, unknown>;

        const server: MCPServer = {
          name,
          type: "stdio", // Codex primarily supports stdio
          hash: "",
        };

        if (rawConfig.command) {
          server.command = rawConfig.command as string;
        }
        if (rawConfig.args) {
          server.args = rawConfig.args as string[];
        }
        if (rawConfig.env) {
          server.env = rawConfig.env as Record<string, string>;
        }

        server.hash = hashMCPServer(server);
        servers.push(server);
      }

      return servers;
    } catch (error) {
      // Invalid TOML
      console.warn(
        `Failed to read config.toml: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
      return [];
    }
  }

  /**
   * Read all agents from .codex/agents/
   */
  async readAgents(): Promise<Agent[]> {
    const agentsDir = join(this.getCodexDir(), "agents");

    try {
      const entries = await fileOps.readdir(agentsDir, { withFileTypes: true });
      const agents: Agent[] = [];

      for (const entry of entries) {
        if (!entry.isDirectory()) {
          continue;
        }

        const agentName = entry.name;
        const agentDir = join(agentsDir, agentName);
        const agentMdPath = join(agentDir, "AGENT.md");

        try {
          const agentContent = await readFile(agentMdPath, "utf-8");
          const parsed = matter(agentContent);

          const supportFiles: Record<string, string> = {};
          const agentFiles = await fileOps.readdir(agentDir, {
            withFileTypes: true,
          });

          for (const file of agentFiles) {
            if (file.name === "AGENT.md" || file.isDirectory()) {
              continue;
            }

            const filePath = join(agentDir, file.name);
            const fileContent = await readFile(filePath, "utf-8");
            supportFiles[file.name] = fileContent;
          }

          const agent: Agent = {
            name: agentName,
            content: parsed.content,
            hash: "",
          };

          if (parsed.data.description) {
            agent.description = parsed.data.description as string;
          }
          if (Object.keys(parsed.data).length > 0) {
            agent.metadata = parsed.data;
          }
          if (Object.keys(supportFiles).length > 0) {
            agent.supportFiles = supportFiles;
          }

          agent.hash = hashAgent(agent);
          agents.push(agent);
        } catch (error) {
          console.warn(
            `Skipping agent ${agentName}: ${error instanceof Error ? error.message : "Unknown error"}`,
          );
        }
      }

      return agents;
    } catch (error) {
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
   * Read all commands from .codex/commands/
   */
  async readCommands(): Promise<Command[]> {
    const commandsDir = join(this.getCodexDir(), "commands");

    try {
      const entries = await fileOps.readdir(commandsDir, {
        withFileTypes: true,
      });
      const commands: Command[] = [];

      for (const entry of entries) {
        if (!entry.isDirectory()) {
          continue;
        }

        const commandName = entry.name;
        const commandDir = join(commandsDir, commandName);
        const commandMdPath = join(commandDir, "COMMAND.md");

        try {
          const commandContent = await readFile(commandMdPath, "utf-8");
          const parsed = matter(commandContent);

          const supportFiles: Record<string, string> = {};
          const commandFiles = await fileOps.readdir(commandDir, {
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

          const command: Command = {
            name: commandName,
            content: parsed.content,
            hash: "",
          };

          if (parsed.data.description) {
            command.description = parsed.data.description as string;
          }
          if (Object.keys(parsed.data).length > 0) {
            command.metadata = parsed.data;
          }
          if (Object.keys(supportFiles).length > 0) {
            command.supportFiles = supportFiles;
          }

          command.hash = hashCommand(command);
          commands.push(command);
        } catch (error) {
          console.warn(
            `Skipping command ${commandName}: ${error instanceof Error ? error.message : "Unknown error"}`,
          );
        }
      }

      return commands;
    } catch (error) {
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
   * Write skills to .codex/skills/
   */
  async writeSkills(skills: Skill[]): Promise<WriteResult> {
    const skillsDir = join(this.getCodexDir(), "skills");

    try {
      await fileOps.ensureDir(skillsDir);

      for (const skill of skills) {
        const skillDir = join(skillsDir, skill.name);
        await fileOps.ensureDir(skillDir);

        let skillContent = skill.content;

        if (skill.metadata || skill.description) {
          const frontmatter: Record<string, unknown> = {
            ...(skill.metadata || {}),
          };

          if (skill.description) {
            frontmatter.description = skill.description;
          }

          frontmatter.name = skill.name;
          skillContent = matter.stringify(skill.content, frontmatter);
        }

        const skillMdPath = join(skillDir, "SKILL.md");
        await atomicWrite(skillMdPath, skillContent);

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
   * Write MCP servers to config.toml
   */
  async writeMCPServers(servers: MCPServer[]): Promise<WriteResult> {
    const configPath = this.getConfigPath();

    try {
      // Ensure .codex directory exists
      await fileOps.ensureDir(this.getCodexDir());

      // Read existing config or create new one
      const existingConfig =
        await fileOps.readTOML<Record<string, unknown>>(configPath);
      const config: Record<string, unknown> = existingConfig || {};

      // Ensure mcp_servers section exists
      if (!config.mcp_servers || typeof config.mcp_servers !== "object") {
        config.mcp_servers = {};
      }

      const mcpServers = config.mcp_servers as Record<string, unknown>;

      // Add/update each server
      for (const server of servers) {
        const serverConfig: Record<string, unknown> = {};

        if (server.command) {
          serverConfig.command = server.command;
        }
        if (server.args) {
          serverConfig.args = server.args;
        }
        if (server.env) {
          serverConfig.env = server.env;
        }

        mcpServers[server.name] = serverConfig;
      }

      // Write config back as TOML
      await fileOps.writeTOML(configPath, config);

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
   * Write agents to .codex/agents/
   */
  async writeAgents(agents: Agent[]): Promise<WriteResult> {
    const agentsDir = join(this.getCodexDir(), "agents");

    try {
      await fileOps.ensureDir(agentsDir);

      for (const agent of agents) {
        const agentDir = join(agentsDir, agent.name);
        await fileOps.ensureDir(agentDir);

        let agentContent = agent.content;

        if (agent.metadata || agent.description) {
          const frontmatter: Record<string, unknown> = {
            ...(agent.metadata || {}),
          };

          if (agent.description) {
            frontmatter.description = agent.description;
          }

          frontmatter.name = agent.name;
          agentContent = matter.stringify(agent.content, frontmatter);
        }

        const agentMdPath = join(agentDir, "AGENT.md");
        await atomicWrite(agentMdPath, agentContent);

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
   * Write commands to .codex/commands/
   */
  async writeCommands(commands: Command[]): Promise<WriteResult> {
    const commandsDir = join(this.getCodexDir(), "commands");

    try {
      await fileOps.ensureDir(commandsDir);

      for (const command of commands) {
        const commandDir = join(commandsDir, command.name);
        await fileOps.ensureDir(commandDir);

        let commandContent = command.content;

        if (command.metadata || command.description) {
          const frontmatter: Record<string, unknown> = {
            ...(command.metadata || {}),
          };

          if (command.description) {
            frontmatter.description = command.description;
          }

          frontmatter.name = command.name;
          commandContent = matter.stringify(command.content, frontmatter);
        }

        const commandMdPath = join(commandDir, "COMMAND.md");
        await atomicWrite(commandMdPath, commandContent);

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
   * Delete a skill from .codex/skills/
   */
  async deleteSkill(name: string): Promise<void> {
    const skillDir = join(this.getCodexDir(), "skills", name);

    try {
      await fileOps.remove(skillDir);
    } catch (error) {
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
   * Delete an MCP server from config.toml
   */
  async deleteMCPServer(name: string): Promise<void> {
    const configPath = this.getConfigPath();

    const config = await fileOps.readTOML<Record<string, unknown>>(configPath);

    if (config?.mcp_servers && typeof config.mcp_servers === "object") {
      const mcpServers = config.mcp_servers as Record<string, unknown>;

      if (mcpServers[name] !== undefined) {
        delete mcpServers[name];
        await fileOps.writeTOML(configPath, config);
      }
    }
  }

  /**
   * Delete an agent from .codex/agents/
   */
  async deleteAgent(name: string): Promise<void> {
    const agentDir = join(this.getCodexDir(), "agents", name);

    try {
      await fileOps.remove(agentDir);
    } catch (error) {
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
   * Delete a command from .codex/commands/
   */
  async deleteCommand(name: string): Promise<void> {
    const commandDir = join(this.getCodexDir(), "commands", name);

    try {
      await fileOps.remove(commandDir);
    } catch (error) {
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
   * Validate Codex configuration
   */
  async validate(): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    const codexDir = this.getCodexDir();
    const codexDirStats = await fileOps.stat(codexDir);
    if (!codexDirStats) {
      warnings.push(".codex directory not found");
    } else if (!codexDirStats.isDirectory()) {
      warnings.push(".codex exists but is not a directory");
    }

    const configPath = this.getConfigPath();
    const configStats = await fileOps.stat(configPath);
    if (!configStats) {
      warnings.push("config.toml not found");
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
}
