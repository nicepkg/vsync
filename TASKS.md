# vibe-sync MVP Implementation Tasks

**Version**: 3.0.0
**Project**: vibe-sync - AI Coding Tool Config Synchronizer
**Timeline**: 11-18 days
**Last Updated**: 2026-01-24

---

## 📋 Task Overview

This document tracks all implementation tasks for vibe-sync MVP. Each phase must be completed sequentially. Mark completed tasks with `[x]`.

**Current Status**: 🟡 Phase 4 In Progress (4.3 Complete)
**Next Phase**: Phase 4.4 - `vibe-sync plan` Command

---

## Phase 1: Foundation (1-2 days)

**Goal**: Set up project structure, core types, and configuration system

### 1.1 Project Initialization

⚠️ **IMPORTANT**: pnpm monorepo - `pnpm-workspace.yaml` at root, CLI code in `cli/`

- [x] Initialize pnpm monorepo structure
  - [x] Create `pnpm-workspace.yaml` at project root
  - [x] Initialize `cli/package.json` with type: "module"
  - [x] Configure `cli/tsconfig.json` (strict mode, ES2022, Node16)
  - [x] Configure build scripts (tsup for bundling)
- [x] Install core dependencies
  - [x] `commander` - CLI framework
  - [x] `inquirer` - Interactive prompts
  - [x] `chalk` - Terminal colors
  - [x] `ora` - Loading spinners
  - [x] `jsonc-parser` - JSONC support
  - [x] `gray-matter` - Frontmatter parsing
- [x] Install dev dependencies
  - [x] `vitest` - Testing framework
  - [x] `@types/node` - Node types
  - [x] `tsx` - TypeScript execution
  - [x] `mock-fs` - File system mocking
- [x] Set up directory structure
  ```
  vibe-sync/                # Project root
  ├── pnpm-workspace.yaml   # Workspace config (root level)
  └── cli/                  # CLI workspace
      ├── package.json
      ├── tsconfig.json
      ├── src/
      │   ├── cli/          # CLI commands
      │   ├── core/         # Core logic
      │   ├── adapters/     # Tool adapters
      │   ├── types/        # TypeScript types
      │   ├── utils/        # Utilities
      │   └── index.ts      # Entry point
      └── test/             # Tests (mirrors src/)
  ```

### 1.2 Core Type Definitions

- [x] Define `cli/src/types/config.ts`
  - [x] `VibeConfig` interface (`.vibe-sync.json` structure)
  - [x] `SyncMode` type (`"safe" | "prune"`)
  - [x] `ToolName` type (`"claude-code" | "cursor" | "opencode"`)
  - [x] `ConfigLevel` type (`"project" | "user"`)
- [x] Define `cli/src/types/models.ts`
  - [x] `Skill` interface (name, description, content, metadata, hash)
  - [x] `MCPServer` interface (name, type, command, args, env, url, headers, auth, hash)
  - [x] `MCPType` type (`"stdio" | "http" | "oauth"`)
- [x] Define `cli/src/types/manifest.ts`
  - [x] `Manifest` interface (version, last_sync, items)
  - [x] `ManifestItem` interface (hash, last_synced, targets)
- [x] Define `cli/src/types/plan.ts`
  - [x] `SyncPlan` interface (tool, operations)
  - [x] `Operation` types (create, update, delete, skip)
  - [x] `DiffResult` interface

### 1.3 Configuration Management

- [x] Implement `cli/src/core/config-manager.ts`
  - [x] `loadConfig(level)` - Load `.vibe-sync.json`
  - [x] `saveConfig(config, level)` - Save configuration
  - [x] `validateConfig(config)` - Validate schema
  - [x] `getConfigPath(level)` - Resolve config file path
- [x] Implement `cli/src/core/manifest-manager.ts`
  - [x] `loadManifest()` - Load manifest.json
  - [x] `saveManifest(manifest)` - Save manifest
  - [x] `getItemHash(name)` - Get item hash from manifest

### 1.4 Utility Functions

- [x] Implement `cli/src/utils/hash.ts`
  - [x] `hashContent(content)` - SHA256 hashing
  - [x] `hashSkill(skill)` - Hash skill object
  - [x] `hashMCPServer(server)` - Hash MCP server object
