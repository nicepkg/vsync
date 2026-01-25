/**
 * Cursor adapter (target tool)
 * Writes skills and MCP servers to Cursor configuration
 * This adapter is write-only (target tool)
 */

import { readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import matter from "gray-matter";
import type {
  MCPServer,
  MCPOAuth,
  Skill,
  Agent,
  Command,
} from "@src/types/models.js";
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
 * Cursor adapter
 * Writes to .cursor/skills/ and .cursor/mcp.json
 */
export class CursorAdapter implements ToolAdapter {
  readonly config: AdapterConfig;
  readonly toolName = "cursor";
  readonly displayName = "Cursor";
  readonly configFormat = "json" as const;
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
    return ".cursor";
  }

  getConfigPaths(): string[] {
    return [];
  }

  getMCPConfigPaths(): string[] {
    return [join(this.getConfigDir(), "mcp.json")];
  }

  getSkillsDir(): string {
    return join(this.getConfigDir(), "skills");
  }

  getAgentsDir(): string {
    return join(this.getConfigDir(), "agents");
  }

  getCommandsDir(): string {
    return join(this.getConfigDir(), "commands");
  }

  private async getMcpConfigExitFullPath(): Promise<string> {
    const mcpConfigPath = await fileOps.findFirstExistingPath(
      this.getMCPConfigPaths().map((p) => join(this.config.baseDir, p)),
    );
    if (!mcpConfigPath) {
      throw new Error("Cursor MCP config path is not configured");
    }
    return mcpConfigPath;
  }

  /**
   * Write skills to .cursor/skills/
   * Each skill is a directory with SKILL.md and optional support files
   */
  async writeSkills(skills: Skill[]): Promise<WriteResult> {
    const skillsDir = join(this.config.baseDir, this.getSkillsDir());

    try {
      // Ensure skills directory exists
      await fileOps.ensureDir(skillsDir);

      for (const skill of skills) {
        const skillDir = join(skillsDir, skill.name);
        await fileOps.ensureDir(skillDir);

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
    const mcpJsonPath = await this.getMcpConfigExitFullPath();

    try {
      // Ensure .cursor directory exists
      await fileOps.ensureDir(join(this.config.baseDir, this.getConfigDir()));

      // Read existing config or create new one
      const existingConfig = await fileOps.readJSON<{
        mcpServers?: Record<string, unknown>;
      }>(mcpJsonPath);
      const config: { mcpServers: Record<string, unknown> } = {
        mcpServers: existingConfig?.mcpServers || {},
      };

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
          serverConfig.env = this.normalizeCursorVars(server.env) as Record<
            string,
            string
          >;
        }
        if (server.url) {
          serverConfig.url = server.url;
        }
        if (server.headers) {
          serverConfig.headers = this.normalizeCursorVars(
            server.headers,
          ) as Record<string, string>;
        }
        if (server.auth) {
          serverConfig.auth = this.normalizeCursorVars(server.auth) as MCPOAuth;
        }

        config.mcpServers[server.name] = serverConfig;
      }

      // Write config
      await fileOps.writeJSON(mcpJsonPath, config);

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
   * Each agent is a single .md file
   */
  async writeAgents(agents: Agent[]): Promise<WriteResult> {
    const agentsDir = join(this.config.baseDir, this.getAgentsDir());

    try {
      // Ensure agents directory exists
      await fileOps.ensureDir(agentsDir);

      for (const agent of agents) {
        // Generate agent content
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

        const agentMdPath = join(agentsDir, `${agent.name}.md`);
        await atomicWrite(agentMdPath, agentContent);
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
    const skillDir = join(this.config.baseDir, this.getSkillsDir(), name);

    try {
      await fileOps.remove(skillDir);
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
    const mcpJsonPath = await this.getMcpConfigExitFullPath();

    const config = await fileOps.readJSON<{
      mcpServers?: Record<string, unknown>;
    }>(mcpJsonPath);

    if (config?.mcpServers && typeof config.mcpServers === "object") {
      delete config.mcpServers[name];
      await fileOps.writeJSON(mcpJsonPath, config);
    }
  }

  /**
   * Write commands to .cursor/commands/
   * Each command is a single .md file
   */
  async writeCommands(commands: Command[]): Promise<WriteResult> {
    const commandsDir = join(this.config.baseDir, this.getCommandsDir());

    try {
      // Ensure commands directory exists
      await fileOps.ensureDir(commandsDir);

      for (const command of commands) {
        // Generate command content
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

        const commandMdPath = join(commandsDir, `${command.name}.md`);
        await atomicWrite(commandMdPath, commandContent);
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
    const agentPath = join(
      this.config.baseDir,
      this.getAgentsDir(),
      `${name}.md`,
    );

    try {
      await fileOps.remove(agentPath);
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

  private normalizeCursorVars(value: unknown): unknown {
    if (typeof value === "string") {
      return this.normalizeCursorString(value);
    }

    if (Array.isArray(value)) {
      return value.map((item) => this.normalizeCursorVars(item));
    }

    if (value && typeof value === "object") {
      const result: Record<string, unknown> = {};
      for (const [key, item] of Object.entries(value)) {
        result[key] = this.normalizeCursorVars(item);
      }
      return result;
    }

    return value;
  }

  private normalizeCursorString(value: string): string {
    return value.replace(/\$\{([A-Za-z0-9_]+)\}/g, (match, name) => {
      if (this.isCursorReservedVar(name)) {
        return match;
      }
      if (!/^[A-Z0-9_]+$/.test(name)) {
        return match;
      }
      return `\${env:${name}}`;
    });
  }

  private isCursorReservedVar(name: string): boolean {
    return (
      name === "workspaceFolder" ||
      name === "workspaceFolderBasename" ||
      name === "userHome" ||
      name === "pathSeparator"
    );
  }

  /**
   * Validate Cursor configuration
   */
  async validate(): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check if .cursor directory exists
    const cursorDir = join(this.config.baseDir, this.getConfigDir());
    try {
      const stats = await stat(cursorDir);
      if (!stats.isDirectory()) {
        warnings.push(".cursor exists but is not a directory");
      }
    } catch {
      warnings.push(".cursor directory not found");
    }

    // Check if mcp.json exists
    const mcpJsonPath = await this.getMcpConfigExitFullPath();
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
  /**
   * Read all skills from .cursor/skills/
   */
  async readSkills(): Promise<Skill[]> {
    const skillsDir = join(this.config.baseDir, this.getSkillsDir());

    try {
      const entries = await readdir(skillsDir, { withFileTypes: true });
      const skills: Skill[] = [];

      for (const entry of entries) {
        if (!entry.isDirectory()) continue;

        const skillName = entry.name;
        const skillDir = join(skillsDir, skillName);
        const skillMdPath = join(skillDir, "SKILL.md");

        try {
          const skillContent = await readFile(skillMdPath, "utf-8");
          const parsed = matter(skillContent);

          // Read support files
          const supportFiles: Record<string, string> = {};
          const skillFiles = await readdir(skillDir, { withFileTypes: true });

          for (const file of skillFiles) {
            if (file.name === "SKILL.md" || file.isDirectory()) continue;

            const filePath = join(skillDir, file.name);
            const fileContent = await readFile(filePath, "utf-8");
            supportFiles[file.name] = fileContent;
          }

          // Build skill object
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
   * Read MCP servers from .cursor/mcp.json
   */
  async readMCPServers(): Promise<MCPServer[]> {
    const mcpJsonPath = await this.getMcpConfigExitFullPath();

    try {
      const content = await readFile(mcpJsonPath, "utf-8");
      const config = JSON.parse(content);

      if (!config.mcpServers || typeof config.mcpServers !== "object") {
        return [];
      }

      const servers: MCPServer[] = [];

      for (const [name, serverConfig] of Object.entries(config.mcpServers)) {
        const rawConfig = serverConfig as Record<string, unknown>;

        const hasCommand = typeof rawConfig.command === "string";
        const hasAuth =
          rawConfig.auth !== undefined && typeof rawConfig.auth === "object";
        const hasUrl = typeof rawConfig.url === "string";

        let type: MCPServer["type"] = "stdio";
        if (hasCommand) {
          type = "stdio";
        } else if (hasAuth) {
          type = "oauth";
        } else if (hasUrl) {
          type = "http";
        }

        const server: MCPServer = {
          name,
          type,
          hash: "",
        };

        if (rawConfig.command) server.command = rawConfig.command as string;
        if (rawConfig.args) server.args = rawConfig.args as string[];
        if (rawConfig.env) server.env = rawConfig.env as Record<string, string>;
        if (rawConfig.url) server.url = rawConfig.url as string;
        if (rawConfig.headers)
          server.headers = rawConfig.headers as Record<string, string>;
        if (rawConfig.auth) server.auth = rawConfig.auth as unknown as MCPOAuth;

        server.hash = hashMCPServer(server);
        servers.push(server);
      }

      return servers;
    } catch (error) {
      if (
        error instanceof Error &&
        "code" in error &&
        error.code === "ENOENT"
      ) {
        return [];
      }
      console.warn(
        `Failed to read mcp.json: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
      return [];
    }
  }

  /**
   * Read all agents from .cursor/agents/
   */
  async readAgents(): Promise<Agent[]> {
    const agentsDir = join(this.config.baseDir, this.getAgentsDir());

    try {
      const entries = await readdir(agentsDir, { withFileTypes: true });
      const agents: Agent[] = [];

      for (const entry of entries) {
        if (!entry.isFile() || !entry.name.endsWith(".md")) continue;

        const agentName = entry.name.slice(0, -3);
        const agentMdPath = join(agentsDir, entry.name);

        try {
          const agentContent = await readFile(agentMdPath, "utf-8");
          const parsed = matter(agentContent);

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
   * Delete a command from .cursor/commands/
   */
  async deleteCommand(name: string): Promise<void> {
    const commandPath = join(
      this.config.baseDir,
      this.getCommandsDir(),
      `${name}.md`,
    );

    try {
      await fileOps.remove(commandPath);
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

  /**
   * Read all commands from .cursor/commands/
   */
  async readCommands(): Promise<Command[]> {
    const commandsDir = join(this.config.baseDir, this.getCommandsDir());

    try {
      const entries = await readdir(commandsDir, { withFileTypes: true });
      const commands: Command[] = [];

      for (const entry of entries) {
        if (!entry.isFile() || !entry.name.endsWith(".md")) continue;

        const commandName = entry.name.slice(0, -3);
        const commandMdPath = join(commandsDir, entry.name);

        try {
          const commandContent = await readFile(commandMdPath, "utf-8");
          const parsed = matter(commandContent);

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
}
