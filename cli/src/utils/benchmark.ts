/**
 * Benchmarking utilities for performance measurement
 *
 * Design Principles:
 * - Single Responsibility: Only handles performance timing and measurement
 * - High Cohesion: All benchmarking functions grouped together
 * - Low Coupling: No dependencies on other modules
 * - DRY: Reusable timing utilities
 */

/**
 * Performance measurement result
 */
export interface BenchmarkResult {
  /** Operation name */
  operation: string;
  /** Duration in milliseconds */
  duration: number;
  /** Number of items processed (if applicable) */
  itemCount?: number;
  /** Items per second (if itemCount provided) */
  throughput?: number;
  /** Memory usage before operation (bytes) */
  memoryBefore?: number;
  /** Memory usage after operation (bytes) */
  memoryAfter?: number;
  /** Memory delta (bytes) */
  memoryDelta?: number;
}

/**
 * Benchmark comparison result
 */
export interface BenchmarkComparison {
  /** Baseline measurement */
  baseline: BenchmarkResult;
  /** Optimized measurement */
  optimized: BenchmarkResult;
  /** Speed improvement factor (e.g., 2.5 means 2.5x faster) */
  speedup: number;
  /** Percentage improvement (e.g., 60 means 60% faster) */
  improvement: number;
  /** Time saved in milliseconds */
  timeSaved: number;
}

/**
 * High-resolution timer for accurate measurements
 */
class PrecisionTimer {
  private startTime: bigint;
  private startMemory?: NodeJS.MemoryUsage;

  constructor(private trackMemory: boolean = false) {
    this.startTime = process.hrtime.bigint();
    if (trackMemory) {
      this.startMemory = process.memoryUsage();
    }
  }

  /**
   * Get elapsed time in milliseconds
   */
  elapsed(): number {
    const endTime = process.hrtime.bigint();
    const nanoSeconds = endTime - this.startTime;
    return Number(nanoSeconds) / 1_000_000; // Convert to milliseconds
  }

  /**
   * Get memory delta if tracking is enabled
   */
  memoryDelta(): number | undefined {
    if (!this.trackMemory || !this.startMemory) {
      return undefined;
    }
    const endMemory = process.memoryUsage();
    return endMemory.heapUsed - this.startMemory.heapUsed;
  }

  /**
   * Get full memory info if tracking is enabled
   */
  memoryInfo():
    | {
        before: number;
        after: number;
        delta: number;
      }
    | undefined {
    if (!this.trackMemory || !this.startMemory) {
      return undefined;
    }
    const endMemory = process.memoryUsage();
    return {
      before: this.startMemory.heapUsed,
      after: endMemory.heapUsed,
      delta: endMemory.heapUsed - this.startMemory.heapUsed,
    };
  }
}

/**
 * Measure the execution time of a synchronous or asynchronous function
 *
 * @param operation - Operation name for reporting
 * @param fn - Function to benchmark
 * @param options - Benchmark options
 * @returns Benchmark result
 *
 * @example
 * ```typescript
 * const result = await measure("file read", async () => {
 *   return await fs.readFile("large.txt", "utf-8");
 * }, { itemCount: 1000 });
 * console.log(`Throughput: ${result.throughput} items/sec`);
 * ```
 */
export async function measure<T>(
  operation: string,
  fn: () => T | Promise<T>,
  options: {
    itemCount?: number;
    trackMemory?: boolean;
  } = {},
): Promise<BenchmarkResult> {
  const timer = new PrecisionTimer(options.trackMemory);

  // Execute the function
  await fn();

  const duration = timer.elapsed();
  const memoryInfo = timer.memoryInfo();

  const result: BenchmarkResult = {
    operation,
    duration,
  };

  if (options.itemCount !== undefined) {
    result.itemCount = options.itemCount;
    result.throughput = (options.itemCount / duration) * 1000; // items per second
  }

  if (memoryInfo) {
    result.memoryBefore = memoryInfo.before;
    result.memoryAfter = memoryInfo.after;
    result.memoryDelta = memoryInfo.delta;
  }

  return result;
}

/**
 * Run a benchmark multiple times and return statistics
 *
 * @param operation - Operation name
 * @param fn - Function to benchmark
 * @param iterations - Number of iterations to run
 * @param options - Benchmark options
 * @returns Array of benchmark results
 */
