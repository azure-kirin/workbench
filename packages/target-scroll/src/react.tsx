"use client";

import {
  createElement,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  type ComponentPropsWithoutRef,
  type ElementType,
  type MouseEvent,
  type ReactNode,
} from "react";
import {
  cancelScroll,
  scrollToTarget,
  scrollToTop,
  type Scroller,
  type ScrollOptions,
  type ScrollTarget,
} from "./index.js";

export type {
  FocusTarget,
  MotionOptions,
  Scroller,
  ScrollOptions,
  ScrollTarget,
} from "./index.js";

/**
 * The two scroll functions with a component's defaults already applied, at
 * stable identities that never change across renders — so they can go in a
 * dependency array, or be passed to a memoised child, without invalidating it.
 *
 * ```tsx
 * const scroll = useScrollTo({ offset: 96 });
 * <button onClick={() => scroll.toTop()}>Back to top</button>
 * ```
 *
 * `defaults` is read at click time, not captured at first render, so an offset
 * derived from state stays current without re-creating the handlers.
 */
export function useScrollTo(defaults: ScrollOptions = {}): Scroller {
  const latest = useRef(defaults);
  useEffect(() => {
    latest.current = defaults;
  });

  return useMemo<Scroller>(
    () => ({
      toTarget: (target: ScrollTarget, options?: ScrollOptions) =>
        scrollToTarget(target, { ...latest.current, ...options }),
      toTop: (options?: ScrollOptions) =>
        scrollToTop({ ...latest.current, ...options }),
      cancel: cancelScroll,
    }),
    [],
  );
}

type ScrollLinkOwnProps<T extends ElementType> = {
  /** Element or component to render. Default `"a"`. Anything that takes `href` and `onClick`. */
  as?: T;
  /**
   * Where to go, as it would be written in an `href`: `"#work"`, or
   * `"/pricing#plans"` for a target that may be on another page.
   *
   * Whatever follows the first `#` is used as the {@link ScrollTarget}; a
   * value with no `#` is used whole, so a CSS selector works too.
   */
  href: string;
  options?: ScrollOptions;
  children?: ReactNode;
};

export type ScrollLinkProps<T extends ElementType = "a"> =
  ScrollLinkOwnProps<T> &
    Omit<ComponentPropsWithoutRef<T>, keyof ScrollLinkOwnProps<T>>;

/**
 * A link that scrolls when it can and navigates when it cannot.
 *
 * It renders a real anchor with a real `href`, so it is right-clickable,
 * middle-clickable, copyable, and works with JavaScript off. The click is
 * intercepted **only** when the target is present in the current document —
 * which is what makes the same component usable for `"/#work"` in a nav that
 * appears on every page: on the home page it scrolls, everywhere else it is
 * an ordinary link and the router handles it.
 *
 * Pass `as` to render a router's link component instead:
 * `<ScrollLink as={Link} href="/#work">`.
 */
export function ScrollLink<T extends ElementType = "a">(
  props: ScrollLinkProps<T>,
) {
  const {
    as,
    href,
    options,
    children,
    onClick,
    ...rest
  } = props as ScrollLinkProps<"a"> & { as?: ElementType; options?: ScrollOptions };

  const latest = useRef(options);
  useEffect(() => {
    latest.current = options;
  });

  const handleClick = useCallback(
    (event: MouseEvent<HTMLAnchorElement>) => {
      onClick?.(event);
      if (event.defaultPrevented) return;
      /* A modified click is a request for a new tab or window, and the
         reader means the URL, not the scroll. Let the browser have it. */
      if (
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }

      const hash = href.indexOf("#");
      const target = hash === -1 ? href : href.slice(hash);
      if (scrollToTarget(target, latest.current)) event.preventDefault();
    },
    [href, onClick],
  );

  return createElement(
    (as ?? "a") as ElementType,
    { ...rest, href, onClick: handleClick },
    children,
  );
}
