import { defineConfig } from "tsdown";

export default defineConfig({
  format: ["esm"],
  dts: {
    sourcemap: false,
    tsconfig: "tsconfig.build.json",
    incremental: true,
  },
  treeshake: true,
  entry: [
    "./src/index.ts",
    "./src/store/memory.ts",
    "./src/store/upstash.ts",
    "./src/store/redis.ts",
  ],
  deps: {
    onlyBundle: false,
  },
});
