import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: [
      { find: "server-only", replacement: path.resolve("tests/stubs/server-only.ts") },
      { find: /^@\//, replacement: path.resolve(".") + "/" },
    ],
  },
  test: { include: ["tests/**/*.test.ts"], setupFiles: ["tests/setup.ts"] },
});
