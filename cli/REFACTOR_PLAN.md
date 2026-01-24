# Architecture Refactoring Plan

**Last Updated**: 2026-01-25

## Problem Statement

Adding a new adapter (e.g., OpenCode) currently requires modifying **20+ files**:

**Source Files (8)**:
- `cli/src/adapters/opencode.ts` (new file)
- `cli/src/adapters/registry.ts`
- `cli/src/commands/import.ts`
- `cli/src/commands/init.ts`
- `cli/src/commands/sync.ts`
- `cli/src/core/config-manager.ts`
- `cli/src/types/config.ts`
- `cli/src/utils/env-vars.ts`

**Test Files (13+)**:
- `cli/test/adapters/opencode.test.ts` (new file)
- `cli/test/adapters/registry.test.ts`
- `cli/test/commands/clean.test.ts`
- `cli/test/commands/import.test.ts`
- `cli/test/commands/init.test.ts`
- `cli/test/commands/list.test.ts`
- `cli/test/commands/plan.test.ts`
- `cli/test/commands/status.test.ts`
- `cli/test/core/config-manager.test.ts`
- `cli/test/core/manifest-manager.test.ts`
- `cli/test/core/planner.test.ts`
- `cli/test/core/rollback.test.ts`
- `cli/test/types/config.test.ts`
- `cli/test/types/manifest.test.ts`
- `cli/test/types/plan.test.ts`
- `cli/test/utils/env-vars.test.ts`

**This violates**:
- **DRY Principle**: Code duplication across tests and commands
- **Open/Closed Principle**: Modifying existing files instead of extending
- **High Cohesion**: Tool-specific logic scattered across multiple files
- **Low Coupling**: Commands hardcoded to specific tool names

**Goal**: Adding a new adapter should only require:
1. Create adapter file: `cli/src/adapters/<name>.ts`
2. Add to registry: 1 line in `cli/src/adapters/registry.ts`
3. Create adapter test: `cli/test/adapters/<name>.test.ts`

---

## Root Causes

### 1. Hardcoded Tool Names
Tool names are string literals scattered throughout the codebase instead of being auto-discovered from adapters.

**Examples**:
- `cli/src/types/config.ts`: `type ToolName = "claude-code" | "cursor" | ...`
- `cli/src/commands/*.ts`: Manual tool name validation
- `cli/src/utils/env-vars.ts`: Switch statements on tool names

### 2. Hardcoded Format Mappings
Config/env formats are hardcoded in utility functions instead of being adapter metadata.

**Example**: `cli/src/utils/env-vars.ts` has switch statements for each tool's env format.

### 3. Manual Adapter Instantiation
Commands manually create adapter instances instead of using a factory pattern.

**Example**: `cli/src/commands/sync.ts` has if/else chains to instantiate adapters.

### 4. Test Code Duplication
Every test file duplicates adapter setup logic instead of using shared utilities.

---

## Solution Architecture

### Phase 1: Adapter Self-Registration ✅ DONE

**Goal**: Adapters declare their own metadata for auto-discovery.

**Changes**

**Implementation**:

Added metadata fields to `ToolAdapter` interface:
```typescript
interface ToolAdapter {
  readonly toolName: string;
  readonly displayName: string;
  readonly configFormat: "json" | "jsonc" | "toml";
  readonly envVarFormat: "claude" | "opencode";
  readonly capabilities: {
    skills: boolean;
    mcp: boolean;
    agents: boolean;
    commands: boolean;
  };
  readonly isReadOnly: boolean;

  // ... existing methods
}
```

Created ADAPTERS array in `registry.ts`:
```typescript
import { ClaudeCodeAdapter } from "./claude-code.js";
import { CursorAdapter } from "./cursor.js";
import { OpenCodeAdapter } from "./opencode.js";
import { CodexAdapter } from "./codex.js";

export const ADAPTERS = [
  ClaudeCodeAdapter,
  CursorAdapter,
  OpenCodeAdapter,
  CodexAdapter,
] as const;
```

Each adapter declares metadata:
```typescript
export class OpenCodeAdapter implements ToolAdapter {
  readonly config: AdapterConfig;
  readonly toolName = "opencode";
  readonly displayName = "OpenCode";
  readonly configFormat = "jsonc" as const;
  readonly envVarFormat = "opencode" as const;
  readonly capabilities = {
    skills: true,
    mcp: true,
    agents: true,
    commands: true,
  } as const;
  readonly isReadOnly = false;

  // ... methods
}
```

