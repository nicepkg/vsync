#!/usr/bin/env node

/**
 * vsync CLI Entry Point
 *
 * AI Coding Tool Config Synchronizer
 * Single source of truth → Compile to multiple formats → Diff-based sync
 */

import { runCLI } from "./cli-setup.js";

export async function main(): Promise<void> {
  await runCLI();
}

// Run CLI if this is the main module
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
}
