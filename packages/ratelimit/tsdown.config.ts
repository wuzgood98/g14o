import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/index.ts"],
  format: "esm",
  dts: { sourcemap: false },
  clean: true,
  sourcemap: false,
  treeshake: true,
  minify: true,
  target: false,
  fixedExtension: false,
  root: "src",
});
