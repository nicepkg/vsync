/**
 * Integration tests for full sync flow
 * Tests complete synchronization workflows from source to target tools
 */

import fs from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { syncCommand } from "@src/commands/sync.js";
import { saveConfig } from "@src/core/config-manager.js";
import type { VibeConfig } from "@src/types/config.js";

describe("Full Sync Flow Integration", () => {
  let testDir: string;
  let claudeDir: string;
  let cursorDir: string;
  let opencodeDir: string;
  let cacheDir: string;
  let originalCwd: string;

  beforeEach(async () => {
    // Save original CWD
    originalCwd = process.cwd();

    // Create temporary test directory
    testDir = await fs.mkdtemp(path.join(tmpdir(), "vibe-sync-test-"));
    claudeDir = path.join(testDir, ".claude");
    cursorDir = path.join(testDir, ".cursor");
    opencodeDir = path.join(testDir, ".opencode");
    cacheDir = path.join(testDir, ".vibe-sync-cache");

    // Create directory structure
    await fs.mkdir(path.join(claudeDir, "skills"), { recursive: true });
    await fs.mkdir(path.join(claudeDir, "agents"), { recursive: true });
    await fs.mkdir(path.join(claudeDir, "commands"), { recursive: true });
    await fs.mkdir(path.join(cursorDir), { recursive: true });
    await fs.mkdir(path.join(opencodeDir), { recursive: true });
    await fs.mkdir(cacheDir, { recursive: true });

    // Change to test directory
    process.chdir(testDir);
  });

  afterEach(async () => {
    // Restore original CWD
    process.chdir(originalCwd);

    // Cleanup test directory
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe("Claude Code → Cursor sync", () => {
    it("should sync skills from Claude Code to Cursor", async () => {
      // Setup source: Claude Code with a skill
      const skillContent = `---
name: test-skill
description: A test skill
---

# Test Skill

This is a test skill content.`;

      await fs.mkdir(path.join(claudeDir, "skills", "test-skill"), {
        recursive: true,
      });
      await fs.writeFile(
        path.join(claudeDir, "skills", "test-skill", "SKILL.md"),
        skillContent,
      );

      // Setup config
      const config: VibeConfig = {
        version: "1.0.0",
        level: "project",
        source_tool: "claude-code",
        target_tools: ["cursor"],
        sync_config: {
          skills: true,
          mcp: false,
          agents: false,
          commands: false,
        },
        use_symlinks_for_skills: false, // Disable symlinks for tests
      };

      await saveConfig(config, "project", testDir);

      // Run sync
      await syncCommand({
        dryRun: false,
        prune: false,
        user: false,
        yes: true, // Skip confirmation
      });

      // Verify skill was synced to Cursor
      const cursorSkillPath = path.join(
        cursorDir,
        "skills",
        "test-skill",
        "SKILL.md",
      );
      const exists = await fs
        .access(cursorSkillPath)
        .then(() => true)
        .catch(() => false);

      expect(exists).toBe(true);

      const cursorSkillContent = await fs.readFile(cursorSkillPath, "utf-8");
      expect(cursorSkillContent).toContain("test-skill");
      expect(cursorSkillContent).toContain("A test skill");
      expect(cursorSkillContent).toContain("This is a test skill content.");
    });

    it("should sync MCP servers from Claude Code to Cursor", async () => {
      // Setup source: Claude Code with MCP config
      const mcpConfig = {
        mcpServers: {
          "test-server": {
            type: "stdio",
            command: "node",
            args: ["server.js"],
            env: {
              API_KEY: "${env:API_KEY}",
            },
          },
        },
      };

      await fs.writeFile(
        path.join(testDir, ".mcp.json"), // Root level, not in .claude/
        JSON.stringify(mcpConfig, null, 2),
      );

      // Setup config
      const config: VibeConfig = {
        version: "1.0.0",
        level: "project",
        source_tool: "claude-code",
        target_tools: ["cursor"],
        sync_config: {
          skills: false,
          mcp: true,
          agents: false,
          commands: false,
        },
      };

      await saveConfig(config, "project", testDir);

      // Run sync
      await syncCommand({
        dryRun: false,
        prune: false,
        user: false,
        yes: true,
      });

      // Verify MCP config was synced to Cursor
      const cursorMcpPath = path.join(cursorDir, "mcp.json");
      const exists = await fs
        .access(cursorMcpPath)
        .then(() => true)
        .catch(() => false);

      expect(exists).toBe(true);

      const cursorMcpContent = await fs.readFile(cursorMcpPath, "utf-8");
      const cursorMcp = JSON.parse(cursorMcpContent);

      expect(cursorMcp.mcpServers["test-server"]).toBeDefined();
      expect(cursorMcp.mcpServers["test-server"].command).toBe("node");
      expect(cursorMcp.mcpServers["test-server"].env.API_KEY).toBe(
        "${env:API_KEY}",
      );
    });

    it("should sync agents from Claude Code to Cursor", async () => {
      // Setup source: Claude Code with an agent
      const agentContent = `---
name: test-agent
description: A test agent
---

# Test Agent

This is a test agent.`;

      await fs.writeFile(
        path.join(claudeDir, "agents", "test-agent.md"),
        agentContent,
      );

      // Setup config
      const config: VibeConfig = {
        version: "1.0.0",
        level: "project",
        source_tool: "claude-code",
        target_tools: ["cursor"],
        sync_config: {
          skills: true, // At least one must be enabled for validation
          mcp: false,
          agents: true,
          commands: false,
        },
        use_symlinks_for_skills: false, // Disable symlinks for tests
      };

      await saveConfig(config, "project", testDir);

      // Run sync
      await syncCommand({
        dryRun: false,
        prune: false,
        user: false,
        yes: true,
      });

      // Verify agent was synced to Cursor
      const cursorAgentPath = path.join(
        cursorDir,
        "agents",
        "test-agent",
        "AGENT.md",
      );
      const exists = await fs
        .access(cursorAgentPath)
        .then(() => true)
        .catch(() => false);

      expect(exists).toBe(true);

      const cursorAgentContent = await fs.readFile(cursorAgentPath, "utf-8");
      expect(cursorAgentContent).toContain("test-agent");
      expect(cursorAgentContent).toContain("A test agent");
    });

    it("should sync commands from Claude Code to Cursor", async () => {
      // Setup source: Claude Code with a command
      const commandContent = `---
name: test-command
description: A test command
---

# Test Command

This is a test command.`;

      await fs.writeFile(
        path.join(claudeDir, "commands", "test-command.md"),
        commandContent,
      );

      // Setup config
      const config: VibeConfig = {
        version: "1.0.0",
        level: "project",
        source_tool: "claude-code",
        target_tools: ["cursor"],
        sync_config: {
          skills: true, // At least one must be enabled for validation
          mcp: false,
          agents: false,
          commands: true,
        },
        use_symlinks_for_skills: false, // Disable symlinks for tests
      };

      await saveConfig(config, "project", testDir);

      // Run sync
      await syncCommand({
        dryRun: false,
        prune: false,
        user: false,
        yes: true,
      });

      // Verify command was synced to Cursor
      const cursorCommandPath = path.join(
        cursorDir,
        "commands",
        "test-command",
        "COMMAND.md",
      );
      const exists = await fs
        .access(cursorCommandPath)
        .then(() => true)
        .catch(() => false);

      expect(exists).toBe(true);

      const cursorCommandContent = await fs.readFile(
        cursorCommandPath,
        "utf-8",
      );
      expect(cursorCommandContent).toContain("test-command");
      expect(cursorCommandContent).toContain("A test command");
    });
  });

  describe("Claude Code → OpenCode sync", () => {
    it("should sync MCP servers with correct format conversion", async () => {
      // Setup source: Claude Code with MCP config
      const mcpConfig = {
        mcpServers: {
          "test-server": {
            type: "stdio",
            command: "node",
            args: ["server.js"],
            env: {
              API_KEY: "${env:API_KEY}",
              TOKEN: "${env:GITHUB_TOKEN}",
            },
          },
        },
      };

      await fs.writeFile(
        path.join(testDir, ".mcp.json"), // Root level, not in .claude/
        JSON.stringify(mcpConfig, null, 2),
      );

      // Setup config
      const config: VibeConfig = {
        version: "1.0.0",
        level: "project",
        source_tool: "claude-code",
        target_tools: ["opencode"],
        sync_config: {
          skills: false,
          mcp: true,
          agents: false,
          commands: false,
        },
      };

      await saveConfig(config, "project", testDir);

      // Run sync
      await syncCommand({
        dryRun: false,
        prune: false,
        user: false,
        yes: true,
      });

      // Verify MCP config was synced with OpenCode format
      const opencodeMcpPath = path.join(opencodeDir, "opencode.jsonc");
      const exists = await fs
        .access(opencodeMcpPath)
        .then(() => true)
        .catch(() => false);

      expect(exists).toBe(true);

      const opencodeMcpContent = await fs.readFile(opencodeMcpPath, "utf-8");
      const opencodeMcp = JSON.parse(opencodeMcpContent);

      // OpenCode uses "mcp" not "mcpServers"
      expect(opencodeMcp.mcp["test-server"]).toBeDefined();
      // OpenCode requires "type" field
      expect(opencodeMcp.mcp["test-server"].type).toBe("stdio");
      // OpenCode uses ${VAR} not ${env:VAR}
      expect(opencodeMcp.mcp["test-server"].env.API_KEY).toBe("${API_KEY}");
      expect(opencodeMcp.mcp["test-server"].env.TOKEN).toBe("${GITHUB_TOKEN}");
    });
  });

  describe("Safe mode vs Prune mode", () => {
    it("should NOT delete items in safe mode", async () => {
      // Setup: Claude Code with skill1, Cursor already has skill1 + skill2
      await fs.mkdir(path.join(claudeDir, "skills", "skill1"), {
        recursive: true,
      });
      await fs.writeFile(
        path.join(claudeDir, "skills", "skill1", "SKILL.md"),
        `---
name: skill1
description: Skill 1
---
Content 1`,
      );

      await fs.mkdir(path.join(cursorDir, "skills", "skill1"), {
        recursive: true,
      });
      await fs.writeFile(
        path.join(cursorDir, "skills", "skill1", "SKILL.md"),
        `---
name: skill1
description: Skill 1
---
Content 1`,
      );

      await fs.mkdir(path.join(cursorDir, "skills", "skill2"), {
        recursive: true,
      });
      await fs.writeFile(
        path.join(cursorDir, "skills", "skill2", "SKILL.md"),
        `---
name: skill2
description: Skill 2
---
Content 2`,
      );

      // Setup config (safe mode)
      const config: VibeConfig = {
        version: "1.0.0",
        level: "project",
        source_tool: "claude-code",
        target_tools: ["cursor"],
        sync_config: {
          skills: true,
          mcp: false,
          agents: false,
          commands: false,
        },
        use_symlinks_for_skills: false, // Disable symlinks for tests
      };

      await saveConfig(config, "project", testDir);

      // Run sync in safe mode
      await syncCommand({
        dryRun: false,
        prune: false, // Safe mode
        user: false,
        yes: true,
      });

      // Verify skill2 still exists (not deleted)
      const skill2Exists = await fs
        .access(path.join(cursorDir, "skills", "skill2", "SKILL.md"))
        .then(() => true)
        .catch(() => false);

      expect(skill2Exists).toBe(true);
    });

    it("should delete items in prune mode", async () => {
      // Setup: Claude Code with skill1, Cursor has skill1 + skill2
      await fs.mkdir(path.join(claudeDir, "skills", "skill1"), {
        recursive: true,
      });
      await fs.writeFile(
        path.join(claudeDir, "skills", "skill1", "SKILL.md"),
        `---
name: skill1
description: Skill 1
---
Content 1`,
      );

      await fs.mkdir(path.join(cursorDir, "skills", "skill1"), {
        recursive: true,
      });
      await fs.writeFile(
        path.join(cursorDir, "skills", "skill1", "SKILL.md"),
        `---
name: skill1
description: Skill 1
---
Content 1`,
      );

      await fs.mkdir(path.join(cursorDir, "skills", "skill2"), {
        recursive: true,
      });
      await fs.writeFile(
        path.join(cursorDir, "skills", "skill2", "SKILL.md"),
        `---
name: skill2
description: Skill 2
---
Content 2`,
      );

      // Create initial manifest with skill2
      const manifestPath = path.join(cacheDir, "manifest.json");
      await fs.writeFile(
        manifestPath,
        JSON.stringify(
          {
            version: "1.0.0",
            last_sync: new Date().toISOString(),
            items: {
              "skills/skill1": {
                hash: "abc123",
                last_synced: new Date().toISOString(),
                targets: ["cursor"],
              },
              "skills/skill2": {
                hash: "def456",
                last_synced: new Date().toISOString(),
                targets: ["cursor"],
              },
            },
          },
          null,
          2,
        ),
      );

      // Setup config (prune mode)
      const config: VibeConfig = {
        version: "1.0.0",
        level: "project",
        source_tool: "claude-code",
        target_tools: ["cursor"],
        sync_config: {
          skills: true,
          mcp: false,
          agents: false,
          commands: false,
        },
      };

      await saveConfig(config, "project", testDir);

      // Run sync in prune mode
      await syncCommand({
        dryRun: false,
        prune: true, // Prune mode
        user: false,
        yes: true,
      });

      // Verify skill2 was deleted
      const skill2Exists = await fs
        .access(path.join(cursorDir, "skills", "skill2", "SKILL.md"))
        .then(() => true)
        .catch(() => false);

      expect(skill2Exists).toBe(false);
    });
  });

  describe("Multi-target sync", () => {
    it("should sync to multiple targets in parallel", async () => {
      // Setup source: Claude Code with a skill
      const skillContent = `---
name: multi-skill
description: Multi-target skill
---

# Multi-target Skill

Content for multiple targets.`;

      await fs.mkdir(path.join(claudeDir, "skills", "multi-skill"), {
        recursive: true,
      });
      await fs.writeFile(
        path.join(claudeDir, "skills", "multi-skill", "SKILL.md"),
        skillContent,
      );

      // Setup config with multiple targets
      const config: VibeConfig = {
        version: "1.0.0",
        level: "project",
        source_tool: "claude-code",
        target_tools: ["cursor", "opencode"],
        sync_config: {
          skills: true,
          mcp: false,
          agents: false,
          commands: false,
        },
        use_symlinks_for_skills: false, // Disable symlinks for tests
      };

      await saveConfig(config, "project", testDir);

      // Run sync
      await syncCommand({
        dryRun: false,
        prune: false,
        user: false,
        yes: true,
      });

      // Verify skill was synced to Cursor
      const cursorSkillExists = await fs
        .access(path.join(cursorDir, "skills", "multi-skill", "SKILL.md"))
        .then(() => true)
        .catch(() => false);

      expect(cursorSkillExists).toBe(true);

      // Verify skill was synced to OpenCode
      const opencodeSkillExists = await fs
        .access(path.join(opencodeDir, "skills", "multi-skill", "SKILL.md"))
        .then(() => true)
        .catch(() => false);

      expect(opencodeSkillExists).toBe(true);
    });
  });

  describe("Manifest updates", () => {
    it("should create and update manifest after sync", async () => {
      // Setup source: Claude Code with a skill
      await fs.mkdir(path.join(claudeDir, "skills", "tracked-skill"), {
        recursive: true,
      });
      await fs.writeFile(
        path.join(claudeDir, "skills", "tracked-skill", "SKILL.md"),
        `---
name: tracked-skill
description: Tracked skill
---
Content`,
      );

      // Setup config
      const config: VibeConfig = {
        version: "1.0.0",
        level: "project",
        source_tool: "claude-code",
        target_tools: ["cursor"],
        sync_config: {
          skills: true,
          mcp: false,
          agents: false,
          commands: false,
        },
        use_symlinks_for_skills: false, // Disable symlinks for tests
      };

      await saveConfig(config, "project", testDir);

      // Run sync
      await syncCommand({
        dryRun: false,
        prune: false,
        user: false,
        yes: true,
      });

      // Verify manifest was created
      const manifestPath = path.join(cacheDir, "manifest.json");
      const manifestExists = await fs
        .access(manifestPath)
        .then(() => true)
        .catch(() => false);

      expect(manifestExists).toBe(true);

      const manifestContent = await fs.readFile(manifestPath, "utf-8");
      const manifest = JSON.parse(manifestContent);

      // Verify manifest has the skill entry
      expect(manifest.items["skills/tracked-skill"]).toBeDefined();
      expect(manifest.items["skills/tracked-skill"].targets).toContain(
        "cursor",
      );
      expect(manifest.items["skills/tracked-skill"].hash).toBeDefined();
    });
  });
});
