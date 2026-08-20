import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { initReveal } from "../src/index.js";
import {
  addRevealTarget,
  controlRaf,
  resetDocument,
  setReducedMotion,
  setTabHidden,
  setTop,
  setViewportHeight,
  type RafHarness,
} from "./helpers.js";

let raf: RafHarness;
let destroy: (() => void) | undefined;
const cleanups: Array<() => void> = [];

beforeEach(() => {
  resetDocument();
  setViewportHeight(800);
  raf = controlRaf();
});

afterEach(() => {
  destroy?.();
  destroy = undefined;
  while (cleanups.length) cleanups.pop()?.();
  raf.restore();
  resetDocument();
});

describe("the gate class", () => {
  it("is added, because the hidden state exists only under it", () => {
    destroy = initReveal();
    expect(document.documentElement.classList.contains("vr-js")).toBe(true);
  });

  it("is removed on teardown, so nothing is left hidden with no engine to un-hide it", () => {
    const stop = initReveal();
    expect(document.documentElement.classList.contains("vr-js")).toBe(true);
    stop();
    expect(document.documentElement.classList.contains("vr-js")).toBe(false);
  });
});

describe("fast scroll — an element that is already past the viewport", () => {
  it("still reveals, because the sweep asks 'are you above the fold line', not 'are you intersecting'", () => {
    const el = addRevealTarget(5000); // far below the fold at load
    destroy = initReveal();
    expect(el.classList.contains("vr-revealed")).toBe(false);

    /* The flick: between one frame and the next the element goes from below
       the fold to entirely above the top of the viewport. An
       IntersectionObserver that did not happen to sample in between reports
       nothing, and the element is stranded at opacity 0 forever. */
    setTop(el, -1200);
    window.dispatchEvent(new Event("scroll"));
    raf.flush();

    expect(el.classList.contains("vr-revealed")).toBe(true);
  });

  it("does not use IntersectionObserver at all", () => {
    const ctor = vi.fn();
    Object.defineProperty(window, "IntersectionObserver", {
      configurable: true,
      writable: true,
      value: ctor,
    });
    cleanups.push(() => {
      delete (window as { IntersectionObserver?: unknown }).IntersectionObserver;
    });

    addRevealTarget(5000);
    destroy = initReveal();
    window.dispatchEvent(new Event("scroll"));
    raf.flush();

    expect(ctor).not.toHaveBeenCalled();
  });

  it("reveals an element that is only partly on screen, at the fold line", () => {
    const el = addRevealTarget(790); // 10px above the bottom edge of an 800px viewport
    destroy = initReveal();
    // Default offset is 24, so the fold line sits at 776 and 790 is below it.
    expect(el.classList.contains("vr-revealed")).toBe(false);

    setTop(el, 700);
    window.dispatchEvent(new Event("scroll"));
    raf.flush();
    expect(el.classList.contains("vr-revealed")).toBe(true);
  });

  it("honours a custom fold offset", () => {
    const el = addRevealTarget(600);
    destroy = initReveal({ offset: 300 }); // fold line at 500
    expect(el.classList.contains("vr-revealed")).toBe(false);

    setTop(el, 400);
    window.dispatchEvent(new Event("scroll"));
    raf.flush();
    expect(el.classList.contains("vr-revealed")).toBe(true);
  });
});

describe("reduced motion", () => {
  it("hides nothing at all — the gate class is never added, so there is no animation rather than a fast one", () => {
    cleanups.push(setReducedMotion(true));

    const el = addRevealTarget(-1200);
    destroy = initReveal();

    expect(document.documentElement.classList.contains("vr-js")).toBe(false);
    expect(el.matches("html.vr-js [data-reveal]")).toBe(false);

    window.dispatchEvent(new Event("scroll"));
    raf.flush();
    expect(el.classList.contains("vr-revealed")).toBe(false);
  });

  it("runs normally when the preference is not set", () => {
    cleanups.push(setReducedMotion(false));
    const el = addRevealTarget(100);
    destroy = initReveal();
    expect(document.documentElement.classList.contains("vr-js")).toBe(true);
    expect(el.classList.contains("vr-revealed")).toBe(true);
  });
});

