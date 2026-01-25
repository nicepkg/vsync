/**
 * Symlink Sync Handler
 * Manages symlink-based synchronization for skills directories
 *
 * Design Principles:
 * - Single Responsibility: Handles only symlink setup for skills
 * - High Cohesion: All symlink sync logic in one place
 * - Low Coupling: Minimal dependencies, uses utility functions
 */

import { stat, lstat, unlink, rmdir, readdir } from "node:fs/promises";
import { join } from "node:path";
import type { VibeConfig } from "@src/types/config.js";
import {
  isSymlink,
  createSymlink,
  resolveSymlink,
  removeSymlink,
} from "@src/utils/symlink.js";

/**
 * Validation result for symlink setup
 */
export interface SymlinkValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Check if symlinks should be used based on configuration
 *
 * @param config - vibe-sync configuration
 * @returns True if symlinks should be used
 */
export function shouldUseSymlinks(config: VibeConfig): boolean {
  return config.use_symlinks_for_skills === true;
}

/**
 * Validate symlink setup before creating
 * Checks for circular symlinks and validates source exists
 *
 * @param sourcePath - Source skills directory path
 * @param targetPath - Target skills directory path
 * @returns Validation result
 */
export async function validateSymlinkSetup(
  sourcePath: string,
  targetPath: string,
): Promise<SymlinkValidationResult> {
  const errors: string[] = [];

  // Check if source exists
  try {
    await stat(sourcePath);
  } catch {
    errors.push("Source skills directory does not exist");
    return { valid: false, errors };
  }

  // Check if target is already a symlink
  const targetIsSymlink = await isSymlink(targetPath);
  if (targetIsSymlink) {
    try {
      const resolved = await resolveSymlink(targetPath);

      // Check for circular symlinks
      const sourceIsSymlink = await isSymlink(sourcePath);
      if (sourceIsSymlink) {
        const sourceResolved = await resolveSymlink(sourcePath);
        if (sourceResolved === targetPath || resolved === sourcePath) {
          errors.push(
            `Circular symlink detected: ${sourcePath} <-> ${targetPath}`,
          );
          return { valid: false, errors };
        }
      }

      // If target already points to source, that's fine
      if (resolved === sourcePath) {
        return { valid: true, errors: [] };
      }
    } catch {
      // Broken symlink - will be replaced
    }
  }

  return { valid: true, errors };
}

/**
 * Setup symlink from target to source for skills directory
 * Removes existing target directory if it exists
 *
 * @param sourcePath - Source skills directory path (e.g., .claude/skills)
 * @param targetPath - Target skills directory path (e.g., .cursor/skills)
 * @throws Error if validation fails or symlink creation fails
 */
export async function setupSymlinkForSkills(
  sourcePath: string,
  targetPath: string,
): Promise<void> {
  // Validate setup
  const validation = await validateSymlinkSetup(sourcePath, targetPath);
  if (!validation.valid) {
    throw new Error(`Invalid symlink setup: ${validation.errors.join(", ")}`);
  }

  // Check if target is already a symlink to source
  const targetIsSymlink = await isSymlink(targetPath);
  if (targetIsSymlink) {
    try {
      const resolved = await resolveSymlink(targetPath);
      if (resolved === sourcePath) {
        // Already points to correct source, nothing to do
        return;
      }
    } catch {
      // Broken symlink, will be replaced
    }
  }

  // Remove existing target directory/symlink if it exists
  try {
    await lstat(targetPath); // Check if path exists

    // Check if target is a symlink
    if (await isSymlink(targetPath)) {
      await removeSymlink(targetPath);
    } else {
      // Regular directory - need to remove recursively
      await removeDirectoryRecursive(targetPath);
    }
  } catch (error) {
    // Path doesn't exist (ENOENT) - that's fine
    if (error instanceof Error && "code" in error && error.code !== "ENOENT") {
      // Path exists but can't remove it
      throw error;
    }
  }

  // Create symlink
  await createSymlink(targetPath, sourcePath);
}

/**
 * Remove directory recursively
 * Workaround for mock-fs issues with rm({ recursive: true })
 *
 * @param dirPath - Directory path to remove
 */
async function removeDirectoryRecursive(dirPath: string): Promise<void> {
  try {
    const entries = await readdir(dirPath);

    // Remove all entries first
    for (const entry of entries) {
      const entryPath = join(dirPath, entry);
      const entryStat = await lstat(entryPath);

      if (entryStat.isDirectory()) {
        await removeDirectoryRecursive(entryPath);
      } else {
        await unlink(entryPath);
      }
    }

    // Remove the directory itself
    await rmdir(dirPath);
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      // Already removed or doesn't exist
      return;
    }
    throw error;
  }
}
