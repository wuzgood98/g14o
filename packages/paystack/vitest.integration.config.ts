import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: false,
    restoreMocks: true,
    include: ["test/**/*.integration.test.ts"],
    exclude: ["**/node_modules/**"],
    setupFiles: ["test/integration.setup.ts"],
    testTimeout: 30_000,
  },
});
