import { describe, it, expect } from "vitest";
import {
  preserveEnvVars,
  normalizeEnvVar,
  extractEnvVars,
} from "@src/utils/env-vars.js";

describe("Environment Variable Utilities", () => {
  describe("preserveEnvVars", () => {
    it("should preserve ${env:VAR} format", () => {
      const input = { TOKEN: "${env:GITHUB_TOKEN}" };
      const result = preserveEnvVars(input);

      expect(result.TOKEN).toBe("${env:GITHUB_TOKEN}");
    });

    it("should preserve ${VAR} format", () => {
      const input = { DATABASE_URL: "${DATABASE_URL}" };
      const result = preserveEnvVars(input);

      expect(result.DATABASE_URL).toBe("${DATABASE_URL}");
    });

    it("should preserve ${workspaceFolder} format", () => {
      const input = { PATH: "${workspaceFolder}/data" };
      const result = preserveEnvVars(input);

      expect(result.PATH).toBe("${workspaceFolder}/data");
    });

    it("should handle mixed env vars in one value", () => {
      const input = {
        CONN: "postgres://${env:USER}:${env:PASS}@localhost",
      };
      const result = preserveEnvVars(input);

      expect(result.CONN).toBe("postgres://${env:USER}:${env:PASS}@localhost");
    });

    it("should handle nested objects", () => {
      const input = {
        level1: {
          level2: {
            TOKEN: "${env:TOKEN}",
          },
        },
      };
      const result = preserveEnvVars(input);

      expect(result.level1.level2.TOKEN).toBe("${env:TOKEN}");
    });

    it("should handle arrays", () => {
      const input = {
        paths: ["${workspaceFolder}/src", "${workspaceFolder}/lib"],
      };
      const result = preserveEnvVars(input);

      expect(result.paths[0]).toBe("${workspaceFolder}/src");
      expect(result.paths[1]).toBe("${workspaceFolder}/lib");
    });

    it("should not expand actual environment variables", () => {
      process.env.TEST_VAR = "should-not-appear";
      const input = { VAR: "${env:TEST_VAR}" };
      const result = preserveEnvVars(input);

      expect(result.VAR).toBe("${env:TEST_VAR}");
      expect(result.VAR).not.toContain("should-not-appear");
      delete process.env.TEST_VAR;
    });

    it("should handle plain string values", () => {
      const input = { PLAIN: "just a string" };
      const result = preserveEnvVars(input);

      expect(result.PLAIN).toBe("just a string");
    });

    it("should handle undefined and null", () => {
      const input = {
        undef: undefined,
        nul: null,
      };
      const result = preserveEnvVars(input);

      expect(result.undef).toBeUndefined();
      expect(result.nul).toBeNull();
    });
  });

  describe("normalizeEnvVar", () => {
    it("should convert ${env:VAR} to ${VAR} for OpenCode", () => {
      const result = normalizeEnvVar("${env:TOKEN}", "opencode");
      expect(result).toBe("${TOKEN}");
    });

    it("should convert ${VAR} to ${env:VAR} for Claude Code", () => {
      const result = normalizeEnvVar("${VAR}", "claude-code");
      expect(result).toBe("${env:VAR}");
    });

    it("should convert ${VAR} to ${env:VAR} for Cursor", () => {
      const result = normalizeEnvVar("${VAR}", "cursor");
      expect(result).toBe("${env:VAR}");
    });

    it("should handle ${workspaceFolder} for all tools", () => {
      expect(normalizeEnvVar("${workspaceFolder}/data", "cursor")).toBe(
        "${workspaceFolder}/data"
      );
      expect(normalizeEnvVar("${workspaceFolder}/data", "claude-code")).toBe(
        "${workspaceFolder}/data"
      );
      expect(normalizeEnvVar("${workspaceFolder}/data", "opencode")).toBe(
        "${workspaceFolder}/data"
      );
    });

    it("should handle ${userHome} for all tools", () => {
      expect(normalizeEnvVar("${userHome}/.config", "cursor")).toBe(
        "${userHome}/.config"
      );
    });

    it("should handle multiple vars in one string", () => {
      const input = "postgres://${env:USER}:${env:PASS}@localhost";
      const result = normalizeEnvVar(input, "opencode");
      expect(result).toBe("postgres://${USER}:${PASS}@localhost");
    });

    it("should not modify plain strings", () => {
      const plain = "just a string";
      expect(normalizeEnvVar(plain, "cursor")).toBe(plain);
      expect(normalizeEnvVar(plain, "opencode")).toBe(plain);
    });

    it("should handle empty strings", () => {
      expect(normalizeEnvVar("", "cursor")).toBe("");
    });
  });

  describe("extractEnvVars", () => {
    it("should extract ${env:VAR} variables", () => {
      const text = "Connection: ${env:DB_HOST}:${env:DB_PORT}";
      const vars = extractEnvVars(text);

      expect(vars).toContain("DB_HOST");
      expect(vars).toContain("DB_PORT");
      expect(vars).toHaveLength(2);
    });

    it("should extract ${VAR} variables", () => {
      const text = "Path: ${HOME}/.config";
      const vars = extractEnvVars(text);

      expect(vars).toContain("HOME");
    });

    it("should ignore ${workspaceFolder} and similar", () => {
      const text = "${workspaceFolder}/src and ${env:TOKEN}";
      const vars = extractEnvVars(text);

      expect(vars).toContain("TOKEN");
      expect(vars).not.toContain("workspaceFolder");
      expect(vars).toHaveLength(1);
    });

    it("should return unique variables", () => {
      const text = "${env:TOKEN} and ${env:TOKEN} and ${TOKEN}";
      const vars = extractEnvVars(text);

      expect(vars).toContain("TOKEN");
      expect(vars).toHaveLength(1);
    });

    it("should return empty array for no variables", () => {
      const text = "Just plain text";
      const vars = extractEnvVars(text);

      expect(vars).toEqual([]);
    });

    it("should handle complex nested structure", () => {
      const obj = {
        env: {
          DB: "${env:DATABASE_URL}",
          TOKEN: "${API_TOKEN}",
        },
        path: "${workspaceFolder}/data",
      };
      const text = JSON.stringify(obj);
      const vars = extractEnvVars(text);

      expect(vars).toContain("DATABASE_URL");
      expect(vars).toContain("API_TOKEN");
      expect(vars).not.toContain("workspaceFolder");
    });
  });
});
