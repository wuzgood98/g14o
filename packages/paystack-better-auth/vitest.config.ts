import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const packageRoot = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@g14o/paystack": path.resolve(packageRoot, "../paystack/src/index.ts"),
    },
  },
  test: {
    environment: "node",
    globals: false,
    restoreMocks: true,
    clearMocks: true,
    include: ["test/**/*.test.ts"],
    exclude: ["node_modules/**"],
    testTimeout: 10_000,
  },
});
