import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { revealScriptSource as sourceFromSrc } from "../src/script.js";
// The built artifact, on purpose: the inline script is produced by calling
// `.toString()` on a bundled function, so the only way to know it is still
// self-contained is to check what the bundler actually emitted. `pretest`
// builds before this runs.
import { revealScriptSource as sourceFromDist } from "../dist/index.js";
import {
  addRevealTarget,
  controlRaf,
  installStylesheet,
  resetDocument,
  setTop,
  setViewportHeight,
  type RafHarness,
} from "./helpers.js";

const variants: Array<[string, typeof sourceFromSrc]> = [
  ["source", sourceFromSrc],
  ["built artifact", sourceFromDist],
];

let raf: RafHarness;

beforeEach(() => {
  resetDocument();
  setViewportHeight(800);
  raf = controlRaf();
});

afterEach(() => {
  raf.restore();
  resetDocument();
});

describe.each(variants)("revealScriptSource — %s", (_label, revealScriptSource) => {
  it("evaluates in a bare scope, proving nothing was hoisted out of the function", () => {
    const source = revealScriptSource();
    /* `new Function` gives the script a scope with no module bindings in it,
       which is what an inline <script> gets. If the bundler had lifted a
       constant, a helper, or a `__name()` wrapper out of the engine body,
       this throws a ReferenceError — the exact failure a reader would hit in
       production and never see in a unit test that imported the function. */
    expect(() => new Function(source)()).not.toThrow();
  });

  it("actually reveals an in-view element when evaluated", () => {
    installStylesheet();
    const el = addRevealTarget(5000);
    new Function(revealScriptSource())();

    expect(document.documentElement.classList.contains("vr-js")).toBe(true);
    expect(getComputedStyle(el).opacity).toBe("0");

    setTop(el, 100);
    window.dispatchEvent(new Event("scroll"));
    raf.flush();

    expect(el.classList.contains("vr-revealed")).toBe(true);
    expect(getComputedStyle(el).opacity).toBe("1");
  });

  it("carries the names the stylesheet keys on, so the two cannot drift apart", () => {
    const source = revealScriptSource();
    expect(source).toContain('"vr-js"');
    expect(source).toContain('"vr-revealed"');
    expect(source).toContain("data-reveal");
  });

  it("passes options through as serialised literals", () => {
    expect(revealScriptSource({ offset: 96 })).toContain('{"offset":96}');
    expect(revealScriptSource()).toContain("{}");
  });

  it("respects a custom offset once evaluated", () => {
    const el = addRevealTarget(600);
    new Function(revealScriptSource({ offset: 300 }))(); // fold line at 500
    expect(el.classList.contains("vr-revealed")).toBe(false);

    setTop(el, 400);
    window.dispatchEvent(new Event("scroll"));
    raf.flush();
    expect(el.classList.contains("vr-revealed")).toBe(true);
  });

  it("cannot break out of the <script> element it is inlined into", () => {
    expect(revealScriptSource().toLowerCase()).not.toContain("</script");
  });
});

describe("the two variants", () => {
  it("agree on behaviour", () => {
    // Not a text comparison — the bundler is allowed to reformat. What must
    // hold is that both are valid, self-contained, and carry the same
    // contract literals, which the shared cases above assert for each.
    expect(typeof sourceFromSrc()).toBe("string");
    expect(typeof sourceFromDist()).toBe("string");
    expect(sourceFromDist().length).toBeLessThan(8000);
  });
});