- [x] Implement `cli/src/utils/atomic-write.ts`
  - [x] `atomicWrite(path, content)` - Atomic file write with fsync
- [x] Implement `cli/src/utils/env-vars.ts`
  - [x] `preserveEnvVars(content)` - Preserve ${...} variables
  - [x] `normalizeEnvVar(value, format)` - Convert env var formats
  - [x] `extractEnvVars(text)` - Extract env var names

**Phase 1 Deliverables**:

- ✅ Working TypeScript project with build scripts
- ✅ All core types defined
- ✅ Configuration and manifest management working
- ✅ Utility functions tested

---

## Phase 2: Adapter Implementation (3-5 days)

**Goal**: Implement read/write adapters for Claude Code, Cursor, OpenCode

### 2.1 Adapter Interface

- [x] Define `cli/src/adapters/base.ts`
  - [x] `ToolAdapter` interface
  - [x] `AdapterConfig` interface
  - [x] `WriteResult` interface
  - [x] `ValidationResult` interface

### 2.2 Claude Code Adapter (Source)

- [x] Implement `cli/src/adapters/claude-code.ts`
  - [x] `init(config)` - Initialize adapter
  - [x] `readSkills()` - Read from `.claude/skills/`
    - [x] Parse `SKILL.md` frontmatter + content
    - [x] Include support files
    - [x] Calculate hash for each skill
  - [x] `readMCPServers()` - Read from `.mcp.json`
    - [x] Parse JSON
    - [x] Extract mcpServers object
    - [x] Preserve `${env:VAR}` and `${VAR}` variables
    - [x] Calculate hash for each server
  - [x] `validate()` - Validate Claude Code configuration
- [x] Write unit tests with mock-fs
  - [x] Test skill reading with various frontmatter formats
  - [x] Test MCP reading with env variables
  - [x] Test error handling (missing files, invalid JSON)

### 2.3 Cursor Adapter (Target)

- [x] Implement `cli/src/adapters/cursor.ts`
  - [x] `init(config)` - Initialize adapter
  - [x] `writeSkills(skills)` - Write to `.cursor/skills/`
    - [x] Create skill directory structure
    - [x] Write SKILL.md with frontmatter
    - [x] Write support files
    - [x] Use atomic writes
  - [x] `writeMCPServers(servers)` - Write to `.cursor/mcp.json`
    - [x] Generate mcpServers object
    - [x] Handle stdio, HTTP, OAuth types
    - [x] Preserve all Cursor variable formats (`${env:VAR}`, `${workspaceFolder}`, etc.)
    - [x] Use atomic write
  - [x] `deleteSkill(name)` - Remove skill directory
  - [x] `deleteMCPServer(name)` - Remove from mcp.json
  - [x] `validate()` - Validate Cursor configuration
- [x] Write unit tests
  - [x] Test skill writing
  - [x] Test MCP writing with all transfer types
  - [x] Test variable preservation
  - [x] Test atomic write behavior

### 2.4 OpenCode Adapter (Target)

- [x] Implement `cli/src/adapters/opencode.ts`
  - [x] `init(config)` - Initialize adapter
  - [x] `writeSkills(skills)` - Write to `.opencode/skills/`
    - [x] Same structure as Cursor
  - [x] `writeMCPServers(servers)` - Write to `opencode.jsonc`
    - [x] Read existing config (preserve other fields)
    - [x] Generate `mcp` object (not `mcpServers`!)
    - [x] Add `type` field (`"stdio"` or `"remote"`)
    - [x] Convert env vars: `${env:VAR}` → `${VAR}`
    - [x] Preserve JSONC comments using `jsonc-parser`
    - [x] Merge with existing config
    - [x] Use atomic write
  - [x] `deleteSkill(name)` - Remove skill directory
  - [x] `deleteMCPServer(name)` - Remove from opencode.jsonc
  - [x] `validate()` - Validate OpenCode configuration
- [x] Write unit tests
  - [x] Test JSONC comment preservation
  - [x] Test `mcp` vs `mcpServers` field name
  - [x] Test `type` field requirement
  - [x] Test env var format conversion

### 2.5 Adapter Registry

