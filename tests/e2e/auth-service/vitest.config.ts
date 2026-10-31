import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  test: {
    include: ["tests/e2e/auth-service/**/*.test.ts"],
    testTimeout: 30000,
    hookTimeout: 30000,
    environment: "node",
    globals: true,
    fileParallelism: false,
    reporters: ["default"],
  },
  resolve: {
    alias: {
      "@helpers": fileURLToPath(new URL("./helpers", import.meta.url)),
    },
  },
});
