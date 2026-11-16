import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Assertions about the published artifact rather than the source. Both of the
 * things checked here are properties of the build configuration that source
 * tests cannot see and that a config change could silently take away — and in
 * both cases the failure would appear only in a consumer's app.
 */

/* Resolved from the package root — `import.meta.url` under the jsdom
   environment is a page URL, not a file one. */
const dist = (file: string) =>
  readFileSync(resolve(process.cwd(), "dist", file), "utf8");

describe("the built React entry", () => {
  it('starts with "use client", exactly once', () => {
    /* `<ScrollLink>` has an event handler, so a React Server Components app
       must be told it is a client module. The directive lives at the top of
       src/react.tsx and survives only while tsup's rollup tree-shaking pass
       is off for that entry — see tsup.config.ts. */
    const source = dist("react.js");
    expect(source.split("\n")[0]).toBe('"use client";');
    expect(source.match(/"use client";/g)).toHaveLength(1);
  });

  it("imports the core rather than inlining it", () => {
    /* The engine keeps the animation in flight in module state. A second
       inlined copy would mean two registries, and cancelling through one
       entry would not stop an animation started through the other. */
    const source = dist("react.js");
    expect(source).toContain('from "./index.js"');
    expect(source).not.toContain("requestAnimationFrame");
  });
});

describe("the built core entry", () => {
  it('carries no "use client" — a server component may import it', () => {
    expect(dist("index.js")).not.toContain("use client");
  });

  it("imports nothing at all", () => {
    /* No dependencies, and no React. */
    expect(dist("index.js")).not.toMatch(/^import /m);
  });

  it("ships types for both entries", () => {
    expect(dist("index.d.ts")).toContain("declare function scrollToTarget");
    expect(dist("react.d.ts")).toContain("declare function ScrollLink");
  });
});
