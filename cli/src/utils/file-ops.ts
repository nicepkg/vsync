/**
 * File operation utilities
 * Provides robust, DRY file operations for all adapters
 */

import type { Dirent, Stats } from "node:fs";
import {
  readFile,
  mkdir,
  rm,
  readdir as fsReaddir,
  stat as fsStat,
  copyFile as fsCopyFile,
  lstat,
  readlink,
  symlink,
  unlink,
} from "node:fs/promises";
import { dirname } from "node:path";
import * as toml from "@iarna/toml";
import * as jsonc from "jsonc-parser";
import { atomicWrite } from "./atomic-write.js";

/**
 * Check if path exists
 */
export async function pathExists(path: string): Promise<boolean> {
  try {
    await fsStat(path);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return false;
    }
    throw error;
  }
}

/**
 * Ensure directory exists (creates if needed)
 */
export async function ensureDir(path: string): Promise<void> {
  await mkdir(path, { recursive: true });
}

/**
 * Read JSON file
 * Returns null if file doesn't exist
 * Throws on invalid JSON
 *
 * Type parameter T allows callers to specify expected shape.
 * Uses 'object' constraint instead of strict JsonValue for flexibility.
 */
export async function readJSON<T extends object>(
  path: string,
): Promise<T | null> {
  try {
    const content = await readFile(path, "utf-8");
    return JSON.parse(content) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

/**
 * Write JSON file atomically
 */
export async function writeJSON<T extends object>(
  path: string,
  data: T,
): Promise<void> {
  await atomicWrite(path, JSON.stringify(data, null, 2));
}

/**
 * Read JSONC file
 * Returns { data, text } where text is the original formatting
 */
export async function readJSONC<T extends object>(
  path: string,
): Promise<{ data: T | null; text: string }> {
  try {
    const text = await readFile(path, "utf-8");
    const data = jsonc.parse(text) as T;
    return { data, text };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return { data: null, text: "" };
    }
    throw error;
  }
}

/**
 * Write JSONC file atomically (preserves formatting if existingText provided)
 */
export async function writeJSONC<T extends object>(
  path: string,
  data: T,
  existingText?: string,
): Promise<void> {
  let output: string;
  if (existingText) {
    const edits = jsonc.modify(existingText, [], data, {
      formattingOptions: { insertSpaces: true, tabSize: 2 },
    });
    output = jsonc.applyEdits(existingText, edits);
  } else {
    output = JSON.stringify(data, null, 2);
  }
  await atomicWrite(path, output);
}

/**
 * Read TOML file
 */
export async function readTOML<T extends object>(
  path: string,
): Promise<T | null> {
  try {
    const content = await readFile(path, "utf-8");
    return toml.parse(content) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

/**
 * Write TOML file atomically
 */
export async function writeTOML<T extends object>(
  path: string,
  data: T,
): Promise<void> {
  const content = toml.stringify(data as toml.JsonMap);
  await atomicWrite(path, content);
}

/**
 * Copy file
 */
export async function copyFile(src: string, dest: string): Promise<void> {
  await fsCopyFile(src, dest);
}

/**
 * Remove file or directory recursively
 */
export async function remove(path: string): Promise<void> {
  await rm(path, { recursive: true, force: true });
}

/**
 * Read directory entries
 */
export async function readdir(
  path: string,
  options: { withFileTypes: true },
): Promise<Dirent[]>;
export async function readdir(path: string): Promise<string[]>;
export async function readdir(
  path: string,
  options?: { withFileTypes: true },
): Promise<string[] | Dirent[]> {
  try {
    if (options?.withFileTypes) {
      return await fsReaddir(path, { withFileTypes: true });
    }
    return await fsReaddir(path);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

/**
 * Get file stats
 */
export async function stat(path: string): Promise<Stats | null> {
  try {
    return await fsStat(path);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

/**
 * Find the first existing path from a list of paths
 * Returns the first path that exists, or null if none exist
 */
export async function findFirstExistingPath(
  paths: string[],
): Promise<string | null> {
  for (const path of paths) {
    if (await pathExists(path)) {
      return path;
    }
  }
  return null;
}

// ============================================================
// Symlink operations
// ============================================================

/**
 * Check if a path is a symlink
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
 * Returns real path if symlink, original path otherwise
 */
export async function resolveSymlink(path: string): Promise<string> {
  const isLink = await isSymlink(path);
  if (!isLink) {
    await lstat(path);
    return path;
  }

  let target = await readlink(path);
  // On Windows, remove \\?\ prefix (UNC paths)
  if (process.platform === "win32" && target.startsWith("\\\\?\\")) {
    target = target.slice(4);
  }
  return target;
}

/**
 * Create a symlink from target to source
 * @param target - Path where symlink will be created
 * @param source - Path that symlink points to (must exist)
 */
export async function createSymlink(
  target: string,
  source: string,
): Promise<void> {
  // Verify source exists
  const sourceStats = await stat(source);
  if (!sourceStats) {
    throw new Error(`Source path does not exist: ${source}`);
  }

  // Check if target already exists
  try {
    await lstat(target);
    throw new Error(`Target path already exists: ${target}`);
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code !== "ENOENT") {
      throw error;
    }
  }

  // Create parent directories if needed
  const parentDir = dirname(target);
  await ensureDir(parentDir);

  // Create symlink (use 'junction' on Windows for no admin requirement)
  const type = process.platform === "win32" ? "junction" : "dir";
  await symlink(source, target, type);
}

/**
 * Remove a symlink (only removes the link, not the source)
 */
export async function removeSymlink(path: string): Promise<void> {
  const isLink = await isSymlink(path);
  if (!isLink) {
    throw new Error(`Path is not a symlink: ${path}`);
  }
  await unlink(path);
}
