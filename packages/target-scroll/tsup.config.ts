import { defineConfig, type Options } from "tsup";

const shared: Options = {
  format: ["esm"],
  target: "es2020",
  dts: true,
  sourcemap: true,
  treeshake: true,
  /* Not minified. It is ~5 kB of code whose entire value is the reasoning in
     the comments; anyone evaluating whether to depend on it will read the
     built file at least once, and their own bundler will minify it anyway. */
  minify: false,
};

/*
 * Two builds rather than one, for one reason: `"use client"` has to survive
 * onto `dist/react.js` and must NOT appear on `dist/index.js` — the core is
 * plain DOM code that a server component may legitimately import. The setting
 * that preserves the directive (`treeshake: false`) is per-config, not
 * per-entry, so the entries are separate configs.
 *
 * The cost of splitting the build is that `src/react.tsx` could end up with
 * its own inlined copy of the engine, and the engine has module state (the
 * animation in flight). Two copies would mean two registries, and
 * `cancelScroll()` from one entry would not stop an animation started by the
 * other. So the core is marked external in the React build and stays a real
 * `import "./index.js"` in the output. test/build.test.ts pins both halves.
 */
export default defineConfig([
  {
    ...shared,
    entry: ["src/index.ts"],
    clean: true,
  },
  {
    ...shared,
    entry: ["src/react.tsx"],
    clean: false,
    external: ["react", "react-dom", "./index.js"],
    /* `"use client"` is written at the top of src/react.tsx and esbuild carries
       it through — but ONLY with tsup's optional rollup tree-shaking pass off.
       That pass drops module-level directives ("Module level directives cause
       errors when bundled"), and the React entry would arrive at a consumer's
       server component without the marker it needs. esbuild's own dead-code
       elimination is all a fifty-line entry wants anyway.
       test/build.test.ts asserts the directive is there, exactly once. */
    treeshake: false,
  },
]);
