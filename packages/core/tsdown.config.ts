import { defineConfig } from "tsdown";

export default defineConfig({
  format: "esm",
  dts: {
    sourcemap: false,
    tsconfig: "tsconfig.build.json",
  },
  sourcemap: false,
  treeshake: true,
  minify: false,
  target: false,
  fixedExtension: false,
  root: "src",
  entry: {
    utils: "src/utils.ts",
    types: "src/types.ts",
    config: "src/config.ts",
  },
  clean: true,
  deps: {
    neverBundle: ["@upstash/redis"],
    skipNodeModulesBundle: true,
  },
});
