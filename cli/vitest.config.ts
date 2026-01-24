import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@src": resolve(__dirname, "./src"),
      "@test": resolve(__dirname, "./test"),
    },
  },
  test: {
    globals: true,
    environment: "node",
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html", "lcov"],
      exclude: [
        "node_modules/**",
        "dist/**",
        "test/**",
        "**/*.config.ts",
        "**/*.d.ts",
      ],
    },
    include: ["test/**/*.test.ts"],
  },
});
