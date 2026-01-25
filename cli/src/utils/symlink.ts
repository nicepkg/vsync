/**
 * Cross-platform symlink utilities
 * Handles symlink creation, detection, and resolution
 */

import {
  lstat,
  readlink,
  symlink,
  unlink,
  mkdir,
  stat,
} from "node:fs/promises";
import { dirname } from "node:path";

/**
 * Check if a path is a symlink
 *
 * @param path - Path to check
 * @returns True if path is a symlink, false otherwise
 */
export async function isSymlink(path: string): Promise<boolean> {
  try {
    const stats = await lstat(path);
    return stats.isSymbolicLink();
  } catch {
    return false;
  }
}

/**
 * Resolve symlink to its real path
 *
 * @param path - Path to resolve
 * @returns Real path if symlink, original path otherwise
 * @throws Error if path doesn't exist
 */
export async function resolveSymlink(path: string): Promise<string> {
  const isLink = await isSymlink(path);
  if (!isLink) {
    // Verify path exists
    await lstat(path);
    return path;
  }

  return await readlink(path);
}

/**
 * Create a symlink from target to source
 * Target is the symlink path, source is what it points to
 *
 * @param target - Path where symlink will be created
 * @param source - Path that symlink points to (must exist)
 * @throws Error if target exists, source doesn't exist, or creation fails
 */
export async function createSymlink(
  target: string,
  source: string,
): Promise<void> {
  // Verify source exists
  try {
    await stat(source);
  } catch {
    throw new Error(`Source path does not exist: ${source}`);
  }

  // Check if target already exists
  try {
    await lstat(target);
    throw new Error(`Target path already exists: ${target}`);
  } catch (error) {
    // ENOENT is expected - target shouldn't exist
    if (error instanceof Error && "code" in error && error.code !== "ENOENT") {
      throw error;
    }
  }

  // Create parent directories if needed
  const parentDir = dirname(target);
  try {
    await mkdir(parentDir, { recursive: true });
  } catch (error) {
    // Ignore error if directory already exists
    if (error instanceof Error && "code" in error && error.code !== "EEXIST") {
      throw error;
    }
  }

  // Create symlink
  // Use 'junction' type on Windows for directory symlinks (no admin required)
  // Use 'dir' type on Unix for directory symlinks
  const type = process.platform === "win32" ? "junction" : "dir";
  await symlink(source, target, type);
}

/**
 * Remove a symlink
 * Only removes the symlink itself, not the source it points to
 *
 * @param path - Path to symlink
 * @throws Error if path is not a symlink or removal fails
 */
export async function removeSymlink(path: string): Promise<void> {
  // Verify it's a symlink
  const isLink = await isSymlink(path);
  if (!isLink) {
    throw new Error(`Path is not a symlink: ${path}`);
  }

  // Remove symlink (use unlink, not rmdir)
  await unlink(path);
}
