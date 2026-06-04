import { defineConfig } from "tsdown";

export default defineConfig({
  format: "esm",
  dts: {
    sourcemap: false,
    tsconfig: "tsconfig.build.json",
  },
  sourcemap: false,
  treeshake: true,
  minify: true,
  target: false,
  fixedExtension: false,
  entry: {
    index: "src/index.ts",
  },
  clean: true,
  deps: {
    skipNodeModulesBundle: true,
  },
});
