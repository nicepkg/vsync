# vibe-sync MVP Implementation Tasks

**Version**: 3.0.0
**Project**: vibe-sync - AI Coding Tool Config Synchronizer
**Timeline**: 11-18 days
**Last Updated**: 2026-01-24

---

## 📋 Task Overview

This document tracks all implementation tasks for vibe-sync MVP. Each phase must be completed sequentially. Mark completed tasks with `[x]`.

**Current Status**: 🟡 Not Started
**Next Phase**: Phase 1 - Foundation

---

## Phase 1: Foundation (1-2 days)

**Goal**: Set up project structure, core types, and configuration system

### 1.1 Project Initialization

⚠️ **IMPORTANT**: pnpm monorepo - `pnpm-workspace.yaml` at root, CLI code in `cli/`

- [ ] Initialize pnpm monorepo structure
  - [ ] Create `pnpm-workspace.yaml` at project root
  - [ ] Initialize `cli/package.json` with type: "module"
  - [ ] Configure `cli/tsconfig.json` (strict mode, ES2022, Node20)
  - [ ] Configure build scripts (tsup for bundling)
- [ ] Install core dependencies
  - [ ] `commander` - CLI framework
  - [ ] `inquirer` - Interactive prompts
  - [ ] `chalk` - Terminal colors
  - [ ] `ora` - Loading spinners
  - [ ] `jsonc-parser` - JSONC support
  - [ ] `gray-matter` - Frontmatter parsing
- [ ] Install dev dependencies
  - [ ] `vitest` - Testing framework
  - [ ] `@types/node` - Node types
  - [ ] `tsx` - TypeScript execution
  - [ ] `mock-fs` - File system mocking
- [ ] Set up directory structure
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

- [ ] Define `cli/src/types/config.ts`
  - [ ] `VibeConfig` interface (`.vibe-sync.json` structure)
  - [ ] `SyncMode` type (`"safe" | "prune"`)
  - [ ] `ToolName` type (`"claude-code" | "cursor" | "opencode"`)
  - [ ] `ConfigLevel` type (`"project" | "user"`)
- [ ] Define `cli/src/types/models.ts`
  - [ ] `Skill` interface (name, description, content, metadata, hash)
  - [ ] `MCPServer` interface (name, type, command, args, env, url, headers, auth, hash)
  - [ ] `MCPType` type (`"stdio" | "http" | "oauth"`)
- [ ] Define `cli/src/types/manifest.ts`
  - [ ] `Manifest` interface (version, last_sync, items)
  - [ ] `ManifestItem` interface (hash, last_synced, targets)
- [ ] Define `cli/src/types/plan.ts`
  - [ ] `SyncPlan` interface (tool, operations)
  - [ ] `Operation` types (create, update, delete, skip)
  - [ ] `DiffResult` interface

### 1.3 Configuration Management

- [ ] Implement `cli/src/core/config-manager.ts`
  - [ ] `loadConfig(level)` - Load `.vibe-sync.json`
  - [ ] `saveConfig(config, level)` - Save configuration
  - [ ] `validateConfig(config)` - Validate schema
  - [ ] `getConfigPath(level)` - Resolve config file path
- [ ] Implement `cli/src/core/manifest-manager.ts`
  - [ ] `loadManifest()` - Load manifest.json
  - [ ] `saveManifest(manifest)` - Save manifest
  - [ ] `updateManifest(plan, results)` - Update after sync
  - [ ] `getItemHash(name)` - Get item hash from manifest

### 1.4 Utility Functions

- [ ] Implement `cli/src/utils/hash.ts`
  - [ ] `hashContent(content)` - SHA256 hashing
  - [ ] `hashSkill(skill)` - Hash skill object
  - [ ] `hashMCPServer(server)` - Hash MCP server object
- [ ] Implement `cli/src/utils/atomic-write.ts`
  - [ ] `atomicWrite(path, content)` - Atomic file write with fsync
- [ ] Implement `cli/src/utils/env-vars.ts`
  - [ ] `preserveEnvVars(content)` - Preserve ${...} variables
  - [ ] `normalizeEnvVar(value, format)` - Convert env var formats

**Phase 1 Deliverables**:

- ✅ Working TypeScript project with build scripts
- ✅ All core types defined
- ✅ Configuration and manifest management working
- ✅ Utility functions tested

---

## Phase 2: Adapter Implementation (3-5 days)

