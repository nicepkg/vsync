/**
 * File Cache - Incremental sync optimization
 *
 * Responsibilities:
 * - Track file modification times and sizes
 * - Detect which files have changed since last read
 * - Cache file hashes to avoid re-computing
 * - Persist cache to disk for cross-session optimization
 *
 * Design Principles:
 * - Single Responsibility: Only manages file change detection
 * - Performance: Uses mtime/size checks before hash computation
 * - Persistence: Saves cache to disk for incremental runs
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { atomicWrite } from "@src/utils/atomic-write.js";

/**
 * Cache entry for a single file
 */
export interface CacheEntry {
  /** Absolute file path */
  path: string;
  /** Content hash */
  hash: string;
  /** Last modification time (milliseconds since epoch) */
  mtime: number;
  /** File size in bytes */
  size: number;
}

/**
 * Serialized cache structure
 */
interface CacheData {
  entries: Record<string, CacheEntry>;
}

/**
 * File Cache - Tracks file changes for incremental sync
 *
 * Uses file metadata (mtime, size) to quickly detect changes
 * without re-reading and re-hashing unchanged files.
 */
export class FileCache {
  private entries: Map<string, CacheEntry> = new Map();
  private cachePath: string;

  /**
   * Create file cache
   * @param cachePath - Path to cache file
   */
  constructor(cachePath: string) {
    this.cachePath = cachePath;
  }

  /**
   * Load cache from disk
   */
  async load(): Promise<void> {
    try {
      const data = await fs.readFile(this.cachePath, "utf-8");
      const parsed: CacheData = JSON.parse(data);

      this.entries.clear();
      for (const [filePath, entry] of Object.entries(parsed.entries)) {
        this.entries.set(filePath, entry);
      }
    } catch {
      // Cache doesn't exist or is corrupted - start fresh
      this.entries.clear();
    }
  }

  /**
   * Save cache to disk
   */
  async save(): Promise<void> {
    const data: CacheData = {
      entries: Object.fromEntries(this.entries),
    };

    // Create cache directory if needed
    const dir = path.dirname(this.cachePath);
    await fs.mkdir(dir, { recursive: true });

    // Use atomic write to prevent corruption
    await atomicWrite(this.cachePath, JSON.stringify(data, null, 2));
  }

  /**
   * Get cache entry for a file
   */
  get(filePath: string): CacheEntry | undefined {
    return this.entries.get(filePath);
  }

  /**
   * Set cache entry for a file
   */
  set(filePath: string, entry: CacheEntry): void {
    this.entries.set(filePath, entry);
  }

  /**
   * Check if file is in cache
   */
  has(filePath: string): boolean {
    return this.entries.has(filePath);
  }

  /**
   * Delete cache entry
   */
  delete(filePath: string): void {
    this.entries.delete(filePath);
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.entries.clear();
  }

  /**
   * Get number of cached files
   */
  size(): number {
    return this.entries.size;
  }

  /**
   * Check if a file has changed since it was cached
   *
   * Fast check using mtime and size - avoids reading file content
   *
   * @param filePath - Absolute path to file
   * @returns true if file changed, false if unchanged
   */
  async isFileChanged(filePath: string): Promise<boolean> {
    const cached = this.entries.get(filePath);

    // File not in cache - treat as changed
    if (!cached) {
      return true;
    }

    try {
      const stat = await fs.stat(filePath);

      // Compare mtime and size (fast metadata checks)
      if (stat.mtimeMs !== cached.mtime || stat.size !== cached.size) {
        return true;
      }

      return false;
    } catch {
      // File doesn't exist or can't be accessed - treat as changed
      return true;
    }
  }

  /**
   * Get list of changed files from a file list
   *
   * @param files - List of file paths to check
   * @returns List of files that have changed
   */
  async getChangedFiles(files: string[]): Promise<string[]> {
    const changed: string[] = [];

    for (const file of files) {
      const isChanged = await this.isFileChanged(file);
      if (isChanged) {
        changed.push(file);
      }
    }

    return changed;
  }

  /**
   * Invalidate cache entries older than a threshold
   *
   * @param maxAge - Maximum age in milliseconds
   */
  invalidateOld(maxAge: number): void {
    const now = Date.now();

    for (const [filePath, entry] of this.entries) {
      if (now - entry.mtime > maxAge) {
        this.entries.delete(filePath);
      }
    }
  }
}
