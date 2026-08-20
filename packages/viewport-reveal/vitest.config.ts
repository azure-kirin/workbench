import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    include: ["test/**/*.test.{ts,tsx}"],
    restoreMocks: true,
    /* Vitest stubs CSS imports by default, which would hand the tests an
       empty string where the shipped stylesheet should be. The gate tests
       assert against the real file, so CSS has to be processed. */
    css: true,
  },
  esbuild: {
    jsx: "automatic",
  },
});
