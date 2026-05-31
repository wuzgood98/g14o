import { defineConfig } from "tsup";

export default defineConfig({
  entry: [
    "src/utils.ts",
    "src/types.ts",
    "src/config.ts",
    "src/cache/index.ts",
    "src/ratelimit/index.ts",
  ],
  format: ["esm"],
  dts: true,
  clean: true,
  sourcemap: true,
  treeshake: true,
});