- [x] Implement `cli/src/adapters/registry.ts`
  - [x] `getAdapter(toolName)` - Factory function
  - [x] Register all adapters
  - [x] Validate adapter availability

**Phase 2 Deliverables**:

- ✅ All adapters implemented and tested
- ✅ Skills read/write working
- ✅ MCP read/write working with env var preservation
- ✅ Unit tests passing (mock-fs)

---

## Phase 3: Diff & Plan System (2-3 days)

**Goal**: Implement difference calculation and sync plan generation

### 3.1 Hash Calculation

- [x] Implement `cli/src/utils/hash.ts` (completed in Phase 1.4)
  - [x] `hashSkill(skill)` - Hash skill content + metadata
  - [x] `hashMCPServer(server)` - Hash MCP server config
  - [x] Handle whitespace normalization
  - [x] Handle JSON key ordering

### 3.2 Difference Calculator

- [x] Implement `cli/src/core/diff.ts`
  - [x] `calculateDiff(source, target, manifest, mode)` - Main diff function
    - [x] Identify items to CREATE (in source, not in target)
    - [x] Identify items to UPDATE (hash mismatch)
    - [x] Identify items to DELETE (in target, not in source, prune mode only)
    - [x] Identify items to SKIP (hash match)
  - [x] `compareHashes(sourceHash, targetHash, manifestHash)` - Hash comparison logic
  - [x] Handle missing manifest items
- [x] Write unit tests
  - [x] Test safe mode (no deletes)
  - [x] Test prune mode (with deletes)
  - [x] Test hash comparison edge cases

### 3.3 Plan Generator

- [x] Implement `cli/src/core/planner.ts`
  - [x] `generatePlan(source, targets, manifest, mode)` - Generate sync plan
  - [x] `formatPlan(plan)` - Format plan for display
  - [x] `validatePlan(plan)` - Validate plan safety
- [x] Implement plan display
  - [x] Color-coded operations (CREATE=green, UPDATE=yellow, DELETE=red, SKIP=gray)
  - [x] Show hash changes for updates
  - [x] Show diff preview for MCP servers
  - [x] Summary statistics

### 3.4 Manifest Updates

- [x] Implement manifest update logic in `cli/src/core/manifest-manager.ts`
  - [x] `updateAfterCreate(item)` - Add new item to manifest
  - [x] `updateAfterUpdate(item, newHash)` - Update hash
  - [x] `updateAfterDelete(item, tool)` - Remove target entry
  - [x] `pruneOrphanedItems()` - Clean up manifest

**Phase 3 Deliverables**:

- ✅ Diff calculation working correctly
- ✅ Plan generation with all operation types
- ✅ Manifest update logic tested
- ✅ Plan display formatting implemented

---

## Phase 4: CLI Commands (2-3 days)

**Goal**: Implement all CLI commands with interactive prompts

### 4.1 CLI Framework Setup

- [x] Implement `cli/src/cli/index.ts`
  - [x] Set up Commander.js
  - [x] Register all commands
  - [x] Global error handler
  - [x] Version flag (`--version`)
  - [x] Help text

### 4.2 `vibe-sync init` Command

- [x] Implement `cli/src/cli/commands/init.ts`
  - [x] Detect existing tools (check for `.claude/`, `.cursor/`, `.opencode/`)
  - [x] Interactive prompts:
    - [x] Multi-select: Which tools do you use?
    - [x] Select: Which tool is the source?
    - [x] Multi-select: What to sync? (Skills, MCP)
  - [x] Generate `.vibe-sync.json`
  - [x] Create `.vibe-sync-cache/` directory
  - [x] Initialize empty manifest.json
  - [x] Support `--user` flag for global config
- [x] Add user-friendly output with chalk + ora

### 4.3 `vibe-sync sync` Command

- [x] Implement `cli/src/cli/commands/sync.ts`
  - [x] Read configuration
  - [x] Load source tool adapter
  - [x] Load target tool adapters
  - [x] Read all configurations
  - [x] Calculate differences
  - [x] Generate sync plan
  - [x] Display plan
  - [x] Prompt for confirmation
  - [x] Execute sync (loop through targets)
  - [x] Update manifest
  - [x] Display summary
  - [x] Support `--dry-run` flag (skip execution)
  - [x] Support `--prune` flag (enable deletes)
  - [x] Support `--user` flag
