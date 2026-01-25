/**
 * Base adapter interface for AI coding tools
 * Defines the contract that all tool adapters must implement
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import matter from "gray-matter";
import type { ConfigLevel, ToolName } from "@src/types/config.js";
import type { Skill, MCPServer, Agent, Command } from "@src/types/models.js";
import { atomicWrite } from "@src/utils/atomic-write.js";
import * as fileOps from "@src/utils/file-ops.js";
import { hashAgent, hashCommand, hashSkill } from "@src/utils/hash.js";
import {
  readSupportFiles,
  writeSupportFiles,
} from "@src/utils/support-files.js";
import { isSymlink } from "@src/utils/symlink.js";

/**
 * Adapter configuration
 */
export interface AdapterConfig {
  /** Tool name */
  tool: ToolName;
  /** Base directory (project root or user home) */
  baseDir: string;
  /** Configuration level (project or user) */
  level: ConfigLevel;
}

/**
 * Write operation result
 */
export interface WriteResult {
  /** Whether the write was successful */
  success: boolean;
  /** Number of items written */
  count: number;
  /** Error message if failed */
  error?: string;
}

/**
 * Validation result
 */
export interface ValidationResult {
  /** Whether the configuration is valid */
  valid: boolean;
  /** Validation errors if any */
  errors: string[];
  /** Validation warnings if any */
  warnings?: string[];
}

/**
 * Base adapter interface
 * All tool adapters must implement this interface
 */
export interface ToolAdapter {
  /** Adapter configuration */
  readonly config: AdapterConfig;

  // Metadata (for self-registration and discovery)
  /** Tool name (e.g., "claude-code", "cursor") */
  readonly toolName: string;
  /** Display name (e.g., "Claude Code", "Cursor") */
  readonly displayName: string;

  /**
   * Get configuration directory name (e.g., ".claude", ".cursor")
   * This is the directory where the tool stores its configuration
   */
  getConfigDir(): string;

  /**
   * Get configuration file paths that should be backed up
   * Returns array of file paths relative to baseDir
   */
  getConfigPaths(): string[];

  /**
   * Get MCP configuration file paths relative to baseDir
   */
  getMCPConfigPaths(): string[];

  /**
   * Get skills directory path relative to baseDir
   */
  getSkillsDir(): string;

  /**
   * Get agents directory path relative to baseDir
   */
  getAgentsDir(): string;

  /**
   * Get commands directory path relative to baseDir
   */
  getCommandsDir(): string;

  // Read methods (for source tools)
  /**
   * Read all skills from the tool's configuration
   * @returns Array of skills with computed hashes
   */
  readSkills(): Promise<Skill[]>;

  /**
   * Read all MCP servers from the tool's configuration
   * @returns Array of MCP servers with computed hashes
   */
  readMCPServers(): Promise<MCPServer[]>;

  /**
   * Read all agents from the tool's configuration
   * @returns Array of agents with computed hashes
   */
  readAgents(): Promise<Agent[]>;

  /**
   * Read all commands from the tool's configuration
   * @returns Array of commands with computed hashes
   */
  readCommands(): Promise<Command[]>;

  // Write methods (for target tools)
  /**
   * Write skills to the tool's configuration
   * @param skills - Skills to write
   * @returns Write result
   */
  writeSkills(skills: Skill[]): Promise<WriteResult>;

  /**
   * Write MCP servers to the tool's configuration
   * @param servers - MCP servers to write
   * @returns Write result
   */
  writeMCPServers(servers: MCPServer[]): Promise<WriteResult>;

  /**
   * Write agents to the tool's configuration
   * @param agents - Agents to write
   * @returns Write result
   */
  writeAgents(agents: Agent[]): Promise<WriteResult>;

  /**
   * Write commands to the tool's configuration
   * @param commands - Commands to write
   * @returns Write result
   */
  writeCommands(commands: Command[]): Promise<WriteResult>;

  // Delete methods
  /**
   * Delete a skill from the tool's configuration
   * @param name - Skill name
   */
  deleteSkill(name: string): Promise<void>;

  /**
   * Delete an MCP server from the tool's configuration
   * @param name - Server name
   */
  deleteMCPServer(name: string): Promise<void>;

