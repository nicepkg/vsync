/**
 * OpenCode adapter (target tool)
 * Writes skills and MCP servers to OpenCode configuration
 * This adapter is write-only (target tool)
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import matter from "gray-matter";
import * as jsonc from "jsonc-parser";
import type {
  MCPServer,
  Skill,
  Agent,
  Command,
  MCPOAuth,
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

  getConfigPaths(): string[] {
    if (this.config.level === "user") {
      return [".opencode/opencode.json", ".opencode/opencode.jsonc"];
    }
    return ["opencode.json", "opencode.jsonc"];
  }

  getMCPConfigPaths(): string[] {
    return this.getConfigPaths();
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
      throw new Error("OpenCode MCP config path is not configured");
    }
    return mcpConfigPath;
  }

  /**
   * Write skills to .opencode/skills/
   * Same structure as Cursor
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
   * Write MCP servers to opencode.jsonc
   * OpenCode uses:
   * - `mcp` field (not `mcpServers`)
   * - `type` field is required ("local" or "remote")
   * - `command` is an array of strings
   * - Environment variables use {env:VAR} format
   */
  async writeMCPServers(servers: MCPServer[]): Promise<WriteResult> {
    const mcpConfigJsoncPath = await this.getMcpConfigExitFullPath();

    try {
      await fileOps.ensureDir(join(this.config.baseDir, this.getConfigDir()));

      // Read existing config or create new one
      const { data: config, text: jsoncText } =
        await fileOps.readJSONC<Record<string, unknown>>(mcpConfigJsoncPath);
      let currentText = jsoncText || "{}";
      const currentConfig = config || {};

      // Ensure mcp object exists by applying edit if needed
      if (!currentConfig.mcp || typeof currentConfig.mcp !== "object") {
        const edits = jsonc.modify(
          currentText,
          ["mcp"],
          {},
          {
            formattingOptions: {
              insertSpaces: true,
              tabSize: 2,
            },
          },
        );
        currentText = jsonc.applyEdits(currentText, edits);
      }

      // Add/update each server using targeted edits
      for (const server of servers) {
        const serverConfig: Record<string, unknown> = {};

        // Add type field (required for OpenCode)
        // Map stdio -> "local", http/oauth -> "remote"
        serverConfig.type = server.type === "stdio" ? "local" : "remote";

        // Add other fields
        if (server.command) {
          serverConfig.command = [
            server.command,
            ...(server.args ? server.args : []),
          ];
        }
        if (server.env) {
          // Convert environment variables to {env:VAR}
          serverConfig.environment = this.toOpenCodeEnvVars(server.env);
        }
        if (server.url) {
          serverConfig.url = server.url;
        }
        if (server.headers) {
          // Convert environment variables in headers
          serverConfig.headers = this.toOpenCodeEnvVars(server.headers);
        }
        if (server.auth) {
          serverConfig.oauth = this.toOpenCodeOAuth(server.auth);
        }

        // Apply edit for this specific server (preserves comments)
        const edits = jsonc.modify(
          currentText,
          ["mcp", server.name],
          serverConfig,
          {
            formattingOptions: {
              insertSpaces: true,
              tabSize: 2,
            },
          },
        );
        currentText = jsonc.applyEdits(currentText, edits);
      }

      // Write config (currentText already has all modifications applied)
      await atomicWrite(mcpConfigJsoncPath, currentText);

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
   * Convert environment variables recursively
   * ${env:VAR} or ${VAR} -> {env:VAR} (OpenCode format)
   */
  private toOpenCodeEnvVars(
    obj: Record<string, unknown>,
  ): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === "string") {
        result[key] = this.toOpenCodeEnvString(value);
      } else if (Array.isArray(value)) {
        result[key] = value.map((item) => {
          if (typeof item === "string") {
            return this.toOpenCodeEnvString(item);
          }
          if (item && typeof item === "object") {
            return this.toOpenCodeEnvVars(item as Record<string, unknown>);
          }
          return item;
        });
      } else if (typeof value === "object" && value !== null) {
        result[key] = this.toOpenCodeEnvVars(value as Record<string, unknown>);
      } else {
        result[key] = value;
      }
    }

    return result;
  }

  private toOpenCodeEnvString(value: string): string {
    const withEnvPrefix = value.replace(/\$\{env:([^}]+)\}/g, "{env:$1}");
    return withEnvPrefix.replace(/\$\{([A-Z0-9_]+)\}/g, "{env:$1}");
  }

  private fromOpenCodeEnvString(value: string): string {
    return value.replace(/\{env:([^}]+)\}/g, "${$1}");
  }

  private fromOpenCodeEnvVars(
    obj: Record<string, unknown>,
  ): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === "string") {
        result[key] = this.fromOpenCodeEnvString(value);
      } else if (Array.isArray(value)) {
        result[key] = value.map((item) => {
          if (typeof item === "string") {
            return this.fromOpenCodeEnvString(item);
          }
          if (item && typeof item === "object") {
            return this.fromOpenCodeEnvVars(item as Record<string, unknown>);
          }
          return item;
        });
      } else if (typeof value === "object" && value !== null) {
        result[key] = this.fromOpenCodeEnvVars(
          value as Record<string, unknown>,
        );
      } else {
        result[key] = value;
      }
    }

    return result;
  }

  private toOpenCodeOAuth(auth: MCPOAuth): Record<string, unknown> {
    const oauth: Record<string, unknown> = {};
    if (auth.client_id) {
      oauth.clientId = this.toOpenCodeEnvString(auth.client_id);
    }
    if (auth.client_secret) {
      oauth.clientSecret = this.toOpenCodeEnvString(auth.client_secret);
    }
    if (auth.scopes && auth.scopes.length > 0) {
      oauth.scope = auth.scopes.join(" ");
    }
    return oauth;
  }

  private fromOpenCodeOAuth(
    oauth: Record<string, unknown>,
  ): MCPOAuth | undefined {
    const auth: MCPOAuth = {
      client_id: "",
      client_secret: "",
    };

    if (typeof oauth.clientId === "string") {
      auth.client_id = this.fromOpenCodeEnvString(oauth.clientId);
    }
    if (typeof oauth.clientSecret === "string") {
      auth.client_secret = this.fromOpenCodeEnvString(oauth.clientSecret);
    }
    if (typeof oauth.scope === "string") {
      auth.scopes = oauth.scope.split(/\s+/).filter(Boolean);
    } else if (Array.isArray(oauth.scopes)) {
      auth.scopes = oauth.scopes.filter(
        (scope): scope is string => typeof scope === "string",
      );
    }

    if (!auth.client_id && !auth.client_secret && !auth.scopes?.length) {
      return undefined;
    }

    return auth;
  }

  /**
   * Delete a skill from .opencode/skills/
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
   * Delete an MCP server from opencode.jsonc
   */
  async deleteMCPServer(name: string): Promise<void> {
    const mcpConfigJsoncPath = await this.getMcpConfigExitFullPath();

    const { data: config, text: jsoncText } =
      await fileOps.readJSONC<Record<string, unknown>>(mcpConfigJsoncPath);

    if (config?.mcp && typeof config.mcp === "object") {
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
        const updatedText = jsonc.applyEdits(jsoncText, edits);

        await atomicWrite(mcpConfigJsoncPath, updatedText);
      }
    }
  }

  /**
   * Write commands to .opencode/commands/
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
   * Delete an agent from .opencode/agents/
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

  /**
   * Validate OpenCode configuration
   */
  async validate(): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check if .opencode directory exists
    const opencodeDir = join(this.config.baseDir, this.getConfigDir());
    const opencodeDirStats = await fileOps.stat(opencodeDir);
    if (!opencodeDirStats) {
      warnings.push(".opencode directory not found");
    } else if (!opencodeDirStats.isDirectory()) {
      warnings.push(".opencode exists but is not a directory");
    }

    // Check if opencode.jsonc exists
    const mcpConfigJsoncPath = await this.getMcpConfigExitFullPath();
    const mcpConfigJsoncStats = await fileOps.stat(mcpConfigJsoncPath);
    if (!mcpConfigJsoncStats) {
      warnings.push("opencode.json not found");
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
    return this.readItemsGeneric<Skill>(
      this.getSkillsDir(),
      "SKILL.md",
      hashSkill,
    );
  }

  async readMCPServers(): Promise<MCPServer[]> {
    const mcpConfigJsoncPath = await this.getMcpConfigExitFullPath();

    const { data: config } =
      await fileOps.readJSONC<Record<string, unknown>>(mcpConfigJsoncPath);

    if (!config?.mcp || typeof config.mcp !== "object") {
      return [];
    }

    const servers: MCPServer[] = [];
    for (const [name, serverConfig] of Object.entries(
      config.mcp as Record<string, unknown>,
    )) {
      const raw = serverConfig as Record<string, unknown>;
      const rawType =
        raw.type === "local" || raw.type === "remote" ? raw.type : null;
      if (!rawType) {
        console.warn(`Skipping MCP server ${name}: invalid type`);
        continue;
      }

      const isRemote = rawType === "remote";
      const server: MCPServer = {
        name,
        type: isRemote && raw.oauth ? "oauth" : isRemote ? "http" : "stdio",
        hash: "",
      };

      if (rawType === "local") {
        if (!Array.isArray(raw.command)) {
          console.warn(`Skipping MCP server ${name}: invalid command`);
          continue;
        }
        const [command, ...args] = raw.command;
        if (typeof command !== "string") {
          console.warn(`Skipping MCP server ${name}: invalid command`);
          continue;
        }
        server.command = command;
        const safeArgs = args.filter(
          (arg): arg is string => typeof arg === "string",
        );
        if (safeArgs.length > 0) {
          server.args = safeArgs;
        }
      } else {
        if (typeof raw.url !== "string") {
          console.warn(`Skipping MCP server ${name}: invalid url`);
          continue;
        }
        server.url = raw.url;
      }

      if (raw.environment && typeof raw.environment === "object") {
        server.env = this.fromOpenCodeEnvVars(
          raw.environment as Record<string, unknown>,
        ) as Record<string, string>;
      }
      if (raw.headers && typeof raw.headers === "object") {
        server.headers = this.fromOpenCodeEnvVars(
          raw.headers as Record<string, unknown>,
        ) as Record<string, string>;
      }
      if (isRemote && raw.oauth && typeof raw.oauth === "object") {
        const auth = this.fromOpenCodeOAuth(
          raw.oauth as Record<string, unknown>,
        );
        if (auth) {
          server.auth = auth;
        }
      }
      server.hash = hashMCPServer(server);
      servers.push(server);
    }
    return servers;
  }

  async readAgents(): Promise<Agent[]> {
    return this.readFlatMarkdownItems<Agent>(this.getAgentsDir(), hashAgent);
  }

  private async readItemsGeneric<T extends Skill>(
    dirName: string,
    fileName: string,
    hashFn: (item: T) => string,
  ): Promise<T[]> {
    const itemsDir = join(this.config.baseDir, dirName);
    try {
      const entries = await fileOps.readdir(itemsDir, { withFileTypes: true });
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
          const files = await fileOps.readdir(itemDir, { withFileTypes: true });
          for (const file of files) {
            if (file.name === fileName || file.isDirectory()) continue;
            const filePath = join(itemDir, file.name);
            supportFiles[file.name] = await readFile(filePath, "utf-8");
          }
          const item = {
            name: itemName,
            content: parsed.content,
            hash: "",
          } as T;
          const itemMeta = item as T & {
            description?: string;
            metadata?: Record<string, unknown>;
            supportFiles?: Record<string, string>;
          };
          if (parsed.data.description)
            itemMeta.description = parsed.data.description;
          if (Object.keys(parsed.data).length > 0)
            itemMeta.metadata = parsed.data;
          if (Object.keys(supportFiles).length > 0)
            itemMeta.supportFiles = supportFiles;
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

  private async readFlatMarkdownItems<T extends Agent | Command>(
    dirName: string,
    hashFn: (item: T) => string,
  ): Promise<T[]> {
    const itemsDir = join(this.config.baseDir, dirName);
    try {
      const entries = await fileOps.readdir(itemsDir, { withFileTypes: true });
      const items: T[] = [];
      for (const entry of entries) {
        if (!entry.isFile() || !entry.name.endsWith(".md")) continue;
        const itemName = entry.name.slice(0, -3);
        const itemPath = join(itemsDir, entry.name);
        try {
          const content = await readFile(itemPath, "utf-8");
          const parsed = matter(content);
          const item = {
            name: itemName,
            content: parsed.content,
            hash: "",
          } as T;
          const itemMeta = item as T & {
            description?: string;
            metadata?: Record<string, unknown>;
          };
          if (parsed.data.description)
            itemMeta.description = parsed.data.description;
          if (Object.keys(parsed.data).length > 0)
            itemMeta.metadata = parsed.data;
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

  async readCommands(): Promise<Command[]> {
    return this.readFlatMarkdownItems<Command>(
      this.getCommandsDir(),
      hashCommand,
    );
  }
}
