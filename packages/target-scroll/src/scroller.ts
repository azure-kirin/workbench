import {
  animateScrollTo,
  cancelScroll,
  type MotionOptions,
} from "./engine.js";

/**
 * What to scroll to: an element, or a string.
 *
 * A string is tried as a CSS selector first — so `"#work"`, the thing you
 * already have in an `href`, works unchanged — and then as a bare element id.
 * The second attempt is not redundant: `document.querySelector("#2col")`
 * throws, because an id that starts with a digit is a legal id and an illegal
 * selector, and ids like that turn up in generated markup.
 */
export type ScrollTarget = string | Element;

/**
 * Where focus should land after the scroll.
 *
 * `true` (the default) means "the place the reader is now looking": the
 * destination element for {@link Scroller.toTarget}, the document start for
 * {@link Scroller.toTop}. A string is resolved like a {@link ScrollTarget}.
 * `false` leaves focus alone.
 */
export type FocusTarget = boolean | string | Element;

export interface ScrollOptions extends MotionOptions {
  /**
   * Extra px to leave above the target — a fixed header's height, typically.
   *
   * Pass a function when the height is not a constant (a header that shrinks
   * on scroll, a banner that can be dismissed); it is called at activation
   * time, so it always sees the current layout. Default 0.
   *
   * This is *added to* the element's `scroll-margin-top`, see `scrollMargin`.
   */
  offset?: number | (() => number);
  /**
   * Whether the target's CSS `scroll-margin-top` is honoured. Default `true`.
   *
   * `scroll-margin-top` is the platform's own answer to "this element should
   * not be scrolled flush against the top edge" — the browser applies it to
   * native hash jumps and to `scrollIntoView`. Reading it keeps this library
   * consistent with the rest of the page instead of inventing a second,
   * parallel offset system that has to be kept in sync by hand.
   *
   * Set `false` only if you are supplying the whole offset yourself and the
   * page also sets `scroll-margin-top` for native jumps; otherwise the two
   * add up.
   */
  scrollMargin?: boolean;
  /**
   * Whether the URL is updated to the target's `#id`. Default `true`.
   *
   * Uses `replaceState`, not `pushState`: an in-page jump is not a document
   * the reader wants Back to return them to, and a nav with six anchors will
   * otherwise fill the history stack with hops the Back button has to be
   * pressed through one at a time.
   */
  updateHash?: boolean;
  /** Where focus lands. Default `true`. See {@link FocusTarget}. */
  focus?: FocusTarget;
}

export interface Scroller {
  /**
   * Scrolls to `target`.
   *
   * Returns `false` — having done nothing at all — when the target is not in
   * this document. That is the useful case for a link: intercept the click
   * only when you can actually handle it, and otherwise let the browser or
   * the router navigate.
   *
   * ```js
   * link.addEventListener("click", (event) => {
   *   if (scrollToTarget(link.hash)) event.preventDefault();
   * });
   * ```
   */
  toTarget(target: ScrollTarget, options?: ScrollOptions): boolean;
  /** Scrolls to the top of the document and drops the `#hash` from the URL. */
  toTop(options?: ScrollOptions): void;
  /** Ends any animation in flight. The page stays wherever it got to. */
  cancel(): void;
}

/** Resolves a {@link ScrollTarget}. Selector first, then bare id. */
export function resolveTarget(target: ScrollTarget): Element | null {
  if (!target) return null;
  if (typeof target !== "string") return target;

  try {
    const found = document.querySelector(target);
    if (found) return found;
  } catch {
    /* Not a valid selector — "#2col", "#a.b", an id with a space in it. */
  }
  return document.getElementById(
    target.charAt(0) === "#" ? target.slice(1) : target,
  );
}

/** Document-space y for an element, with scroll-margin and offset applied. */
function positionOf(element: Element, options: ScrollOptions): number {
  const margin =
    options.scrollMargin === false
      ? 0
      : parseFloat(getComputedStyle(element).scrollMarginTop) || 0;
  const offset =
    typeof options.offset === "function" ? options.offset() : options.offset || 0;

  const y = element.getBoundingClientRect().top + window.scrollY - margin - offset;

  /* Clamped into the range the document can actually reach. Asking for a
     position past the end does not break the browser — it clamps too — but it
     inflates the distance, so the easing would spend its slow tail travelling
     nowhere and the movement would look like it stalled on arrival. */
  const max = document.documentElement.scrollHeight - window.innerHeight;
  return Math.max(0, max > 0 ? Math.min(y, max) : y);
}

/** Elements that are focusable on their own and must not be given a tabindex. */
const NATIVELY_FOCUSABLE =
  /^(A|AREA|AUDIO|BUTTON|DETAILS|EMBED|IFRAME|INPUT|OBJECT|SELECT|SUMMARY|TEXTAREA|VIDEO)$/;

