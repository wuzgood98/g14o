import { defineConfig } from "tsdown";

export default defineConfig({
  format: ["esm"],
  tsconfig: "tsconfig.build.json",
  dts: {
    sourcemap: false,
    tsconfig: "tsconfig.build.json",
    incremental: true,
    compilerOptions: {
      removeComments: true,
    },
  },
  treeshake: true,
  entry: [
    "./src/index.ts",
    "./src/client/index.ts",
    "./src/handler.ts",
    "./src/observability.ts",
    "./src/stream.ts",
    "./src/memory.ts",
    "./src/redis.ts",
    "./src/upstash.ts",
  ],
  deps: {
    onlyBundle: false,
  },
});
