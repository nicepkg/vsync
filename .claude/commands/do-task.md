---
description: Execute tasks from TASKS.md following vsync specifications
argument-hint: [phase-task or "next"]
---

# Do Task - vsync

Execute development tasks from `TASKS.md` following vsync project specifications and TDD workflow.

## Current Context

- Current branch: !`git branch --show-current`
- Git status: !`git status --short | head -20`

## Phase Overview

!`grep -E "^## Phase [0-9]:|^\*\*Current Status\*\*:" TASKS.md | head -20`

## Instructions

### 1. Task Selection

If `$ARGUMENTS` is provided:

- If it's a phase-task reference (e.g., `Phase 1.1`, `Phase 2.3`), work on that specific task
- If it's `next`, pick the next uncompleted task `[ ]` in the current phase

If no argument, show current phase and ask which task to work on.

### 2. Before Starting - CRITICAL READS

**MUST READ in this order:**

| Document           | Purpose                       | Time   | Critical Sections                             |
| ------------------ | ----------------------------- | ------ | --------------------------------------------- |
| **TASKS.md**       | Current phase & task details  | 2 min  | Current phase section                         |
| **CLAUDE.md**      | AI-specific rules & workflows | 5 min  | Critical Rules, Config Formats, TDD           |
| **docs/prd.md**    | Detailed specifications       | 10 min | Section 2 (Config Formats), relevant sections |
| **docs/config.md** | Project configuration values  | 1 min  | All fields                                    |

### 3. Task Execution Workflow (TDD)

```
1. Read task from TASKS.md
2. Check phase dependencies (previous phases must be complete)
3. Read relevant documentation sections
4. **WRITE TESTS FIRST** (cli/test/[module].test.ts)
   - Use vitest + mock-fs
   - Cover all edge cases
5. Implement code (src/[module].ts)
   - Follow patterns in CLAUDE.md
   - Match config formats EXACTLY (see PRD Section 2)
6. Run tests: pnpm test
7. Verify: pnpm typecheck && pnpm lint
8. Mark task [x] in TASKS.md
9. Update phase status if phase complete
10. Commit with Angular convention
```

### 4. Critical Implementation Rules

**Config Format Precision** (see PRD Section 2.2):

```typescript
// ⚠️ CRITICAL: Each tool has DIFFERENT formats

// OpenCode
{
  "mcp": {                        // NOT "mcpServers"!
    "sqlite": {
      "type": "stdio",            // REQUIRED field
      "command": "npx",
      "env": { "DB": "${VAR}" }   // ${VAR} not ${env:VAR}
    }
  }
}

// Cursor
{
  "mcpServers": {
    "sqlite": {
      "command": "npx",           // No "type" field
      "env": { "DB": "${env:VAR}" } // ${env:VAR} format
    }
  }
}

// Claude Code
{
  "mcpServers": {
    "sqlite": {
      "command": "npx",
      "env": { "DB": "${env:VAR}" } // ${env:VAR} or ${VAR}
    }
  }
}
```

**Environment Variable Preservation**:

```typescript
// ❌ WRONG - Variables get expanded
const config = { env: { TOKEN: process.env.GITHUB_TOKEN } };

// ✅ CORRECT - Preserve variable syntax
const config = { env: { TOKEN: "${env:GITHUB_TOKEN}" } };
```

**Atomic Writes** (ALWAYS):

```typescript
// ❌ WRONG - Not crash-safe
await fs.writeFile(path, content);

// ✅ CORRECT - Use utility
import { atomicWrite } from "../utils/atomic-write";
await atomicWrite(path, content);
```

### 5. Phase-Specific Patterns

**Phase 1 (Foundation)**:

- Create TypeScript strict config
- Define all types in `cli/src/types/`
- Implement core utilities in `cli/src/utils/`
- No implementation without types first

**Phase 2 (Adapters)**:

```typescript
// Pattern for adapters
class ToolAdapter {
  // 1. Read methods (for source tool)
  async readSkills(): Promise<Skill[]>;
  async readMCPServers(): Promise<MCPServer[]>;

  // 2. Write methods (for target tools)
  async writeSkills(skills: Skill[]): Promise<WriteResult>;
  async writeMCPServers(servers: MCPServer[]): Promise<WriteResult>;

  // 3. Delete methods
  async deleteSkill(name: string): Promise<void>;
  async deleteMCPServer(name: string): Promise<void>;
}

// MUST preserve env vars and use atomic writes
```

**Phase 3 (Diff & Plan)**:

```typescript
// Hash-based difference detection
calculateDiff(source, target, manifest, mode) → DiffResult
// Compare: source hash vs target hash vs manifest hash
// Determine: CREATE, UPDATE, DELETE, SKIP
```

**Phase 4 (CLI)**:

```typescript
// Use Commander.js + Inquirer.js
import { Command } from "commander";
import inquirer from "inquirer";
import ora from "ora";
import chalk from "chalk";

// Show progress with ora
const spinner = ora("Reading configuration...").start();
// ... work
spinner.succeed("Done");
```

**Phase 5 (Security)**:

- MCP servers require user confirmation on first sync
- Show command, env vars, URL before approval
- Update whitelist in .vsync.json

**Phase 6 (Testing)**:

- Aim for >90% coverage
- Use mock-fs for file system tests
- Test all edge cases (missing files, invalid JSON, etc.)

### 6. File Structure Reference