**Goal**: Implement read/write adapters for Claude Code, Cursor, OpenCode

### 2.1 Adapter Interface

- [ ] Define `cli/src/adapters/base.ts`
  - [ ] `ToolAdapter` interface
  - [ ] `AdapterConfig` interface
  - [ ] `WriteResult` interface
  - [ ] `ValidationResult` interface

### 2.2 Claude Code Adapter (Source)

- [ ] Implement `cli/src/adapters/claude-code.ts`
  - [ ] `init(config)` - Initialize adapter
  - [ ] `readSkills()` - Read from `.claude/skills/`
    - [ ] Parse `SKILL.md` frontmatter + content
    - [ ] Include support files
    - [ ] Calculate hash for each skill
  - [ ] `readMCPServers()` - Read from `.mcp.json`
    - [ ] Parse JSON
    - [ ] Extract mcpServers object
    - [ ] Preserve `${env:VAR}` and `${VAR}` variables
    - [ ] Calculate hash for each server
  - [ ] `validate()` - Validate Claude Code configuration
- [ ] Write unit tests with mock-fs
  - [ ] Test skill reading with various frontmatter formats
  - [ ] Test MCP reading with env variables
  - [ ] Test error handling (missing files, invalid JSON)

### 2.3 Cursor Adapter (Target)

- [ ] Implement `cli/src/adapters/cursor.ts`
  - [ ] `init(config)` - Initialize adapter
  - [ ] `writeSkills(skills)` - Write to `.cursor/skills/`
    - [ ] Create skill directory structure
    - [ ] Write SKILL.md with frontmatter
    - [ ] Write support files
    - [ ] Use atomic writes
  - [ ] `writeMCPServers(servers)` - Write to `.cursor/mcp.json`
    - [ ] Generate mcpServers object
    - [ ] Handle stdio, HTTP, OAuth types
    - [ ] Preserve all Cursor variable formats (`${env:VAR}`, `${workspaceFolder}`, etc.)
    - [ ] Use atomic write
  - [ ] `deleteSkill(name)` - Remove skill directory
  - [ ] `deleteMCPServer(name)` - Remove from mcp.json
  - [ ] `validate()` - Validate Cursor configuration
- [ ] Write unit tests
  - [ ] Test skill writing
  - [ ] Test MCP writing with all transfer types
  - [ ] Test variable preservation
  - [ ] Test atomic write behavior

### 2.4 OpenCode Adapter (Target)

- [ ] Implement `cli/src/adapters/opencode.ts`
  - [ ] `init(config)` - Initialize adapter
  - [ ] `writeSkills(skills)` - Write to `.opencode/skills/`
    - [ ] Same structure as Cursor
  - [ ] `writeMCPServers(servers)` - Write to `opencode.jsonc`
    - [ ] Read existing config (preserve other fields)
    - [ ] Generate `mcp` object (not `mcpServers`!)
    - [ ] Add `type` field (`"stdio"` or `"remote"`)
    - [ ] Convert env vars: `${env:VAR}` → `${VAR}`
    - [ ] Preserve JSONC comments using `jsonc-parser`
    - [ ] Merge with existing config
    - [ ] Use atomic write
  - [ ] `deleteSkill(name)` - Remove skill directory
  - [ ] `deleteMCPServer(name)` - Remove from opencode.jsonc
  - [ ] `validate()` - Validate OpenCode configuration
- [ ] Write unit tests
  - [ ] Test JSONC comment preservation
  - [ ] Test `mcp` vs `mcpServers` field name
  - [ ] Test `type` field requirement
  - [ ] Test env var format conversion

### 2.5 Adapter Registry

- [ ] Implement `cli/src/adapters/registry.ts`
  - [ ] `getAdapter(toolName)` - Factory function
  - [ ] Register all adapters
  - [ ] Validate adapter availability

**Phase 2 Deliverables**:

- ✅ All adapters implemented and tested
- ✅ Skills read/write working
- ✅ MCP read/write working with env var preservation
- ✅ Unit tests passing (mock-fs)

---

## Phase 3: Diff & Plan System (2-3 days)

**Goal**: Implement difference calculation and sync plan generation

### 3.1 Hash Calculation

- [ ] Implement `cli/src/core/hasher.ts`
  - [ ] `calculateSkillHash(skill)` - Hash skill content + metadata
  - [ ] `calculateMCPHash(server)` - Hash MCP server config
  - [ ] Handle whitespace normalization
  - [ ] Handle JSON key ordering

