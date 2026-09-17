import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/contracts/**/*.test.ts"],
    globalSetup: ["test/contracts/setup.ts"],
    testTimeout: 30000,
    hookTimeout: 30000,
  },
});
