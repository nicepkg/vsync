/**
 * Symlink Sync Handler
 * Manages symlink-based synchronization for skills directories
 *
 * Design Principles:
 * - Single Responsibility: Handles only symlink setup for skills
 * - High Cohesion: All symlink sync logic in one place
 * - Low Coupling: Minimal dependencies, uses utility functions
 */

import {
  stat,
  lstat,
  unlink,
  rmdir,
  readdir,
  mkdir,
  copyFile,
  access,
} from "node:fs/promises";
import { join, dirname, basename } from "node:path";
import type { VibeConfig } from "@src/types/config.js";
import {
  isSymlink,
  createSymlink,
  resolveSymlink,
  removeSymlink,
} from "@src/utils/file-ops.js";

/**
 * Validation result for symlink setup
 */
export interface SymlinkValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Backup information for a directory
 */
export interface DirectoryBackupInfo {
  /** Original directory path */
  originalPath: string;
  /** Backup directory path (empty if directory didn't exist) */
  backupPath: string;
  /** Whether the directory existed before backup */
  existed: boolean;
  /** Timestamp when backup was created */
  timestamp: string;
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
 * Create a backup of a directory before modification
 * Recursively copies all files and subdirectories
 *
 * @param dirPath - Path to directory to backup
 * @returns Backup information
 */
export async function createDirectoryBackup(
  dirPath: string,
): Promise<DirectoryBackupInfo> {
  const timestamp = new Date().toISOString();

  // Check if directory exists
  let existed = true;
  try {
    await access(dirPath);
  } catch {
    existed = false;
  }

  // If directory doesn't exist, nothing to backup
  if (!existed) {
    return {
      originalPath: dirPath,
      backupPath: "",
      existed: false,
      timestamp,
    };
  }

  // Create backup directory in parent directory
  const parentDir = dirname(dirPath);
  const dirName = basename(dirPath);
  const backupDirName = `.vibe-sync-backup-${Date.now()}-${dirName}`;
  const backupPath = join(parentDir, backupDirName);

  // Copy directory recursively
  await copyDirectoryRecursive(dirPath, backupPath);

  return {
    originalPath: dirPath,
    backupPath,
    existed: true,
    timestamp,
  };
}

/**
 * Restore a directory from backup
 * Deletes current directory and restores from backup
 *
 * @param backup - Backup information
 */
export async function restoreDirectoryBackup(
  backup: DirectoryBackupInfo,
): Promise<void> {
  if (!backup.existed) {
    // Directory didn't exist originally - delete it if it exists now
    try {
      await removeDirectoryRecursive(backup.originalPath);
    } catch {
      // Ignore errors - directory might already be deleted
    }
    return;
  }

  // Directory existed - restore from backup
  if (!backup.backupPath) {
    // No backup path means nothing to restore
    return;
  }

  try {
    // Check if backup still exists
    await access(backup.backupPath);

    // Remove current directory if it exists
    try {
      await removeDirectoryRecursive(backup.originalPath);
    } catch {
      // Ignore errors - directory might not exist
    }

    // Restore from backup
    await copyDirectoryRecursive(backup.backupPath, backup.originalPath);
  } catch {
    // Ignore errors - backup might have been cleaned up
  }
}

/**
 * Clean up backup directory after successful operation
 *
 * @param backup - Backup information
 */
export async function cleanupDirectoryBackup(
  backup: DirectoryBackupInfo,
): Promise<void> {
  if (!backup.backupPath) {
    // No backup directory to clean up
    return;
  }

  try {
    await removeDirectoryRecursive(backup.backupPath);
  } catch {
    // Ignore errors - backup might already be deleted
  }
}

/**
 * Setup symlink from target to source with automatic backup and rollback
 * Creates backup before deletion, restores on error
 *
 * @param sourcePath - Source skills directory path (e.g., .claude/skills)
 * @param targetPath - Target skills directory path (e.g., .cursor/skills)
 * @returns Backup information (caller should cleanup on success)
 * @throws Error if validation fails or symlink creation fails
 */
export async function setupSymlinkWithBackup(
  sourcePath: string,
  targetPath: string,
): Promise<DirectoryBackupInfo> {
  // Validate setup
  const validation = await validateSymlinkSetup(sourcePath, targetPath);
  if (!validation.valid) {
    throw new Error(`Invalid symlink setup: ${validation.errors.join(", ")}`);
  }

  // Create backup before any modifications
  const backup = await createDirectoryBackup(targetPath);

  try {
    // Check if target is already a symlink to source
    const targetIsSymlink = await isSymlink(targetPath);
    if (targetIsSymlink) {
      try {
        const resolved = await resolveSymlink(targetPath);
        if (resolved === sourcePath) {
          // Already points to correct source, nothing to do
          // No need to restore since nothing was changed
          return backup;
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
      if (
        error instanceof Error &&
        "code" in error &&
        error.code !== "ENOENT"
      ) {
        // Path exists but can't remove it - rollback
        await restoreDirectoryBackup(backup);
        throw error;
      }
    }

    // Create symlink
    try {
      await createSymlink(targetPath, sourcePath);
    } catch (error) {
      // Symlink creation failed - rollback
      await restoreDirectoryBackup(backup);
      throw error;
    }

    return backup;
  } catch (error) {
    // Any error during setup - ensure rollback happened
    await restoreDirectoryBackup(backup);
    throw error;
  }
}

/**
 * Copy directory recursively
 * Helper function for backup/restore operations
 *
 * @param srcPath - Source directory path
 * @param destPath - Destination directory path
 */
async function copyDirectoryRecursive(
  srcPath: string,
  destPath: string,
): Promise<void> {
  // Create destination directory
  await mkdir(destPath, { recursive: true });

  // Read source directory
  const entries = await readdir(srcPath);

  // Copy all entries
  for (const entry of entries) {
    const srcEntryPath = join(srcPath, entry);
    const destEntryPath = join(destPath, entry);
    const entryStat = await lstat(srcEntryPath);

    if (entryStat.isDirectory()) {
      // Recursively copy subdirectory
      await copyDirectoryRecursive(srcEntryPath, destEntryPath);
    } else {
      // Copy file
      await copyFile(srcEntryPath, destEntryPath);
    }
  }
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
