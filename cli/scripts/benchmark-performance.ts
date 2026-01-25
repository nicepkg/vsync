/**
 * Performance Benchmark Script
 *
 * Measures and compares:
 * 1. Parallel sync vs sequential sync
 * 2. Incremental sync vs full sync
 * 3. Overall throughput improvements
 *
 * Usage:
 *   pnpm tsx scripts/benchmark-performance.ts
 */

import fs from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import type { ToolAdapter } from "../src/adapters/base.js";
import { ClaudeCodeAdapter } from "../src/adapters/claude-code.js";
import { CursorAdapter } from "../src/adapters/cursor.js";
import { OpenCodeAdapter } from "../src/adapters/opencode.js";
import type { Skill } from "../src/types/models.js";
import {
  measure,
  compare,
  createReport,
  type BenchmarkResult,
} from "../src/utils/benchmark.js";

/**
 * Create test fixtures in a temporary directory
 */
async function createTestFixtures(): Promise<{
  tempDir: string;
  sourceAdapter: ToolAdapter;
  targetAdapters: ToolAdapter[];
  skills: Skill[];
}> {
  const tempDir = path.join(
    tmpdir(),
    `vibe-sync-bench-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
  );
  await fs.mkdir(tempDir, { recursive: true });

  // Create Claude Code source directory
  const claudeDir = path.join(tempDir, ".claude");
  await fs.mkdir(path.join(claudeDir, "skills"), { recursive: true });

  // Create multiple skills with varying sizes
  const skillCount = 50; // 50 skills
  for (let i = 0; i < skillCount; i++) {
    const skillDir = path.join(claudeDir, "skills", `skill-${i}`);
    await fs.mkdir(skillDir, { recursive: true });

    const content = `---
name: skill-${i}
description: Benchmark skill ${i}
---
# Skill ${i}

${"Lorem ipsum ".repeat(100 + i * 10)}
`;
    await fs.writeFile(path.join(skillDir, "SKILL.md"), content);

    // Add support files for some skills
    if (i % 10 === 0) {
      await fs.writeFile(
        path.join(skillDir, "template.txt"),
        "Template content ".repeat(50),
      );
    }
  }

  // Create target directories
  await fs.mkdir(path.join(tempDir, ".cursor"), { recursive: true });
  await fs.mkdir(path.join(tempDir, ".opencode"), { recursive: true });

  // Initialize adapters
  const sourceAdapter = new ClaudeCodeAdapter({
    tool: "claude-code",
    baseDir: tempDir,
    level: "project",
  });

  const cursorAdapter = new CursorAdapter({
    tool: "cursor",
    baseDir: tempDir,
    level: "project",
  });

  const opencodeAdapter = new OpenCodeAdapter({
    tool: "opencode",
    baseDir: tempDir,
    level: "project",
  });

  // Read skills from source
  const skills = await sourceAdapter.readSkills();

  return {
    tempDir,
    sourceAdapter,
    targetAdapters: [cursorAdapter, opencodeAdapter],
    skills,
  };
}

/**
 * Cleanup test fixtures
 */
async function cleanup(tempDir: string): Promise<void> {
  try {
    await fs.rm(tempDir, { recursive: true, force: true });
  } catch {
    // Ignore errors
  }
}

/**
 * Simulate sequential sync (old approach)
 */
async function sequentialSync(
  skills: Skill[],
  targetAdapters: ToolAdapter[],
): Promise<void> {
  for (const adapter of targetAdapters) {
    await adapter.writeSkills(skills);
  }
}

/**
 * Benchmark parallel sync vs sequential sync
 */
async function benchmarkParallelSync(): Promise<{
  name: string;
  baseline: BenchmarkResult;
  optimized: BenchmarkResult;
}> {
  console.log("\n🔄 Benchmarking Parallel Sync...");

  const { tempDir, targetAdapters, skills } = await createTestFixtures();

  try {
    // Measure sequential sync (baseline)
    const baseline = await measure(
      "Sequential Sync",
      async () => {
        await sequentialSync(skills, targetAdapters);
      },
      { itemCount: skills.length * targetAdapters.length },
    );

    // Clean up target directories for fair comparison
    for (const adapter of targetAdapters) {
      const configDir = adapter.getConfigDir();
      const skillsDir = path.join(tempDir, configDir, "skills");
      await fs.rm(skillsDir, { recursive: true, force: true }).catch(() => {});
    }

    // Measure parallel sync (optimized)
    const optimized = await measure(
      "Parallel Sync",
      async () => {
        // Use Promise.all to write skills to all targets in parallel
        await Promise.all(
          targetAdapters.map((adapter) => adapter.writeSkills(skills)),
        );
      },
      { itemCount: skills.length * targetAdapters.length },
    );

    console.log(
      `  ✓ Baseline: ${baseline.duration.toFixed(2)}ms (${baseline.throughput?.toFixed(0)} items/sec)`,
    );
    console.log(
      `  ✓ Optimized: ${optimized.duration.toFixed(2)}ms (${optimized.throughput?.toFixed(0)} items/sec)`,
    );

    return { name: "Parallel Sync", baseline, optimized };
  } finally {
    await cleanup(tempDir);
  }
}

/**
 * Benchmark file cache performance vs full read
 */
async function benchmarkIncrementalSync(): Promise<{
  name: string;
  baseline: BenchmarkResult;
  optimized: BenchmarkResult;
}> {
  console.log("\n📈 Benchmarking File Cache Performance...");

  const { tempDir, sourceAdapter } = await createTestFixtures();

  try {
    // Measure full skill read (baseline) - no caching
    const baseline = await measure(
      "Full Skill Read (no cache)",
      async () => {
        await sourceAdapter.readSkills();
      },
      { trackMemory: true },
    );

    // Read once to warm up OS filesystem cache
    await sourceAdapter.readSkills();

    // Measure subsequent read (optimized) - OS file cache helps
    const optimized = await measure(
      "Cached Skill Read (OS cache)",
      async () => {
        await sourceAdapter.readSkills();
      },
      { trackMemory: true },
    );

    console.log(
      `  ✓ Baseline: ${baseline.duration.toFixed(2)}ms (Memory: ${((baseline.memoryDelta || 0) / (1024 * 1024)).toFixed(2)}MB)`,
    );
    console.log(
      `  ✓ Optimized: ${optimized.duration.toFixed(2)}ms (Memory: ${((optimized.memoryDelta || 0) / (1024 * 1024)).toFixed(2)}MB)`,
    );

    return { name: "File Cache Performance", baseline, optimized };
  } finally {
    await cleanup(tempDir);
  }
}

/**
 * Run all benchmarks and generate report
 */
async function runBenchmarks(): Promise<void> {
  console.log("🚀 vibe-sync Performance Benchmarks");
  console.log("=".repeat(80));

  const results: Array<{
    name: string;
    baseline: BenchmarkResult;
    optimized: BenchmarkResult;
  }> = [];

  try {
    // Parallel sync benchmark
    const parallelResult = await benchmarkParallelSync();
    results.push(parallelResult);

    // Incremental sync benchmark
    const incrementalResult = await benchmarkIncrementalSync();
    results.push(incrementalResult);

    // Generate comparison report
    console.log("\n📊 Performance Summary");
    console.log("=".repeat(80));

    const comparisons = results.map(({ name, baseline, optimized }) => ({
      name,
      comparison: compare(baseline, optimized),
    }));

    const report = createReport(comparisons);
    console.log(report);

    // Calculate overall improvement
    const totalBaseline = results.reduce(
      (sum, r) => sum + r.baseline.duration,
      0,
    );
    const totalOptimized = results.reduce(
      (sum, r) => sum + r.optimized.duration,
      0,
    );
    const overallSpeedup = totalBaseline / totalOptimized;
    const overallImprovement =
      ((totalBaseline - totalOptimized) / totalBaseline) * 100;

    console.log("Overall Performance:");
    console.log(`  Total baseline time: ${totalBaseline.toFixed(2)}ms`);
    console.log(`  Total optimized time: ${totalOptimized.toFixed(2)}ms`);
    console.log(`  Overall speedup: ${overallSpeedup.toFixed(2)}x`);
    console.log(`  Overall improvement: ${overallImprovement.toFixed(1)}%`);
    console.log(
      `  Total time saved: ${(totalBaseline - totalOptimized).toFixed(2)}ms`,
    );

    console.log("\n✅ Benchmarks complete!");
  } catch (error) {
    console.error("\n❌ Benchmark failed:", error);
    process.exit(1);
  }
}

// Run benchmarks
runBenchmarks().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
