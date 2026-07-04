import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const packageRoot = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@g14o/ratelimit": path.resolve(packageRoot, "../core/src/index.ts"),
    },
  },
  test: {
    environment: "node",
    globals: false,
    restoreMocks: true,
    include: ["src/**/*.integration.test.ts"],
    exclude: ["**/node_modules/**"],
    setupFiles: ["src/integration.setup.ts"],
    testTimeout: 30_000,
  },
});
