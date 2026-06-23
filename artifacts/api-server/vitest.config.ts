import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // Integration tests hit the real dev database serially to keep owner-scope
    // assertions deterministic.
    fileParallelism: false,
    hookTimeout: 30000,
    testTimeout: 30000,
  },
});