  /**
   * Delete an agent from the tool's configuration
   * @param name - Agent name
   */
  deleteAgent(name: string): Promise<void>;

  /**
   * Delete a command from the tool's configuration
   * @param name - Command name
   */
  deleteCommand(name: string): Promise<void>;
}

export abstract class BaseAdapter implements ToolAdapter {
  readonly config: AdapterConfig;

  constructor(config: AdapterConfig) {
    this.config = config;
  }

  abstract readonly toolName: string;
  abstract readonly displayName: string;
  abstract getConfigDir(): string;
  abstract getConfigPaths(): string[];
  abstract getMCPConfigPaths(): string[];
  abstract readMCPServers(): Promise<MCPServer[]>;
  abstract writeMCPServers(servers: MCPServer[]): Promise<WriteResult>;
  abstract deleteMCPServer(name: string): Promise<void>;

  getSkillsDir(): string {
    return join(this.getConfigDir(), "skills");
  }

  getAgentsDir(): string {
    return join(this.getConfigDir(), "agents");
  }

  getCommandsDir(): string {
    return join(this.getConfigDir(), "commands");
  }

  protected resolvePath(relativePath: string): string {
    return join(this.config.baseDir, relativePath);
  }

  protected async getMcpConfigPath(): Promise<string> {
    const paths = this.getMCPConfigPaths().map((path) =>
      this.resolvePath(path),
    );
    const existingPath = await fileOps.findFirstExistingPath(paths);
    return existingPath ?? paths[0]!;
  }

  async readSkills(): Promise<Skill[]> {
    return this.readDirectoryItems<Skill>(
      this.getSkillsDir(),
      "SKILL.md",
      hashSkill,
    );
  }

  async writeSkills(skills: Skill[]): Promise<WriteResult> {
    // Check if skills directory is a symlink
    const skillsDir = this.resolvePath(this.getSkillsDir());
    const isLink = await isSymlink(skillsDir);

    if (isLink) {
      // Skip writing to symlinked directory - it's managed by the source
      return {
        success: true,
        count: 0,
      };
    }

    return this.writeDirectoryItems<Skill>(
      this.getSkillsDir(),
      "SKILL.md",
      skills,
    );
  }

  async deleteSkill(name: string): Promise<void> {
    // Check if skills directory is a symlink
    const skillsDir = this.resolvePath(this.getSkillsDir());
    const isLink = await isSymlink(skillsDir);

    if (isLink) {
      throw new Error(
        "Cannot delete individual skills from symlinked directory. " +
          "The symlink points to another tool's skills directory.",
      );
    }

    await this.deleteDirectoryItem(this.getSkillsDir(), name);
  }

  async readAgents(): Promise<Agent[]> {
    return this.readFlatItems<Agent>(this.getAgentsDir(), hashAgent);
  }

  async writeAgents(agents: Agent[]): Promise<WriteResult> {
    return this.writeFlatItems<Agent>(this.getAgentsDir(), agents);
  }

  async deleteAgent(name: string): Promise<void> {
    await this.deleteFlatItem(this.getAgentsDir(), name);
  }

  async readCommands(): Promise<Command[]> {
    return this.readFlatItems<Command>(this.getCommandsDir(), hashCommand);
  }

  async writeCommands(commands: Command[]): Promise<WriteResult> {
    return this.writeFlatItems<Command>(this.getCommandsDir(), commands);
  }

  async deleteCommand(name: string): Promise<void> {
    await this.deleteFlatItem(this.getCommandsDir(), name);
  }

