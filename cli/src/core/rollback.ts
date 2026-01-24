/**
 * Rollback mechanism for safe error recovery
 * Provides backup/restore capabilities for sync operations
 */

import { readFile, unlink, copyFile, mkdir, access } from "node:fs/promises";
import { dirname, join, basename } from "node:path";
import { atomicWrite } from "@src/utils/atomic-write.js";

/**
 * Backup information for a file
 */
export interface BackupInfo {
  /** Original file path */
  originalPath: string;
  /** Backup file path (empty if file didn't exist) */
  backupPath: string;
  /** Whether the file existed before backup */
  existed: boolean;
  /** Timestamp when backup was created */
  timestamp: string;
}

/**
 * Create a backup of a file before modification
 *
 * Strategy:
 * 1. Check if file exists
 * 2. If exists, copy to backup file in same directory
 * 3. Return backup info for later restore/cleanup
 *
 * @param filePath - Path to file to backup
 * @returns Backup information
 */
export async function createBackup(filePath: string): Promise<BackupInfo> {
  const timestamp = new Date().toISOString();

  // Check if file exists
  let existed = true;
  try {
    await access(filePath);
  } catch {
    existed = false;
  }

  // If file doesn't exist, nothing to backup
  if (!existed) {
    return {
      originalPath: filePath,
      backupPath: "",
      existed: false,
      timestamp,
    };
  }

  // Create backup file in same directory
  const dir = dirname(filePath);
  const file = basename(filePath);
  const backupFileName = `.vibe-sync-backup-${Date.now()}-${file}`;
  const backupPath = join(dir, backupFileName);

  // Ensure backup directory exists
  await mkdir(dir, { recursive: true });

  // Copy file to backup location
  await copyFile(filePath, backupPath);

  return {
    originalPath: filePath,
    backupPath,
    existed: true,
    timestamp,
  };
}

/**
 * Restore a file from backup
 *
 * Strategy:
 * 1. If file existed before, restore from backup
 * 2. If file didn't exist before, delete it
 * 3. Use atomic write for restoration to prevent corruption
 *
 * @param backup - Backup information
 */
export async function restoreBackup(backup: BackupInfo): Promise<void> {
  if (!backup.existed) {
    // File didn't exist originally - delete it if it exists now
    try {
      await unlink(backup.originalPath);
    } catch {
      // Ignore errors - file might already be deleted
    }
    return;
  }

  // File existed - restore from backup
  if (!backup.backupPath) {
    // No backup path means nothing to restore
    return;
  }

  try {
    // Read backup content
    const backupContent = await readFile(backup.backupPath, "utf-8");

    // Restore using atomic write to prevent corruption
    await atomicWrite(backup.originalPath, backupContent);
  } catch {
    // Ignore errors - backup might have been cleaned up or file deleted
  }
}

/**
 * Clean up backup file after successful operation
 *
 * @param backup - Backup information
 */
export async function cleanupBackup(backup: BackupInfo): Promise<void> {
  if (!backup.backupPath) {
    // No backup file to clean up
    return;
  }

  try {
    await unlink(backup.backupPath);
  } catch {
    // Ignore errors - backup might already be deleted
  }
}
