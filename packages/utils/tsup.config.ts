import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/utils.ts", "src/types.ts", "src/config.ts"],
  format: ["esm"],
  dts: true,
  clean: true,
  sourcemap: true,
  treeshake: true,
});
