/**
 * Environment Variable Transformer
 * Unified logic for converting environment variable formats across different tools
 *
 * Supported formats:
 * - Claude Code: ${VAR}
 * - Cursor: ${env:VAR} (with reserved vars like ${workspaceFolder})
 * - OpenCode: {env:VAR} (no dollar sign)
 *
 * This eliminates duplicate env var transformation logic in adapters
 */

/**
 * Environment variable format types
 */
export type EnvVarFormat = "claude-code" | "cursor" | "opencode";

/**
 * Cursor reserved variables (should not be prefixed with env:)
 */
const CURSOR_RESERVED_VARS = new Set([
  "workspaceFolder",
  "workspaceFolderBasename",
  "userHome",
  "pathSeparator",
]);

/**
 * Environment Variable Transformer
 * Provides unified transformation logic for different tool formats
 */
export class EnvVarTransformer {
  /**
   * Transform environment variables from one format to another
   *
   * @param value - Value to transform (string, object, or array)
   * @param from - Source format
   * @param to - Target format
   * @returns Transformed value
   */
  static transform(
    value: unknown,
    from: EnvVarFormat,
    to: EnvVarFormat,
  ): unknown {
    // If formats are the same, no transformation needed
    if (from === to) {
      return value;
    }

    // Recursively transform based on value type
    if (typeof value === "string") {
      return this.transformString(value, from, to);
    }

    if (Array.isArray(value)) {
      return value.map((item) => this.transform(item, from, to));
    }

    if (value && typeof value === "object") {
      const result: Record<string, unknown> = {};
      for (const [key, item] of Object.entries(value)) {
        result[key] = this.transform(item, from, to);
      }
      return result;
    }

    return value;
  }

  /**
   * Transform a string from one format to another
   *
   * @param value - String value to transform
   * @param from - Source format
   * @param to - Target format
   * @returns Transformed string
   */
  private static transformString(
    value: string,
    from: EnvVarFormat,
    to: EnvVarFormat,
  ): string {
    // Normalize to intermediate format (claude-code: ${VAR})
    const normalized = this.toNormalized(value, from);

    // Convert from normalized to target format
    return this.fromNormalized(normalized, to);
  }

  /**
   * Convert from specific format to normalized format (${VAR})
   */
  private static toNormalized(value: string, from: EnvVarFormat): string {
    switch (from) {
      case "claude-code":
        // Already in normalized format
        return value;

      case "cursor":
        // ${env:VAR} -> ${VAR} (skip reserved vars)
        return value.replace(/\$\{env:([A-Za-z0-9_]+)\}/g, (match, name) => {
          if (CURSOR_RESERVED_VARS.has(name)) {
            return match; // Keep reserved vars as-is
          }
          return `\${${name}}`;
        });

      case "opencode":
        // {env:VAR} -> ${VAR}
        return value.replace(/\{env:([A-Za-z0-9_]+)\}/g, "${$1}");
    }
  }

  /**
   * Convert from normalized format (${VAR}) to specific format
   */
  private static fromNormalized(value: string, to: EnvVarFormat): string {
    switch (to) {
      case "claude-code":
        // Already in normalized format
        return value;

      case "cursor":
        // ${VAR} -> ${env:VAR} (only for uppercase env vars)
        return value.replace(/\$\{([A-Za-z0-9_]+)\}/g, (match, name) => {
          // Skip if already has env: prefix
          if (match.includes("env:")) {
            return match;
          }
          // Skip reserved vars
          if (CURSOR_RESERVED_VARS.has(name)) {
            return match;
          }
          // Only transform uppercase vars (env vars convention)
          if (!/^[A-Z0-9_]+$/.test(name)) {
            return match;
          }
          return `\${env:${name}}`;
        });

      case "opencode":
        // ${VAR} -> {env:VAR}
        // Also handle ${env:VAR} -> {env:VAR}
        const withEnvPrefix = value.replace(/\$\{env:([^}]+)\}/g, "{env:$1}");
        return withEnvPrefix.replace(/\$\{([A-Z0-9_]+)\}/g, "{env:$1}");
    }
  }

  /**
   * Quick converters for common use cases
   */

  static toOpenCode(value: unknown): unknown {
    return this.transform(value, "claude-code", "opencode");
  }

  static fromOpenCode(value: unknown): unknown {
    return this.transform(value, "opencode", "claude-code");
  }

  static toCursor(value: unknown): unknown {
    return this.transform(value, "claude-code", "cursor");
  }

  static fromCursor(value: unknown): unknown {
    return this.transform(value, "cursor", "claude-code");
  }
}
