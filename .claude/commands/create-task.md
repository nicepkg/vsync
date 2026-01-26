---
description: Create new task for feature or bugfix
argument-hint: "[feature|bugfix|refactor] description"
---

# Create Task - vsync

Create a new task in `TASKS.md` for a feature, bugfix, or refactoring work.

## Current Context

- Current branch: !`git branch --show-current`
- Git status: !`git status --short | head -20`

## Current Task Status

!`tail -30 TASKS.md | grep -E "^##|^\*\*|^-"`

## Instructions

### 1. Task Type Detection

Parse `$ARGUMENTS` to determine task type:

- **feature**: New functionality (e.g., "Add Codex adapter", "Support user-level config")
- **bugfix**: Fix existing issue (e.g., "Fix env var expansion in OpenCode adapter")
- **refactor**: Code improvement (e.g., "Extract common adapter logic")

### 2. Before Creating Task - CRITICAL READS

**Read these to understand context:**

| Document           | Purpose              | What to Check                     |
| ------------------ | -------------------- | --------------------------------- |
| **docs/prd.md**    | Specification        | Is this in MVP scope? (Section 8) |
| **CLAUDE.md**      | Implementation rules | Does it conflict with core rules? |
| **TASKS.md**       | Existing tasks       | Is there already a task for this? |
| **docs/config.md** | Project config       | Does it affect config values?     |

### 3. Scope Validation

**MVP Scope (INCLUDED)**:

- ✅ Skills sync (Claude Code → Cursor, OpenCode)
- ✅ MCP sync (Claude Code → Cursor, OpenCode)
- ✅ Safe mode / Prune mode
- ✅ Project-level config
- ✅ CLI commands (init, sync, plan, status, list, clean)
- ✅ MCP security
- ✅ Atomic writes
- ✅ Env var preservation

**v1.1 Scope (EXCLUDED from MVP)**:

- ❌ Agents sync
- ❌ Commands sync
- ❌ Codex adapter
- ❌ User-level config
- ❌ `import` command
- ❌ Watch mode

**If task is v1.1 scope**: Ask user if they want to update PRD first or defer to v1.1.

### 4. Impact Analysis

Analyze which modules this task will affect:

**Adapters** (`cli/src/adapters/`):

- New adapter: Create new file + register in registry
- Adapter modification: Update existing adapter + tests
- Affects: PRD Section 2 (config formats)

**Core Logic** (`cli/src/core/`):

- Config management: Update config-manager.ts
- Diff/Plan: Update diff.ts or planner.ts
- Security: Update security.ts
- Affects: PRD Section 5, 6, 7

**CLI** (`cli/src/cli/`):

- New command: Create in cli/commands/
- Command modification: Update existing command
- Affects: PRD Section 4

**Types** (`cli/src/types/`):

- New data model: Add to types/
- Type modification: Update existing types
- Affects: PRD Section 6

**Utils** (`cli/src/utils/`):

- New utility: Create new file
- Utility modification: Update existing
- Usually supporting code

### 5. Files to Modify

Based on task type, identify files to change:

**For New Adapter** (e.g., Codex):

```
Files to create:
- cli/src/adapters/codex.ts
- cli/test/adapters/codex.test.ts

Files to modify:
- cli/src/adapters/registry.ts (register adapter)
- cli/src/types/config.ts (add "codex" to ToolName)
- docs/prd.md (update Section 2 if format different)
- CLAUDE.md (add Codex examples if needed)

Files to read:
- docs/prd.md Section 2 (config formats)
- cli/src/adapters/cursor.ts (reference implementation)
- cli/src/adapters/base.ts (interface definition)
```

**For Config Format Bugfix** (e.g., OpenCode env vars):

```
Files to modify:
- cli/src/adapters/opencode.ts (fix env var format)
- cli/test/adapters/opencode.test.ts (add test case)

Files to read:
- docs/prd.md Section 2.2 (OpenCode format spec)
- cli/src/utils/env-preserv.ts (env var utilities)
- CLAUDE.md (env var preservation rules)
```

**For New CLI Command**:

```
Files to create:
- cli/src/cli/commands/[command-name].ts
- cli/test/cli/[command-name].test.ts

Files to modify:
- cli/src/cli/index.ts (register command)
- docs/prd.md Section 4 (document command)

Files to read:
- docs/prd.md Section 4 (CLI command patterns)
- cli/src/cli/commands/sync.ts (reference implementation)
```

**For Security Enhancement**:

```
Files to modify:
- cli/src/core/security.ts
- cli/test/core/security.test.ts

Files to read:
- docs/prd.md Section 5.2 (MCP security)
- CLAUDE.md (security rules)
```