**Status**: ✅ Completed
**Files Modified**:
- ✅ `cli/src/adapters/base.ts`
- ✅ `cli/src/adapters/claude-code.ts`
- ✅ `cli/src/adapters/cursor.ts`
- ✅ `cli/src/adapters/opencode.ts`
- ✅ `cli/src/adapters/codex.ts`
- ✅ `cli/src/adapters/registry.ts`

---

### Phase 2: Dynamic Type Generation

**Goal**: Auto-generate `ToolName` type from registry instead of hardcoding.

**Current Code** (`cli/src/types/config.ts`):
```typescript
// ❌ Hardcoded - must update when adding adapter
export type ToolName = "claude-code" | "cursor" | "opencode" | "codex";
```

**New Code**:
```typescript
// ✅ Auto-generated from registry
import { ADAPTERS } from "@src/adapters/registry.js";

// Infer ToolName from adapter instances
type AdapterInstance = InstanceType<(typeof ADAPTERS)[number]>;
export type ToolName = AdapterInstance["toolName"];

// Also auto-generate other types
export type ConfigFormat = AdapterInstance["configFormat"];
export type EnvVarFormat = AdapterInstance["envVarFormat"];
```

**Benefits**:
- Adding new adapter automatically updates `ToolName` type
- Cannot get out of sync - compiler enforces consistency
- Removes 1 file modification when adding adapter

**Status**: ❌ TODO
**Files to Modify**:
- `cli/src/types/config.ts`

**Tests**:
- ✅ Existing type tests should pass unchanged

---

### Phase 3: Registry Helper Functions

**Goal**: Provide utilities to query adapter metadata dynamically.

**Implementation** (`cli/src/adapters/registry.ts`):

```typescript
/**
 * Get all available tool names
 */
export function getAvailableTools(): ToolName[] {
  return ADAPTERS.map((AdapterClass) => {
    const instance = new AdapterClass({ baseDir: "" });
    return instance.toolName;
  });
}

/**
 * Create adapter instance (factory pattern)
 */
export function createAdapter(
  toolName: ToolName,
  config: AdapterConfig
): ToolAdapter {
  const AdapterClass = ADAPTERS.find((A) => {
    const instance = new A({ baseDir: "" });
    return instance.toolName === toolName;
  });

  if (!AdapterClass) {
    throw new Error(`Unknown tool: ${toolName}`);
  }

  return new AdapterClass(config);
}

/**
 * Get adapter metadata without instantiating with real config
 */
export function getAdapterMetadata(toolName: ToolName) {
  const AdapterClass = ADAPTERS.find((A) => {
    const instance = new A({ baseDir: "" });
    return instance.toolName === toolName;
  });

  if (!AdapterClass) {
    throw new Error(`Unknown tool: ${toolName}`);
  }

  const instance = new AdapterClass({ baseDir: "" });
  return {
    toolName: instance.toolName,
    displayName: instance.displayName,
    configFormat: instance.configFormat,
    envVarFormat: instance.envVarFormat,
    capabilities: instance.capabilities,
    isReadOnly: instance.isReadOnly,
  };
}

/**
 * Get config format for a tool
 */
export function getConfigFormat(toolName: ToolName): ConfigFormat {
  return getAdapterMetadata(toolName).configFormat;
}

/**
 * Get env var format for a tool
 */
export function getEnvVarFormat(toolName: ToolName): EnvVarFormat {
  return getAdapterMetadata(toolName).envVarFormat;
}

/**
 * Check if tool supports a capability
 */
export function supportsCapability(
  toolName: ToolName,
  capability: keyof ToolAdapter["capabilities"]
): boolean {
  return getAdapterMetadata(toolName).capabilities[capability];
}
```

**Benefits**:
- Centralized adapter queries
- Type-safe
- Easy to extend

**Status**: ❌ TODO
**Files to Modify**:
- `cli/src/adapters/registry.ts`

**Tests**:
- `cli/test/adapters/registry.test.ts`

---

### Phase 4: Refactor Utility Functions

