import { defineConfig } from "tsdown";

export default defineConfig({
  format: "esm",
  dts: {
    sourcemap: false,
    tsconfig: "tsconfig.build.json",
    incremental: true,
  },
  treeshake: true,
  target: false,
  fixedExtension: false,
  root: "src",
  entry: {
    utils: "src/utils.ts",
    types: "src/types.ts",
    config: "src/config.ts",
  },
  deps: {
    neverBundle: ["@upstash/redis"],
    skipNodeModulesBundle: true,
  },
});
