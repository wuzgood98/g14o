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
  root: "src",
  entry: {
    utils: "src/utils.ts",
    types: "src/types.ts",
    config: "src/config.ts",
    "cache/index": "src/cache/index.ts",
    "ratelimit/index": "src/ratelimit/index.ts",
  },
  clean: true,
  deps: {
    neverBundle: [
      "@upstash/redis",
      "@upstash/ratelimit",
      "next",
      "next/server",
    ],
    skipNodeModulesBundle: true,
  },
});
