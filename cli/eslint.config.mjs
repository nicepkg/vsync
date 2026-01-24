// @ts-check
import path from "path";
import { fileURLToPath } from "url";
import { defineConfig, globalIgnores } from "eslint/config";
import prettier from "eslint-config-prettier/flat";
import eslintPluginImport from "eslint-plugin-import";
import eslintPluginPrettier from "eslint-plugin-prettier";
import eslintPluginUnusedImports from "eslint-plugin-unused-imports";
import jsoncParser from "jsonc-eslint-parser";
import tseslint from "typescript-eslint";

const configDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(
  // Prettier config (disables conflicting ESLint rules)
  prettier,

  // Global ignores
  globalIgnores(["dist/**", "node_modules/**", ".git/**", "coverage/**"]),

  // Base config for all JavaScript files
  {
    files: ["**/*.{js,mjs,cjs}"],
    plugins: {
      prettier: eslintPluginPrettier,
    },
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        console: "readonly",
        process: "readonly",
        __dirname: "readonly",
        __filename: "readonly",
      },
    },
    rules: {
      "prettier/prettier": [
        "error",
        {
          singleQuote: false,
          endOfLine: "auto",
        },
      ],
    },
  },

  // TypeScript recommended configs
  ...tseslint.configs.recommended.map((config) => ({
    ...config,
    files: ["**/*.{ts,mts}"],
  })),

  // TypeScript files config
  {
    files: ["**/*.{ts,mts}"],
    plugins: {
      "@typescript-eslint": tseslint.plugin,
      "unused-imports": eslintPluginUnusedImports,
      prettier: eslintPluginPrettier,
      import: eslintPluginImport,
    },
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: configDir,
      },
      globals: {
        console: "readonly",
        process: "readonly",
        __dirname: "readonly",
        __filename: "readonly",
      },
    },
    settings: {
      "import/resolver": {
        typescript: {
          project: "./tsconfig.json",
        },
        node: {
          extensions: [".js", ".ts"],
        },
      },
    },
    rules: {
      // Prettier
      "prettier/prettier": [
        "error",
        {
          singleQuote: false,
          endOfLine: "auto",
        },
      ],

      // Import rules
      "import/extensions": "off",
      "import/prefer-default-export": "off",
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
      "import/no-cycle": "off",
      "import/no-extraneous-dependencies": "off",

      // TypeScript rules
      "@typescript-eslint/no-unused-vars": "off", // Use unused-imports instead
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/consistent-type-imports": [
        "warn",
        {
          prefer: "type-imports",
          fixStyle: "inline-type-imports",
        },
      ],

      // Unused imports plugin
      "unused-imports/no-unused-imports": "error",
      "unused-imports/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
        },
      ],
    },
  },

  // JSON and JSONC files
  {
    files: ["**/*.{json,jsonc}"],
    plugins: {
      prettier: eslintPluginPrettier,
    },
    languageOptions: {
      parser: jsoncParser,
    },
    rules: {
      "@typescript-eslint/no-unused-expressions": "off",
      "no-unused-expressions": "off",
      "prettier/prettier": "warn",
    },
  },

  // Linter options
  {
    linterOptions: {
      reportUnusedDisableDirectives: "warn",
    },
  },
);
