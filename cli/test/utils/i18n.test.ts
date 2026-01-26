import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  detectSystemLanguage,
  loadLanguage,
  t,
  setLanguage,
  getCurrentLanguage,
} from "@src/utils/i18n.js";

describe("i18n Utilities", () => {
  afterEach(async () => {
    // Reset to English after each test
    await loadLanguage("en");
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

    it("should handle already loaded translations", async () => {
      // Translations are now compile-time imports, so they're always available
      await loadLanguage("en");
      const translation = t("common.yes");
      expect(translation).toBe("Yes");
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
      expect(translation).toBe("🎯 vsync initialization");
    });

    it("should interpolate single parameter", () => {
      const translation = t("commands.sync.reading", { tool: "claude-code" });
      expect(translation).toBe("Reading claude-code configuration...");
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
      expect(translation).toBe("Reading {tool} configuration...");
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

    it("should work with compile-time imported translations", async () => {
      // Translations are now compile-time imports (more efficient)
      await loadLanguage("en");
      const translation = t("common.yes");
      expect(translation).toBe("Yes");

      await setLanguage("zh");
      const zhTranslation = t("common.yes");
      expect(zhTranslation).toBe("是");
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
