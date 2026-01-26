#!/usr/bin/env node

/**
 * vsync CLI Entry Point
 *
 * AI Coding Tool Config Synchronizer
 * Single source of truth → Compile to multiple formats → Diff-based sync
 */

import { realpathSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runCLI } from "./cli-setup.js";

export async function main(): Promise<void> {
  await runCLI();
}

export function isMainModule(
  argvPath: string | undefined,
  moduleUrl: string,
): boolean {
  if (!argvPath) {
    return false;
  }

  try {
    const argvRealPath = realpathSync(resolve(argvPath));
    const moduleRealPath = realpathSync(fileURLToPath(moduleUrl));
    return argvRealPath === moduleRealPath;
  } catch {
    return false;
  }
}

// Run CLI if this is the main module
if (isMainModule(process.argv[1], import.meta.url)) {
  main().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
}