### 6. Task Creation Template

Add to `TASKS.md` under appropriate section or create new section:

```markdown
## [Feature/Bugfix/Refactor]: [Title]

**Type**: [feature|bugfix|refactor]
**Priority**: [high|medium|low]
**Affects**: [adapters|core|cli|types|utils]
**Estimated Time**: [X hours/days]

### Description

[Detailed description of what needs to be done]

### Motivation

[Why this is needed - user pain point, bug impact, or improvement benefit]

### Acceptance Criteria

- [ ] [Specific, testable criterion 1]
- [ ] [Specific, testable criterion 2]
- [ ] [Specific, testable criterion 3]

### Implementation Plan

#### Files to Create

- [ ] `path/to/new/file.ts` - [Purpose]
- [ ] `path/to/test.test.ts` - [Test coverage]

#### Files to Modify

- [ ] `path/to/existing.ts` - [Change description]
- [ ] `docs/prd.md` - [Update section X]

#### Files to Read (Before Starting)

- [ ] `docs/prd.md` Section X - [Why read this]
- [ ] `src/example.ts` - [Reference implementation]
- [ ] `CLAUDE.md` - [Relevant rules]

### Testing Strategy

- [ ] Unit tests: [What to test]
- [ ] Integration tests: [What to test]
- [ ] Edge cases: [What to cover]
- [ ] Target coverage: >90%

### Related Issues/Tasks

- Depends on: [Task IDs if any]
- Blocks: [Task IDs if any]
- Related to: [Issue numbers or PRs]

### Notes

[Any additional context, constraints, or considerations]

---

**Created**: [Date]
**Status**: [ ] Not Started
```

### 7. Examples

**Example 1: New Feature - Codex Adapter**

```markdown
## Feature: Add Codex Adapter Support

**Type**: feature
**Priority**: medium
**Affects**: adapters, types
**Estimated Time**: 2-3 days

### Description

Implement Codex adapter to support syncing configurations to Codex tool.
This is a v1.1 feature (not in MVP scope).

### Motivation

Users who use Codex want to sync their Claude Code configs to Codex.

### Acceptance Criteria

- [ ] Can read Codex config from `~/.codex/config.toml`
- [ ] Can write skills to `~/.codex/skills/`
- [ ] Can write MCP servers to `~/.codex/config.json`
- [ ] Handles Codex's lack of env var interpolation
- [ ] Tests pass with >90% coverage

### Implementation Plan

#### Files to Create

- [ ] `cli/src/adapters/codex.ts` - Codex adapter implementation
- [ ] `cli/test/adapters/codex.test.ts` - Adapter tests

#### Files to Modify

- [ ] `cli/src/adapters/registry.ts` - Register Codex adapter
- [ ] `cli/src/types/config.ts` - Add "codex" to ToolName type
- [ ] `docs/prd.md` - Update Section 2 with Codex format
- [ ] `CLAUDE.md` - Add Codex examples

#### Files to Read (Before Starting)

- [ ] `docs/prd.md` Section 2 - Config format specs
- [ ] `cli/src/adapters/cursor.ts` - Reference implementation
- [ ] `cli/src/adapters/base.ts` - Interface definition
- [ ] `CLAUDE.md` - Adapter implementation rules

### Testing Strategy

- [ ] Unit tests: Read/write skills and MCP configs
- [ ] Unit tests: Verify NO env var interpolation (Codex limitation)
- [ ] Integration tests: Full sync flow with Codex
- [ ] Edge cases: Missing config, invalid JSON, permission errors
- [ ] Target coverage: >90%

### Related Issues/Tasks

- Depends on: Phase 2 completion
- Related to: v1.1 roadmap

### Notes

- Codex does NOT support env var interpolation (see PRD Section 2)
- Config file is `~/.codex/config.toml` (user level only)
- MCP field name is `mcp_Servers`

---

**Created**: 2026-01-24
**Status**: [ ] Not Started
```

**Example 2: Bugfix - OpenCode Env Var Format**

