/**
 * Configuration type definitions for vsync
 * Defines the structure of .vsync.json
 */

import { z } from "zod";

/**
 * Sync mode
 * - safe: Only create/update, never delete
 * - prune: Strict mirror, delete items not in source
 */
export type SyncMode = "safe" | "prune";

/**
 * Supported AI coding tools
 * These are the core adapters included with vsync.
 * Third-party adapters can register dynamically via registerAdapter()
 *
 * Note: This list must be kept in sync with registered core adapters.
 * Consider using getAvailableTools() at runtime for dynamic discovery.
 */
export type ToolName = "claude-code" | "cursor" | "opencode" | "codex";

/**
 * Configuration level
 * - project: Project-specific config (.vsync.json)
 * - user: Global user config (~/.vsync.json)
 */
export type ConfigLevel = "project" | "user";

/**
 * Sync configuration - what to synchronize
 */
export interface SyncConfig {
  /** Synchronize skills */
  skills: boolean;
  /** Synchronize MCP servers */
  mcp: boolean;
  /** Synchronize agents (optional, v1.1+) */
  agents?: boolean;
  /** Synchronize commands (optional, v1.1+) */
  commands?: boolean;
}

/**
 * Main vsync configuration
 * Stored in .vsync.json (project) or ~/.vsync.json (user)
 */
export interface VibeConfig {
  /** JSON schema URL (optional) */
  $schema?: string;
  /** Config version */
  version: string;
  /** Configuration level */
  level: ConfigLevel;
  /** Source tool to read configuration from (optional for user-level language-only config) */
  source_tool?: ToolName;
  /** Target tools to sync configuration to (optional for user-level language-only config) */
  target_tools?: ToolName[];
  /** What to synchronize (optional for user-level language-only config) */
  sync_config?: SyncConfig;
  /** Last successful sync timestamp (ISO 8601) */
  last_sync?: string;
  /**
   * Use symlinks for skills instead of copying files
   * When enabled, target skills directories will be symlinked to source_tool's directory
   * Saves disk space and keeps single source of truth
   * @since v1.2
   */
  use_symlinks_for_skills?: boolean;
  /**
   * User interface language preference
   * Only applicable for user-level config (~/.vsync.json)
   * Defaults to system language if not set
   * @since v1.2
   */
  language?: "en" | "zh";
}

/**
 * Zod schemas for runtime validation
 */

// Language schema
const LanguageSchema = z.enum(["en", "zh"]);

// Sync config schema
const SyncConfigSchema = z
  .object({
    skills: z.boolean(),
    mcp: z.boolean(),
    agents: z.boolean().optional(),
    commands: z.boolean().optional(),
  })
  .refine((data) => data.skills || data.mcp, {
    message: "At least one sync type must be enabled (skills or mcp)",
  });

// Base config fields (common to all configs)
const BaseConfigSchema = z.object({
  $schema: z.string().optional(),
  version: z.string().min(1, "version is required"),
  last_sync: z.string().optional(),
  use_symlinks_for_skills: z.boolean().optional(),
  language: LanguageSchema.optional(),
});

/**
 * Create tool name schema with dynamic validation
 * This function must be called with available tools from registry
 */
export function createToolNameSchema(validTools: string[]) {
  return z.enum(validTools as [string, ...string[]]);
}

/**
 * Create project-level config schema
 * Requires source_tool, target_tools, and sync_config
 */
export function createProjectConfigSchema(validTools: string[]) {
  const ToolNameSchema = createToolNameSchema(validTools);

  return BaseConfigSchema.extend({
    level: z.literal("project"),
    source_tool: ToolNameSchema,
    target_tools: z
      .array(ToolNameSchema)
      .min(1, "target_tools cannot be empty"),
    sync_config: SyncConfigSchema,
  }).refine((data) => !data.target_tools.includes(data.source_tool), {
    message:
      "source_tool cannot be included in target_tools (would create a loop)",
    path: ["target_tools"],
  });
}

/**
 * Create user-level config schema
 * Can be either full config or minimal (language-only) config
 */
export function createUserConfigSchema(validTools: string[]) {
  const ToolNameSchema = createToolNameSchema(validTools);

  // Base user config (level + common fields)
  const UserBaseSchema = BaseConfigSchema.extend({
    level: z.literal("user"),
  });

  // Full user config - has source_tool, target_tools, sync_config
  const FullUserConfigSchema = UserBaseSchema.extend({
    source_tool: ToolNameSchema,
    target_tools: z
      .array(ToolNameSchema)
      .min(1, "target_tools cannot be empty"),
    sync_config: SyncConfigSchema,
  });

  // Minimal user config - only has language, no source/target/sync
  // This schema explicitly requires language and doesn't include other fields
  const MinimalUserConfigSchema = z
    .object({
      version: z.string().min(1, "version is required"),
      level: z.literal("user"),
      language: LanguageSchema,
      // Optional common fields
      $schema: z.string().optional(),
      last_sync: z.string().optional(),
      use_symlinks_for_skills: z.boolean().optional(),
    })
    .strict(); // Use strict mode to reject extra fields

  // User config can be either full or minimal
  return z.union([FullUserConfigSchema, MinimalUserConfigSchema]);
}

/**
 * Create complete config schema
 * Uses union to support both project-level and user-level configs
 */
export function createVibeConfigSchema(validTools: string[]) {
  return z.union([
    createProjectConfigSchema(validTools),
    createUserConfigSchema(validTools),
  ]);
}
