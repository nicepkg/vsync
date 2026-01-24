/**
 * Manifest manager for .vibe-sync-cache/manifest.json
 * Tracks sync state and hashes for all configuration items
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { cwd } from "node:process";
import type { ToolName } from "@src/types/config.js";
import type { Manifest, ItemType } from "@src/types/manifest.js";
import { atomicWrite } from "@src/utils/atomic-write.js";

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
    last_synced: new Date().toISOString(),
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

  // Update last_synced timestamp
  manifest.last_synced = new Date().toISOString();

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
function getItemKey(type: ItemType, name: string): string {
  return `${type}/${name}`;
}

/**
 * Update manifest after creating a new item
 * Adds the item to manifest or updates target if item already exists
 *
 * @param manifest - Manifest to update
 * @param type - Item type (skill or mcp)
 * @param name - Item name
 * @param hash - Item hash
 * @param targetTool - Target tool name
 */
export function updateAfterCreate(
  manifest: Manifest,
  type: ItemType,
  name: string,
  hash: string,
  targetTool: ToolName,
): void {
  const key = getItemKey(type, name);
  const now = new Date().toISOString();

  // If item doesn't exist, create it
  if (!manifest.items[key]) {
    manifest.items[key] = {
      type,
      name,
      hash,
      last_synced: now,
      targets: {},
    };
  }

  // Add or update target
  manifest.items[key].targets[targetTool] = {
    synced: true,
    hash,
    last_synced: now,
  };
}

/**
 * Update manifest after updating an existing item
 * Updates the hash for both the item and the target
 *
 * @param manifest - Manifest to update
 * @param type - Item type (skill or mcp)
 * @param name - Item name
 * @param newHash - New hash value
 * @param targetTool - Target tool name
 * @throws Error if item doesn't exist in manifest
 */
export function updateAfterUpdate(
  manifest: Manifest,
  type: ItemType,
  name: string,
  newHash: string,
  targetTool: ToolName,
): void {
  const key = getItemKey(type, name);
  const item = manifest.items[key];

  if (!item) {
    throw new Error(`Item ${key} not found in manifest`);
  }

  const now = new Date().toISOString();

  // Update item hash and timestamp
  item.hash = newHash;
  item.last_synced = now;

  // Update target
  item.targets[targetTool] = {
    synced: true,
    hash: newHash,
    last_synced: now,
  };
}

/**
 * Update manifest after deleting an item from a target
 * Removes the target entry but keeps the item in manifest
 *
 * @param manifest - Manifest to update
 * @param type - Item type (skill or mcp)
 * @param name - Item name
 * @param targetTool - Target tool name
 * @throws Error if item doesn't exist in manifest
 */
export function updateAfterDelete(
  manifest: Manifest,
  type: ItemType,
  name: string,
  targetTool: ToolName,
): void {
  const key = getItemKey(type, name);
  const item = manifest.items[key];

  if (!item) {
    throw new Error(`Item ${key} not found in manifest`);
  }

  // Remove target entry
  delete item.targets[targetTool];
}

/**
 * Remove orphaned items from manifest
 * Orphaned items are items with no targets
 *
 * @param manifest - Manifest to clean
 * @returns Array of removed item keys
 */
export function pruneOrphanedItems(manifest: Manifest): string[] {
  const removed: string[] = [];

  for (const [key, item] of Object.entries(manifest.items)) {
    // If item has no targets, remove it
    if (Object.keys(item.targets).length === 0) {
      delete manifest.items[key];
      removed.push(key);
    }
  }

  return removed;
}
