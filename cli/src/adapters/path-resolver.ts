/**
 * Adapter Path Resolver
 * Provides consistent, testable path resolution for all adapters
 *
 * Design Principles:
 * - Single Responsibility: Only handles path construction
 * - DRY: Eliminates duplicated path logic across adapters
 * - Testable: Easy to mock for testing
 */

import { join } from "node:path";

/**
 * Path resolver for adapter configuration directories
 * Centralizes all path construction logic
 */
export class AdapterPathResolver {
  constructor(
    private readonly baseDir: string,
    private readonly configDir: string,
  ) {}

  /**
   * Resolve path segments relative to config directory
   * Returns relative path (not absolute)
   *
   * @param segments - Path segments to join
   * @returns Relative path from baseDir
   *
   * @example
   * resolver.relative("skills") → ".claude/skills"
   * resolver.relative("agents", "foo.md") → ".claude/agents/foo.md"
   */
  relative(...segments: string[]): string {
    return join(this.configDir, ...segments);
  }

  /**
   * Resolve path segments to absolute path
   * Combines baseDir + configDir + segments
   *
   * @param segments - Path segments to join
   * @returns Absolute path
   *
   * @example
   * resolver.absolute("skills") → "/project/.claude/skills"
   * resolver.absolute("mcp.json") → "/project/.claude/mcp.json"
   */
  absolute(...segments: string[]): string {
    return join(this.baseDir, this.configDir, ...segments);
  }

  /**
   * Resolve a relative path to absolute
   * Used when you already have a relative path and need absolute
   *
   * @param relativePath - Relative path from baseDir
   * @returns Absolute path
   *
   * @example
   * resolver.toAbsolute(".claude/skills") → "/project/.claude/skills"
   */
  toAbsolute(relativePath: string): string {
    return join(this.baseDir, relativePath);
  }

  /**
   * Get skills directory path (relative)
   * @returns Relative path to skills directory
   */
  skillsDir(): string {
    return this.relative("skills");
  }

  /**
   * Get agents directory path (relative)
   * @returns Relative path to agents directory
   */
  agentsDir(): string {
    return this.relative("agents");
  }

  /**
   * Get commands directory path (relative)
   * @returns Relative path to commands directory
   */
  commandsDir(): string {
    return this.relative("commands");
  }

  /**
   * Get config directory path (absolute)
   * Used for ensuring directory exists
   * @returns Absolute path to config directory
   */
  configDirAbsolute(): string {
    return join(this.baseDir, this.configDir);
  }

  /**
   * Get base directory
   * @returns Base directory path
   */
  getBaseDir(): string {
    return this.baseDir;
  }

  /**
   * Get config directory (relative)
   * @returns Config directory path
   */
  getConfigDir(): string {
    return this.configDir;
  }
}
