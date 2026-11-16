import STYLESHEET_SOURCE from "../styles.css?raw";

/**
 * The engine's questions about the world are: what does matchMedia say, how
 * tall is the viewport, where is this element's top, is the tab hidden, and
 * does rAF fire. jsdom answers three of those wrongly or not at all, so each
 * one is controlled here rather than inside the tests.
 */

/** jsdom never lays anything out: every rect is 0×0 at 0,0. Give one element a top. */
export function setTop(el: Element, top: number): void {
  Object.defineProperty(el, "getBoundingClientRect", {
    configurable: true,
    value: () => ({
      top,
      bottom: top + 100,
      left: 0,
      right: 100,
      width: 100,
      height: 100,
      x: 0,
      y: top,
      toJSON: () => ({}),
    }),
  });
}

export type RafHarness = {
  /** Run every frame callback queued so far. */
  flush(): void;
  /** How many frame callbacks are queued and unrun — the "frozen tab" measure. */
  pending(): number;
  restore(): void;
};

/**
 * Replaces requestAnimationFrame with a queue nothing drains automatically,
 * so a test can decide whether frames happen at all. A tab in the background
 * is exactly this: callbacks queued, never called.
 */
export function controlRaf(): RafHarness {
  const original = globalThis.requestAnimationFrame;
  let queue: FrameRequestCallback[] = [];
  globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) => {
    queue.push(cb);
    return queue.length;
  }) as typeof globalThis.requestAnimationFrame;
  return {
    flush() {
      const due = queue;
      queue = [];
      for (const cb of due) cb(0);
    },
    pending: () => queue.length,
    restore() {
      globalThis.requestAnimationFrame = original;
      queue = [];
    },
  };
}

/** jsdom has no matchMedia at all, which is itself a case the engine must survive. */
export function setReducedMotion(reduce: boolean): () => void {
  const had = "matchMedia" in window;
  const original = window.matchMedia;
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      matches: reduce && query.includes("prefers-reduced-motion"),
      media: query,
      onchange: null,
      addListener() {},
      removeListener() {},
      addEventListener() {},
      removeEventListener() {},
      dispatchEvent: () => false,
    }),
  });
  return () => {
    if (had) {
      Object.defineProperty(window, "matchMedia", {
        configurable: true,
        writable: true,
        value: original,
      });
    } else {
      delete (window as { matchMedia?: unknown }).matchMedia;
    }
  };
}

export function setTabHidden(hidden: boolean): () => void {
  Object.defineProperty(document, "hidden", {
    configurable: true,
    get: () => hidden,
  });
  return () => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      get: () => false,
    });
  };
}

export function setViewportHeight(height: number): void {
  Object.defineProperty(window, "innerHeight", {
    configurable: true,
    writable: true,
    value: height,
  });
}

/** Puts a `[data-reveal]` element in the document at a known scroll position. */
export function addRevealTarget(top: number, attr = "data-reveal"): HTMLElement {
  const el = document.createElement("div");
  el.setAttribute(attr, "");
  document.body.appendChild(el);
  setTop(el, top);
  return el;
}

/**
 * Replaces `<body>` outright rather than emptying it. Some tests evaluate the
 * shipped inline script, which has no teardown handle by design — an inline
 * script in a real page never needs one — so its MutationObserver keeps
 * watching whichever body node it was given. Swapping the node leaves those
 * observers pointed at a detached tree instead of at the next test's DOM.
 */
export function resetDocument(): void {
  document.documentElement.className = "";
  const fresh = document.createElement("body");
  document.body.replaceWith(fresh);
  for (const style of document.head.querySelectorAll("style[data-vr-test]")) {
    style.remove();
  }
}

/** The stylesheet exactly as it ships — asserted against, not re-typed. */
export const STYLESHEET: string = STYLESHEET_SOURCE;

/** Applies the shipped stylesheet to the jsdom document. */
export function installStylesheet(): HTMLStyleElement {
  const style = document.createElement("style");
  style.setAttribute("data-vr-test", "");
  style.textContent = STYLESHEET;
  document.head.appendChild(style);
  return style;
}
