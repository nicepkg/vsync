import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Command } from "commander";
import { createCLI } from "../../src/cli/index.js";

describe("CLI Framework", () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let processExitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    processExitSpy = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit called");
    });
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    processExitSpy.mockRestore();
  });

  describe("createCLI", () => {
    it("should create Commander program instance", () => {
      const program = createCLI();

      expect(program).toBeInstanceOf(Command);
    });

    it("should set correct program name", () => {
      const program = createCLI();

      expect(program.name()).toBe("vibe-sync");
    });

    it("should set program description", () => {
      const program = createCLI();
      const description = program.description();

      expect(description).toContain("AI Coding Tool Config Synchronizer");
    });

    it("should set version from package.json", () => {
      const program = createCLI();
      const version = program.version();

      expect(version).toMatch(/^\d+\.\d+\.\d+$/);
    });

    it("should register init command", () => {
      const program = createCLI();
      const commands = program.commands;

      const initCommand = commands.find((cmd) => cmd.name() === "init");
      expect(initCommand).toBeDefined();
    });

    it("should register sync command", () => {
      const program = createCLI();
      const commands = program.commands;

      const syncCommand = commands.find((cmd) => cmd.name() === "sync");
      expect(syncCommand).toBeDefined();
    });

    it("should register plan command", () => {
      const program = createCLI();
      const commands = program.commands;

      const planCommand = commands.find((cmd) => cmd.name() === "plan");
      expect(planCommand).toBeDefined();
    });

    it("should register status command", () => {
      const program = createCLI();
      const commands = program.commands;

      const statusCommand = commands.find((cmd) => cmd.name() === "status");
      expect(statusCommand).toBeDefined();
    });

    it("should register list command", () => {
      const program = createCLI();
      const commands = program.commands;

      const listCommand = commands.find((cmd) => cmd.name() === "list");
      expect(listCommand).toBeDefined();
    });

    it("should register clean command", () => {
      const program = createCLI();
      const commands = program.commands;

      const cleanCommand = commands.find((cmd) => cmd.name() === "clean");
      expect(cleanCommand).toBeDefined();
    });

    it("should have --version flag", () => {
      const program = createCLI();

      expect(program.version()).toBeTruthy();
    });

    it("should have help text", () => {
      const program = createCLI();
      const helpText = program.helpInformation();

      expect(helpText).toContain("vibe-sync");
      expect(helpText).toContain("Commands:");
    });
  });

  describe("Error Handling", () => {
    it("should handle errors gracefully", async () => {
      const program = createCLI();

      // Simulate error by parsing invalid args
      try {
        await program.parseAsync(["node", "vibe-sync", "nonexistent"], {
          from: "user",
        });
      } catch (error) {
        // Expected to throw due to process.exit mock
        expect(error).toBeDefined();
      }

      // Error should be logged
      expect(consoleErrorSpy).toHaveBeenCalled();
    });
  });
});
