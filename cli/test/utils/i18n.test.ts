import mockFs from "mock-fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  detectSystemLanguage,
  loadLanguage,
  t,
  setLanguage,
  getCurrentLanguage,
} from "@src/utils/i18n.js";

describe("i18n Utilities", () => {
  const enTranslations = {
    common: {
      yes: "Yes",
      no: "No",
      cancel: "Cancel",
    },
    commands: {
      init: {
        welcome: "Welcome to vibe-sync!",
        selectTools: "Which AI coding tools do you use?",
      },
      sync: {
        reading: "Reading source ({tool})...",
        foundSkills: "Found {count} skills",
      },
    },
    errors: {
      configNotFound: "Configuration file not found",
      invalidConfig: "Invalid configuration: {message}",
    },
  };

  const zhTranslations = {
    common: {
      yes: "是",
      no: "否",
      cancel: "取消",
    },
    commands: {
      init: {
        welcome: "欢迎使用 vibe-sync!",
        selectTools: "您使用哪些 AI 编码工具?",
      },
      sync: {
        reading: "正在读取源配置 ({tool})...",
        foundSkills: "找到 {count} 个技能",
      },
    },
    errors: {
      configNotFound: "未找到配置文件",
      invalidConfig: "无效的配置: {message}",
    },
  };

  beforeEach(() => {
    mockFs({
      "/project/src/locales": {
        "en.json": JSON.stringify(enTranslations),
        "zh.json": JSON.stringify(zhTranslations),
      },
    });

    // Mock __dirname for locales path resolution
    vi.stubGlobal("__dirname", "/project/src/utils");
  });

  afterEach(() => {
    mockFs.restore();
    vi.unstubAllGlobals();
  });

  describe("detectSystemLanguage", () => {
    it("should detect English from LANG=en_US.UTF-8", () => {
      const originalLang = process.env.LANG;
      process.env.LANG = "en_US.UTF-8";

      const lang = detectSystemLanguage();
      expect(lang).toBe("en");

      process.env.LANG = originalLang;
    });

    it("should detect Chinese from LANG=zh_CN.UTF-8", () => {
      const originalLang = process.env.LANG;
      process.env.LANG = "zh_CN.UTF-8";

      const lang = detectSystemLanguage();
      expect(lang).toBe("zh");

      process.env.LANG = originalLang;
    });

    it("should default to English for unknown locale", () => {
      const originalLang = process.env.LANG;
      process.env.LANG = "fr_FR.UTF-8";

      const lang = detectSystemLanguage();
      expect(lang).toBe("en");

      process.env.LANG = originalLang;
    });

    it("should default to English when LANG is not set", () => {
      const originalLang = process.env.LANG;
      delete process.env.LANG;

      const lang = detectSystemLanguage();
      expect(lang).toBe("en");

      process.env.LANG = originalLang;
    });
  });

  describe("loadLanguage", () => {
    it("should load English translations", async () => {
      await loadLanguage("en");

      const translation = t("common.yes");
      expect(translation).toBe("Yes");
    });

    it("should load Chinese translations", async () => {
      await loadLanguage("zh");

      const translation = t("common.yes");
      expect(translation).toBe("是");
    });

    it("should throw error for unsupported language", async () => {
      await expect(loadLanguage("fr" as any)).rejects.toThrow(
        "Unsupported language",
      );
    });

    it("should throw error when translation file is missing", async () => {
      mockFs({
        "/project/src/locales": {},
      });

      await expect(loadLanguage("en")).rejects.toThrow();
    });
  });

  describe("t (translate)", () => {
    beforeEach(async () => {
      await loadLanguage("en");
    });

    it("should translate simple key", () => {
      const translation = t("common.yes");
      expect(translation).toBe("Yes");
    });

    it("should translate nested key", () => {
      const translation = t("commands.init.welcome");
      expect(translation).toBe("Welcome to vibe-sync!");
    });

    it("should interpolate single parameter", () => {
      const translation = t("commands.sync.reading", { tool: "claude-code" });
      expect(translation).toBe("Reading source (claude-code)...");
    });

    it("should interpolate multiple parameters", () => {
      const translation = t("commands.sync.foundSkills", { count: "5" });
      expect(translation).toBe("Found 5 skills");
    });

    it("should handle missing key by returning key", () => {
      const translation = t("nonexistent.key");
      expect(translation).toBe("nonexistent.key");
    });

    it("should handle missing interpolation parameters", () => {
      const translation = t("commands.sync.reading");
      expect(translation).toBe("Reading source ({tool})...");
    });

    it("should switch language dynamically", async () => {
      expect(t("common.yes")).toBe("Yes");

      await setLanguage("zh");
      expect(t("common.yes")).toBe("是");

      await setLanguage("en");
      expect(t("common.yes")).toBe("Yes");
    });
  });

  describe("getCurrentLanguage", () => {
    it("should return default language before loading", () => {
      const lang = getCurrentLanguage();
      expect(["en", "zh"]).toContain(lang);
    });

    it("should return current language after loading", async () => {
      await loadLanguage("zh");
      expect(getCurrentLanguage()).toBe("zh");

      await setLanguage("en");
      expect(getCurrentLanguage()).toBe("en");
    });
  });

  describe("edge cases", () => {
    beforeEach(async () => {
      await loadLanguage("en");
    });

    it("should handle empty translation object", async () => {
      mockFs({
        "/project/src/locales": {
          "en.json": JSON.stringify({}),
        },
      });

      await loadLanguage("en");
      const translation = t("any.key");
      expect(translation).toBe("any.key");
    });

    it("should handle invalid JSON gracefully", async () => {
      mockFs({
        "/project/src/locales": {
          "en.json": "{ invalid json }",
        },
      });

      await expect(loadLanguage("en")).rejects.toThrow();
    });

    it("should handle numeric interpolation values", () => {
      const translation = t("commands.sync.foundSkills", { count: 42 });
      expect(translation).toBe("Found 42 skills");
    });

    it("should preserve original string when no params provided", () => {
      const translation = t("errors.invalidConfig");
      expect(translation).toBe("Invalid configuration: {message}");
    });

    it("should handle partial parameter replacement", () => {
      const translation = t("errors.invalidConfig", { message: "bad format" });
      expect(translation).toBe("Invalid configuration: bad format");
    });
  });
});
