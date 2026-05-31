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

const entries = [
  "src/utils.ts",
  "src/types.ts",
  "src/config.ts",
  "src/cache/index.ts",
  "src/ratelimit/index.ts",
];

export default defineConfig(
  entries.map((entry, index) => {
    const isFirstEntry = index === 0;
    return {
      ...shared,
      entry,
      clean: isFirstEntry,
    };
  })
);
