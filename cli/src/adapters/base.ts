/**
 * Base adapter interface for AI coding tools
 * Defines the contract that all tool adapters must implement
 */

import type { ConfigLevel, ToolName } from "../types/config.js";
import type { Skill, MCPServer, Agent, Command } from "../types/models.js";

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

  // Validation
  /**
   * Validate the tool's configuration
   * @returns Validation result
   */
  validate(): Promise<ValidationResult>;
}
