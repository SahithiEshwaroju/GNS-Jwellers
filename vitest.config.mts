import { defineConfig } from "vitest/config";
import path from "node:path";
const __dirname = import.meta.dirname;

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "server-only": path.resolve(__dirname, "tests/stubs/server-only.ts"),
    },
  },
  test: {
    include: process.env.VITEST_INTEGRATION ? ["tests/integration/**/*.test.ts"] : ["tests/unit/**/*.test.ts"],
    environment: "node",
    testTimeout: 30_000,
    hookTimeout: 60_000,
    fileParallelism: !process.env.VITEST_INTEGRATION,
  },
});
