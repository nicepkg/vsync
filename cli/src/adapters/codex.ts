/**
 * Codex adapter (target tool)
 * Writes skills and MCP servers to Codex configuration
 * This adapter supports both read and write operations
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import matter from "gray-matter";
import type { Skill, MCPServer, Agent, Command } from "@src/types/models.js";
import { atomicWrite } from "@src/utils/atomic-write.js";
import * as fileOps from "@src/utils/file-ops.js";
import { hashSkill, hashMCPServer } from "@src/utils/hash.js";
import type {
  AdapterConfig,
  ToolAdapter,
  ValidationResult,
  WriteResult,
} from "./base.js";

/**
 * Codex adapter
 * Reads/writes to .codex/ (project) or ~/.codex/ (user)
 * MCP servers in config.toml, skills in directories
 */
export class CodexAdapter implements ToolAdapter {
  readonly config: AdapterConfig;
  readonly toolName = "codex";
  readonly displayName = "Codex";

  constructor(config: AdapterConfig) {
    this.config = config;
  }

  getConfigDir(): string {
    return ".codex";
  }

  getConfigPaths(): string[] {
    return [join(this.getConfigDir(), "config.toml")];
  }

  getMCPConfigPaths(): string[] {
    return [join(this.getConfigDir(), "config.toml")];
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
      throw new Error("Codex MCP config path is not configured");
    }
    return mcpConfigPath;
  }

  /**
   * Read all skills from .codex/skills/
   * Same structure as Claude Code: each skill is a directory with SKILL.md
   */
  async readSkills(): Promise<Skill[]> {
    const skillsDir = join(this.config.baseDir, this.getSkillsDir());

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
    const mcpConfigPath = await this.getMcpConfigExitFullPath();

    const config =
      await fileOps.readTOML<Record<string, unknown>>(mcpConfigPath);

    if (!config?.mcp_servers || typeof config.mcp_servers !== "object") {
      return [];
    }

    try {
      const servers: MCPServer[] = [];
      const mcpServers = config.mcp_servers as Record<string, unknown>;

      for (const [name, serverConfig] of Object.entries(mcpServers)) {
        const rawConfig = serverConfig as Record<string, unknown>;
        const hasUrl = typeof rawConfig.url === "string";

        const server: MCPServer = {
          name,
          type: hasUrl ? "http" : "stdio",
          hash: "",
        };

        if (rawConfig.command) {
          server.command = rawConfig.command as string;
        }
        if (rawConfig.args) {
          server.args = rawConfig.args as string[];
        }

        if (rawConfig.url) {
          server.url = rawConfig.url as string;
        }

        const env: Record<string, string> = {};
        if (Array.isArray(rawConfig.env_vars)) {
          for (const entry of rawConfig.env_vars) {
            if (typeof entry === "string") {
              env[entry] = "${" + entry + "}";
            }
          }
        }
        if (rawConfig.env && typeof rawConfig.env === "object") {
          for (const [key, value] of Object.entries(rawConfig.env)) {
            if (typeof value === "string") {
              env[key] = value;
            }
          }
        }
        if (Object.keys(env).length > 0) {
          server.env = env;
        }

        const headers: Record<string, string> = {};
        if (
          rawConfig.http_headers &&
          typeof rawConfig.http_headers === "object"
        ) {
          for (const [key, value] of Object.entries(
            rawConfig.http_headers as Record<string, unknown>,
          )) {
            if (typeof value === "string") {
              headers[key] = value;
            }
          }
        }
        if (
          rawConfig.env_http_headers &&
          typeof rawConfig.env_http_headers === "object"
        ) {
          for (const [key, value] of Object.entries(
            rawConfig.env_http_headers as Record<string, unknown>,
          )) {
            if (typeof value === "string") {
              headers[key] = "${" + value + "}";
            }
          }
        }
        if (typeof rawConfig.bearer_token_env_var === "string") {
          headers.Authorization =
            "Bearer ${" + rawConfig.bearer_token_env_var + "}";
        }
        if (Object.keys(headers).length > 0) {
          server.headers = headers;
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
    return [];
  }

  /**
   * Read all commands from .codex/commands/
   */
  async readCommands(): Promise<Command[]> {
    return [];
  }

  /**
   * Write skills to .codex/skills/
   */
  async writeSkills(skills: Skill[]): Promise<WriteResult> {
    const skillsDir = join(this.config.baseDir, this.getSkillsDir());

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
    const mcpConfigPath = await this.getMcpConfigExitFullPath();

    try {
      // Ensure .codex directory exists
      await fileOps.ensureDir(join(this.config.baseDir, this.getConfigDir()));

      // Read existing config or create new one
      const existingMCPConfig =
        await fileOps.readTOML<Record<string, unknown>>(mcpConfigPath);
      const config: Record<string, unknown> = existingMCPConfig || {};

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
        if (server.url) {
          serverConfig.url = server.url;
        }

        if (server.env) {
          const envVars = new Set<string>();
          const envTable: Record<string, string> = {};

          for (const [key, value] of Object.entries(server.env)) {
            const envVar = this.extractEnvVarName(value);
            if (envVar) {
              envVars.add(envVar);
            } else {
              envTable[key] = value;
            }
          }

          if (envVars.size > 0) {
            serverConfig.env_vars = Array.from(envVars);
          }
          if (Object.keys(envTable).length > 0) {
            serverConfig.env = envTable;
          }
        }

        if (server.headers) {
          const httpHeaders: Record<string, string> = {};
          const envHttpHeaders: Record<string, string> = {};
          let bearerTokenEnvVar: string | undefined;

          for (const [key, value] of Object.entries(server.headers)) {
            const bearerEnvVar = this.extractBearerTokenEnvVar(value);
            if (key.toLowerCase() === "authorization" && bearerEnvVar) {
              bearerTokenEnvVar = bearerEnvVar;
              continue;
            }

            const envVar = this.extractEnvVarName(value);
            if (envVar) {
              envHttpHeaders[key] = envVar;
            } else {
              httpHeaders[key] = value;
            }
          }

          if (bearerTokenEnvVar) {
            serverConfig.bearer_token_env_var = bearerTokenEnvVar;
          }
          if (Object.keys(httpHeaders).length > 0) {
            serverConfig.http_headers = httpHeaders;
          }
          if (Object.keys(envHttpHeaders).length > 0) {
            serverConfig.env_http_headers = envHttpHeaders;
          }
        }

        mcpServers[server.name] = serverConfig;
      }

      // Write MCP config back as TOML
      await fileOps.writeTOML(mcpConfigPath, config);

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

  private extractEnvVarName(value: string): string | null {
    const envMatch =
      value.match(/^\$\{env:([A-Z0-9_]+)\}$/) ||
      value.match(/^\$\{([A-Z0-9_]+)\}$/);
    return envMatch?.[1] ?? null;
  }

  private extractBearerTokenEnvVar(value: string): string | null {
    const bearerMatch =
      value.match(/^Bearer\s+\$\{env:([A-Z0-9_]+)\}$/) ||
      value.match(/^Bearer\s+\$\{([A-Z0-9_]+)\}$/);
    return bearerMatch?.[1] ?? null;
  }

  /**
   * Write agents to .codex/agents/
   */
  async writeAgents(agents: Agent[]): Promise<WriteResult> {
    void agents;
    return {
      success: false,
      count: 0,
      error: "Codex does not support agents",
    };
  }

  /**
   * Write commands to .codex/commands/
   */
  async writeCommands(commands: Command[]): Promise<WriteResult> {
    void commands;
    return {
      success: false,
      count: 0,
      error: "Codex does not support commands",
    };
  }

  /**
   * Delete a skill from .codex/skills/
   */
  async deleteSkill(name: string): Promise<void> {
    const skillDir = join(this.config.baseDir, this.getSkillsDir(), name);

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
    const mcpConfigPath = await this.getMcpConfigExitFullPath();

    const config =
      await fileOps.readTOML<Record<string, unknown>>(mcpConfigPath);

    if (config?.mcp_servers && typeof config.mcp_servers === "object") {
      const mcpServers = config.mcp_servers as Record<string, unknown>;

      if (mcpServers[name] !== undefined) {
        delete mcpServers[name];
        await fileOps.writeTOML(mcpConfigPath, config);
      }
    }
  }

  /**
   * Delete an agent from .codex/agents/
   */
  async deleteAgent(name: string): Promise<void> {
    throw new Error(`Codex does not support agents: ${name}`);
  }

  /**
   * Delete a command from .codex/commands/
   */
  async deleteCommand(name: string): Promise<void> {
    throw new Error(`Codex does not support commands: ${name}`);
  }

  /**
   * Validate Codex configuration
   */
  async validate(): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    const codexDir = join(this.config.baseDir, this.getConfigDir());
    const codexDirStats = await fileOps.stat(codexDir);
    if (!codexDirStats) {
      warnings.push(".codex directory not found");
    } else if (!codexDirStats.isDirectory()) {
      warnings.push(".codex exists but is not a directory");
    }

    const mcpConfigPath = await this.getMcpConfigExitFullPath();
    const mcpConfigStats = await fileOps.stat(mcpConfigPath);
    if (!mcpConfigStats) {
      warnings.push("config.toml mcp config file not found");
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
