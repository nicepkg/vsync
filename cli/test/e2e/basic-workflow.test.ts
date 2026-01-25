/**
 * Basic E2E workflow tests
 * Tests simple, happy-path workflows to verify core functionality
 */

import fs from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  generateConfig,
  saveConfig as saveInitConfig,
  createCacheDirectory,
} from "@src/commands/init.js";
import { syncCommand } from "@src/commands/sync.js";
import type { ToolName } from "@src/types/config.js";

/**
 * E2E test utilities - high cohesion, single responsibility
 */
class E2ETestHelper {
  /**
   * Create a unique temporary project directory
   */
  static async createTempProject(): Promise<string> {
    const tempDir = path.join(
      tmpdir(),
      `vibe-sync-e2e-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    );
    await fs.mkdir(tempDir, { recursive: true });
    return tempDir;
  }

  /**
   * Clean up temporary project directory
   */
  static async cleanupTempProject(dir: string): Promise<void> {
    try {
      await fs.rm(dir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  }

  /**
   * Check if a file exists
   */
  static async fileExists(filePath: string): Promise<boolean> {
    return fs
      .access(filePath)
      .then(() => true)
      .catch(() => false);
  }

  /**
   * Get skill path for a given tool
   */
  static getSkillPath(
    projectDir: string,
    tool: ToolName,
    skillName: string,
  ): string {
    const toolConfigDirs: Record<ToolName, string> = {
      "claude-code": ".claude",
      cursor: ".cursor",
      opencode: ".opencode",
      codex: ".codex",
    };

    const configDir = toolConfigDirs[tool];
    return path.join(projectDir, configDir, "skills", skillName, "SKILL.md");
  }

  /**
   * Get skills directory path for a given tool
   */
  static getSkillsDir(projectDir: string, tool: ToolName): string {
    const toolConfigDirs: Record<ToolName, string> = {
      "claude-code": ".claude",
      cursor: ".cursor",
      opencode: ".opencode",
      codex: ".codex",
    };

    const configDir = toolConfigDirs[tool];
    return path.join(projectDir, configDir, "skills");
  }

  /**
   * Check if a path is a symlink
   */
  static async isSymlink(filePath: string): Promise<boolean> {
    try {
      const stats = await fs.lstat(filePath);
      return stats.isSymbolicLink();
    } catch {
      return false;
    }
  }

  /**
   * Get the target of a symlink
   */
  static async getSymlinkTarget(filePath: string): Promise<string | null> {
    try {
      return await fs.readlink(filePath);
    } catch {
      return null;
    }
  }

  /**
   * Get MCP config path for a given tool
   */
  static getMCPConfigPath(projectDir: string, tool: ToolName): string {
    const mcpPaths: Record<ToolName, string> = {
      "claude-code": ".mcp.json",
      cursor: ".cursor/mcp.json",
      opencode: "opencode.json",
      codex: ".mcp.json",
    };

    return path.join(projectDir, mcpPaths[tool]);
  }

  /**
   * Get agent path for a given tool
   */
  static getAgentPath(
    projectDir: string,
    tool: ToolName,
    agentName: string,
  ): string {
    const toolConfigDirs: Record<ToolName, string> = {
      "claude-code": ".claude",
      cursor: ".cursor",
      opencode: ".opencode",
      codex: ".codex",
    };

    const configDir = toolConfigDirs[tool];
    return path.join(projectDir, configDir, "agents", `${agentName}.md`);
  }

  /**
   * Get command path for a given tool
   */
  static getCommandPath(
    projectDir: string,
    tool: ToolName,
    commandName: string,
  ): string {
    const toolConfigDirs: Record<ToolName, string> = {
      "claude-code": ".claude",
      cursor: ".cursor",
      opencode: ".opencode",
      codex: ".codex",
    };

    const configDir = toolConfigDirs[tool];
    return path.join(projectDir, configDir, "commands", `${commandName}.md`);
  }
}

/**
 * Test fixture builder - follows builder pattern
 */
class E2ETestFixture {
  private projectDir: string;

  constructor(projectDir: string) {
    this.projectDir = projectDir;
  }

  /**
   * Initialize vibe-sync configuration
   */
  async initVibeSync(
    source: ToolName,
    targets: ToolName[],
    options?: {
      useSymlinks?: boolean;
      syncItems?: Array<"skills" | "mcp" | "agents" | "commands">;
    },
  ): Promise<void> {
    const config = await generateConfig({
      tools: [source, ...targets],
      source,
      syncItems: options?.syncItems ?? ["skills", "mcp"],
      isUserLevel: false,
    });

    // Configure symlinks (default: disabled for E2E tests to avoid prompts)
    config.use_symlinks_for_skills = options?.useSymlinks ?? false;

    await saveInitConfig(config, this.projectDir);
    await createCacheDirectory(this.projectDir);
  }

  /**
   * Create a skill in Claude Code source
   */
  async createSkill(skillName: string, content?: string): Promise<void> {
    const skillDir = path.join(this.projectDir, ".claude", "skills", skillName);
    await fs.mkdir(skillDir, { recursive: true });

    const skillContent =
      content ||
      `---
name: ${skillName}
description: ${skillName} skill
---
# ${skillName}
`;

    await fs.writeFile(path.join(skillDir, "SKILL.md"), skillContent);
  }

  /**
   * Remove a skill from Claude Code source
   */
  async removeSkill(skillName: string): Promise<void> {
    const skillDir = path.join(this.projectDir, ".claude", "skills", skillName);
    await fs.rm(skillDir, { recursive: true, force: true });
  }

  /**
   * Create an MCP server configuration in Claude Code source
   */
  async createMCPServer(
    serverName: string,
    config?: {
      command?: string;
      args?: string[];
      env?: Record<string, string>;
    },
  ): Promise<void> {
    const mcpConfigPath = path.join(this.projectDir, ".mcp.json");
    const mcpConfig = {
      mcpServers: {
        [serverName]: {
          command: config?.command || "npx",
          args: config?.args || ["-y", "@modelcontextprotocol/server-memory"],
          ...(config?.env && { env: config.env }),
        },
      },
    };

    await fs.writeFile(mcpConfigPath, JSON.stringify(mcpConfig, null, 2));
  }

  /**
   * Create an agent in Claude Code source
   */
  async createAgent(agentName: string, content?: string): Promise<void> {
    const agentDir = path.join(this.projectDir, ".claude", "agents");
    await fs.mkdir(agentDir, { recursive: true });

    const agentContent =
      content ||
      `---
name: ${agentName}
description: ${agentName} agent
---
# ${agentName} Agent
`;

    await fs.writeFile(path.join(agentDir, `${agentName}.md`), agentContent);
  }

  /**
   * Create a command in Claude Code source
   */
  async createCommand(commandName: string, content?: string): Promise<void> {
    const commandDir = path.join(this.projectDir, ".claude", "commands");
    await fs.mkdir(commandDir, { recursive: true });

    const commandContent =
      content ||
      `---
name: ${commandName}
description: ${commandName} command
---
# ${commandName} Command
`;

    await fs.writeFile(
      path.join(commandDir, `${commandName}.md`),
      commandContent,
    );
  }
}

describe("Basic E2E Workflows", () => {
  let testDir: string;
  let originalCwd: string;
  let fixture: E2ETestFixture;

  beforeEach(async () => {
    originalCwd = process.cwd();
    testDir = await E2ETestHelper.createTempProject();
    fixture = new E2ETestFixture(testDir);
    process.chdir(testDir);
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await E2ETestHelper.cleanupTempProject(testDir);
  });

  describe("Basic Sync", () => {
    it("should sync from Claude Code to Cursor", async () => {
      // Arrange
      await fixture.createSkill("demo", "---\nname: demo\n---\n# Demo Skill\n");
      await fixture.initVibeSync("claude-code", ["cursor"]);

      // Act
      await syncCommand({ yes: true });

      // Assert
      const skillPath = E2ETestHelper.getSkillPath(testDir, "cursor", "demo");
      const skillContent = await fs.readFile(skillPath, "utf-8");
      expect(skillContent).toContain("Demo Skill");
    });

    it("should sync to multiple targets in parallel", async () => {
      // Arrange
      await fixture.createSkill("demo");
      await fixture.initVibeSync("claude-code", ["cursor", "opencode"]);

      // Act
      await syncCommand({ yes: true });

      // Assert - DRY: use helper for multiple tools
      const targets: ToolName[] = ["cursor", "opencode"];
      for (const target of targets) {
        const skillPath = E2ETestHelper.getSkillPath(testDir, target, "demo");
        const exists = await E2ETestHelper.fileExists(skillPath);
        expect(exists).toBe(true);
      }
    });
  });

  describe("Prune Mode", () => {
    it("should delete orphaned items", async () => {
      // Arrange - setup and first sync
      await fixture.createSkill("demo");
      await fixture.initVibeSync("claude-code", ["cursor"]);
      await syncCommand({ yes: true });

      const skillPath = E2ETestHelper.getSkillPath(testDir, "cursor", "demo");

      // Verify initial sync
      expect(await E2ETestHelper.fileExists(skillPath)).toBe(true);

      // Act - remove from source and sync in prune mode
      await fixture.removeSkill("demo");
      await syncCommand({ yes: true, prune: true });

      // Assert
      expect(await E2ETestHelper.fileExists(skillPath)).toBe(false);
    });
  });

  describe("Symlink Mode", () => {
    it("should create symlinks when enabled", async () => {
      // Arrange
      await fixture.createSkill("demo");
      await fixture.initVibeSync("claude-code", ["cursor"], {
        useSymlinks: true,
      });

      // Act
      await syncCommand({ yes: true });

      // Assert - skills directory should be a symlink
      const cursorSkillsDir = E2ETestHelper.getSkillsDir(testDir, "cursor");
      const isSymlink = await E2ETestHelper.isSymlink(cursorSkillsDir);
      expect(isSymlink).toBe(true);
    });

    it("should point to source skills directory", async () => {
      // Arrange
      await fixture.createSkill("demo");
      await fixture.initVibeSync("claude-code", ["cursor"], {
        useSymlinks: true,
      });

      // Act
      await syncCommand({ yes: true });

      // Assert - symlink target should be source skills directory
      const cursorSkillsDir = E2ETestHelper.getSkillsDir(testDir, "cursor");
      const symlinkTarget =
        await E2ETestHelper.getSymlinkTarget(cursorSkillsDir);
      const sourceSkillsDir = E2ETestHelper.getSkillsDir(
        testDir,
        "claude-code",
      );

      // Resolve real paths for comparison (handles /var vs /private/var on macOS)
      const realSymlinkTarget = symlinkTarget
        ? await fs.realpath(symlinkTarget)
        : null;
      const realSourceDir = await fs.realpath(sourceSkillsDir);

      expect(realSymlinkTarget).toBe(realSourceDir);
    });

    it("should allow accessing files through symlink", async () => {
      // Arrange
      await fixture.createSkill("demo", "---\nname: demo\n---\n# Symlinked!");
      await fixture.initVibeSync("claude-code", ["cursor"], {
        useSymlinks: true,
      });

      // Act
      await syncCommand({ yes: true });

      // Assert - can read file through symlink
      const cursorSkillPath = E2ETestHelper.getSkillPath(
        testDir,
        "cursor",
        "demo",
      );
      const content = await fs.readFile(cursorSkillPath, "utf-8");
      expect(content).toContain("Symlinked!");
    });

    it("should reflect source changes immediately", async () => {
      // Arrange - setup symlink
      await fixture.createSkill("demo", "---\nname: demo\n---\n# Original");
      await fixture.initVibeSync("claude-code", ["cursor"], {
        useSymlinks: true,
      });
      await syncCommand({ yes: true });

      const cursorSkillPath = E2ETestHelper.getSkillPath(
        testDir,
        "cursor",
        "demo",
      );

      // Verify initial content
      let content = await fs.readFile(cursorSkillPath, "utf-8");
      expect(content).toContain("Original");

      // Act - modify source directly (no sync needed!)
      const sourceSkillPath = E2ETestHelper.getSkillPath(
        testDir,
        "claude-code",
        "demo",
      );
      await fs.writeFile(sourceSkillPath, "---\nname: demo\n---\n# Modified!");

      // Assert - change visible immediately through symlink
      content = await fs.readFile(cursorSkillPath, "utf-8");
      expect(content).toContain("Modified!");
    });

    it("should work with multiple targets", async () => {
      // Arrange
      await fixture.createSkill("demo");
      await fixture.initVibeSync("claude-code", ["cursor", "opencode"], {
        useSymlinks: true,
      });

      // Act
      await syncCommand({ yes: true });

      // Assert - both targets should have symlinks
      const targets: ToolName[] = ["cursor", "opencode"];
      const sourceSkillsDir = E2ETestHelper.getSkillsDir(
        testDir,
        "claude-code",
      );
      const realSourceDir = await fs.realpath(sourceSkillsDir);

      for (const target of targets) {
        const targetSkillsDir = E2ETestHelper.getSkillsDir(testDir, target);
        const isSymlink = await E2ETestHelper.isSymlink(targetSkillsDir);
        const symlinkTarget =
          await E2ETestHelper.getSymlinkTarget(targetSkillsDir);

        // Resolve real path for comparison
        const realSymlinkTarget = symlinkTarget
          ? await fs.realpath(symlinkTarget)
          : null;

        expect(isSymlink).toBe(true);
        expect(realSymlinkTarget).toBe(realSourceDir);
      }
    });
  });

  describe("MCP Sync", () => {
    it("should sync MCP servers from Claude Code to Cursor", async () => {
      // Arrange
      await fixture.createMCPServer("memory", {
        command: "npx",
        args: ["-y", "@modelcontextprotocol/server-memory"],
      });
      await fixture.initVibeSync("claude-code", ["cursor"], {
        syncItems: ["mcp"],
      });

      // Act
      await syncCommand({ yes: true });

      // Assert
      const cursorMCPPath = E2ETestHelper.getMCPConfigPath(testDir, "cursor");
      const mcpContent = await fs.readFile(cursorMCPPath, "utf-8");
      const mcpConfig = JSON.parse(mcpContent);

      expect(mcpConfig.mcpServers).toBeDefined();
      expect(mcpConfig.mcpServers.memory).toBeDefined();
      expect(mcpConfig.mcpServers.memory.command).toBe("npx");
      expect(mcpConfig.mcpServers.memory.args).toEqual([
        "-y",
        "@modelcontextprotocol/server-memory",
      ]);
    });

    it("should preserve environment variables in MCP config", async () => {
      // Arrange
      await fixture.createMCPServer("github", {
        command: "npx",
        args: ["-y", "@modelcontextprotocol/server-github"],
        env: {
          GITHUB_TOKEN: "${env:GITHUB_TOKEN}",
        },
      });
      await fixture.initVibeSync("claude-code", ["cursor"], {
        syncItems: ["mcp"],
      });

      // Act
      await syncCommand({ yes: true });

      // Assert - env vars should be preserved, not expanded
      const cursorMCPPath = E2ETestHelper.getMCPConfigPath(testDir, "cursor");
      const mcpContent = await fs.readFile(cursorMCPPath, "utf-8");
      const mcpConfig = JSON.parse(mcpContent);

      expect(mcpConfig.mcpServers.github.env).toBeDefined();
      expect(mcpConfig.mcpServers.github.env.GITHUB_TOKEN).toBe(
        "${env:GITHUB_TOKEN}",
      );
    });

    it("should sync MCP servers to OpenCode with correct format", async () => {
      // Arrange
      await fixture.createMCPServer("memory", {
        command: "npx",
        args: ["-y", "@modelcontextprotocol/server-memory"],
        env: {
          API_KEY: "${env:API_KEY}",
        },
      });
      await fixture.initVibeSync("claude-code", ["opencode"], {
        syncItems: ["mcp"],
      });

      // Act
      await syncCommand({ yes: true });

      // Assert - OpenCode uses different format
      const opencodeMCPPath = E2ETestHelper.getMCPConfigPath(
        testDir,
        "opencode",
      );
      const mcpContent = await fs.readFile(opencodeMCPPath, "utf-8");
      const mcpConfig = JSON.parse(mcpContent);

      expect(mcpConfig.mcp).toBeDefined(); // OpenCode uses 'mcp', not 'mcpServers'
      expect(mcpConfig.mcp.memory).toBeDefined();
      expect(mcpConfig.mcp.memory.type).toBe("local"); // OpenCode requires 'type' field
      expect(mcpConfig.mcp.memory.command).toEqual([
        "npx",
        "-y",
        "@modelcontextprotocol/server-memory",
      ]);
      expect(mcpConfig.mcp.memory.environment.API_KEY).toBe("{env:API_KEY}"); // OpenCode format
    });
  });

  describe("Agents Sync", () => {
    it("should sync agents from Claude Code to Cursor", async () => {
      // Arrange
      await fixture.createAgent(
        "test-agent",
        "---\nname: test-agent\n---\n# Test Agent\n",
      );
      await fixture.initVibeSync("claude-code", ["cursor"], {
        syncItems: ["skills", "agents"], // Need skills or mcp for validation
      });

      // Act
      await syncCommand({ yes: true });

      // Assert
      const cursorAgentPath = E2ETestHelper.getAgentPath(
        testDir,
        "cursor",
        "test-agent",
      );
      const agentContent = await fs.readFile(cursorAgentPath, "utf-8");
      expect(agentContent).toContain("Test Agent");
    });

    it("should sync agents to multiple targets", async () => {
      // Arrange
      await fixture.createAgent("code-reviewer");
      await fixture.initVibeSync("claude-code", ["cursor", "opencode"], {
        syncItems: ["skills", "agents"], // Need skills or mcp for validation
      });

      // Act
      await syncCommand({ yes: true });

      // Assert - both targets should have the agent
      const targets: ToolName[] = ["cursor", "opencode"];
      for (const target of targets) {
        const agentPath = E2ETestHelper.getAgentPath(
          testDir,
          target,
          "code-reviewer",
        );
        const exists = await E2ETestHelper.fileExists(agentPath);
        expect(exists).toBe(true);
      }
    });
  });

  describe("Commands Sync", () => {
    it("should sync commands from Claude Code to Cursor", async () => {
      // Arrange
      await fixture.createCommand(
        "test-cmd",
        "---\nname: test-cmd\n---\n# Test Command\n",
      );
      await fixture.initVibeSync("claude-code", ["cursor"], {
        syncItems: ["skills", "commands"], // Need skills or mcp for validation
      });

      // Act
      await syncCommand({ yes: true });

      // Assert
      const cursorCommandPath = E2ETestHelper.getCommandPath(
        testDir,
        "cursor",
        "test-cmd",
      );
      const commandContent = await fs.readFile(cursorCommandPath, "utf-8");
      expect(commandContent).toContain("Test Command");
    });

    it("should sync commands to multiple targets", async () => {
      // Arrange
      await fixture.createCommand("deploy");
      await fixture.initVibeSync("claude-code", ["cursor", "opencode"], {
        syncItems: ["skills", "commands"], // Need skills or mcp for validation
      });

      // Act
      await syncCommand({ yes: true });

      // Assert - both targets should have the command
      const targets: ToolName[] = ["cursor", "opencode"];
      for (const target of targets) {
        const commandPath = E2ETestHelper.getCommandPath(
          testDir,
          target,
          "deploy",
        );
        const exists = await E2ETestHelper.fileExists(commandPath);
        expect(exists).toBe(true);
      }
    });
  });
});
