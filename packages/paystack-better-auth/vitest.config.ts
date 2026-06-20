import { defineConfig } from "vitest/config";

export default defineConfig({
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
