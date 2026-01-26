/**
 * Data model type definitions for vibe-sync
 * Defines Skills, Agents, and MCP Server structures
 */

/**
 * Base interface for content-based configuration items
 * DRY: Shared structure for Skill, Agent, and Command
 */
export interface BaseItem {
  /** Item name (directory or file name) */
  name: string;
  /** Short description (optional, from frontmatter) */
  description?: string;
  /** Main content from markdown file */
  content: string;
  /** Frontmatter metadata */
  metadata?: Record<string, unknown>;
  /** Support files (relative path -> content) */
  supportFiles?: Record<string, string>;
  /** SHA256 hash of content + metadata */
  hash: string;
}

/**
 * Skill configuration
 * Represents a reusable instruction template
 * Type alias to BaseItem - add specific fields here when needed
 */
export type Skill = BaseItem;

/**
 * Agent configuration
 * Represents a custom AI agent with specific behaviors and instructions
 * Type alias to BaseItem - add specific fields here when needed
 */
export type Agent = BaseItem;

/**
 * Command configuration
 * Represents a reusable command/script
 * Type alias to BaseItem - add specific fields here when needed
 */
export type Command = BaseItem;

/**
 * MCP server transport type
 * - stdio: Standard I/O communication
 * - http: HTTP/HTTPS remote server
 * - oauth: OAuth-authenticated remote server
 */
export type MCPType = "stdio" | "http" | "oauth";

/**
 * OAuth configuration for OAuth MCP servers
 */
export interface MCPOAuth {
  /** OAuth client ID */
  client_id: string;
  /** OAuth client secret */
  client_secret: string;
  /** Optional OAuth scopes */
  scopes?: string[];
  /** Optional OAuth token endpoint */
  token_endpoint?: string;
}

/**
 * MCP Server configuration
 * Normalized representation across all tools
 */
export interface MCPServer {
  /** Server name/identifier */
  name: string;
  /** Transport type */
  type: MCPType;

  // Stdio-specific fields
  /** Command to execute (stdio only) */
  command?: string;
  /** Command arguments (stdio only) */
  args?: string[];

  // HTTP/OAuth-specific fields
  /** Server URL (http/oauth only) */
  url?: string;
  /** HTTP headers (http/oauth only) */
  headers?: Record<string, string>;

  // OAuth-specific fields
  /** OAuth configuration (oauth only) */
  auth?: MCPOAuth;

  // Common fields
  /** Environment variables (all types) */
  env?: Record<string, string>;

  /** SHA256 hash of server configuration */
  hash: string;
}
