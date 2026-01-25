/**
 * Debug logging utility
 * Provides structured logging with debug mode support
 */

import chalk from "chalk";

/**
 * Global debug mode flag
 */
let debugEnabled = false;

/**
 * Sensitive keys to redact in debug output
 */
const SENSITIVE_KEYS = new Set([
  "password",
  "token",
  "apiKey",
  "api_key",
  "secret",
  "accessToken",
  "access_token",
  "refreshToken",
  "refresh_token",
  "privateKey",
  "private_key",
  "authorization",
]);

/**
 * Enable or disable debug mode
 *
 * @param enabled - Whether to enable debug mode
 */
export function setDebugMode(enabled: boolean): void {
  debugEnabled = enabled;
}

/**
 * Check if debug mode is enabled
 *
 * @returns True if debug mode is enabled
 */
export function isDebugEnabled(): boolean {
  return debugEnabled;
}

/**
 * Get formatted timestamp for debug output
 *
 * @returns Timestamp string in format [HH:MM:SS.mmm]
 */
function getTimestamp(): string {
  const now = new Date();
  const hours = now.getHours().toString().padStart(2, "0");
  const minutes = now.getMinutes().toString().padStart(2, "0");
  const seconds = now.getSeconds().toString().padStart(2, "0");
  const ms = now.getMilliseconds().toString().padStart(3, "0");
  return `[${hours}:${minutes}:${seconds}.${ms}]`;
}

/**
 * Log debug message (only when debug mode is enabled)
 *
 * @param message - Main message
 * @param args - Additional arguments to log
 */
export function debug(message: string, ...args: unknown[]): void {
  if (!debugEnabled) return;

  const timestamp = getTimestamp();
  console.error(chalk.gray(`${timestamp} [DEBUG]`), message, ...args);
}

/**
 * Log error with stack trace (only when debug mode is enabled)
 *
 * @param message - Error description
 * @param error - Error object or message
 */
export function debugError(message: string, error: unknown): void {
  if (!debugEnabled) return;

  const timestamp = getTimestamp();
  console.error(chalk.gray(`${timestamp}`) + chalk.red(" [ERROR]"), message);

  if (error instanceof Error) {
    console.error(chalk.red(error.message));
    if (error.stack) {
      console.error(chalk.gray(error.stack));
    }
  } else {
    console.error(error);
  }
}

/**
 * Redact sensitive values in an object
 *
 * @param obj - Object to redact
 * @param seen - Set of already seen objects (for circular reference detection)
 * @returns Redacted copy of object
 */
function redactSensitiveData(
  obj: unknown,
  seen = new WeakSet<object>(),
): unknown {
  if (obj === null || obj === undefined) return obj;

  // Handle primitives
  if (typeof obj !== "object") return obj;

  // Check for circular reference
  if (seen.has(obj as object)) {
    return "[Circular Reference]";
  }

  // Mark as seen
  seen.add(obj as object);

  // Handle arrays
  if (Array.isArray(obj)) {
    return obj.map((item) => redactSensitiveData(item, seen));
  }

  // Handle objects
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    // Check if key matches sensitive pattern (case-insensitive)
    const lowerKey = key.toLowerCase();
    const isSensitive = Array.from(SENSITIVE_KEYS).some((sensitiveKey) =>
      lowerKey.includes(sensitiveKey.toLowerCase()),
    );

    if (isSensitive) {
      result[key] = "***REDACTED***";
    } else if (typeof value === "object" && value !== null) {
      result[key] = redactSensitiveData(value, seen);
    } else {
      result[key] = value;
    }
  }
  return result;
}

/**
 * Log formatted object (only when debug mode is enabled)
 *
 * @param label - Label for the object
 * @param obj - Object to log
 */
export function debugObject(label: string, obj: unknown): void {
  if (!debugEnabled) return;

  const timestamp = getTimestamp();
  console.error(chalk.gray(`${timestamp} [DEBUG]`), `${label}:`);

  // Redact sensitive data (handles circular references internally)
  const redacted = redactSensitiveData(obj);

  // Format with indentation
  const formatted = JSON.stringify(redacted, null, 2);
  console.error(chalk.gray(formatted));
}

/**
 * Create a timing logger (only when debug mode is enabled)
 * Returns a function that logs the elapsed time when called
 *
 * @param operation - Name of the operation being timed
 * @returns Function to call when operation completes
 */
export function debugTiming(operation: string): () => void {
  if (!debugEnabled) {
    // Return no-op function when debug is disabled
    return () => {};
  }

  const startTime = Date.now();

  return () => {
    const elapsed = Date.now() - startTime;
    const timestamp = getTimestamp();
    console.error(
      chalk.gray(`${timestamp}`) + chalk.cyan(" [TIMING]"),
      `${operation} took ${elapsed}ms`,
    );
  };
}