```
src/
├── cli/              # CLI commands (Phase 4)
│   ├── commands/
│   │   ├── init.ts       # vsync init
│   │   ├── sync.ts       # vsync sync
│   │   ├── plan.ts       # vsync plan
│   │   ├── status.ts     # vsync status
│   │   ├── list.ts       # vsync list
│   │   └── clean.ts      # vsync clean
│   └── index.ts      # Commander setup
├── core/             # Core logic (Phase 1, 3, 5)
│   ├── config-manager.ts   # Load/save .vsync.json
│   ├── manifest-manager.ts # Manifest CRUD
│   ├── diff.ts             # Diff calculator
│   ├── planner.ts          # Plan generator
│   ├── security.ts         # MCP security
│   └── rollback.ts         # Error recovery
├── adapters/         # Tool adapters (Phase 2)
│   ├── base.ts           # ToolAdapter interface
│   ├── claude-code.ts    # Source adapter
│   ├── cursor.ts         # Target adapter
│   ├── opencode.ts       # Target adapter
│   └── registry.ts       # Adapter factory
├── types/            # TypeScript types (Phase 1)
│   ├── config.ts     # VSyncConfig, SyncMode, etc.
│   ├── models.ts     # Skill, MCPServer, etc.
│   ├── manifest.ts   # Manifest types
│   └── plan.ts       # SyncPlan, DiffResult, etc.
├── utils/            # Utilities (Phase 1)
│   ├── hash.ts           # SHA256 hashing
│   ├── atomic-write.ts   # Atomic file writes
│   └── env-preserv.ts    # Env var preservation
└── index.ts          # Entry point

cli/test/                 # Mirror src/ structure
```

### 7. Validation Checklist

Before marking task `[x]` complete:

- [ ] Tests written FIRST (TDD)
- [ ] Tests passing: `pnpm test`
- [ ] TypeScript compiles: `pnpm typecheck`
- [ ] Lint passes: `pnpm lint`
- [ ] Config formats match PRD Section 2 EXACTLY
- [ ] Environment variables NOT expanded
- [ ] Atomic writes used for all file operations
- [ ] Task marked `[x]` in TASKS.md
- [ ] Phase status updated if all tasks complete

### 8. Common Mistakes to Avoid

| Mistake                      | Correct                               |
| ---------------------------- | ------------------------------------- |
| ❌ OpenCode: `mcpServers`    | ✅ OpenCode: `mcp`                    |
| ❌ OpenCode: no `type` field | ✅ OpenCode: `type: "stdio"` required |
| ❌ OpenCode: `${env:VAR}`    | ✅ OpenCode: `${VAR}`                 |
| ❌ `fs.writeFile()`          | ✅ `atomicWrite()`                    |
| ❌ `process.env.VAR`         | ✅ `"${env:VAR}"` (string)            |
| ❌ Implement before tests    | ✅ Write tests first (TDD)            |
| ❌ Skip phase order          | ✅ Complete phases sequentially       |

### 9. When to Read PRD Sections

| PRD Section     | When to Read          | Contains                      |
| --------------- | --------------------- | ----------------------------- |
| **Section 1**   | Starting project      | Core positioning              |
| **Section 2**   | Implementing adapters | Config format mappings        |
| **Section 2.2** | Writing MCP adapters  | Detailed MCP formats per tool |
| **Section 3**   | Config management     | Level system (project/user)   |
| **Section 4**   | CLI commands          | Command specifications        |
| **Section 5**   | Security/sync         | MCP security, sync modes      |
| **Section 6**   | Adapter design        | Adapter architecture          |
| **Section 7**   | Diff/plan             | Diff & plan system            |
| **Section 8**   | Planning              | MVP scope                     |

### 10. Commit Format

After completing the task:

```bash
# Phase 1-3: Core features
feat(core): implement [task description]

# Phase 2: Adapters
feat(adapters): implement [adapter name] for [feature]

# Phase 4: CLI
feat(cli): add [command name] command

# Phase 5: Security
feat(security): implement MCP approval flow

# Phase 6: Testing
test: add [module] tests with >90% coverage

# Examples:
feat(adapters): implement Cursor MCP writer with env var preservation
feat(core): add hash-based diff calculator
test(adapters): add OpenCode adapter tests with JSONC support

# Always include:
- Bullet points of changes

Task: Phase X.Y

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
```

### 11. Testing with mock-fs

```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import mockFs from "mock-fs";
import { CursorAdapter } from "../../cli/src/adapters/cursor";

describe("CursorAdapter", () => {
  beforeEach(() => {
    mockFs({
      ".cursor": {},
    });
  });

  afterEach(() => {
    mockFs.restore();
  });

  it("should preserve env vars", async () => {
    // Test implementation
  });
});
```

## Execution Steps

1. **Parse arguments**: Determine which task to work on
2. **Read task details**: From TASKS.md
3. **Check dependencies**: Ensure previous phases/tasks complete
4. **Read documentation**: CLAUDE.md + relevant PRD sections
5. **Write tests**: In cli/test/ directory (TDD)
6. **Implement code**: In src/ directory
7. **Validate**: Run pnpm test && pnpm typecheck && pnpm lint
8. **Update TASKS.md**: Mark task [x], update phase status
9. **Commit changes**: Use Angular convention

## Quick Reference

**Commands**:

```bash
pnpm test              # Run tests
pnpm test:watch        # Watch mode
pnpm typecheck         # Type check
pnpm lint              # Lint code
pnpm build             # Build project
```

**Config Formats**: See PRD Section 2.2 or CLAUDE.md "Config Format Cheat Sheet"

**Core Rules**: See CLAUDE.md "Critical Rules" section

**Phase Status**: See TASKS.md progress table

---

**Let's build vsync with TDD and precision! 🚀**
