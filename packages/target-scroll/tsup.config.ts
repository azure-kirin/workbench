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

export default defineConfig([
  {
    ...shared,
    entry: ["src/index.ts"],
    clean: true,
  },
]);
