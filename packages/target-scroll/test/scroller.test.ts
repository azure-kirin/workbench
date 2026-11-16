import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cancelScroll,
  createScroller,
  resolveTarget,
  scrollToTarget,
  scrollToTop,
} from "../src/index.js";
import {
  addSection,
  controlClock,
  controlRaf,
  controlScroll,
  resetDocument,
  setDocumentHeight,
  setTop,
  setViewportHeight,
  type RafHarness,
  type ScrollHarness,
} from "./helpers.js";

const T0 = 1000;

let raf: RafHarness;
let scroll: ScrollHarness;

/** Runs whatever animation is in flight to completion. */
function settle(): void {
  raf.flush(T0);
  raf.flush(T0 + 10_000);
}

beforeEach(() => {
  resetDocument();
  setViewportHeight(800);
  setDocumentHeight(20_000);
  raf = controlRaf();
  scroll = controlScroll();
  controlClock(T0);
});

afterEach(() => {
  cancelScroll();
  raf.restore();
  scroll.restore();
  resetDocument();
});

describe("activation on a target the URL already points at", () => {
  it("scrolls again — this is the whole reason the library exists", () => {
    const section = addSection("work", 5000);

    expect(scrollToTarget("#work")).toBe(true);
    settle();
    expect(scroll.y()).toBe(5000);
    expect(location.hash).toBe("#work");

    /* The reader scrolls back up by hand and presses the same nav item. A
       native `<a href="#work">` does NOTHING here: the fragment already
       matches, so the browser has nowhere to navigate to. That is exactly
       the moment the affordance is being leaned on hardest. */
    scroll.setY(0);
    setTop(section, 5000);
    const callsBefore = scroll.calls.length;

    expect(scrollToTarget("#work")).toBe(true);
    settle();

    expect(scroll.calls.length).toBeGreaterThan(callsBefore);
    expect(scroll.y()).toBe(5000);
  });

  it("still syncs the URL and moves focus when the page is already there", () => {
    const section = addSection("work", 0);
    scroll.setY(0);
    history.replaceState(null, "", "/");

    expect(scrollToTarget("#work")).toBe(true);

    expect(scroll.calls).toHaveLength(0); // nothing to travel
    expect(location.hash).toBe("#work");
    expect(document.activeElement).toBe(section);
  });
});

describe("resolving a target", () => {
  it("takes an element, a hash, a bare id, or any selector", () => {
    const section = addSection("work", 100);
    section.className = "panel";

    expect(resolveTarget(section)).toBe(section);
    expect(resolveTarget("#work")).toBe(section);
    expect(resolveTarget("work")).toBe(section);
    expect(resolveTarget(".panel")).toBe(section);
  });

  it("resolves an id that is a legal id but an illegal selector", () => {
    /* `document.querySelector("#2col")` throws — ids starting with a digit
       are fine in HTML and invalid in CSS, and generated markup produces
       them. Falling back to getElementById costs one line. */
    const section = addSection("2col", 100);
    expect(() => document.querySelector("#2col")).toThrow();
    expect(resolveTarget("#2col")).toBe(section);
  });

  it("returns false and does nothing at all when the target is absent", () => {
    history.replaceState(null, "", "/page?ref=x");

    expect(scrollToTarget("#nowhere")).toBe(false);

    expect(scroll.calls).toHaveLength(0);
    expect(raf.pending()).toBe(0);
    expect(location.href).toContain("/page?ref=x");
    expect(location.hash).toBe("");
  });
});

describe("where the target lands", () => {
  it("honours the element's scroll-margin-top", () => {
    const section = addSection("work", 5000);
    section.style.scrollMarginTop = "96px";

    scrollToTarget("#work");
    settle();

    expect(scroll.y()).toBe(5000 - 96);
  });

  it("adds offset on top of it, and takes offset as a function", () => {
    const section = addSection("work", 5000);
    section.style.scrollMarginTop = "96px";

    scrollToTarget("#work", { offset: 24 });
    settle();
    expect(scroll.y()).toBe(5000 - 96 - 24);

    scroll.setY(0);
    setTop(section, 5000);
    scrollToTarget("#work", { offset: () => 40 });
    settle();
    expect(scroll.y()).toBe(5000 - 96 - 40);
  });

  it("can ignore scroll-margin-top for a page that owns the whole offset", () => {
    const section = addSection("work", 5000);
    section.style.scrollMarginTop = "96px";

    scrollToTarget("#work", { scrollMargin: false, offset: 64 });
    settle();

    expect(scroll.y()).toBe(5000 - 64);
  });

  it("measures from the current scroll position, not from the top", () => {
    const section = addSection("work", -200); // 200px above the viewport top
    scroll.setY(3000);
    setTop(section, -200);

    scrollToTarget("#work");
    settle();

    expect(scroll.y()).toBe(2800);
  });

  it("never asks for a negative position", () => {
    const section = addSection("work", 10);
    section.style.scrollMarginTop = "200px";

    scrollToTarget("#work");
    settle();

    expect(scroll.y()).toBe(0);
  });

  it("clamps to the end of the document, so the easing does not idle on arrival", () => {
    setDocumentHeight(6000); // reachable maximum is 6000 - 800
    addSection("footer", 5800);

    scrollToTarget("#footer");
    settle();

    expect(scroll.y()).toBe(5200);
  });
});

