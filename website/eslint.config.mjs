import path from "node:path";
import { fileURLToPath } from "node:url";
import { FlatCompat } from "@eslint/eslintrc";
import { defineConfig, globalIgnores } from "eslint/config";
import prettier from "eslint-config-prettier/flat";
import eslintPluginPrettier from "eslint-plugin-prettier";

const configDir = path.dirname(fileURLToPath(import.meta.url));

const compat = new FlatCompat({
  baseDirectory: configDir,
});

const nextConfigs = compat
  .extends("next/core-web-vitals", "next/typescript")
  .map((config) => {
    const languageOptions =
      config.languageOptions && typeof config.languageOptions === "object"
        ? config.languageOptions
        : {};
    const parserOptions =
      "parserOptions" in languageOptions &&
      languageOptions.parserOptions &&
      typeof languageOptions.parserOptions === "object"
        ? languageOptions.parserOptions
        : {};

    return {
      ...config,
      languageOptions: {
        ...languageOptions,
        parserOptions: {
          ...parserOptions,
          tsconfigRootDir: configDir,
        },
      },
    };
  });

export default defineConfig(
  // Next.js Core Web Vitals config (includes React, React Hooks, Next.js, and TypeScript rules)
  ...nextConfigs,

  // Prettier config (disables conflicting ESLint rules)
  prettier,

  // Global ignores
  globalIgnores([
    // Default Next.js ignores
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Additional ignores
    "public/_pagefind/**",
    "node_modules/**",
    ".git/**",
  ]),

  // Custom rules for JS/TS files
  {
    files: ["**/*.{js,mjs,cjs,jsx,ts,tsx}"],
    plugins: {
      prettier: eslintPluginPrettier,
    },
    settings: {
      next: {
        rootDir: configDir,
      },
    },
    rules: {
      // Import rules (plugin already loaded by next/core-web-vitals)
      "import/no-anonymous-default-export": "warn",
      "import/order": [
        "warn",
        {
          groups: [
            "builtin",
            "external",
            "internal",
            "parent",
            "sibling",
            "index",
          ],
          "newlines-between": "never",
          alphabetize: {
            order: "asc",
            caseInsensitive: true,
          },
        },
      ],

      // React rules overrides
      "react/no-unknown-property": "off", // For Three.js props

      // Prettier
      "prettier/prettier": "warn",
    },
  },

  // TypeScript-specific rules (without re-extending tseslint configs)
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: configDir,
      },
    },
    rules: {
      // TypeScript rules
      "@typescript-eslint/triple-slash-reference": "off",
      "@typescript-eslint/array-type": "off",
      "@typescript-eslint/consistent-type-definitions": "off",
      "@typescript-eslint/consistent-type-imports": [
        "warn",
        {
          prefer: "type-imports",
          fixStyle: "inline-type-imports",
        },
      ],
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      "@typescript-eslint/require-await": "off",
      "@typescript-eslint/no-misused-promises": [
        "error",
        {
          checksVoidReturn: {
            attributes: false,
          },
        },
      ],
      "@typescript-eslint/prefer-nullish-coalescing": "off",
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unnecessary-condition": "off",
    },
  },

  // JSON and JSONC files
  {
    files: ["**/*.{json,jsonc}"],
    plugins: {
      prettier: eslintPluginPrettier,
    },
    rules: {
      "@typescript-eslint/no-unused-expressions": "off",
      "no-unused-expressions": "off",
      "prettier/prettier": "warn",
    },
  },

  // Markdown files - ignore by default
  {
    files: ["**/*.md"],
    rules: {
      // Disable all rules for markdown
    },
  },

  // Linter options
  {
    linterOptions: {
      reportUnusedDisableDirectives: "warn",
    },
  },
);
