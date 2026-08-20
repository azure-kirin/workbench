import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/cli.ts"],
  format: ["esm"],
  dts: { entry: "src/index.ts" },
  clean: true,
  target: "es2022",
  /*
   * The DOM probes in src/probes.ts are handed to Playwright's
   * page.evaluate(), which serialises them with Function.prototype.toString()
   * and re-parses the result inside the page. Anything the bundler hoists out
   * of a probe body — a shared helper, a renamed binding, esbuild's
   * `keepNames` __name() wrapper — lives outside the string and throws a
   * ReferenceError in the page while every unit test still passes. So: no
   * minification, no keepNames, no code splitting between the two entries.
   * test/probes.test.ts pins this against the built artifact.
   */
  minify: false,
  keepNames: false,
  splitting: false,
  sourcemap: true,
  treeshake: true,
  external: ["playwright"],
});