describe("a tab that was in the background", () => {
  it("sweeps directly on visibilitychange, because rAF is frozen while hidden", () => {
    const el = addRevealTarget(5000);
    cleanups.push(setTabHidden(true));
    destroy = initReveal();
    expect(el.classList.contains("vr-revealed")).toBe(false);

    /* Scroll restoration in a background tab: the position moves, the scroll
       event fires, a frame is requested — and never runs. */
    setTop(el, 100);
    window.dispatchEvent(new Event("scroll"));
    expect(raf.pending()).toBe(1);
    expect(el.classList.contains("vr-revealed")).toBe(false);

    // The reader comes back. Nothing may depend on a frame here.
    cleanups.push(setTabHidden(false));
    document.dispatchEvent(new Event("visibilitychange"));

    expect(el.classList.contains("vr-revealed")).toBe(true);
    expect(raf.pending()).toBe(1); // still unrun: the reveal did not come from a frame
  });

  it("does not sweep while the tab is still hidden", () => {
    const el = addRevealTarget(5000);
    cleanups.push(setTabHidden(true));
    destroy = initReveal();

    setTop(el, 100);
    document.dispatchEvent(new Event("visibilitychange"));
    expect(el.classList.contains("vr-revealed")).toBe(false);
  });

  it("sweeps directly on pageshow, for a bfcache restore", () => {
    const el = addRevealTarget(5000);
    destroy = initReveal();

    setTop(el, 100);
    window.dispatchEvent(new Event("pageshow"));

    expect(el.classList.contains("vr-revealed")).toBe(true);
    expect(raf.pending()).toBe(0);
  });
});

describe("elements that arrive later", () => {
  it("reveals a node inserted after start, so the wrapper needs no JavaScript of its own", async () => {
    destroy = initReveal();

    const branch = document.createElement("section");
    const el = document.createElement("div");
    el.setAttribute("data-reveal", "");
    branch.appendChild(el);
    document.body.appendChild(branch);
    setTop(el, 100);

    await new Promise((resolve) => setTimeout(resolve, 0));
    raf.flush();

    expect(el.classList.contains("vr-revealed")).toBe(true);
  });

  it("reveals a node that is itself the inserted root", async () => {
    destroy = initReveal();

    const el = document.createElement("div");
    el.setAttribute("data-reveal", "");
    document.body.appendChild(el);
    setTop(el, 100);

    await new Promise((resolve) => setTimeout(resolve, 0));
    raf.flush();

    expect(el.classList.contains("vr-revealed")).toBe(true);
  });
});

describe("the pending set", () => {
  it("only shrinks — a revealed element is never swept again", () => {
    const a = addRevealTarget(100);
    const b = addRevealTarget(5000);
    destroy = initReveal();
    expect(a.classList.contains("vr-revealed")).toBe(true);

    a.classList.remove("vr-revealed"); // if it were still pending, a sweep would re-add it
    setTop(b, 100);
    window.dispatchEvent(new Event("scroll"));
    raf.flush();

    expect(b.classList.contains("vr-revealed")).toBe(true);
    expect(a.classList.contains("vr-revealed")).toBe(false);
  });

  it("drops elements removed from the document without throwing", () => {
    const el = addRevealTarget(5000);
    destroy = initReveal();
    el.remove();

    window.dispatchEvent(new Event("scroll"));
    expect(() => raf.flush()).not.toThrow();
  });
});

describe("teardown", () => {
  it("stops responding to scroll", () => {
    const el = addRevealTarget(5000);
    const stop = initReveal();
    stop();

    setTop(el, 100);
    window.dispatchEvent(new Event("scroll"));
    raf.flush();

    expect(el.classList.contains("vr-revealed")).toBe(false);
  });
});
