import { defineConfig } from "tsdown";

export default defineConfig({
  deps: {
    onlyBundle: false,
  },
  format: ["esm"],
  dts: {
    sourcemap: false,
    tsconfig: "tsconfig.build.json",
    incremental: true,
  },
  treeshake: true,
  entry: ["./src/index.ts", "./src/client.ts"],
});
