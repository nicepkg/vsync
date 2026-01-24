/**
 * Atomic file write utility
 * Ensures crash-safe file writes using temp file + rename pattern
 */

import { randomBytes } from "node:crypto";
import { writeFile, rename, mkdir, unlink, open } from "node:fs/promises";
import { dirname, join } from "node:path";

/**
 * Write file atomically to prevent corruption
 *
 * Strategy:
 * 1. Write to temporary file in same directory
 * 2. fsync the temporary file
 * 3. Rename temporary file to target (atomic operation)
 * 4. Clean up on error
 *
 * @param filePath - Target file path
 * @param content - Content to write
 */
export async function atomicWrite(
  filePath: string,
  content: string,
): Promise<void> {
  const dir = dirname(filePath);
  const tmpSuffix = randomBytes(8).toString("hex");
  const tmpPath = join(dir, `.tmp-${tmpSuffix}`);

  let fileHandle;
  try {
    // Ensure parent directory exists
    await mkdir(dir, { recursive: true });

    // Write to temporary file
    await writeFile(tmpPath, content, { encoding: "utf-8", flag: "w" });

    // Fsync to ensure data is written to disk
    fileHandle = await open(tmpPath, "r+");
    await fileHandle.sync();
    await fileHandle.close();
    fileHandle = undefined;

    // Atomically rename temp file to target
    // This is atomic on POSIX systems and modern Windows
    await rename(tmpPath, filePath);
  } catch (error) {
    // Close file handle if still open
    if (fileHandle) {
      try {
        await fileHandle.close();
      } catch {
        // Ignore close errors
      }
    }

    // Clean up temp file on error
    try {
      await unlink(tmpPath);
    } catch {
      // Ignore cleanup errors
    }
    throw error;
  }
}
