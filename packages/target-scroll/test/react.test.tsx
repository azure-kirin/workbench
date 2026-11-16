import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { ScrollLink, useScrollTo } from "../src/react.js";
import { cancelScroll, type Scroller, type ScrollOptions } from "../src/index.js";
import {
  addSection,
  controlClock,
  controlRaf,
  controlScroll,
  resetDocument,
  setViewportHeight,
  type RafHarness,
  type ScrollHarness,
} from "./helpers.js";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}

let raf: RafHarness;
let scroll: ScrollHarness;
let container: HTMLElement;
let root: Root;

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  resetDocument();
  setViewportHeight(800);
  raf = controlRaf();
  scroll = controlScroll();
  controlClock(1000);
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  cancelScroll();
  raf.restore();
  scroll.restore();
  resetDocument();
});

function render(ui: React.ReactNode): void {
  act(() => root.render(ui));
}

/** Clicks and reports whether the component took the navigation over. */
function click(
  element: Element,
  init: MouseEventInit = {},
): { defaultPrevented: boolean } {
  const event = new MouseEvent("click", {
    bubbles: true,
    cancelable: true,
    button: 0,
    ...init,
  });
  act(() => {
    element.dispatchEvent(event);
  });
  return { defaultPrevented: event.defaultPrevented };
}

describe("<ScrollLink>", () => {
  it("renders a real anchor with a real href", () => {
    /* Right-clickable, middle-clickable, copyable, and it still works with
       JavaScript off — the scroll is an enhancement on top of a link, not a
       replacement for one. */
    expect(
      renderToStaticMarkup(<ScrollLink href="#work">Work</ScrollLink>),
    ).toBe('<a href="#work">Work</a>');
  });

  it("scrolls, and takes the click, when the target is in this document", () => {
    addSection("work", 5000);
    render(<ScrollLink href="#work">Work</ScrollLink>);

    const result = click(container.querySelector("a")!);

    expect(result.defaultPrevented).toBe(true);
    expect(raf.pending()).toBe(1);
  });

  it("leaves the click alone when the target is on another page", () => {
    /* The same nav renders on every route. On the page that has #work it
       scrolls; everywhere else it must stay an ordinary link and let the
       router navigate. Nothing about the component knows which page it is
       on — it asks the document. */
    render(<ScrollLink href="/#work">Work</ScrollLink>);

    const result = click(container.querySelector("a")!);

    expect(result.defaultPrevented).toBe(false);
    expect(scroll.calls).toHaveLength(0);
  });

  it("reads the target from the fragment of a full path", () => {
    addSection("work", 5000);
    render(<ScrollLink href="/#work">Work</ScrollLink>);

    expect(click(container.querySelector("a")!).defaultPrevented).toBe(true);
  });

  it("lets a modified click open a new tab", () => {
    addSection("work", 5000);
    render(<ScrollLink href="#work">Work</ScrollLink>);
    const anchor = container.querySelector("a")!;

    expect(click(anchor, { metaKey: true }).defaultPrevented).toBe(false);
    expect(click(anchor, { ctrlKey: true }).defaultPrevented).toBe(false);
    expect(click(anchor, { shiftKey: true }).defaultPrevented).toBe(false);
    expect(click(anchor, { button: 1 }).defaultPrevented).toBe(false);
    expect(scroll.calls).toHaveLength(0);
  });

  it("runs a caller's onClick first, and stands down if it prevents default", () => {
    addSection("work", 5000);
    const onClick = vi.fn((event: React.MouseEvent) => event.preventDefault());
    render(
      <ScrollLink href="#work" onClick={onClick}>
        Work
      </ScrollLink>,
    );

    click(container.querySelector("a")!);

    expect(onClick).toHaveBeenCalled();
    expect(scroll.calls).toHaveLength(0);
    expect(raf.pending()).toBe(0);
  });

  it("forwards the rest of its props, and renders through `as`", () => {
    const Custom = (props: React.ComponentPropsWithoutRef<"a">) => (
      <a {...props} data-custom="" />
    );
    const html = renderToStaticMarkup(
      <ScrollLink as={Custom} href="#work" className="nav" aria-current="true">
        Work
      </ScrollLink>,
    );
    expect(html).toBe(
      '<a class="nav" aria-current="true" href="#work" data-custom="">Work</a>',
    );
  });

  it("passes its options through to the scroll", () => {
    const section = addSection("work", 5000);
    section.style.scrollMarginTop = "0px";
    render(
      <ScrollLink href="#work" options={{ offset: 120, updateHash: false }}>
        Work
      </ScrollLink>,
    );

    click(container.querySelector("a")!);
    raf.flush(1000);
    raf.flush(11_000);

    expect(scroll.y()).toBe(4880);
    expect(location.hash).toBe("");
  });
});

describe("useScrollTo", () => {
  it("keeps one identity across renders, so it can sit in a dependency array", () => {
    const seen: Scroller[] = [];
    function Probe({ offset }: { offset: number }) {
      seen.push(useScrollTo({ offset }));
      return null;
    }

    render(<Probe offset={0} />);
    render(<Probe offset={80} />);
    render(<Probe offset={160} />);

    expect(seen).toHaveLength(3);
    expect(seen[1]).toBe(seen[0]);
    expect(seen[2]).toBe(seen[0]);
  });

  it("reads the current defaults at click time, not the ones it was created with", () => {
    addSection("work", 5000);
    let scroller: Scroller | undefined;
    function Probe({ options }: { options: ScrollOptions }) {
      scroller = useScrollTo(options);
      return null;
    }

    render(<Probe options={{ offset: 0 }} />);
    render(<Probe options={{ offset: 300 }} />);

    act(() => {
      scroller!.toTarget("#work");
    });
    raf.flush(1000);
    raf.flush(11_000);

    expect(scroll.y()).toBe(4700);
  });

  it("scrolls to the top and clears the fragment", () => {
    history.replaceState(null, "", "/case?utm=x#work");
    scroll.setY(6000);
    let scroller: Scroller | undefined;
    function Probe() {
      scroller = useScrollTo();
      return null;
    }
    render(<Probe />);

    act(() => scroller!.toTop());
    raf.flush(1000);
    raf.flush(11_000);

    expect(scroll.y()).toBe(0);
    expect(location.search).toBe("?utm=x");
    expect(location.hash).toBe("");
  });
});
