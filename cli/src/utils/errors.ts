/**
 * Custom error types for vibe-sync
 */

/**
 * Error thrown when a tool does not support a specific feature
 * Used to gracefully skip unsupported features during sync
 */
export class NotSupportError extends Error {
  constructor(
    public readonly tool: string,
    public readonly feature: string,
  ) {
    super(`${tool} does not support ${feature}`);
    this.name = "NotSupportError";

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, NotSupportError);
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
