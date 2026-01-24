/**
 * Environment variable preservation and normalization utilities
 * CRITICAL: Must preserve variable syntax, never expand them
 */

import type { ToolName } from "@src/types/config.js";

/**
 * Preserve environment variables in object
 * Ensures variables are not expanded to actual values
 *
 * @param obj - Object that may contain env vars
 * @returns Same object (variables preserved)
 */
export function preserveEnvVars<T>(obj: T): T {
  // This is a type-safe pass-through
  // The real preservation happens in JSON stringify/parse
  // and by never calling process.env during serialization
  return obj;
}

/**
 * Normalize environment variable format for target tool
 *
 * Tool-specific formats:
 * - Claude Code: ${env:VAR} or ${VAR}
 * - Cursor: ${env:VAR}, ${workspaceFolder}, ${userHome}, etc.
 * - OpenCode: ${VAR} (no "env:" prefix)
 *
 * @param value - String value that may contain variables
 * @param targetTool - Target tool name
 * @returns Normalized string
 */
export function normalizeEnvVar(value: string, targetTool: ToolName): string {
  if (targetTool === "opencode") {
    // OpenCode uses ${VAR} without "env:" prefix
    // Convert ${env:VAR} → ${VAR}
    return value.replace(/\$\{env:([^}]+)\}/g, "${$1}");
  } else {
    // Claude Code and Cursor use ${env:VAR}
    // Convert ${VAR} → ${env:VAR}, but skip special vars
    const specialVars = [
      "workspaceFolder",
      "workspaceFolderBasename",
      "userHome",
      "pathSeparator",
      "/",
    ];

    return value.replace(/\$\{([^}:]+)\}/g, (match, varName) => {
      // Don't add "env:" prefix to special variables
      if (specialVars.includes(varName)) {
        return match;
      }
      // Add "env:" prefix if not already present
      return `\${env:${varName}}`;
    });
  }
}

/**
 * Extract all environment variable names from text
 * Used for security checks and validation
 *
 * @param text - Text that may contain variable references
 * @returns Array of unique variable names
 */
export function extractEnvVars(text: string): string[] {
  const vars = new Set<string>();

  // Special variables that are not env vars
  const specialVars = new Set([
    "workspaceFolder",
    "workspaceFolderBasename",
    "userHome",
    "pathSeparator",
    "/",
  ]);

  // Match ${env:VAR} format
  const envMatches = text.matchAll(/\$\{env:([^}]+)\}/g);
  for (const match of envMatches) {
    if (match[1]) {
      vars.add(match[1]);
    }
  }

  // Match ${VAR} format (but exclude special vars)
  const varMatches = text.matchAll(/\$\{([^}:]+)\}/g);
  for (const match of varMatches) {
    if (match[1] && !specialVars.has(match[1])) {
      vars.add(match[1]);
    }
  }

  return Array.from(vars);
}