- [x] Add progress indicators with ora
- [ ] Add error recovery (rollback on failure)

### 4.4 `vibe-sync plan` Command

- [x] Implement `cli/src/cli/commands/plan.ts`
  - [x] Same as `sync --dry-run` but with detailed output
  - [x] Show hash comparisons
  - [x] Show operation reasons
  - [x] No confirmation prompt

### 4.5 `vibe-sync status` Command

- [ ] Implement `cli/src/cli/commands/status.ts`
  - [ ] Read configuration
  - [ ] Read manifest
  - [ ] Display:
    - [ ] Source and target tools
    - [ ] Last sync time
    - [ ] Synced item counts
    - [ ] Tool health status
  - [ ] Check for pending changes
  - [ ] Support `--user` flag

### 4.6 `vibe-sync list` Command

- [ ] Implement `cli/src/cli/commands/list.ts`
  - [ ] `list skills` - Show all skills with hash, description, synced targets
  - [ ] `list mcp` - Show all MCP servers with type, command, synced targets
  - [ ] Table format output
  - [ ] Support `--user` flag

### 4.7 `vibe-sync clean` Command

- [ ] Implement `cli/src/cli/commands/clean.ts`
  - [ ] Interactive mode: multi-select items to remove
  - [ ] Single item mode: `clean skill/name`
  - [ ] Display removal plan
  - [ ] Confirm before deletion
  - [ ] Remove from targets only (not source)
  - [ ] Support `--from-source` flag (dangerous, requires double confirmation)
  - [ ] Update manifest
  - [ ] Support `--user` flag

**Phase 4 Deliverables**:

- ✅ All CLI commands working
- ✅ Interactive prompts user-friendly
- ✅ Error handling robust
- ✅ Help text clear

---

## Phase 5: Security & Safety (1-2 days)

**Goal**: Implement MCP security checks and atomic write guarantees

### 5.1 MCP Security System

- [ ] Implement `cli/src/core/security.ts`
  - [ ] `checkMCPServer(server, config)` - Security validation
    - [ ] Check if command in `allowed_commands`
    - [ ] Check if command in `denied_commands`
    - [ ] Check if URL in `allowed_domains`
  - [ ] `promptMCPApproval(server)` - Interactive approval prompt
  - [ ] `addToWhitelist(server, config)` - Update security config
- [ ] Add security checks to sync flow
  - [ ] Detect new MCP servers
  - [ ] Show server details (command, env, url)
  - [ ] Require user confirmation
  - [ ] Update `.vibe-sync.json` with approval

### 5.2 Atomic Write Verification

- [ ] Verify atomic write implementation
  - [ ] Test write → fsync → rename flow
  - [ ] Test cleanup on error
  - [ ] Test concurrent writes
  - [ ] Test crash recovery

### 5.3 Environment Variable Preservation

- [ ] Implement `src/utils/env-preserv.ts`
  - [ ] Test regex for `${env:VAR}` detection
  - [ ] Test preservation during JSON stringify
  - [ ] Test format conversion (Claude Code ↔ Cursor ↔ OpenCode)
- [ ] Add validation tests
  - [ ] Ensure variables not expanded
  - [ ] Ensure correct format per tool

### 5.4 Rollback Mechanism

- [ ] Implement `cli/src/core/rollback.ts`
  - [ ] Create backup before sync
  - [ ] Restore on error
  - [ ] Clean up backups on success

**Phase 5 Deliverables**:

- ✅ MCP security prompts working
- ✅ Atomic writes verified
- ✅ Environment variables preserved
- ✅ Rollback mechanism tested

---

## Phase 6: Testing & Polish (2-3 days)

**Goal**: Comprehensive testing, error handling, and UX improvements

### 6.1 Unit Tests

- [ ] Test coverage for all modules
  - [ ] Adapters: >90% coverage
  - [ ] Core logic: >95% coverage
  - [ ] Utils: 100% coverage
- [ ] Edge case testing
  - [ ] Empty configurations
  - [ ] Missing files
  - [ ] Invalid JSON/JSONC
  - [ ] Permission errors
  - [ ] Disk full scenarios

