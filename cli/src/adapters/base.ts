/**
 * Base adapter interface for AI coding tools
 * Defines the contract that all tool adapters must implement
 */

import type { ToolName } from "../types/config.js";
import type { Skill, MCPServer, Agent } from "../types/models.js";
import { getAdapter as getAdapterFromRegistry } from "./registry.js";

/**
 * Adapter configuration
 */
export interface AdapterConfig {
  /** Tool name */
  tool: ToolName;
  /** Base directory (project root or user home) */
  baseDir: string;
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

  // Validation
  /**
   * Validate the tool's configuration
   * @returns Validation result
   */
  validate(): Promise<ValidationResult>;
}

/**
 * Create adapter for a specific tool
 * Factory function to instantiate the correct adapter
 *
 * @param config - Adapter configuration
 * @returns Tool adapter instance
 * @deprecated Use getAdapter from registry.ts instead
 */
export function createAdapter(config: AdapterConfig): ToolAdapter {
  // Re-export from registry for backward compatibility
  return getAdapterFromRegistry(config);
}
