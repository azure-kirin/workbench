import { vi } from "vitest";

/**
 * jsdom has no layout and no scrolling. Everything the engine asks the world —
 * where is this element, how tall is the viewport, how tall is the document,
 * where are we scrolled to, does a frame ever run, what does matchMedia say —
 * is answered here instead of inside the tests, so a test reads as the failure
 * mode it is about.
 */

/** jsdom gives every element a 0x0 rect at 0,0. Give one a position. */
export function setTop(element: Element, top: number): void {
  Object.defineProperty(element, "getBoundingClientRect", {
    configurable: true,
    value: () => ({
      top,
      bottom: top + 200,
      left: 0,
      right: 800,
      width: 800,
      height: 200,
      x: 0,
      y: top,
      toJSON: () => ({}),
    }),
  });
}

export type ScrollHarness = {
  /** Every scrollTo the engine performed, in order. */
  readonly calls: Array<{ top: number; behavior?: string }>;
  /** Current scroll position, as the engine last left it. */
  y(): number;
  /** Put the page somewhere without going through the engine. */
  setY(value: number): void;
  restore(): void;
};

/**
 * jsdom's `window.scrollTo` is a stub that does nothing and logs. This makes
 * it real enough: it records what was asked for and moves `window.scrollY`,
 * so a test can assert both the destination and the path taken to it.
 */
export function controlScroll(): ScrollHarness {
  const original = window.scrollTo;
  const calls: Array<{ top: number; behavior?: string }> = [];
  let y = 0;

  Object.defineProperty(window, "scrollY", {
    configurable: true,
    get: () => y,
  });
  Object.defineProperty(window, "scrollX", { configurable: true, value: 0 });

  window.scrollTo = ((
    first: number | ScrollToOptions,
    second?: number,
  ): void => {
    if (typeof first === "object") {
      calls.push({ top: first.top ?? y, behavior: first.behavior });
      y = first.top ?? y;
    } else {
      calls.push({ top: second ?? 0 });
      y = second ?? 0;
    }
  }) as typeof window.scrollTo;

  return {
    calls,
    y: () => y,
    setY(value: number) {
      y = value;
    },
    restore() {
      window.scrollTo = original;
    },
  };
}

export type RafHarness = {
  /** Run the queued frame callback with `time` on the performance clock. */
  flush(time: number): void;
  /** Queued and unrun — the "rAF is suspended" measure. */
  pending(): number;
  restore(): void;
};

/**
 * Replaces requestAnimationFrame with a queue nothing drains on its own, so a
 * test decides whether frames happen at all and at what timestamps. An
 * embedded webview with rAF suspended is exactly this: callbacks queued,
 * never called.
 */
export function controlRaf(): RafHarness {
  const originalRequest = globalThis.requestAnimationFrame;
  const originalCancel = globalThis.cancelAnimationFrame;
  let queue = new Map<number, FrameRequestCallback>();
  let id = 0;

  globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) => {
    queue.set(++id, cb);
    return id;
  }) as typeof globalThis.requestAnimationFrame;
  globalThis.cancelAnimationFrame = ((handle: number) => {
    queue.delete(handle);
  }) as typeof globalThis.cancelAnimationFrame;

  return {
    flush(time: number) {
      const due = [...queue.values()];
      queue = new Map();
      for (const cb of due) cb(time);
    },
    pending: () => queue.size,
    restore() {
      globalThis.requestAnimationFrame = originalRequest;
      globalThis.cancelAnimationFrame = originalCancel;
      queue = new Map();
    },
  };
}

/** Pins `performance.now()` so a test owns the animation clock outright. */
export function controlClock(start = 1000): { set(time: number): void } {
  let time = start;
  vi.spyOn(performance, "now").mockImplementation(() => time);
  return {
    set(value: number) {
      time = value;
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

export function setViewportHeight(height: number): void {
  Object.defineProperty(window, "innerHeight", {
    configurable: true,
    writable: true,
    value: height,
  });
}

/** jsdom reports a document height of 0, which would defeat the end-of-page clamp. */
export function setDocumentHeight(height: number): void {
  Object.defineProperty(document.documentElement, "scrollHeight", {
    configurable: true,
    get: () => height,
  });
}

/** A positioned section in the document, as a page would have. */
export function addSection(id: string, top: number): HTMLElement {
  const el = document.createElement("section");
  el.id = id;
  document.body.appendChild(el);
  setTop(el, top);
  return el;
}

export function resetDocument(): void {
  document.body.replaceWith(document.createElement("body"));
  history.replaceState(null, "", "/");
}
