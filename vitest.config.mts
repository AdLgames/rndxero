import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": import.meta.dirname,
    },
  },
  test: {
    include: ["tests/**/*.test.ts"],
    setupFiles: ["dotenv/config"],
    // Integration test files share tables and TRUNCATE them between tests;
    // running files in parallel races those truncates against each other.
    fileParallelism: false,
  },
});
