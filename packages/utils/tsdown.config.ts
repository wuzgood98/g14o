import { defineConfig } from "tsdown";

const shared = {
  format: "esm" as const,
  dts: { sourcemap: false },
  sourcemap: false,
  treeshake: true,
  minify: true,
  target: false,
  fixedExtension: false,
  root: "src",
};

const entries = ["src/utils.ts", "src/types.ts", "src/config.ts"];

export default defineConfig(
  entries.map((entry, index) => ({
    ...shared,
    entry,
    clean: index === 0,
  }))
);
