/**
 * Manifest manager for .vibe-sync-cache/manifest.json
 * Tracks sync state and hashes for all configuration items
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { cwd } from "node:process";
import type { Manifest, ItemType } from "../types/manifest.js";
import { atomicWrite } from "../utils/atomic-write.js";

/**
 * Get manifest file path
 *
 * @param projectDir - Project directory (defaults to cwd)
 * @returns Absolute path to manifest file
 */
export function getManifestPath(projectDir?: string): string {
  const dir = projectDir ?? cwd();
  return join(dir, ".vibe-sync-cache", "manifest.json");
}

/**
 * Create an empty manifest with current timestamp
 *
 * @returns Empty manifest
 */
export function createEmptyManifest(): Manifest {
  return {
    version: "1.0.0",
    last_sync: new Date().toISOString(),
    items: {},
  };
}

/**
 * Load manifest from disk
 * Creates empty manifest if file doesn't exist
 *
 * @param projectDir - Project directory (optional)
 * @returns Manifest
 */
export async function loadManifest(projectDir?: string): Promise<Manifest> {
  const manifestPath = getManifestPath(projectDir);

  try {
    const content = await readFile(manifestPath, "utf-8");
    const manifest = JSON.parse(content) as Manifest;

    // Validate manifest structure
    if (!manifest.version || !manifest.items) {
      console.warn("Invalid manifest structure, creating new one");
      return createEmptyManifest();
    }

    return manifest;
  } catch (error) {
    // If file doesn't exist or is corrupted, create empty manifest
    if (error instanceof Error) {
      if ("code" in error && error.code === "ENOENT") {
        // File doesn't exist, return empty manifest
        return createEmptyManifest();
      }
      // File is corrupted, warn and return empty
      console.warn(`Corrupted manifest, creating new one: ${error.message}`);
    }
    return createEmptyManifest();
  }
}

/**
 * Save manifest to disk
 * Uses atomic write for crash safety
 *
 * @param manifest - Manifest to save
 * @param projectDir - Project directory (optional)
 */
export async function saveManifest(
  manifest: Manifest,
  projectDir?: string,
): Promise<void> {
  const manifestPath = getManifestPath(projectDir);

  // Update last_sync timestamp
  manifest.last_sync = new Date().toISOString();

  // Format with indentation for readability
  const content = JSON.stringify(manifest, null, 2);

  await atomicWrite(manifestPath, content);
}

/**
 * Get item hash from manifest
 *
 * @param manifest - Manifest to query
 * @param type - Item type (skill or mcp)
 * @param name - Item name
 * @returns Hash if found, undefined otherwise
 */
export function getItemHash(
  manifest: Manifest,
  type: ItemType,
  name: string,
): string | undefined {
  const key = `${type}/${name}`;
  return manifest.items[key]?.hash;
}

/**
 * Get manifest item key
 *
 * @param type - Item type
 * @param name - Item name
 * @returns Manifest key (e.g., "skill/name" or "mcp/name")
 */
export function getItemKey(type: ItemType, name: string): string {
  return `${type}/${name}`;
}
