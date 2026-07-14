import { defineConfig } from "tsdown";

export default defineConfig({
  format: ["esm"],
  dts: {
    sourcemap: false,
    tsconfig: "tsconfig.build.json",
    incremental: true,
  },
  treeshake: true,
  entry: ["./src/index.ts", "./src/config.ts", "./src/types.ts"],
  deps: {
    onlyBundle: false,
  },
});
