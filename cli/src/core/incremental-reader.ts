/**
 * Incremental Reader - Optimized file reading with caching
 *
 * Responsibilities:
 * - Read only changed files using FileCache
 * - Cache parsed results in memory
 * - Provide generic interface for incremental reads
 *
 * Design Principles:
 * - Single Responsibility: Only handles incremental file reading
 * - Generic: Works with any file type and parser
 * - Performance: Skips unchanged files based on metadata
 */

import { promises as fs } from "node:fs";
import { hashContent } from "@src/utils/hash.js";
import { debug } from "@src/utils/logger.js";
import { type FileCache } from "./file-cache.js";

/**
 * Read result for a file
 */
export interface ReadResult<T> {
  /** Parsed data */
  data: T;
  /** File hash */
  hash: string;
  /** Whether file was read from cache */
  fromCache: boolean;
}

/**
 * Parser function type
 */
export type Parser<T> = (content: string, filePath: string) => Promise<T>;

/**
 * Incremental Reader - Reads files with caching
 *
 * Uses FileCache to detect changed files and avoid re-reading
 * unchanged files. Maintains in-memory cache of parsed results.
 */
export class IncrementalReader {
  private fileCache: FileCache;
  // In-memory cache: filePath -> parsed data
  private dataCache: Map<string, unknown> = new Map();

  constructor(fileCache: FileCache) {
    this.fileCache = fileCache;
  }

  /**
   * Read a file incrementally
   *
   * If file hasn't changed (based on mtime/size), returns cached data.
   * Otherwise reads and parses the file.
   *
   * @param filePath - Absolute path to file
   * @param parser - Function to parse file content
   * @returns Read result with data and metadata
   */
  async readFile<T>(
    filePath: string,
    parser: Parser<T>,
  ): Promise<ReadResult<T>> {
    // Check if file changed
    const isChanged = await this.fileCache.isFileChanged(filePath);

    // File unchanged - return from cache
    if (!isChanged && this.dataCache.has(filePath)) {
      const cached = this.fileCache.get(filePath);
      if (!cached) {
        throw new Error(`Cache inconsistency for ${filePath}`);
      }

      return {
        data: this.dataCache.get(filePath) as T,
        hash: cached.hash,
        fromCache: true,
      };
    }

    // File changed or not in cache - read and parse
    const content = await fs.readFile(filePath, "utf-8");
    const data = await parser(content, filePath);
    const hash = hashContent(content);

    // Update caches
    const stat = await fs.stat(filePath);
    this.fileCache.set(filePath, {
      path: filePath,
      hash,
      mtime: stat.mtimeMs,
      size: stat.size,
    });
    this.dataCache.set(filePath, data);

    return {
      data,
      hash,
      fromCache: false,
    };
  }

  /**
   * Read multiple files incrementally
   *
   * Only reads files that have changed since last read.
   *
   * @param filePaths - List of file paths
   * @param parser - Function to parse file content
   * @returns Array of read results
   */
  async readFiles<T>(
    filePaths: string[],
    parser: Parser<T>,
  ): Promise<ReadResult<T>[]> {
    const results: ReadResult<T>[] = [];

    for (const filePath of filePaths) {
      try {
        const result = await this.readFile(filePath, parser);
        results.push(result);
      } catch (error) {
        // Skip files that can't be read
        debug(
          `Failed to read ${filePath}: ${error instanceof Error ? error.message : "Unknown error"}`,
        );
      }
    }

    return results;
  }

  /**
   * Get list of files that need to be read
   *
   * Filters out unchanged files based on cache.
   *
   * @param filePaths - List of file paths to check
   * @returns List of files that have changed
   */
  async getFilesToRead(filePaths: string[]): Promise<string[]> {
    return this.fileCache.getChangedFiles(filePaths);
  }

  /**
   * Clear in-memory cache
   *
   * Useful when you want to force re-reading files.
   */
  clearDataCache(): void {
    this.dataCache.clear();
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    filesCached: number;
    datasCached: number;
  } {
    return {
      filesCached: this.fileCache.size(),
      datasCached: this.dataCache.size,
    };
  }
}
