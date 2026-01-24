/**
 * OpenCode adapter (target tool)
 * Writes skills and MCP servers to OpenCode configuration
 * This adapter is write-only (target tool)
 */

import { mkdir, readdir, readFile, rm, stat } from "node:fs/promises";
import { join } from "node:path";
import matter from "gray-matter";
import * as jsonc from "jsonc-parser";
import type { MCPServer, Skill, Agent, Command } from "@src/types/models.js";
import { atomicWrite } from "@src/utils/atomic-write.js";
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
 * OpenCode adapter
 * Writes to .opencode/skills/ and opencode.jsonc
 */
export class OpenCodeAdapter implements ToolAdapter {
  readonly config: AdapterConfig;
  readonly toolName = "opencode";
  readonly displayName = "OpenCode";
  readonly configFormat = "jsonc" as const;
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
    return ".opencode";
  }

  getConfigFiles(): string[] {
    return ["opencode.jsonc"];
  }

  getSkillsDir(): string {
    return `${this.config.baseDir}/.opencode/skills`;
  }

  getAgentsDir(): string {
    return `${this.config.baseDir}/.opencode/agents`;
  }

  getCommandsDir(): string {
    return `${this.config.baseDir}/.opencode/commands`;
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
   * ${env:VAR} -> ${VAR} (OpenCode format)
   */
  private convertEnvVars(
    obj: Record<string, unknown>,
  ): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === "string") {
        // OpenCode uses ${VAR} without "env:" prefix
        // Convert ${env:VAR} → ${VAR}
        result[key] = value.replace(/\$\{env:([^}]+)\}/g, "${$1}");
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
   * Write commands to .opencode/commands/
   * Same structure as Cursor
   */
  async writeCommands(commands: Command[]): Promise<WriteResult> {
    const commandsDir = join(this.config.baseDir, ".opencode", "commands");

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
  // Read methods - use same structure as Cursor, just replace .cursor with .opencode
  async readSkills(): Promise<Skill[]> {
    return this.readItemsGeneric<Skill>("skills", "SKILL.md", hashSkill);
  }

  async readMCPServers(): Promise<MCPServer[]> {
    const jsoncPath = join(this.config.baseDir, "opencode.jsonc");
    try {
      const content = await readFile(jsoncPath, "utf-8");
      const config = jsonc.parse(content) as Record<string, unknown>;
      if (!config?.mcp || typeof config.mcp !== "object") return [];

      const servers: MCPServer[] = [];
      for (const [name, serverConfig] of Object.entries(
        config.mcp as Record<string, unknown>,
      )) {
        const raw = serverConfig as Record<string, unknown>;
        const server: MCPServer = { name, type: "stdio", hash: "" };
        if (raw.command) server.command = raw.command as string;
        if (raw.args) server.args = raw.args as string[];
        if (raw.env) server.env = raw.env as Record<string, string>;
        server.hash = hashMCPServer(server);
        servers.push(server);
      }
      return servers;
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "ENOENT")
        return [];
      return [];
    }
  }

  async readAgents(): Promise<Agent[]> {
    return this.readItemsGeneric<Agent>("agents", "AGENT.md", hashAgent);
  }

  private async readItemsGeneric<T extends Skill | Agent | Command>(
    dirName: string,
    fileName: string,
    hashFn: (item: T) => string,
  ): Promise<T[]> {
    const itemsDir = join(this.config.baseDir, ".opencode", dirName);
    try {
      const entries = await readdir(itemsDir, { withFileTypes: true });
      const items: T[] = [];
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const itemName = entry.name;
        const itemDir = join(itemsDir, itemName);
        const itemPath = join(itemDir, fileName);
        try {
          const content = await readFile(itemPath, "utf-8");
          const parsed = matter(content);
          const supportFiles: Record<string, string> = {};
          const files = await readdir(itemDir, { withFileTypes: true });
          for (const file of files) {
            if (file.name === fileName || file.isDirectory()) continue;
            const filePath = join(itemDir, file.name);
            supportFiles[file.name] = await readFile(filePath, "utf-8");
          }
          const item: any = {
            name: itemName,
            content: parsed.content,
            hash: "",
          };
          if (parsed.data.description)
            item.description = parsed.data.description;
          if (Object.keys(parsed.data).length > 0) item.metadata = parsed.data;
          if (Object.keys(supportFiles).length > 0)
            item.supportFiles = supportFiles;
          item.hash = hashFn(item);
          items.push(item);
        } catch {
          console.warn(`Skipping ${dirName} ${itemName}`);
        }
      }
      return items;
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "ENOENT")
        return [];
      throw error;
    }
  }

  /**
   * Delete a command from .opencode/commands/
   */
  async deleteCommand(name: string): Promise<void> {
    const commandDir = join(this.config.baseDir, ".opencode", "commands", name);

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
    return this.readItemsGeneric<Command>(
      "commands",
      "COMMAND.md",
      hashCommand,
    );
  }
}
