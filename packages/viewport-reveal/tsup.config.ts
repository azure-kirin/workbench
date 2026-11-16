import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/react.tsx"],
  format: ["esm"],
  dts: true,
  clean: true,
  target: "es2020",
  /*
   * Minification is off deliberately. `revealScriptSource()` ships the engine
   * by stringifying the built function, so whatever esbuild emits here is
   * what a reader sees in their page source — and the whole argument for the
   * inline script is that it is small and auditable. `keepNames` is off for
   * the opposite reason: it wraps functions in a `__name()` helper that lives
   * outside the stringified body and would throw the moment the inline script
   * ran. test/script.test.ts evaluates the generated string to keep that
   * honest.
   */
  minify: false,
  keepNames: false,
  splitting: true,
  sourcemap: true,
  treeshake: true,
  external: ["react", "react-dom"],
});
