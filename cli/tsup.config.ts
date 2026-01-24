import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: true,
  clean: true,
  shims: true,
  minify: false,
  sourcemap: true,
  treeshake: true,
  splitting: false,
  outDir: "dist",
  target: "node24",
  platform: "node",
  // Bundle all dependencies for faster npx usage
  noExternal: [/.*/],
});
