/* eslint-disable @typescript-eslint/no-explicit-any */
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
} from "node:fs/promises";
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
 */
export async function readJSON<T = any>(path: string): Promise<T | null> {
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
export async function writeJSON(path: string, data: any): Promise<void> {
  await atomicWrite(path, JSON.stringify(data, null, 2));
}

/**
 * Read JSONC file
 * Returns { data, text } where text is the original formatting
 */
export async function readJSONC<T = any>(
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
export async function writeJSONC(
  path: string,
  data: any,
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
export async function readTOML<T = any>(path: string): Promise<T | null> {
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
export async function writeTOML(path: string, data: any): Promise<void> {
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
  options?: { withFileTypes: true },
): Promise<Dirent[]>;
export async function readdir(path: string): Promise<string[]>;
export async function readdir(
  path: string,
  options?: any,
): Promise<string[] | Dirent[]> {
  try {
    return (await fsReaddir(path, options)) as any;
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
