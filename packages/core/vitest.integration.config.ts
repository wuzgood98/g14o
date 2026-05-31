import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: false,
    restoreMocks: true,
    include: ["src/**/*.integration.test.ts"],
    exclude: ["**/node_modules/**"],
    setupFiles: [
      "src/cache/integration.setup.ts",
      "src/ratelimit/integration.setup.ts",
    ],
    testTimeout: 30_000,
  },
});
