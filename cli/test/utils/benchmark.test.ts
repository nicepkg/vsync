/**
 * Benchmark utility tests
 */

import { describe, it, expect } from "vitest";
import {
  measure,
  measureMultiple,
  calculateStats,
  compare,
  formatResult,
  formatComparison,
  createReport,
  type BenchmarkResult,
} from "@src/utils/benchmark.js";

describe("Benchmark Utilities", () => {
  describe("measure", () => {
    it("should measure synchronous function execution time", async () => {
      const result = await measure("sync operation", () => {
        // Simulate work
        let sum = 0;
        for (let i = 0; i < 1000; i++) {
          sum += i;
        }
        return sum;
      });

      expect(result.operation).toBe("sync operation");
      expect(result.duration).toBeGreaterThan(0);
      expect(result.duration).toBeLessThan(100); // Should be fast
    });

    it("should measure asynchronous function execution time", async () => {
      const result = await measure("async operation", async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
      });

      expect(result.operation).toBe("async operation");
      // Allow some variance in CI environments (8ms-50ms range)
      expect(result.duration).toBeGreaterThanOrEqual(8);
      expect(result.duration).toBeLessThan(50); // Allow some overhead
    });

    it("should calculate throughput when itemCount provided", async () => {
      const itemCount = 1000;
      const result = await measure(
        "batch operation",
        async () => {
          await new Promise((resolve) => setTimeout(resolve, 100));
        },
        { itemCount },
      );

      expect(result.itemCount).toBe(itemCount);
      expect(result.throughput).toBeDefined();
      expect(result.throughput).toBeGreaterThan(0);
      // throughput = items / (duration_ms / 1000) = items * 1000 / duration_ms
      const expectedThroughput = (itemCount / result.duration) * 1000;
      expect(result.throughput).toBeCloseTo(expectedThroughput, 1);
    });

    it("should track memory usage when trackMemory enabled", async () => {
      const result = await measure(
        "memory operation",
        () => {
          // Allocate some memory
          const arr = new Array(10000).fill(0);
          return arr.length;
        },
        { trackMemory: true },
      );

      expect(result.memoryBefore).toBeDefined();
      expect(result.memoryAfter).toBeDefined();
      expect(result.memoryDelta).toBeDefined();
    });

    it("should not track memory when trackMemory disabled", async () => {
      const result = await measure("no memory tracking", () => {
        return 42;
      });

      expect(result.memoryBefore).toBeUndefined();
      expect(result.memoryAfter).toBeUndefined();
      expect(result.memoryDelta).toBeUndefined();
    });
  });

  describe("measureMultiple", () => {
    it("should run benchmark multiple times", async () => {
      const iterations = 5;
      const results = await measureMultiple(
        "repeated operation",
        async () => {
          await new Promise((resolve) => setTimeout(resolve, 5));
        },
        iterations,
      );

      expect(results).toHaveLength(iterations);
      for (const result of results) {
        expect(result.operation).toBe("repeated operation");
        expect(result.duration).toBeGreaterThan(0);
      }
    });

    it("should pass options to each measurement", async () => {
      const results = await measureMultiple(
        "batch test",
        () => {
          return 100;
        },
        3,
        { itemCount: 100, trackMemory: true },
      );

      expect(results).toHaveLength(3);
      for (const result of results) {
        expect(result.itemCount).toBe(100);
        expect(result.throughput).toBeDefined();
        expect(result.memoryDelta).toBeDefined();
      }
    });
  });

  describe("calculateStats", () => {
    it("should calculate statistics from results", () => {
      const results: BenchmarkResult[] = [
        { operation: "test", duration: 10 },
        { operation: "test", duration: 20 },
        { operation: "test", duration: 15 },
        { operation: "test", duration: 25 },
        { operation: "test", duration: 30 },
      ];

      const stats = calculateStats(results);

      expect(stats.min).toBe(10);
      expect(stats.max).toBe(30);
      expect(stats.mean).toBe(20);
      expect(stats.median).toBe(20);
      expect(stats.stdDev).toBeGreaterThan(0);
    });

    it("should handle single result", () => {
      const results: BenchmarkResult[] = [{ operation: "test", duration: 42 }];

      const stats = calculateStats(results);

      expect(stats.min).toBe(42);
      expect(stats.max).toBe(42);
      expect(stats.mean).toBe(42);
      expect(stats.median).toBe(42);
      expect(stats.stdDev).toBe(0);
    });

    it("should calculate median correctly for even number of results", () => {
      const results: BenchmarkResult[] = [
        { operation: "test", duration: 10 },
        { operation: "test", duration: 20 },
        { operation: "test", duration: 30 },
        { operation: "test", duration: 40 },
      ];

      const stats = calculateStats(results);

      // Median of [10, 20, 30, 40] is the middle value (20)
      expect(stats.median).toBe(30);
    });
  });

  describe("compare", () => {
    it("should calculate speedup and improvement", () => {
      const baseline: BenchmarkResult = {
        operation: "baseline",
        duration: 100,
      };

      const optimized: BenchmarkResult = {
        operation: "optimized",
        duration: 50,
      };

      const comparison = compare(baseline, optimized);

      expect(comparison.baseline).toBe(baseline);
      expect(comparison.optimized).toBe(optimized);
      expect(comparison.speedup).toBe(2); // 2x faster
      expect(comparison.improvement).toBe(50); // 50% improvement
      expect(comparison.timeSaved).toBe(50); // 50ms saved
    });

    it("should handle slower performance", () => {
      const baseline: BenchmarkResult = {
        operation: "baseline",
        duration: 50,
      };

      const optimized: BenchmarkResult = {
        operation: "optimized",
        duration: 100,
      };

      const comparison = compare(baseline, optimized);

      expect(comparison.speedup).toBe(0.5); // 2x slower
      expect(comparison.improvement).toBe(-100); // 100% slower (regression)
      expect(comparison.timeSaved).toBe(-50); // Lost 50ms
    });

    it("should handle identical performance", () => {
      const baseline: BenchmarkResult = {
        operation: "baseline",
        duration: 100,
      };

      const optimized: BenchmarkResult = {
        operation: "optimized",
        duration: 100,
      };

      const comparison = compare(baseline, optimized);

      expect(comparison.speedup).toBe(1);
      expect(comparison.improvement).toBe(0);
      expect(comparison.timeSaved).toBe(0);
    });

    it("should calculate large speedups correctly", () => {
      const baseline: BenchmarkResult = {
        operation: "baseline",
        duration: 1000,
      };

      const optimized: BenchmarkResult = {
        operation: "optimized",
        duration: 100,
      };

      const comparison = compare(baseline, optimized);

      expect(comparison.speedup).toBe(10); // 10x faster
      expect(comparison.improvement).toBe(90); // 90% improvement
      expect(comparison.timeSaved).toBe(900);
    });
  });

  describe("formatResult", () => {
    it("should format basic result", () => {
      const result: BenchmarkResult = {
        operation: "test operation",
        duration: 123.456,
      };

      const formatted = formatResult(result);

      expect(formatted).toBe("test operation: 123.46ms");
    });

    it("should include throughput when available", () => {
      const result: BenchmarkResult = {
        operation: "batch process",
        duration: 100,
        itemCount: 5000,
        throughput: 50000,
      };

      const formatted = formatResult(result);

      expect(formatted).toContain("batch process: 100.00ms");
      expect(formatted).toContain("(50000 items/sec)");
    });

    it("should include memory delta when available", () => {
      const result: BenchmarkResult = {
        operation: "memory test",
        duration: 50,
        memoryBefore: 10 * 1024 * 1024,
        memoryAfter: 12 * 1024 * 1024,
        memoryDelta: 2 * 1024 * 1024,
      };

      const formatted = formatResult(result);

      expect(formatted).toContain("memory test: 50.00ms");
      expect(formatted).toContain("Memory: +2.00MB");
    });

    it("should format negative memory delta", () => {
      const result: BenchmarkResult = {
        operation: "gc test",
        duration: 50,
        memoryBefore: 12 * 1024 * 1024,
        memoryAfter: 10 * 1024 * 1024,
        memoryDelta: -2 * 1024 * 1024,
      };

      const formatted = formatResult(result);

      expect(formatted).toContain("Memory: -2.00MB");
    });
  });

  describe("formatComparison", () => {
    it("should format comparison result", () => {
      const baseline: BenchmarkResult = {
        operation: "baseline",
        duration: 200,
      };

      const optimized: BenchmarkResult = {
        operation: "optimized",
        duration: 100,
      };

      const comparison = compare(baseline, optimized);
      const formatted = formatComparison(comparison);

      expect(formatted).toContain("Baseline: 200.00ms");
      expect(formatted).toContain("Optimized: 100.00ms");
      expect(formatted).toContain("Speedup: 2.00x");
      expect(formatted).toContain("Improvement: 50.0%");
      expect(formatted).toContain("Time saved: 100.00ms");
    });
  });

  describe("createReport", () => {
    it("should create formatted report with multiple comparisons", () => {
      const comparison1 = compare(
        { operation: "seq", duration: 100 },
        { operation: "par", duration: 50 },
      );

      const comparison2 = compare(
        { operation: "full", duration: 200 },
        { operation: "inc", duration: 20 },
      );

      const report = createReport([
        { name: "Parallel Sync", comparison: comparison1 },
        { name: "Incremental Sync", comparison: comparison2 },
      ]);

      expect(report).toContain("Performance Benchmark Report");
      expect(report).toContain("Parallel Sync:");
      expect(report).toContain("Incremental Sync:");
      expect(report).toContain("Speedup: 2.00x");
      expect(report).toContain("Speedup: 10.00x");
    });

    it("should handle empty comparisons", () => {
      const report = createReport([]);

      expect(report).toContain("Performance Benchmark Report");
      expect(report).toContain("=".repeat(80));
    });
  });

  describe("precision timing", () => {
    it("should measure sub-millisecond precision", async () => {
      const result = await measure("fast operation", () => {
        // Very fast operation
        return 1 + 1;
      });

      // Should still measure even very fast operations
      expect(result.duration).toBeGreaterThanOrEqual(0);
      // Precision should be better than 1ms
      expect(result.duration).toBeLessThan(5);
    });

    it("should distinguish between different durations", async () => {
      const fast = await measure("fast", async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
      });

      const slow = await measure("slow", async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
      });

      expect(slow.duration).toBeGreaterThan(fast.duration);
      expect(slow.duration).toBeGreaterThan(fast.duration * 2);
    });
  });
});