```markdown
## Bugfix: OpenCode Env Vars Not Converting Correctly

**Type**: bugfix
**Priority**: high
**Affects**: adapters
**Estimated Time**: 2-3 hours

### Description

OpenCode adapter is writing `${env:VAR}` instead of `${VAR}`, causing
env vars to not expand in OpenCode.

### Motivation

Users report MCP servers not working in OpenCode because env var format
is wrong. PRD Section 2.2 clearly states OpenCode uses `${VAR}` format.

### Acceptance Criteria

- [ ] OpenCode adapter converts `${env:VAR}` to `${VAR}` when writing
- [ ] Existing tests updated to verify format conversion
- [ ] New test added for env var format edge cases
- [ ] Manual verification with OpenCode

### Implementation Plan

#### Files to Modify

- [ ] `cli/src/adapters/opencode.ts` - Fix env var conversion
- [ ] `cli/test/adapters/opencode.test.ts` - Add test case
- [ ] `cli/src/utils/env-preserv.ts` - Update conversion function if needed

#### Files to Read (Before Starting)

- [ ] `docs/prd.md` Section 2.2 - OpenCode format spec
- [ ] `CLAUDE.md` - Env var preservation rules
- [ ] `cli/src/adapters/opencode.ts` - Current implementation

### Testing Strategy

- [ ] Test: `${env:VAR}` → `${VAR}` conversion
- [ ] Test: `${env:VAR}` with multiple vars
- [ ] Test: Already correct `${VAR}` format (no double conversion)
- [ ] Test: Mixed formats in same config

### Related Issues/Tasks

- Reported by: [User/Issue #]
- Affects: Phase 2.4 (OpenCode Adapter)

### Notes

- This is a critical bug - breaks OpenCode MCP functionality
- Easy fix but need thorough testing

---

**Created**: 2026-01-24
**Status**: [ ] Not Started
```

**Example 3: Refactor - Extract Common Adapter Logic**

```markdown
## Refactor: Extract Common Adapter Logic to Base Class

**Type**: refactor
**Priority**: low
**Affects**: adapters
**Estimated Time**: 1-2 days

### Description

Extract common logic (atomic write, hash calculation, directory creation)
from individual adapters into a base class to reduce duplication.

### Motivation

All adapters have duplicate code for:

- Atomic file writes
- Hash calculation
- Directory creation
- Error handling

Refactoring will make code DRY and easier to maintain.

### Acceptance Criteria

- [ ] AbstractToolAdapter base class created with common methods
- [ ] All adapters extend AbstractToolAdapter
- [ ] No functionality changes (behavior identical)
- [ ] All tests still pass
- [ ] Code coverage maintained or improved

### Implementation Plan

#### Files to Create

- [ ] `cli/src/adapters/abstract-adapter.ts` - Base class

#### Files to Modify

- [ ] `cli/src/adapters/claude-code.ts` - Extend base class
- [ ] `cli/src/adapters/cursor.ts` - Extend base class
- [ ] `cli/src/adapters/opencode.ts` - Extend base class
- [ ] `cli/src/adapters/base.ts` - Update interface if needed

#### Files to Read (Before Starting)

- [ ] All adapter files - Identify common patterns
- [ ] `CLAUDE.md` - Adapter architecture section

### Testing Strategy

- [ ] All existing adapter tests must pass unchanged
- [ ] No new tests needed (behavior unchanged)
- [ ] Verify coverage not decreased

### Related Issues/Tasks

- Should be done after: Phase 2 completion
- Nice to have, not blocking

### Notes

- This is a code quality improvement
- No user-facing changes
- Good candidate for after MVP

---

**Created**: 2026-01-24
**Status**: [ ] Not Started
```

### 8. Validation Checklist

Before adding task to TASKS.md:

- [ ] Task type identified (feature/bugfix/refactor)
- [ ] Scope validated (MVP or v1.1)
- [ ] Impact analysis complete (which modules affected)
- [ ] Files to create/modify/read listed
- [ ] Acceptance criteria specific and testable
- [ ] Testing strategy defined
- [ ] Dependencies identified
- [ ] Estimated time provided

### 9. After Creating Task

1. Add task to appropriate section in `TASKS.md`
2. Update task count in relevant phase
3. Update progress table if needed
4. Commit the task addition:

```bash
git add TASKS.md
git commit -m "docs(tasks): add task for [description]

- [Brief description of task]
- Priority: [high/medium/low]
- Affects: [modules]
"
```

## Execution Steps

1. **Parse arguments**: Understand what user wants to add
2. **Read documentation**: PRD (scope check), CLAUDE.md (rules), TASKS.md (existing tasks)
3. **Validate scope**: Is this MVP or v1.1?
4. **Analyze impact**: Which modules affected?
5. **Identify files**: What needs to be created/modified/read?
6. **Create task**: Use template above
7. **Add to TASKS.md**: In appropriate section
8. **Commit**: Document the new task

## When to Update PRD

If task requires changes to:

- Config formats (PRD Section 2)
- CLI commands (PRD Section 4)
- Security rules (PRD Section 5)
- Architecture (PRD Section 6)
- MVP scope (PRD Section 8)

Then update PRD FIRST before adding task to TASKS.md.

---

**Let's capture all work in TASKS.md for proper tracking! 📝**
