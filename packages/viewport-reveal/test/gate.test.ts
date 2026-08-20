import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Reveal } from "../src/react.js";
import { REVEAL_ROOT_CLASS } from "../src/index.js";
import {
  addRevealTarget,
  installStylesheet,
  resetDocument,
  STYLESHEET,
} from "./helpers.js";

/**
 * Failure mode 1: a server-rendered `opacity: 0` hides content from every
 * reader that is not a browser running your JavaScript. These tests pin the
 * inversion that fixes it — the hidden state exists ONLY under the gate
 * class, and the gate class only exists if a script ran.
 */

let style: HTMLStyleElement | undefined;

beforeEach(() => {
  resetDocument();
  style = installStylesheet();
});

afterEach(() => {
  style?.remove();
  style = undefined;
  resetDocument();
});

describe("without the gate class", () => {
  it("the hidden rule does not select the element", () => {
    const el = addRevealTarget(5000);
    expect(el.matches(`html.${REVEAL_ROOT_CLASS} [data-reveal]`)).toBe(false);
  });

  it("nothing in the stylesheet makes the element transparent", () => {
    const el = addRevealTarget(5000);
    /* jsdom returns "" rather than the initial value for a property no rule
       sets — it does not resolve initial values — so "not 0" is the strongest
       honest assertion here. It is still the one that matters: the only way
       this element disappears is a rule setting opacity to 0, and none
       applies. */
    expect(getComputedStyle(el).opacity).not.toBe("0");
  });

  it("the mount variant is not animated either", () => {
    const el = addRevealTarget(5000, "data-reveal-mount");
    expect(el.matches(`html.${REVEAL_ROOT_CLASS} [data-reveal-mount]`)).toBe(
      false,
    );
  });
});

describe("with the gate class", () => {
  it("the hidden rule selects the element", () => {
    const el = addRevealTarget(5000);
    document.documentElement.classList.add(REVEAL_ROOT_CLASS);
    expect(el.matches(`html.${REVEAL_ROOT_CLASS} [data-reveal]`)).toBe(true);
  });

  it("the element computes as transparent until it is revealed", () => {
    const el = addRevealTarget(5000);
    document.documentElement.classList.add(REVEAL_ROOT_CLASS);
    expect(getComputedStyle(el).opacity).toBe("0");

    el.classList.add("vr-revealed");
    expect(getComputedStyle(el).opacity).toBe("1");
  });
});

describe("the server-rendered markup", () => {
  it("carries no hidden state of its own — no inline opacity, no hidden attribute", () => {
    const html = renderToStaticMarkup(
      Reveal({ children: "Content a crawler must be able to read" }),
    );
    expect(html).toContain("Content a crawler must be able to read");
    expect(html).not.toMatch(/opacity/i);
    expect(html).not.toMatch(/\bhidden\b/);
    expect(html).not.toMatch(/visibility\s*:/i);
    expect(html).not.toMatch(/display\s*:\s*none/i);
  });

  it("carries no hidden state even when a delay is set", () => {
    const html = renderToStaticMarkup(
      Reveal({ delay: 120, children: "still readable" }),
    );
    expect(html).toContain("still readable");
    expect(html).not.toMatch(/opacity/i);
  });
});

describe("the stylesheet's override contract", () => {
  it("declares no :root block, so a consumer's tokens win regardless of stylesheet order", () => {
    const withoutComments = STYLESHEET.replace(/\/\*[\s\S]*?\*\//g, "");
    expect(withoutComments).not.toMatch(/:root/);
  });

  it("reads every knob as var(--name, default), so it works with zero configuration", () => {
    const css = STYLESHEET.replace(/\/\*[\s\S]*?\*\//g, "");
    for (const knob of [
      "--vr-duration",
      "--vr-distance",
      "--vr-easing",
      "--vr-delay",
    ]) {
      const uses = css.match(new RegExp(`var\\(${knob}\\s*[,)]`, "g")) ?? [];
      expect(uses.length).toBeGreaterThan(0);
      for (const use of uses) expect(use.endsWith(",")).toBe(true);
    }
  });

  it("gates every hidden state behind the root class", () => {
    const declarations = STYLESHEET.replace(/\/\*[\s\S]*?\*\//g, "").match(
      /^[^@{}]*\[data-reveal[^{]*\{/gm,
    );
    expect(declarations).not.toBeNull();
    for (const selector of declarations ?? []) {
      expect(selector).toContain(`html.${REVEAL_ROOT_CLASS}`);
    }
  });
});