describe("the URL", () => {
  it("is rewritten in place, keeping the query string and the router's state", () => {
    addSection("work", 5000);
    history.replaceState({ routeKey: "abc" }, "", "/case?utm=news");

    scrollToTarget("#work");

    expect(location.pathname).toBe("/case");
    expect(location.search).toBe("?utm=news");
    expect(location.hash).toBe("#work");
    /* A client-side router keeps its bookkeeping in history.state. The
       original of this code replaced it with null, which surfaces later as a
       Back button that restores the wrong scroll position. */
    expect(history.state).toEqual({ routeKey: "abc" });
  });

  it("adds no history entry — six anchors must not become six Back presses", () => {
    addSection("work", 5000);
    const push = vi.spyOn(history, "pushState");

    scrollToTarget("#work");

    expect(push).not.toHaveBeenCalled();
  });

  it("is left alone when updateHash is false", () => {
    addSection("work", 5000);
    scrollToTarget("#work", { updateHash: false });
    expect(location.hash).toBe("");
  });

  it("has only the fragment removed on scrollToTop", () => {
    history.replaceState(null, "", "/case?utm=news#work");

    scrollToTop();

    expect(location.pathname).toBe("/case");
    expect(location.search).toBe("?utm=news");
    expect(location.hash).toBe("");
  });

  it("takes no fragment from an element with no id", () => {
    const el = document.createElement("div");
    el.className = "panel";
    document.body.appendChild(el);
    setTop(el, 4000);

    expect(scrollToTarget(".panel")).toBe(true);
    expect(location.hash).toBe("");
  });
});

describe("focus", () => {
  it("moves to the target without letting the browser scroll to it", () => {
    const section = addSection("work", 5000);
    const focus = vi.spyOn(section, "focus");

    scrollToTarget("#work");

    expect(focus).toHaveBeenCalledWith({ preventScroll: true });
    expect(document.activeElement).toBe(section);
  });

  it("gives a non-focusable target a temporary tabindex, and takes it back", () => {
    const section = addSection("work", 5000);

    scrollToTarget("#work");
    expect(section.getAttribute("tabindex")).toBe("-1");

    section.dispatchEvent(new FocusEvent("blur"));
    expect(section.hasAttribute("tabindex")).toBe(false);
  });

  it("does not write tabindex onto something already focusable", () => {
    /* `tabindex="-1"` on a link would take it OUT of the tab order — the
       opposite of the intent. */
    const link = document.createElement("a");
    link.id = "skip";
    link.href = "#work";
    document.body.appendChild(link);
    setTop(link, 3000);

    scrollToTarget("#skip");

    expect(link.hasAttribute("tabindex")).toBe(false);
    expect(document.activeElement).toBe(link);
  });

  it("respects an explicit target, and can be turned off", () => {
    addSection("work", 5000);
    const main = addSection("main-content", 100);

    scrollToTarget("#work", { focus: "#main-content" });
    expect(document.activeElement).toBe(main);

    main.blur();
    scrollToTarget("#work", { focus: false });
    expect(document.activeElement).toBe(document.body);
  });

  it("returns to the document start on scrollToTop", () => {
    const section = addSection("work", 5000);
    scrollToTarget("#work");
    expect(document.activeElement).toBe(section);

    scrollToTop();

    expect(document.activeElement).toBe(document.body);
  });
});

describe("createScroller", () => {
  it("applies its defaults, and lets a call override one key", () => {
    const section = addSection("work", 5000);
    const scroller = createScroller({ offset: 100, updateHash: false });

    scroller.toTarget("#work");
    settle();
    expect(scroll.y()).toBe(4900);
    expect(location.hash).toBe("");

    scroll.setY(0);
    setTop(section, 5000);
    scroller.toTarget("#work", { offset: 0 });
    settle();
    expect(scroll.y()).toBe(5000);
    expect(location.hash).toBe(""); // the default it did not override still holds
  });

  it("reads its defaults at click time, so a mutable object stays live", () => {
    const section = addSection("work", 5000);
    const defaults = { offset: 100 };
    const scroller = createScroller(defaults);

    defaults.offset = 250;
    scroller.toTarget("#work");
    settle();

    expect(scroll.y()).toBe(4750);
    expect(section.id).toBe("work");
  });
});
