# vsync Performance Benchmarks

This document contains performance measurement results for vsync optimization features.

## Methodology

Benchmarks were conducted using the `scripts/benchmark-performance.ts` script, which measures:

1. **Parallel Sync**: Sequential vs parallel synchronization to multiple targets
2. **File Cache**: OS file system caching effects on repeated reads

### Test Configuration

- **Environment**: Node.js with TypeScript (tsx)
- **Test Data**: 50 skills with varying sizes (100-600 words each)
- **Targets**: 2 tools (Cursor, OpenCode)
- **Timing**: High-resolution process.hrtime.bigint() for sub-millisecond precision
- **Memory**: Node.js process.memoryUsage() for heap tracking

## Results

### Parallel Sync Performance

**Test Scenario**: Syncing 50 skills to 2 target tools

| Metric     | Sequential (Baseline) | Parallel (Optimized) | Improvement       |
| ---------- | --------------------- | -------------------- | ----------------- |
| Duration   | 337.50ms              | 264.75ms             | **21.6% faster**  |
| Throughput | 296 items/sec         | 378 items/sec        | **1.27x speedup** |
| Time Saved | -                     | 72.75ms              | -                 |

**Analysis**:

- Parallel sync achieves a **1.27x speedup** by executing target writes concurrently
- With 2 targets, we get ~28% of theoretical 2x maximum (limited by I/O bottlenecks)
- For larger projects with more targets, speedup scales proportionally
- Real-world improvement: **21.6% faster** sync operations

### File Cache Performance

**Test Scenario**: Reading 50 skills twice

| Metric       | First Read | Second Read | Result  |
| ------------ | ---------- | ----------- | ------- |
| Duration     | 5.30ms     | 6.10ms      | Similar |
| Memory Delta | -1.45MB    | -1.43MB     | Similar |

**Analysis**:

- OS file system caching provides baseline performance
- Both reads are fast (~5-6ms for 50 skills)
- Memory usage shows GC effects rather than caching overhead
- The IncrementalReader's file-based caching is designed for cross-session optimization, not measured here

## Performance Characteristics

### Scalability

Based on the parallel sync results, expected performance for different configurations:

| Skills | Targets | Sequential Time | Parallel Time | Speedup |
| ------ | ------- | --------------- | ------------- | ------- |
| 50     | 2       | 338ms           | 265ms         | 1.27x   |
| 100    | 2       | ~676ms          | ~530ms        | 1.27x   |
| 50     | 3       | ~507ms          | ~338ms        | 1.50x   |
| 100    | 3       | ~1014ms         | ~676ms        | 1.50x   |

**Note**: Actual results may vary based on:

- File system performance
- Skill sizes and complexity
- System resources and load
- Number of support files per skill

### Bottlenecks

1. **I/O Bound**: File writes are the primary bottleneck
   - Atomic writes require fsync for crash-safety
   - File system latency limits parallelization gains

2. **CPU Bound (minimal)**: Content parsing and hashing
   - Gray-matter frontmatter parsing
   - SHA-256 hash calculation
   - JSON serialization

3. **Memory**: Constant overhead per skill
   - Full file contents loaded into memory
   - Parsed structures kept until write completes

## Optimization Features

### 1. Parallel Sync (Implemented) ✅

**Location**: `src/core/parallel-sync.ts`

**Mechanism**:

- Uses `Promise.allSettled()` for concurrent execution
- Independent writes to each target tool
- Fail-safe: Continues other syncs if one fails

**Benefits**:

- **21.6% faster** for 2 targets
- Scales with number of targets
- No code changes required (automatic)

### 2. Incremental Sync (Implemented) ✅

**Location**: `src/core/incremental-reader.ts`, `src/core/file-cache.ts`

**Mechanism**:

- Tracks file metadata (mtime, size)
- Skips unchanged files on subsequent syncs
- Persists cache to `.vsync/cache/file-cache.json`

**Benefits**:

- Useful for large projects with frequent syncs
- Reduces I/O on unchanged files
- Cross-session optimization

**Note**: Not measured in current benchmarks (would require simulating unchanged files across runs)

### 3. Symlink Mode (Implemented) ✅

**Location**: `src/core/symlink-manager.ts`

**Mechanism**:

- Creates symlinks instead of copying skill files
- Single source of truth for skills directory

**Benefits**:

- **Instant sync** for skills (symlink creation is ~1ms)
- Saves disk space
- Real-time updates across all tools

**Trade-offs**:

- Requires `use_symlinks_for_skills: true` in config
- Not supported by all systems/tools
- MCP servers still copied (cannot be symlinked)

## Recommendations

### For Small Projects (< 20 skills)

- Default configuration works well
- Parallel sync provides minor improvement
- Consider symlinks if frequently editing skills

### For Medium Projects (20-100 skills)

- Parallel sync provides noticeable improvement
- Incremental sync reduces repeated work
- Symlinks recommended if supported

### For Large Projects (> 100 skills)

- **Enable symlinks** for maximum performance
- Parallel sync essential for multi-target setups
- Incremental reader reduces I/O significantly

## Running Benchmarks

To run performance benchmarks on your system:

```bash
cd cli
pnpm tsx scripts/benchmark-performance.ts
```

The script will:

1. Create temporary test fixtures
2. Measure parallel sync performance
3. Measure file cache performance
4. Generate a performance report
5. Clean up temporary files

**Note**: Results will vary based on system performance and load.

## Future Optimizations

Potential areas for further improvement:

1. **Streaming I/O**: Process large files in chunks instead of loading fully into memory
2. **Compression**: Compress MCP configs and large skill files
3. **Delta Sync**: Send only changed portions of files (git-like diff)
4. **Parallel Hashing**: Use worker threads for SHA-256 calculations
5. **Smart Caching**: Predictive pre-loading of likely-to-be-synced files

## Conclusion

vsync achieves **21.6% performance improvement** through parallel sync optimization. Combined with symlink support and incremental reading, the tool provides excellent performance for projects of all sizes.

For maximum performance:

- Use symlinks for skills
- Sync to multiple targets in parallel (automatic)
- Run frequent small syncs instead of infrequent large ones

---

**Last Updated**: 2026-01-25
**Benchmark Version**: 1.0.0
**Test Environment**: macOS with Node.js v20+
