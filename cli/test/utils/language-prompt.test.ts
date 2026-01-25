import { access } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

// Mock modules
vi.mock("node:fs/promises");
vi.mock("inquirer");
vi.mock("@src/core/config-manager.js");
vi.mock("@src/utils/i18n.js", () => ({
  detectSystemLanguage: vi.fn(),
  initI18n: vi.fn(),
}));

// Import functions after mocks are defined
const { shouldPromptForLanguage, promptForLanguage, initializeLanguage } =
  await import("@src/utils/language-prompt.js");

describe("Language Prompt Utilities", () => {
  const mockAccess = vi.mocked(access);
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("shouldPromptForLanguage", () => {
    it("should return true when user config does not exist", async () => {
      mockAccess.mockRejectedValue({ code: "ENOENT" });

      const result = await shouldPromptForLanguage();

      expect(result).toBe(true);
      expect(mockAccess).toHaveBeenCalledWith(
        join(homedir(), ".vibe-sync.json"),
      );
    });

    it("should return false when user config exists", async () => {
      mockAccess.mockResolvedValue(undefined);

      const result = await shouldPromptForLanguage();

      expect(result).toBe(false);
      expect(mockAccess).toHaveBeenCalledWith(
        join(homedir(), ".vibe-sync.json"),
      );
    });

    it("should return false when access throws non-ENOENT error", async () => {
      mockAccess.mockRejectedValue({ code: "EACCES" });

      const result = await shouldPromptForLanguage();

      expect(result).toBe(false);
    });

    it("should use custom userDir if provided", async () => {
      mockAccess.mockRejectedValue({ code: "ENOENT" });

      await shouldPromptForLanguage("/custom/dir");

      expect(mockAccess).toHaveBeenCalledWith(
        join("/custom/dir", ".vibe-sync.json"),
      );
    });
  });

  describe("promptForLanguage", () => {
    it("should prompt user with bilingual message", async () => {
      const inquirer = await import("inquirer");
      const mockPrompt = vi
        .spyOn(inquirer.default, "prompt")
        .mockResolvedValue({ language: "zh" });

      const result = await promptForLanguage();

      expect(result).toBe("zh");
      expect(mockPrompt).toHaveBeenCalledWith([
        {
          type: "select",
          name: "language",
          message: "Choose language / 选择语言:",
          choices: [
            { name: "English", value: "en" },
            { name: "中文", value: "zh" },
          ],
        },
      ]);
    });

    it("should return English when user selects English", async () => {
      const inquirer = await import("inquirer");
      vi.spyOn(inquirer.default, "prompt").mockResolvedValue({
        language: "en",
      });

      const result = await promptForLanguage();

      expect(result).toBe("en");
    });

    it("should return Chinese when user selects Chinese", async () => {
      const inquirer = await import("inquirer");
      vi.spyOn(inquirer.default, "prompt").mockResolvedValue({
        language: "zh",
      });

      const result = await promptForLanguage();

      expect(result).toBe("zh");
    });
  });

  describe("initializeLanguage", () => {
    it("should use system language when config exists", async () => {
      mockAccess.mockResolvedValue(undefined);

      const { loadConfig } = await import("@src/core/config-manager.js");
      const { detectSystemLanguage, initI18n } =
        await import("@src/utils/i18n.js");

      vi.mocked(loadConfig).mockResolvedValue({
        version: "1.0.0",
        level: "user",
        source_tool: "claude-code",
        target_tools: ["cursor"],
        sync_config: { skills: true, mcp: true },
        language: "zh",
      });

      await initializeLanguage();

      expect(initI18n).toHaveBeenCalledWith("zh");
      expect(detectSystemLanguage).not.toHaveBeenCalled();
    });

    it("should prompt and save when config does not exist", async () => {
      mockAccess.mockRejectedValue({ code: "ENOENT" });

      const { loadConfig, saveConfig } =
        await import("@src/core/config-manager.js");
      const { detectSystemLanguage, initI18n } =
        await import("@src/utils/i18n.js");
      const inquirer = await import("inquirer");

      // loadConfig should throw when config doesn't exist
      vi.mocked(loadConfig).mockRejectedValue(
        new Error("Configuration file not found"),
      );
      vi.mocked(detectSystemLanguage).mockReturnValue("en");
      vi.spyOn(inquirer.default, "prompt").mockResolvedValue({
        language: "zh",
      });

      await initializeLanguage();

      expect(initI18n).toHaveBeenCalledWith("zh");
      expect(saveConfig).toHaveBeenCalledWith(
        {
          version: "1.0.0",
          level: "user",
          source_tool: "claude-code", // Default placeholder
          target_tools: [],
          sync_config: { skills: true, mcp: true },
          language: "zh",
        },
        "user",
        undefined,
        undefined,
      );
    });

    it("should use detected language when config does not exist and no prompt", async () => {
      mockAccess.mockRejectedValue({ code: "ENOENT" });

      const { loadConfig, saveConfig } =
        await import("@src/core/config-manager.js");
      const { detectSystemLanguage, initI18n } =
        await import("@src/utils/i18n.js");

      // loadConfig should throw when config doesn't exist
      vi.mocked(loadConfig).mockRejectedValue(
        new Error("Configuration file not found"),
      );
      vi.mocked(detectSystemLanguage).mockReturnValue("zh");

      await initializeLanguage(false); // skipPrompt = true

      expect(initI18n).toHaveBeenCalledWith("zh");
      expect(detectSystemLanguage).toHaveBeenCalled();
      expect(saveConfig).not.toHaveBeenCalled();
    });

    it("should handle user config with no language preference", async () => {
      mockAccess.mockResolvedValue(undefined);

      const { loadConfig } = await import("@src/core/config-manager.js");
      const { detectSystemLanguage, initI18n } =
        await import("@src/utils/i18n.js");

      vi.mocked(loadConfig).mockResolvedValue({
        version: "1.0.0",
        level: "user",
        source_tool: "claude-code",
        target_tools: ["cursor"],
        sync_config: { skills: true, mcp: true },
        // No language field
      });
      vi.mocked(detectSystemLanguage).mockReturnValue("en");

      await initializeLanguage();

      expect(detectSystemLanguage).toHaveBeenCalled();
      expect(initI18n).toHaveBeenCalledWith("en");
    });

    it("should use custom userDir if provided", async () => {
      mockAccess.mockResolvedValue(undefined);

      const { loadConfig } = await import("@src/core/config-manager.js");
      const { initI18n } = await import("@src/utils/i18n.js");

      vi.mocked(loadConfig).mockResolvedValue({
        version: "1.0.0",
        level: "user",
        source_tool: "claude-code",
        target_tools: ["cursor"],
        sync_config: { skills: true, mcp: true },
        language: "zh",
      });

      await initializeLanguage(true, "/custom/dir");

      expect(loadConfig).toHaveBeenCalledWith("user", undefined, "/custom/dir");
      expect(initI18n).toHaveBeenCalledWith("zh");
    });
  });

  describe("edge cases", () => {
    it("should handle corrupted user config gracefully", async () => {
      mockAccess.mockResolvedValue(undefined);

      const { loadConfig } = await import("@src/core/config-manager.js");
      const { detectSystemLanguage, initI18n } =
        await import("@src/utils/i18n.js");
      const inquirer = await import("inquirer");

      vi.mocked(loadConfig).mockRejectedValue(new Error("Invalid JSON"));
      vi.mocked(detectSystemLanguage).mockReturnValue("en");
      vi.spyOn(inquirer.default, "prompt").mockResolvedValue({
        language: "en",
      });

      await initializeLanguage();

      // When config is corrupted and shouldPrompt is true (default),
      // it should prompt the user (not use detectSystemLanguage)
      expect(initI18n).toHaveBeenCalledWith("en");
    });

    it("should not create duplicate user config when skipping prompt", async () => {
      mockAccess.mockRejectedValue({ code: "ENOENT" });

      const { loadConfig, saveConfig } =
        await import("@src/core/config-manager.js");
      const { detectSystemLanguage } = await import("@src/utils/i18n.js");

      vi.mocked(loadConfig).mockRejectedValue(
        new Error("Configuration file not found"),
      );
      vi.mocked(detectSystemLanguage).mockReturnValue("en");

      await initializeLanguage(false); // skipPrompt

      expect(saveConfig).not.toHaveBeenCalled();
    });
  });
});