### 6.2 Integration Tests

- [ ] Test full sync flow
  - [ ] Claude Code → Cursor (skills + MCP)
  - [ ] Claude Code → OpenCode (skills + MCP)
  - [ ] Safe mode vs Prune mode
  - [ ] User level vs Project level
- [ ] Test error recovery
  - [ ] Partial write failure
  - [ ] Network interruption (for future HTTP MCP)
  - [ ] Corrupt manifest

### 6.3 E2E Tests

- [ ] Set up test fixtures
  - [ ] Sample Claude Code configuration
  - [ ] Sample skills with frontmatter
  - [ ] Sample MCP configurations
- [ ] Test complete workflows
  - [ ] `init` → `sync` → `status` → `list`
  - [ ] `sync` → modify source → `sync` again
  - [ ] `clean` → `sync`
- [ ] Test CLI output
  - [ ] Colors and formatting
  - [ ] Progress indicators
  - [ ] Error messages

### 6.4 Error Handling

- [ ] Improve error messages
  - [ ] Clear, actionable messages
  - [ ] Suggest fixes
  - [ ] Show file paths and line numbers
- [ ] Add debug mode
  - [ ] `--debug` flag for verbose logging
  - [ ] Stack traces on error

### 6.5 Documentation

- [ ] Write comprehensive README.md
  - [ ] Installation
  - [ ] Quick start
  - [ ] Commands reference
  - [ ] Configuration guide
  - [ ] Troubleshooting
- [ ] Write API documentation
  - [ ] Adapter interface
  - [ ] Configuration schema
  - [ ] Manifest format
- [ ] Add code comments
  - [ ] JSDoc for all public functions
  - [ ] Inline comments for complex logic

### 6.6 UX Polish

- [ ] Improve CLI output
  - [ ] Better table formatting
  - [ ] Clearer progress messages
  - [ ] Emoji indicators (optional, configurable)
- [ ] Add confirmation timeouts
  - [ ] Auto-cancel after 30s of inactivity
- [ ] Add `--yes` flag
  - [ ] Skip confirmations (for CI/CD)

**Phase 6 Deliverables**:

- ✅ >90% test coverage
- ✅ All integration tests passing
- ✅ E2E tests passing
- ✅ Documentation complete
- ✅ Error handling polished

---

## Post-MVP (v1.1) - Not in Current Scope

- [ ] User-level configuration support
- [ ] Agents synchronization
- [ ] Commands synchronization
- [ ] Codex adapter
- [ ] `import` command
- [ ] Performance optimization (parallel sync)
- [ ] Watch mode (`sync --watch`)
- [ ] GitHub Action integration
- [ ] VSCode extension

---

## Progress Tracking

**Overall Progress**: 1/6 phases complete

| Phase   | Status      | Start Date | End Date   | Notes      |
| ------- | ----------- | ---------- | ---------- | ---------- |
| Phase 1 | 🟢 Complete | 2026-01-24 | 2026-01-24 | Foundation |
| Phase 2 | 🔴 Not Started | -          | -        | Adapters     |
| Phase 3 | 🔴 Not Started | -          | -        | Diff & Plan  |
| Phase 4 | 🔴 Not Started | -          | -        | CLI Commands |
| Phase 5 | 🔴 Not Started | -          | -        | Security     |
| Phase 6 | 🔴 Not Started | -          | -        | Testing      |

**Legend**:

- 🔴 Not Started
- 🟡 In Progress
- 🟢 Complete
- 🔵 Blocked

---

## Notes

- **Working Directory**: `cli/` folder (pnpm monorepo workspace)
- **Package Manager**: Use `pnpm` (run from `cli/` directory)
- **Project Structure**: pnpm monorepo (CLI workspace in `cli/`)
- **Commit Convention**: Angular format (`feat`, `fix`, `docs`, etc.)
- **Testing Strategy**: Write tests BEFORE implementation (TDD)
- **Code Style**: Use Prettier + ESLint (will be configured in Phase 1)

---

**Last Updated**: 2026-01-24
**Next Action**: Start Phase 1 - Initialize TypeScript project
