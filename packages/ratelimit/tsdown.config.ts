import { defineConfig } from "tsdown";

export default defineConfig({
  format: ["esm"],
  dts: {
    sourcemap: false,
    tsconfig: "tsconfig.build.json",
    incremental: true,
  },
  sourcemap: false,
  treeshake: true,
  minify: true,
  entry: ["./src/index.ts", "./src/config.ts"],
  clean: true,
  deps: {
    onlyBundle: false,
  },
});