  protected async readDirectoryItems<T extends Skill>(
    dirName: string,
    fileName: string,
    hashFn: (item: T) => string,
  ): Promise<T[]> {
    const itemsDir = this.resolvePath(dirName);

    try {
      const entries = await fileOps.readdir(itemsDir, { withFileTypes: true });
      const items: T[] = [];

      for (const entry of entries) {
        if (!entry.isDirectory()) {
          continue;
        }

        const itemName = entry.name;
        const itemDir = join(itemsDir, itemName);
        const itemPath = join(itemDir, fileName);

        try {
          const content = await readFile(itemPath, "utf-8");
          const parsed = matter(content);
          const supportFiles = await readSupportFiles(itemDir, {
            exclude: (relativePath) => relativePath === fileName,
          });

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

          if (parsed.data.description) {
            itemMeta.description = parsed.data.description;
          }
          if (Object.keys(parsed.data).length > 0) {
            itemMeta.metadata = parsed.data;
          }
          if (Object.keys(supportFiles).length > 0) {
            itemMeta.supportFiles = supportFiles;
          }

          item.hash = hashFn(item);
          items.push(item);
        } catch {
          // Silently skip invalid items (YAML parse errors, etc.)
          // These are usually expected for complex or malformed command files
        }
      }

      return items;
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

  protected async readFlatItems<T extends Agent | Command>(
    dirName: string,
    hashFn: (item: T) => string,
  ): Promise<T[]> {
    const itemsDir = this.resolvePath(dirName);

    try {
      const entries = await fileOps.readdir(itemsDir, { withFileTypes: true });
      const items: T[] = [];

      for (const entry of entries) {
        if (!entry.isFile() || !entry.name.endsWith(".md")) {
          continue;
        }

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

          if (parsed.data.description) {
            itemMeta.description = parsed.data.description;
          }
          if (Object.keys(parsed.data).length > 0) {
            itemMeta.metadata = parsed.data;
          }

          item.hash = hashFn(item);
          items.push(item);
        } catch {
          // Silently skip invalid items (YAML parse errors, etc.)
          // These are usually expected for complex or malformed command files
        }
      }

      return items;
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

  protected async writeDirectoryItems<T extends Skill>(
    dirName: string,
    fileName: string,
    items: T[],
  ): Promise<WriteResult> {
    const itemsDir = this.resolvePath(dirName);

    try {
      await fileOps.ensureDir(itemsDir);

      for (const item of items) {
        const itemDir = join(itemsDir, item.name);
        await fileOps.ensureDir(itemDir);

        const hasFrontmatter =
          Boolean(item.metadata) || Boolean(item.description);
        let itemContent = item.content;

        if (hasFrontmatter) {
          const frontmatter: Record<string, unknown> = {
            ...(item.metadata || {}),
          };
          if (item.description) {
            frontmatter.description = item.description;
          }
          frontmatter.name = item.name;
          itemContent = matter.stringify(item.content, frontmatter);
        }

        const itemPath = join(itemDir, fileName);
        await atomicWrite(itemPath, itemContent);
        await writeSupportFiles(itemDir, item.supportFiles);
      }

      return {
        success: true,
        count: items.length,
      };
    } catch (error) {
      return {
        success: false,
        count: 0,
        error:
          error instanceof Error
            ? error.message
            : "Unknown error writing items",
      };
    }
  }

  protected async writeFlatItems<T extends Agent | Command>(
    dirName: string,
    items: T[],
  ): Promise<WriteResult> {
    const itemsDir = this.resolvePath(dirName);

    try {
      await fileOps.ensureDir(itemsDir);

      for (const item of items) {
        const hasFrontmatter =
          Boolean(item.metadata) || Boolean(item.description);
        let itemContent = item.content;

        if (hasFrontmatter) {
          const frontmatter: Record<string, unknown> = {
            ...(item.metadata || {}),
          };
          if (item.description) {
            frontmatter.description = item.description;
          }
          frontmatter.name = item.name;
          itemContent = matter.stringify(item.content, frontmatter);
        }

        const itemPath = join(itemsDir, `${item.name}.md`);
        await atomicWrite(itemPath, itemContent);
      }

      return {
        success: true,
        count: items.length,
      };
    } catch (error) {
      return {
        success: false,
        count: 0,
        error:
          error instanceof Error
            ? error.message
            : "Unknown error writing items",
      };
    }
  }

  protected async deleteDirectoryItem(
    dirName: string,
    name: string,
  ): Promise<void> {
    const itemDir = join(this.resolvePath(dirName), name);

    try {
      await fileOps.remove(itemDir);
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

  protected async deleteFlatItem(dirName: string, name: string): Promise<void> {
    const itemPath = join(this.resolvePath(dirName), `${name}.md`);

    try {
      await fileOps.remove(itemPath);
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
}
