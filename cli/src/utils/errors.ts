/**
 * Custom error types for vsync
 *
 * Error Handling Strategy:
 * - WARNING: Log and continue (e.g., invalid config entry)
 * - RECOVERABLE: Retry or fallback (e.g., temporary file lock)
 * - FATAL: Rollback and abort (e.g., data corruption, prune mode read failure)
 */

/**
 * Error severity levels
 * Defines how the application should respond to different error types
 */
export enum ErrorSeverity {
  /** Log warning and continue - error doesn't affect overall operation */
  WARNING = "WARNING",
  /** Attempt retry or fallback - error may be temporary */
  RECOVERABLE = "RECOVERABLE",
  /** Abort operation and rollback - error is critical */
  FATAL = "FATAL",
}

/**
 * Base error class for vsync
 * Provides consistent error handling with severity classification
 */
export class SyncError extends Error {
  constructor(
    message: string,
    public readonly severity: ErrorSeverity,
    public readonly context?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "SyncError";

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, SyncError);
    }
  }

  /**
   * Create a warning-level error (log and continue)
   */
  static warning(
    message: string,
    context?: Record<string, unknown>,
  ): SyncError {
    return new SyncError(message, ErrorSeverity.WARNING, context);
  }

  /**
   * Create a recoverable error (retry or fallback)
   */
  static recoverable(
    message: string,
    context?: Record<string, unknown>,
  ): SyncError {
    return new SyncError(message, ErrorSeverity.RECOVERABLE, context);
  }

  /**
   * Create a fatal error (rollback and abort)
   */
  static fatal(message: string, context?: Record<string, unknown>): SyncError {
    return new SyncError(message, ErrorSeverity.FATAL, context);
  }
}

/**
 * Error thrown when a tool does not support a specific feature
 * Used to gracefully skip unsupported features during sync
 * Severity: WARNING (log and continue)
 */
export class NotSupportError extends SyncError {
  constructor(
    public readonly tool: string,
    public readonly feature: string,
  ) {
    super(`${tool} does not support ${feature}`, ErrorSeverity.WARNING, {
      tool,
      feature,
    });
    this.name = "NotSupportError";

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, NotSupportError);
    }
  }
}

/**
 * Error thrown when reading configuration fails in prune mode
 * Severity: FATAL (must abort to prevent data loss)
 */
export class PruneModeReadError extends SyncError {
  constructor(
    public readonly tool: string,
    public readonly itemType: string,
    public readonly originalError: Error,
  ) {
    super(
      `Cannot read ${itemType} from ${tool} in prune mode: ${originalError.message}. ` +
        `Prune mode requires reliable target reads to prevent accidental deletion.`,
      ErrorSeverity.FATAL,
      { tool, itemType, originalError: originalError.message },
    );
    this.name = "PruneModeReadError";

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, PruneModeReadError);
    }
  }
}

/**
 * Error thrown when configuration file is invalid or corrupted
 * Severity: WARNING (skip invalid entry, continue with others)
 */
export class InvalidConfigError extends SyncError {
  constructor(
    public readonly filePath: string,
    public readonly reason: string,
  ) {
    super(
      `Invalid configuration in ${filePath}: ${reason}`,
      ErrorSeverity.WARNING,
      { filePath, reason },
    );
    this.name = "InvalidConfigError";

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, InvalidConfigError);
    }
  }
}

/**
 * Error thrown when file operation fails (read/write/delete)
 * Severity: RECOVERABLE in safe mode, FATAL in prune mode
 */
export class FileOperationError extends SyncError {
  constructor(
    public readonly operation: "read" | "write" | "delete",
    public readonly filePath: string,
    public readonly originalError: Error,
    severity: ErrorSeverity = ErrorSeverity.RECOVERABLE,
  ) {
    super(
      `Failed to ${operation} ${filePath}: ${originalError.message}`,
      severity,
      { operation, filePath, originalError: originalError.message },
    );
    this.name = "FileOperationError";

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, FileOperationError);
    }
  }
}

/**
 * Error thrown when sync validation fails
 * Severity: FATAL (cannot proceed with invalid plan)
 */
export class ValidationError extends SyncError {
  constructor(public readonly errors: string[]) {
    super(`Sync validation failed: ${errors.join(", ")}`, ErrorSeverity.FATAL, {
      errors,
    });
    this.name = "ValidationError";

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ValidationError);
    }
  }
}

/**
 * Type guard to check if an error is a NotSupportError
 *
 * @param error - Error to check
 * @returns True if error is NotSupportError
 */
export function isNotSupportError(error: unknown): error is NotSupportError {
  return error instanceof NotSupportError;
}

/**
 * Type guard to check if an error is a SyncError
 *
 * @param error - Error to check
 * @returns True if error is SyncError
 */
export function isSyncError(error: unknown): error is SyncError {
  return error instanceof SyncError;
}

/**
 * Get error severity from any error
 * Returns FATAL for non-SyncError errors
 *
 * @param error - Error to check
 * @returns Error severity
 */
export function getErrorSeverity(error: unknown): ErrorSeverity {
  if (isSyncError(error)) {
    return error.severity;
  }
  // Unknown errors are treated as FATAL by default
  return ErrorSeverity.FATAL;
}

/**
 * Check if error should cause rollback
 *
 * @param error - Error to check
 * @returns True if error requires rollback
 */
export function shouldRollback(error: unknown): boolean {
  const severity = getErrorSeverity(error);
  return severity === ErrorSeverity.FATAL;
}

/**
 * Check if a WriteResult indicates unsupported feature
 * Checks both error type and error message pattern
 *
 * @param result - Write result to check
 * @returns True if the error indicates unsupported feature
 */
export function isUnsupportedFeature(result: {
  success: boolean;
  error?: string;
}): boolean {
  if (!result.error) {
    return false;
  }

  // Check for error message patterns
  return result.error.includes("does not support");
}