### 3.2 Difference Calculator

- [ ] Implement `cli/src/core/diff.ts`
  - [ ] `calculateDiff(source, target, manifest, mode)` - Main diff function
    - [ ] Identify items to CREATE (in source, not in target)
    - [ ] Identify items to UPDATE (hash mismatch)
    - [ ] Identify items to DELETE (in target, not in source, prune mode only)
    - [ ] Identify items to SKIP (hash match)
  - [ ] `compareHashes(sourceHash, targetHash, manifestHash)` - Hash comparison logic
  - [ ] Handle missing manifest items
- [ ] Write unit tests
  - [ ] Test safe mode (no deletes)
  - [ ] Test prune mode (with deletes)
  - [ ] Test hash comparison edge cases

### 3.3 Plan Generator

- [ ] Implement `cli/src/core/planner.ts`
  - [ ] `generatePlan(source, targets, manifest, mode)` - Generate sync plan
  - [ ] `formatPlan(plan)` - Format plan for display
  - [ ] `validatePlan(plan)` - Validate plan safety
- [ ] Implement plan display
  - [ ] Color-coded operations (CREATE=green, UPDATE=yellow, DELETE=red, SKIP=gray)
  - [ ] Show hash changes for updates
  - [ ] Show diff preview for MCP servers
  - [ ] Summary statistics

### 3.4 Manifest Updates

- [ ] Implement manifest update logic in `cli/src/core/manifest-manager.ts`
  - [ ] `updateAfterCreate(item)` - Add new item to manifest
  - [ ] `updateAfterUpdate(item, newHash)` - Update hash
  - [ ] `updateAfterDelete(item, tool)` - Remove target entry
  - [ ] `pruneOrphanedItems()` - Clean up manifest

**Phase 3 Deliverables**:

- ✅ Diff calculation working correctly
- ✅ Plan generation with all operation types
- ✅ Manifest update logic tested
- ✅ Plan display formatting implemented

---

## Phase 4: CLI Commands (2-3 days)

**Goal**: Implement all CLI commands with interactive prompts

### 4.1 CLI Framework Setup

- [ ] Implement `cli/src/cli/index.ts`
  - [ ] Set up Commander.js
  - [ ] Register all commands
  - [ ] Global error handler
  - [ ] Version flag (`--version`)
  - [ ] Help text

### 4.2 `vibe-sync init` Command

- [ ] Implement `cli/src/cli/commands/init.ts`
  - [ ] Detect existing tools (check for `.claude/`, `.cursor/`, `.opencode/`)
  - [ ] Interactive prompts:
    - [ ] Multi-select: Which tools do you use?
    - [ ] Select: Which tool is the source?
    - [ ] Multi-select: What to sync? (Skills, MCP)
  - [ ] Generate `.vibe-sync.json`
  - [ ] Create `.vibe-sync-cache/` directory
  - [ ] Initialize empty manifest.json
  - [ ] Support `--user` flag for global config
- [ ] Add user-friendly output with chalk + ora

### 4.3 `vibe-sync sync` Command

- [ ] Implement `cli/src/cli/commands/sync.ts`
  - [ ] Read configuration
  - [ ] Load source tool adapter
  - [ ] Load target tool adapters
  - [ ] Read all configurations
  - [ ] Calculate differences
  - [ ] Generate sync plan
  - [ ] Display plan
  - [ ] Prompt for confirmation
  - [ ] Execute sync (loop through targets)
  - [ ] Update manifest
  - [ ] Display summary
  - [ ] Support `--dry-run` flag (skip execution)
  - [ ] Support `--prune` flag (enable deletes)
  - [ ] Support `--user` flag
- [ ] Add progress indicators with ora
- [ ] Add error recovery (rollback on failure)

### 4.4 `vibe-sync plan` Command

- [ ] Implement `cli/src/cli/commands/plan.ts`
  - [ ] Same as `sync --dry-run` but with detailed output
  - [ ] Show hash comparisons
  - [ ] Show file diffs for changes
  - [ ] No confirmation prompt

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

**Overall Progress**: 0/6 phases complete

| Phase   | Status         | Start Date | End Date | Notes        |
| ------- | -------------- | ---------- | -------- | ------------ |
| Phase 1 | 🔴 Not Started | -          | -        | Foundation   |
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