**Goal**: Remove hardcoded tool names from `env-vars.ts`.

**Current Code** (`cli/src/utils/env-vars.ts`):
```typescript
// ❌ Hardcoded - must update when adding adapter with new format
export function normalizeEnvVar(
  value: string,
  format: "claude" | "opencode"
): string {
  if (format === "claude") {
    return value.replace(/\$\{([^:}]+)\}/g, "${env:$1}");
  } else if (format === "opencode") {
    return value.replace(/\$\{env:([^}]+)\}/g, "${$1}");
  }
  return value;
}
```

**New Code**:
```typescript
// ✅ Uses EnvVarFormat type from registry
import type { EnvVarFormat } from "@src/types/config.js";

export function normalizeEnvVar(value: string, format: EnvVarFormat): string {
  if (format === "claude") {
    // ${VAR} -> ${env:VAR}
    return value.replace(/\$\{([^:}]+)\}/g, "${env:$1}");
  } else if (format === "opencode") {
    // ${env:VAR} -> ${VAR}
    return value.replace(/\$\{env:([^}]+)\}/g, "${$1}");
  }
  return value;
}
```

**Benefits**:
- Type-safe (EnvVarFormat auto-updated from registry)
- No functional change

**Status**: ❌ TODO
**Files to Modify**:
- `cli/src/utils/env-vars.ts`

**Tests**:
- ✅ Existing tests should pass unchanged

---

### Phase 5: Refactor Commands (Factory Pattern)

**Goal**: Replace manual adapter instantiation with factory pattern.

**Current Code** (`cli/src/commands/import.ts`):
```typescript
// ❌ Manual instantiation - must update when adding adapter
import { ClaudeCodeAdapter } from "@src/adapters/claude-code.js";
import { CursorAdapter } from "@src/adapters/cursor.js";
import { OpenCodeAdapter } from "@src/adapters/opencode.js";

let sourceAdapter: ToolAdapter;
if (sourceTool === "claude-code") {
  sourceAdapter = new ClaudeCodeAdapter({ baseDir });
} else if (sourceTool === "cursor") {
  sourceAdapter = new CursorAdapter({ baseDir });
} else if (sourceTool === "opencode") {
  sourceAdapter = new OpenCodeAdapter({ baseDir });
} else {
  throw new Error(`Unknown tool: ${sourceTool}`);
}
```

**New Code**:
```typescript
// ✅ Factory pattern - automatically supports new adapters
import { createAdapter } from "@src/adapters/registry.js";

const sourceAdapter = createAdapter(sourceTool, { baseDir });
```

**Benefits**:
- Removes 4 files from modification list
- Commands automatically support new adapters
- Type-safe

**Status**: ❌ TODO
**Files to Modify**:
- `cli/src/commands/import.ts`
- `cli/src/commands/init.ts`
- `cli/src/commands/sync.ts`
- `cli/src/core/config-manager.ts`

**Tests**:
- ✅ Existing tests should pass unchanged

---

### Phase 6: Shared Test Utilities

**Goal**: Create reusable test helpers to eliminate code duplication.

**Create Helper Files**:

**File**: `cli/test/helpers/adapter-setup.ts`
```typescript
import { vol } from "memfs";
import { createAdapter } from "@src/adapters/registry.js";
import type { ToolName } from "@src/types/config.js";

/**
 * Setup mock file system for a tool
 */
export function setupMockFS(files: Record<string, string>) {
  vol.fromJSON(files);
}

/**
 * Create test adapter instance
 */
export function createTestAdapter(toolName: ToolName, baseDir = "/test") {
  return createAdapter(toolName, { baseDir });
}

/**
 * Get skills directory path for a tool
 */
export function getSkillsDir(toolName: ToolName, baseDir = "/test"): string {
  const dirs = {
    "claude-code": `${baseDir}/.claude/skills`,
    "cursor": `${baseDir}/.cursor/skills`,
    "opencode": `${baseDir}/.opencode/skills`,
    "codex": `${baseDir}/.codex/skills`,
  };
  return dirs[toolName];
}

/**
 * Create mock skill files for a tool
 */
export function mockSkillFiles(
  toolName: ToolName,
  skillName: string,
  content: string,
  baseDir = "/test"
) {
  const skillsPath = getSkillsDir(toolName, baseDir);
  return {
    [`${skillsPath}/${skillName}/SKILL.md`]: content,
  };
}
```

