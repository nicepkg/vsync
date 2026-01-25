/**
 * Error formatting utility
 * Provides clear, actionable error messages with suggestions
 */

import chalk from "chalk";

/**
 * Error categories for better organization
 */
export enum ErrorCategory {
  CONFIG = "configuration",
  FILE = "file",
  SYNC = "sync",
  ADAPTER = "adapter",
  VALIDATION = "validation",
  NETWORK = "network",
  UNKNOWN = "unknown",
}

/**
 * Formatted error with enhanced information
 */
export class FormattedError extends Error {
  category: ErrorCategory;
  suggestion?: string;
  filePath?: string;
  lineNumber?: number;
  tool?: string;

  constructor(
    message: string,
    options: {
      category: ErrorCategory;
      suggestion?: string;
      filePath?: string;
      lineNumber?: number;
      tool?: string;
    },
  ) {
    super(message);
    this.name = "FormattedError";
    this.category = options.category;
    if (options.suggestion !== undefined) this.suggestion = options.suggestion;
    if (options.filePath !== undefined) this.filePath = options.filePath;
    if (options.lineNumber !== undefined) this.lineNumber = options.lineNumber;
    if (options.tool !== undefined) this.tool = options.tool;
  }
}

/**
 * Format error for display with colors and suggestions
 *
 * @param error - Error to format
 * @param options - Additional formatting options
 * @returns Formatted error string
 */
export function formatError(
  error: unknown,
  options?: {
    filePath?: string;
    lineNumber?: number;
    suggestion?: string;
  },
): string {
  let message = "";

  // Extract error message
  if (error instanceof FormattedError) {
    message = chalk.red(`✗ ${error.message}`);

    // Add file path if available
    if (error.filePath || options?.filePath) {
      const path = error.filePath || options?.filePath;
      const line = error.lineNumber || options?.lineNumber;
      message += chalk.gray(`\n  File: ${path}${line ? `:${line}` : ""}`);
    }

    // Add suggestion
    if (error.suggestion || options?.suggestion) {
      const suggestion = error.suggestion || options?.suggestion;
      message += chalk.yellow(`\n  💡 ${suggestion}`);
    }
  } else if (error instanceof Error) {
    message = chalk.red(`✗ ${error.message}`);

    // Add file path if provided
    if (options?.filePath) {
      const line = options.lineNumber;
      message += chalk.gray(
        `\n  File: ${options.filePath}${line ? `:${line}` : ""}`,
      );
    }

    // Add suggestion if provided
    if (options?.suggestion) {
      message += chalk.yellow(`\n  💡 ${options.suggestion}`);
    }
  } else {
    message = chalk.red(`✗ ${String(error)}`);

    if (options?.suggestion) {
      message += chalk.yellow(`\n  💡 ${options.suggestion}`);
    }
  }

  return message;
}

/**
 * Create configuration-related error
 *
 * @param type - Type of config error
 * @param details - Error details
 * @returns Formatted error
 */
export function createConfigError(
  type: "notFound" | "invalid" | "corrupt",
  details: {
    filePath?: string;
    reason?: string;
  },
): FormattedError {
  let message = "";
  let suggestion = "";

  switch (type) {
    case "notFound":
      message = `Configuration file not found: ${details.filePath || ".vibe-sync.json"}`;
      suggestion = "Run 'vibe-sync init' to create a new configuration file.";
      break;

    case "invalid":
      message = `Invalid configuration: ${details.reason || "Unknown error"}`;
      suggestion =
        "Check your .vibe-sync.json file for syntax errors or missing required fields.";
      break;

    case "corrupt":
      message = `Configuration file is corrupted: ${details.reason || "Unable to parse"}`;
      suggestion =
        "Backup your config and run 'vibe-sync init' to create a fresh configuration.";
      break;
  }

  const errorOptions: {
    category: ErrorCategory;
    suggestion: string;
    filePath?: string;
  } = {
    category: ErrorCategory.CONFIG,
    suggestion,
  };

  if (details.filePath !== undefined) {
    errorOptions.filePath = details.filePath;
  }

  return new FormattedError(message, errorOptions);
}

/**
 * Create file-related error
 *
 * @param type - Type of file error
 * @param details - Error details
 * @returns Formatted error
 */
