import { defineConfig } from "tsdown";

export default defineConfig({
  format: "esm",
  dts: {
    sourcemap: false,
    tsconfig: "tsconfig.build.json",
  },
  treeshake: true,
  minify: true,
  sourcemap: false,
  target: false,
  fixedExtension: false,
  clean: true,
  deps: {
    neverBundle: ["better-auth", "zod"],
    skipNodeModulesBundle: true,
  },
  entry: {
    index: "src/index.ts",
    client: "src/client.ts",
  },
});
