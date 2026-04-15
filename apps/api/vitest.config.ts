import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globalSetup: [],
    setupFiles: ["./vitest.setup.ts"],
  },
});