export function createFileError(
  type: "notFound" | "permissionDenied" | "invalidJSON" | "readFailed",
  details: {
    filePath?: string;
    operation?: "read" | "write" | "delete";
    lineNumber?: number;
    reason?: string;
  },
): FormattedError {
  let message = "";
  let suggestion = "";

  switch (type) {
    case "notFound":
      message = `File not found: ${details.filePath || "unknown"}`;
      suggestion = "Check that the file path is correct and the file exists.";
      break;

    case "permissionDenied":
      message = `Permission denied when trying to ${details.operation || "access"}: ${details.filePath || "unknown"}`;
      suggestion =
        "Check file permissions or try running with appropriate access rights.";
      break;

    case "invalidJSON":
      message = `Invalid JSON in ${details.filePath || "file"}${details.lineNumber ? ` at line ${details.lineNumber}` : ""}`;
      suggestion =
        "Validate your JSON syntax. Look for missing commas, brackets, or quotes.";
      break;

    case "readFailed":
      message = `Failed to read ${details.filePath || "file"}: ${details.reason || "Unknown error"}`;
      suggestion = "Check file permissions and that the file is not corrupted.";
      break;
  }

  const errorOptions: {
    category: ErrorCategory;
    suggestion: string;
    filePath?: string;
    lineNumber?: number;
  } = {
    category: ErrorCategory.FILE,
    suggestion,
  };

  if (details.filePath !== undefined) {
    errorOptions.filePath = details.filePath;
  }
  if (details.lineNumber !== undefined) {
    errorOptions.lineNumber = details.lineNumber;
  }

  return new FormattedError(message, errorOptions);
}

/**
 * Create sync-related error
 *
 * @param type - Type of sync error
 * @param details - Error details
 * @returns Formatted error
 */
export function createSyncError(
  type: "noTargets" | "toolNotFound" | "hashMismatch" | "syncFailed",
  details?: {
    tool?: string;
    directory?: string;
    item?: string;
    expected?: string;
    actual?: string;
    reason?: string;
  },
): FormattedError {
  let message = "";
  let suggestion = "";

  switch (type) {
    case "noTargets":
      message = "No target tools configured for synchronization";
      suggestion =
        "Add target tools to your .vibe-sync.json configuration (target_tools array).";
      break;

    case "toolNotFound":
      message = `Tool directory not found for ${details?.tool || "tool"}: ${details?.directory || "unknown"}`;
      suggestion = `Ensure ${details?.tool || "the tool"} is installed and initialized in this project.`;
      break;

    case "hashMismatch":
      message = `Hash mismatch detected for ${details?.item || "item"}`;
      if (details?.expected && details?.actual) {
        message += `\n  Expected: ${details.expected}\n  Actual: ${details.actual}`;
      }
      suggestion =
        "The item may have been modified outside of vibe-sync. Run 'vibe-sync sync' to update.";
      break;

    case "syncFailed":
      message = `Synchronization failed: ${details?.reason || "Unknown error"}`;
      suggestion =
        "Check the error details above and ensure all tools are properly configured.";
      break;
  }

  const errorOptions: {
    category: ErrorCategory;
    suggestion: string;
    tool?: string;
  } = {
    category: ErrorCategory.SYNC,
    suggestion,
  };

  if (details?.tool !== undefined) {
    errorOptions.tool = details.tool;
  }

  return new FormattedError(message, errorOptions);
}

/**
 * Create adapter-related error
 *
 * @param type - Type of adapter error
 * @param details - Error details
 * @returns Formatted error
 */
export function createAdapterError(
  type: "unsupportedTool" | "readFailed" | "writeFailed" | "deleteFailed",
  details: {
    tool?: string;
    itemType?: "skills" | "mcp" | "agents" | "commands";
    reason?: string;
  },
): FormattedError {
  let message = "";
  let suggestion = "";

  switch (type) {
    case "unsupportedTool":
      message = `Unsupported tool: ${details.tool || "unknown"}`;
      suggestion =
        "Supported tools are: claude-code, cursor, opencode, codex. Check your configuration.";
      break;

    case "readFailed":
      message = `Failed to read ${details.itemType || "items"} from ${details.tool || "tool"}: ${details.reason || "Unknown error"}`;
      suggestion = `Ensure ${details.tool || "the tool"} is properly configured and the ${details.itemType || "items"} directory exists.`;
      break;

    case "writeFailed":
      // Capitalize itemType for better display
      const itemLabel =
        details.itemType === "mcp"
          ? "MCP servers"
          : details.itemType || "items";
      message = `Failed to write ${itemLabel} to ${details.tool || "tool"}: ${details.reason || "Unknown error"}`;
      suggestion = `Check ${details.tool || "tool"} configuration directory permissions and format requirements.`;
      break;

    case "deleteFailed":
      message = `Failed to delete ${details.itemType || "item"} from ${details.tool || "tool"}: ${details.reason || "Unknown error"}`;
      suggestion =
        "Check file permissions and ensure the item exists before deletion.";
      break;
  }

  const errorOptions: {
    category: ErrorCategory;
    suggestion: string;
    tool?: string;
  } = {
    category: ErrorCategory.ADAPTER,
    suggestion,
  };

  if (details.tool !== undefined) {
    errorOptions.tool = details.tool;
  }

  return new FormattedError(message, errorOptions);
}