**File**: `cli/test/helpers/mock-data.ts`
```typescript
import type { Skill, MCPServer, Agent, Command } from "@src/types/models.js";

export function createMockSkill(overrides?: Partial<Skill>): Skill {
  return {
    name: "test-skill",
    content: "Test skill content",
    hash: "abc123",
    ...overrides,
  };
}

export function createMockMCPServer(overrides?: Partial<MCPServer>): MCPServer {
  return {
    name: "test-server",
    type: "stdio",
    command: "node",
    args: ["server.js"],
    hash: "def456",
    ...overrides,
  };
}

export function createMockAgent(overrides?: Partial<Agent>): Agent {
  return {
    name: "test-agent",
    content: "Test agent content",
    hash: "ghi789",
    ...overrides,
  };
}

export function createMockCommand(overrides?: Partial<Command>): Command {
  return {
    name: "test-command",
    content: "Test command content",
    hash: "jkl012",
    ...overrides,
  };
}
```

**Benefits**:
- Reusable across all test files
- Consistent test setup
- Reduces code duplication

**Status**: ❌ TODO
**Files to Create**:
- `cli/test/helpers/adapter-setup.ts`
- `cli/test/helpers/mock-data.ts`

---

### Phase 7: Refactor Tests (Parameterized)

**Goal**: Convert tests to use shared utilities and parameterization.

**Pattern**:

**Before** (`cli/test/commands/import.test.ts`):
```typescript
// ❌ Duplicated adapter setup
describe("import command", () => {
  it("should import from claude-code", () => {
    vol.fromJSON({ "/.claude/skills/test/SKILL.md": "content" });
    const adapter = new ClaudeCodeAdapter({ baseDir: "/" });
    // ...
  });

  it("should import from cursor", () => {
    vol.fromJSON({ "/.cursor/skills/test/SKILL.md": "content" });
    const adapter = new CursorAdapter({ baseDir: "/" });
    // ...
  });
  // Repeat for every adapter...
});
```

**After**:
```typescript
// ✅ Parameterized with shared helpers
import { getAvailableTools } from "@src/adapters/registry.js";
import { createTestAdapter, mockSkillFiles, setupMockFS } from "@test/helpers/adapter-setup.js";

describe("import command", () => {
  const tools = getAvailableTools();

  describe.each(tools)("importing from %s", (toolName) => {
    beforeEach(() => {
      const files = mockSkillFiles(toolName, "test-skill", "# Test");
      setupMockFS(files);
    });

    it("should import skills", async () => {
      const adapter = createTestAdapter(toolName);
      const skills = await adapter.readSkills();
      expect(skills).toHaveLength(1);
      expect(skills[0].name).toBe("test-skill");
    });
  });
});
```

**Benefits**:
- Adding new adapter automatically adds test coverage
- No code duplication
- Consistent test patterns
- Tests parameterized over all adapters

**Status**: ❌ TODO
**Files to Refactor**:
- `cli/test/commands/*.test.ts`
- `cli/test/core/*.test.ts`
- `cli/test/adapters/registry.test.ts`

---

### Phase 8: Migrate to fs-extra

**Goal**: Replace Node.js `fs` module with `fs-extra` for better DX.

**Current Code**:
```typescript
// ❌ Manual directory creation
import { mkdir, writeFile } from "node:fs/promises";

await mkdir(dir, { recursive: true });
await writeFile(path, content);
```

**New Code**:
```typescript
// ✅ Automatic directory creation
import { outputFile } from "fs-extra";

await outputFile(path, content); // Creates dirs automatically
```

**Benefits**:
- Simpler API
- Automatic directory creation
- Better error messages
- JSON file helpers

**Status**: ❌ TODO
**Files to Modify**:
- `cli/src/adapters/*.ts`
- `cli/src/utils/*.ts`

**Dependencies**:
```bash
pnpm add fs-extra
pnpm add -D @types/fs-extra
```

---

## Implementation Workflow

### Step 1: Complete Phase 1 ✅ DONE
- ✅ Add metadata fields to all adapters
- ✅ Create ADAPTERS array in registry