export async function measureMultiple<T>(
  operation: string,
  fn: () => T | Promise<T>,
  iterations: number,
  options: {
    itemCount?: number;
    trackMemory?: boolean;
  } = {},
): Promise<BenchmarkResult[]> {
  const results: BenchmarkResult[] = [];

  for (let i = 0; i < iterations; i++) {
    const result = await measure(operation, fn, options);
    results.push(result);
  }

  return results;
}

/**
 * Calculate statistics from multiple benchmark results
 *
 * @param results - Array of benchmark results
 * @returns Statistical summary
 */
export function calculateStats(results: BenchmarkResult[]): {
  min: number;
  max: number;
  mean: number;
  median: number;
  stdDev: number;
} {
  if (results.length === 0) {
    throw new Error("Cannot calculate stats from empty results array");
  }

  const durations = results.map((r) => r.duration);
  durations.sort((a, b) => a - b);

  const min = durations[0]!;
  const max = durations[durations.length - 1]!;
  const mean = durations.reduce((a, b) => a + b, 0) / durations.length;
  const median = durations[Math.floor(durations.length / 2)]!;

  // Calculate standard deviation
  const variance =
    durations.reduce((sum, d) => sum + Math.pow(d - mean, 2), 0) /
    durations.length;
  const stdDev = Math.sqrt(variance);

  return { min, max, mean, median, stdDev };
}

/**
 * Compare two benchmark results (baseline vs optimized)
 *
 * @param baseline - Baseline measurement
 * @param optimized - Optimized measurement
 * @returns Comparison result showing improvement
 *
 * @example
 * ```typescript
 * const baseline = await measure("sequential sync", () => sequentialSync());
 * const optimized = await measure("parallel sync", () => parallelSync());
 * const comparison = compare(baseline, optimized);
 * console.log(`${comparison.improvement}% faster`);
 * ```
 */
export function compare(
  baseline: BenchmarkResult,
  optimized: BenchmarkResult,
): BenchmarkComparison {
  const speedup = baseline.duration / optimized.duration;
  const improvement =
    ((baseline.duration - optimized.duration) / baseline.duration) * 100;
  const timeSaved = baseline.duration - optimized.duration;

  return {
    baseline,
    optimized,
    speedup,
    improvement,
    timeSaved,
  };
}

/**
 * Format benchmark result for human-readable output
 *
 * @param result - Benchmark result to format
 * @returns Formatted string
 */
export function formatResult(result: BenchmarkResult): string {
  let output = `${result.operation}: ${result.duration.toFixed(2)}ms`;

  if (result.itemCount !== undefined && result.throughput !== undefined) {
    output += ` (${result.throughput.toFixed(0)} items/sec)`;
  }

  if (result.memoryDelta !== undefined) {
    const mb = result.memoryDelta / (1024 * 1024);
    output += ` | Memory: ${mb >= 0 ? "+" : ""}${mb.toFixed(2)}MB`;
  }

  return output;
}

/**
 * Format benchmark comparison for human-readable output
 *
 * @param comparison - Comparison result to format
 * @returns Formatted string
 */
export function formatComparison(comparison: BenchmarkComparison): string {
  const { baseline, optimized, speedup, improvement, timeSaved } = comparison;

  return [
    `Baseline: ${baseline.duration.toFixed(2)}ms`,
    `Optimized: ${optimized.duration.toFixed(2)}ms`,
    `Speedup: ${speedup.toFixed(2)}x`,
    `Improvement: ${improvement.toFixed(1)}%`,
    `Time saved: ${timeSaved.toFixed(2)}ms`,
  ].join(" | ");
}

/**
 * Create a benchmark report with multiple comparisons
 *
 * @param comparisons - Array of comparisons
 * @returns Formatted report string
 */
export function createReport(
  comparisons: Array<{
    name: string;
    comparison: BenchmarkComparison;
  }>,
): string {
  const lines = ["Performance Benchmark Report", "=".repeat(80), ""];

  for (const { name, comparison } of comparisons) {
    lines.push(`${name}:`);
    lines.push(`  ${formatComparison(comparison)}`);
    lines.push("");
  }

  return lines.join("\n");
}
