import type {
  ComponentPropsWithoutRef,
  CSSProperties,
  ElementType,
  ReactNode,
} from "react";
import { revealScriptSource } from "./script.js";
import type { RevealEngineOptions } from "./engine.js";

export { stagger, REVEAL_ROOT_CLASS, REVEAL_ATTR, REVEAL_MOUNT_ATTR, REVEALED_CLASS, REVEAL_DELAY_PROPERTY } from "./index.js";
export type { RevealEngineOptions };

/**
 * Neither component uses state, effects, refs or context, so neither needs
 * `"use client"`. In React Server Components both render on the server and
 * ship no JavaScript of their own — the only JavaScript in the system is
 * the inline engine.
 */

/**
 * When the entrance plays.
 *
 * - `"view"` (default) — when the element reaches the fold line, driven by
 *   the engine's sweep. This is the one that survives a fast flick.
 * - `"mount"` — on insertion, as a pure CSS animation. For content that
 *   appears in a fixed overlay, a dialog, or a portal, where "scrolled into
 *   view" has no meaning and the sweep would never fire.
 * - `"none"` — no entrance. The element renders plain and finished. Use it
 *   for anything above the fold: the first screen is what a reader judges
 *   the page on, and an animated first screen is a first screen that is
 *   briefly missing.
 */
export type RevealTrigger = "view" | "mount" | "none";

type RevealOwnProps<T extends ElementType> = {
  /** Element or component to render. Default `"div"`. */
  as?: T;
  /** When the entrance plays. Default `"view"`. */
  trigger?: RevealTrigger;
  /**
   * Delay before this element's entrance starts.
   *
   * A number is milliseconds — `delay={120}`. A string is used as-is, so any
   * CSS `<time>` or `calc()` works, including {@link stagger} for a delay
   * measured in steps of `--vr-stagger`.
   *
   * Ignored when `trigger` is `"none"`.
   */
  delay?: number | string;
  style?: CSSProperties;
  children?: ReactNode;
};

export type RevealProps<T extends ElementType = "div"> = RevealOwnProps<T> &
  Omit<ComponentPropsWithoutRef<T>, keyof RevealOwnProps<T>>;

function toCssTime(delay: number | string): string {
  return typeof delay === "number" ? `${delay}ms` : delay;
}

/**
 * Wraps content in a scroll entrance.
 *
 * What it renders is deliberately unremarkable: an element carrying an
 * attribute. The hidden state comes from `styles.css` and applies only
 * under `html.vr-js`, which the engine sets synchronously — so the markup
 * this returns is fully visible on its own, and stays visible if the
 * JavaScript never runs.
 */
export function Reveal<T extends ElementType = "div">(props: RevealProps<T>) {
  const {
    as,
    trigger = "view",
    delay,
    style,
    children,
    ...rest
  } = props as RevealProps<"div"> & { as?: ElementType };

  const Tag = (as ?? "div") as ElementType;

  if (trigger === "none") {
    return (
      <Tag {...rest} style={style}>
        {children}
      </Tag>
    );
  }

  const styleWithDelay =
    delay === undefined
      ? style
      : ({ ...style, "--vr-delay": toCssTime(delay) } as CSSProperties);

  if (trigger === "mount") {
    return (
      <Tag {...rest} data-reveal-mount="" style={styleWithDelay}>
        {children}
      </Tag>
    );
  }

  return (
    <Tag
      {...rest}
      data-reveal=""
      style={styleWithDelay}
      /* The engine adds `vr-revealed` to this element before React hydrates
         — that IS the entrance, and it has to happen off React's clock or
         the element would be waiting on hydration to appear.

         React's hydration pass walks the live attributes of each node and
         reports every one it did not render itself, not just the ones it
         owns, so a class arriving from outside React is flagged whatever it
         is called (renaming it to a `data-` attribute does not help —
         diffHydratedProperties collects them all). Suppression is the only
         way to tell React this node is co-owned. It is one level deep: this
         element's own attributes, never its children. */
      suppressHydrationWarning
    >
      {children}
    </Tag>
  );
}

export type RevealScriptProps = RevealEngineOptions & {
  /** CSP nonce, if your `script-src` uses nonces rather than hashes. */
  nonce?: string;
};

/**
 * The inline engine, as a component.
 *
 * Render it as the FIRST child of `<body>`. Not in `<head>`: a script in
 * the head runs before `<body>` exists, and the engine observes
 * `document.body`. Not lower down either — everything above it would paint
 * visible and then be hidden, which is the flash the whole design exists to
 * avoid.
 *
 * ```tsx
 * <body>
 *   <RevealScript />
 *   {children}
 * </body>
 * ```
 *
 * `<html>` needs `suppressHydrationWarning` for the same reason the wrapper
 * does: the engine adds a class to it before React hydrates.
 */
export function RevealScript({ nonce, ...options }: RevealScriptProps = {}) {
  return (
    <script
      nonce={nonce}
      // Inline and blocking on purpose. See revealScriptSource().
      dangerouslySetInnerHTML={{ __html: revealScriptSource(options) }}
    />
  );
}