/**
 * Moves focus without moving the page.
 *
 * A native hash jump does two things: it scrolls, and it moves the sequential
 * focus navigation starting point to the target, so the reader's next Tab
 * continues from the section they just jumped to. Hand-rolled scrolling only
 * does the first one, and the omission is invisible until someone navigates
 * by keyboard: they land in the new section visually and their next Tab takes
 * them back to the link they came from.
 *
 * `preventScroll` is load-bearing rather than defensive — focusing an element
 * scrolls it into view in every browser, which would teleport the page to the
 * destination the moment the animation started.
 */
function focusWithoutScrolling(element: Element): void {
  const el = element as HTMLElement;
  if (typeof el.focus !== "function") return;

  /* A section, a heading or a div is not focusable, so it gets a programmatic
     tabindex — removed again on blur, because leaving `tabindex="-1"` behind
     on every section the reader has visited changes the document for the sake
     of one moment. Elements that are already focusable are left alone:
     writing `tabindex="-1"` onto a link would take it OUT of the tab order. */
  if (
    !el.hasAttribute("tabindex") &&
    !NATIVELY_FOCUSABLE.test(el.tagName) &&
    !el.hasAttribute("contenteditable")
  ) {
    el.setAttribute("tabindex", "-1");
    el.addEventListener("blur", () => el.removeAttribute("tabindex"), {
      once: true,
    });
  }

  el.focus({ preventScroll: true });
}

function applyFocus(option: FocusTarget | undefined, fallback: Element | null) {
  if (option === false) return;
  const element =
    option === undefined || option === true
      ? fallback
      : typeof option === "string"
        ? resolveTarget(option)
        : option;
  if (element) focusWithoutScrolling(element);
}

/**
 * Rewrites the current URL's fragment in place.
 *
 * `history.state` is passed back through rather than replaced with `null`.
 * Client-side routers keep their own bookkeeping there — scroll positions,
 * route keys, the index of the entry in their stack — and a `replaceState(null,
 * …)` erases it, which shows up later as a Back button that restores the wrong
 * scroll position or a route that reloads instead of resuming.
 */
function replaceFragment(fragment: string): void {
  try {
    history.replaceState(
      history.state,
      "",
      `${location.pathname}${location.search}${fragment}`,
    );
  } catch {
    /* Sandboxed iframes and some file:// contexts refuse history writes.
       Losing the URL sync is not a reason to lose the scroll. */
  }
}

/**
 * Binds a set of defaults — the fixed header offset, usually — to the two
 * scroll functions, so call sites do not repeat them.
 *
 * ```js
 * const scroller = createScroller({ offset: () => header.offsetHeight });
 * scroller.toTarget("#pricing");
 * ```
 *
 * Options passed to a call override the defaults per key. Defaults are read
 * at activation, so an object you mutate stays live.
 */
export function createScroller(defaults: ScrollOptions = {}): Scroller {
  return {
    toTarget(target, options) {
      return scrollToTarget(target, { ...defaults, ...options });
    },
    toTop(options) {
      scrollToTop({ ...defaults, ...options });
    },
    cancel: cancelScroll,
  };
}

/**
 * Scrolls to `target`, updates the URL, and moves focus. Returns `false` if
 * the target is not in this document — see {@link Scroller.toTarget}.
 *
 * Nothing here consults `location.hash`, and that is the point. A native hash
 * link is inert once the hash already matches: the second click on the nav
 * item the reader is already "on" does nothing, which is precisely when they
 * are trying hardest to use it — they have scrolled away and want to go back.
 * Every activation scrolls.
 */
export function scrollToTarget(
  target: ScrollTarget,
  options: ScrollOptions = {},
): boolean {
  const element = resolveTarget(target);
  if (!element) return false;

  animateScrollTo(positionOf(element, options), options);

  if (options.updateHash !== false && (element as HTMLElement).id) {
    replaceFragment(`#${(element as HTMLElement).id}`);
  }
  /* Focus moves now, not on arrival: the animation can be cancelled by the
     reader half way, and the destination is still where the affordance said
     it would take them. It also keeps the two orderings — instant jump and
     animated scroll — identical. */
  applyFocus(options.focus, element);

  return true;
}

/** Scrolls to the top of the document and drops the `#hash` from the URL. */
export function scrollToTop(options: ScrollOptions = {}): void {
  animateScrollTo(0, options);

  if (options.updateHash !== false) {
    /* Only the fragment goes. The original of this code rebuilt the URL from
       `location.pathname` alone, which silently dropped the query string —
       and with it whatever campaign, filter or session parameter the visitor
       arrived with. */
    replaceFragment("");
  }
  /* The document start, for keyboard readers: after this, Tab continues from
     the top of the page rather than from the control that has just scrolled
     out from under the pointer. Pass a skip-link target (`focus:
     "#main-content"`) to land somewhere more specific. */
  applyFocus(options.focus, document.body);
}