### Step 2: Verify Current Tests ✅ DONE
- ✅ Run `cd cli && pnpm test`
- ✅ Fix any failing tests
- ✅ Ensure all existing tests pass before proceeding

### Step 3: Implement Phases 2-5 ✅ DONE

**Completed**:
1. ✅ **Phase 2**: Dynamic types - ToolName, ConfigFormat, EnvVarFormat auto-inferred from ADAPTERS
2. ✅ **Phase 3**: Registry helpers - getAvailableTools(), createAdapter(), getAdapterMetadata(), etc.
3. ✅ **Phase 4**: Refactor env-vars - Use EnvVarFormat type instead of hardcoded tool names
4. ✅ **Phase 5**: Factory pattern - Commands already using getAdapter() factory

**Results**:
- ✅ All 366 tests passing
- ✅ Typecheck passing
- ✅ Lint passing (6 warnings only)

### Step 4: Implement Phases 6-8 ⏳ CURRENT

**Remaining**:
1. **Phase 6**: Create test utilities (additive)
2. **Phase 7**: Refactor tests (use utilities)
3. **Phase 8**: Migrate to fs-extra (optional optimization)

**After Each Phase**:
- ✅ Run `pnpm test`
- ✅ Run `pnpm typecheck`
- ✅ Run `pnpm lint`
- ✅ Commit changes (Angular convention)

---

## Success Criteria

### Adding a New Adapter (e.g., "windsurf")

**Before Refactoring** (20+ files):
1. Create `cli/src/adapters/windsurf.ts`
2. Update `cli/src/adapters/registry.ts`
3. Update `cli/src/types/config.ts` - add to ToolName
4. Update `cli/src/utils/env-vars.ts` - add format
5. Update `cli/src/commands/import.ts` - add instantiation
6. Update `cli/src/commands/init.ts` - add instantiation
7. Update `cli/src/commands/sync.ts` - add instantiation
8. Update `cli/src/core/config-manager.ts`
9. Update 13+ test files
10. Create `cli/test/adapters/windsurf.test.ts`

**After Refactoring** (3 files):
1. Create `cli/src/adapters/windsurf.ts` with metadata
2. Add to ADAPTERS array in `cli/src/adapters/registry.ts` (1 line)
3. Create `cli/test/adapters/windsurf.test.ts`

**Result**: 20+ files → 3 files ✅

---

## Impact Summary

### Files No Longer Need Modification

After refactoring, adding a new adapter will NOT require modifying:
- ❌ `cli/src/types/config.ts` (auto-generated)
- ❌ `cli/src/utils/env-vars.ts` (uses EnvVarFormat type)
- ❌ `cli/src/commands/*.ts` (uses factory)
- ❌ `cli/src/core/config-manager.ts` (uses factory)
- ❌ 13+ test files (parameterized)

**Files That Still Need Modification**:
- ✅ `cli/src/adapters/<name>.ts` (new adapter file)
- ✅ `cli/src/adapters/registry.ts` (add to ADAPTERS array - 1 line)
- ✅ `cli/test/adapters/<name>.test.ts` (new test file)

---

## Estimated Effort

| Phase | Complexity | Time | Risk | Priority |
|-------|-----------|------|------|----------|
| Phase 1 | Low | ✅ DONE | Low | P0 |
| Phase 2 | Low | 30 min | Low | P0 |
| Phase 3 | Low | 1 hour | Low | P0 |
| Phase 4 | Low | 30 min | Low | P1 |
| Phase 5 | Medium | 2 hours | Medium | P0 |
| Phase 6 | Medium | 1.5 hours | Low | P1 |
| Phase 7 | High | 3 hours | Medium | P1 |
| Phase 8 | Medium | 1.5 hours | Low | P2 |
| **Total** | - | **~10 hours** | - | - |

**ROI**: Positive after adding 2nd new adapter (saves ~2 hours per adapter)

---

## Next Steps

1. ✅ Complete Phase 1 - DONE
2. ✅ Run existing tests - DONE
3. ✅ Fix any failing tests - DONE
4. ✅ Complete Phases 2-5 - DONE
5. ⏳ Continue with Phases 6-8 (optional)

---

**Last Updated**: 2026-01-25 (Phases 1-5 completed)
