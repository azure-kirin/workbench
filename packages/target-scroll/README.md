# target-scroll

Scroll the page to an element with an animation of its own, and the
defences an animation of its own needs.

This is a short animation loop and a great deal of defence. The animation
part is unremarkable and there are a dozen libraries that do it. What is
different here is what happens when the reader clicks the same nav item
twice, when `requestAnimationFrame` never runs, when the reader takes the
wheel back mid-flight, and when the page sets `html { scroll-behavior:
smooth }` — four situations in which the obvious hand-written version does
nothing, fights the reader, or arrives late, and does it silently.

---

## The problem

### 1. Setting the hash it already has does nothing

The usual hand-written nav handler scrolls by writing the fragment:
`location.hash = "#work"`. The first time, that navigates. The second time
the fragment already is `#work`, and the setter returns without doing
anything. That is the specification, not a bug: the `Location` `hash` setter
stops when the new fragment equals the current one, a bailout kept for pages
that set `location.hash` on every scroll. No scroll, no `hashchange`, no
error. In Playwright's Chromium 158, 151 and 133 and its WebKit 27.2 the
page stays where it is.

The bailout belongs to that setter alone. A plain `<a href="#work">` clicked
again, `location.href = "#work"` and `location.assign("#work")` all navigate
to the fragment again and scroll back to the target. The dead click comes
from script that writes the hash.

Watch someone use a single-page nav and you will see them click the item they
are already "on". They read the section, scrolled past it, and want to go
back; the nav item is the affordance for that, and it is dead at exactly the
moment they lean on it hardest. Nothing is broken enough to report, so it
never gets reported.

Nothing in this library scrolls by writing `location.hash`. Every activation
scrolls.

### 2. `requestAnimationFrame` does not necessarily tick

An animation loop assumes frames happen. They do not always:

- **Embedded webviews.** In-app browsers — the ones inside social, messaging
  and email apps, where a large share of shared links are opened — throttle or
  suspend rAF in states a page cannot detect.
- **Energy saver.** Battery-saver modes on desktop and mobile reduce or halt
  frame callbacks for backgrounded and idle content.
- **Background tabs.** A page can lay out, restore scroll position and take
  clicks from a restored session before its first frame ever runs.

The failure this produces is not a scroll that lacks polish. It is a **click
that does nothing** — on the platform hardest to reproduce, from a bug report
that says only "the menu doesn't work on my phone".

So there is a watchdog. If the first frame has not run within 120ms, the
animation is abandoned and the page jumps to the target. On a healthy browser
the first frame lands in about 16ms and the watchdog never fires; where rAF is
suspended the reader gets an instant jump, which is worse than an animation
and enormously better than nothing.

### 3. The reader's own scroll has to win

Once an animation owns the scroll position, a wheel event fights it: the
reader scrolls up, the animation writes the position back down, and the page
appears to be stuck. An animation that argues with the hand on the wheel is
worse than no animation.

A `wheel`, a `touchstart` or a scrolling key (up and down arrows, page
up/down, home, end, space — unless the reader is typing in a field) ends the
animation immediately, wherever it has got to.

### 4. `html { scroll-behavior: smooth }` turns every frame into its own animation

That line is added to *improve* anchor links, and it applies to every
programmatic scroll on the page that does not say otherwise, including the
sixty a second an animation loop performs. Each frame starts a fresh
browser-side smooth scroll toward a position the next frame moves again, so
the page trails the loop and arrives after it has finished. A 400ms loop to
6000px was 345px short when it ended in WebKit 27.2 and 2px short in
Chromium 158; both caught up within a second. Every scroll here passes
`behavior: "instant"`, which opts that call out of the CSS property.

### And two smaller ones

**The URL and the Back button.** Pointing the fragment at the target is
right — the address bar should describe where the reader asked to go. Doing it with
`pushState` is not: a nav with six anchors leaves six entries the reader has
to press Back through one at a time to leave the page. This uses
`replaceState`, and passes `history.state` back through rather than replacing
it with `null`, because that is where a client-side router keeps its scroll
restoration and route bookkeeping.

**Focus.** A native hash jump does two things: it scrolls, and it moves the
sequential focus navigation starting point to the target. A hand-rolled scroll
only does the first, and the omission is invisible until someone navigates by
keyboard: they land in the new section visually, press Tab, and are taken back
to the link they came from. Focus is moved explicitly here — with
`preventScroll`, since focusing an element scrolls it into view and would
teleport the page the instant the animation started.

### What about `overflow-x: clip`?

This package used to open by saying that in Chromium `overflow-x: clip` on
`<html>` turns a smooth `scrollIntoView` or `scrollTo` into nothing. That was
seen on one site, in an older Chromium, and was never reduced to a test case.
It could not be reproduced in Chromium 158, 151 or 133 (Playwright's builds,
headless, at a desktop window and under Pixel 7 emulation). With `clip` on
the x axis or on both, on `<html>`, on `<body>`, on both, or on an ancestor
that is not the root; with `scroll-behavior: smooth` or `overflow-y: auto`
beside it; on a `<body>` under `html { overflow: hidden }`; with the target
in a `position: sticky` or a `contain` box; and inside a scroll container that
is not the viewport — a smooth `scrollIntoView` and a smooth `scrollTo`
animated to the target every time. The specification agrees: on the
viewport, `clip` is read as `hidden`, and a programmatic scroll goes through
`hidden`.

The nearest thing that did fail is a different property.
`html, body { overflow-x: hidden; height: 100% }` makes `<body>` the scroll
container, and `window.scrollTo` then does nothing, smooth or not, while
`scrollIntoView` scrolls the body. `clip` does not do that, which is why it
is the property to reach for. This library fails there too, because it
scrolls only the window (see What it will not do).

---

## Install

It is not on npm yet. Until it is, build it from this repository and depend
on it by path:

```sh
cd workbench/packages/target-scroll && npm install && npm run build
cd your-app && npm install ../workbench/packages/target-scroll
```

No dependencies. React is an optional peer dependency, used only by the
`target-scroll/react` entry. ESM only.

---

## Usage

```js
import { scrollToTarget, scrollToTop } from "target-scroll";

// An element, an id, a hash, or any CSS selector.
scrollToTarget("#pricing");
scrollToTarget(document.querySelector("[data-section='faq']"));

scrollToTop();
```

### On a link

`scrollToTarget` returns `false` when the target is not in this document, and
that is the useful case for a link: intercept the click only when you can
actually handle it, and otherwise let the browser navigate.

```js
document.querySelectorAll("a[href^='#']").forEach((link) => {
  link.addEventListener("click", (event) => {
    if (scrollToTarget(link.hash)) event.preventDefault();
  });
});
```

### With a fixed header

```js
import { createScroller } from "target-scroll";

const scroller = createScroller({ offset: () => header.offsetHeight });

scroller.toTarget("#pricing");
scroller.toTop();
```

`offset` is a function here because the header shrinks on scroll; a number is
fine when it does not. Defaults are read at activation, so an object you
mutate stays live.

### With React

```tsx
import { ScrollLink, useScrollTo } from "target-scroll/react";

function Nav() {
  const scroll = useScrollTo({ offset: 96 });

  return (
    <nav>
      {/* Renders <a href="/#work">. Scrolls on a page that has #work,
          navigates on every other page. */}
      <ScrollLink href="/#work">Work</ScrollLink>
      <ScrollLink href="/#about">About</ScrollLink>

      <button onClick={() => scroll.toTop()}>Back to top</button>
    </nav>
  );
}
```

With a router's link component:

```tsx
import Link from "next/link";

<ScrollLink as={Link} href="/#work">Work</ScrollLink>
```

---

## API

### `target-scroll`

| Export | Type | |
|---|---|---|
| `scrollToTarget(target, options?)` | `(ScrollTarget, ScrollOptions?) => boolean` | Scrolls, syncs the URL, moves focus. `false` means the target is not in this document and **nothing** was done. |
| `scrollToTop(options?)` | `(ScrollOptions?) => void` | Scrolls to the top and drops the `#hash`, keeping path and query. |
| `createScroller(defaults?)` | `(ScrollOptions?) => Scroller` | Binds defaults. Returns `{ toTarget, toTop, cancel }`. |
| `cancelScroll()` | `() => void` | Ends the animation in flight. The page stays where it got to. |
| `animateScrollTo(y, options?)` | `(number, MotionOptions?) => boolean` | The motion layer alone, for a coordinate you already have. |
| `resolveTarget(target)` | `(ScrollTarget) => Element \| null` | The resolution rule, exposed so callers can ask before acting. |
| `easeOutQuart(t)` · `distanceDuration(distance)` · `prefersReducedMotion()` | | The defaults, as functions, so a custom option can build on them. |

**`ScrollTarget`** is `string | Element`. A string is tried as a CSS selector
first and then as a bare element id.

### `ScrollOptions`

| Option | Type | Default | |
|---|---|---|---|
| `offset` | `number \| (() => number)` | `0` | Extra px above the target — a fixed header. A function is called at activation, so a header that changes height stays correct. |
| `scrollMargin` | `boolean` | `true` | Honour the target's CSS `scroll-margin-top`. `offset` adds to it. |
| `updateHash` | `boolean` | `true` | Rewrite the URL fragment with `replaceState`. |
| `focus` | `boolean \| string \| Element` | `true` | Where focus lands. `true` = the destination (the document start, for `toTop`). |
| `duration` | `number \| ((distance: number) => number)` | `distanceDuration` | ms. `0` jumps. |
| `easing` | `(t: number) => number` | `easeOutQuart` | |
| `watchdog` | `number` | `120` | ms to wait for the first frame before jumping. `0` disables. |
| `cancelOnUserInput` | `boolean` | `true` | Wheel, touch and scroll keys end the animation. |

`MotionOptions` is the last four of these — the ones `animateScrollTo` takes.

### `target-scroll/react`

**`useScrollTo(defaults?)`** returns a `Scroller` whose identity never changes
across renders, so it can go in a dependency array or be handed to a memoised
child. `defaults` is read at click time rather than captured, so an offset
derived from state stays current without re-creating the handlers.

**`<ScrollLink>`**

| Prop | Type | Default | |
|---|---|---|---|
| `href` | `string` | — | As you would write it in an `href`: `"#work"`, `"/pricing#plans"`. Everything after the first `#` is the target; a value with no `#` is used whole, so a selector works. |
| `options` | `ScrollOptions` | — | |
| `as` | `ElementType` | `"a"` | Anything that takes `href` and `onClick`. |
| …rest | — | — | Forwarded. `onClick` runs first and can call `preventDefault()` to stand the scroll down. |

The React entry is marked `"use client"`. The core is not, and can be imported
from a server component.

---

## Design decisions

### What changed from the code this grew out of

This was extracted from one site's `lib/scroll.ts`, where it was two functions
— `scrollToTop()` and `scrollToId(id)` — that knew things about that site.
Removing what they knew was the work:

| Was | Is | Why not something else |
|---|---|---|
| `document.getElementById(id)` | `string \| Element`, selector then id | A selector-only rule would break `"#2col"`, which is a legal id and an illegal selector; an id-only rule would refuse `[data-section]` markup that has no ids. |
| A fixed nav offset expressed as the site's `scroll-mt-*` convention | `scroll-margin-top` read from the target, plus an `offset` option | See below. |
| Focus moved to `#main-content`, hardcoded, and only on `scrollToTop` | `focus` option, defaulting to the destination | See below. |
| `replaceState(null, "", pathname)` | `replaceState(history.state, "", pathname + search + hash)` | Two bugs rather than decisions: the query string was dropped, and a router's history state was erased. |
| No return value | `boolean` from `toTarget` | The site knew from its own routing state whether a target was on the current page. A library cannot; it can ask the document. |
| The watchdog stayed armed after a cancel | Cancelling clears it | A reader who flicked the wheel within 120ms of clicking was thrown at the target anyway. |
| `{ once: true }` input listeners, never removed | Removed on completion | A once-listener that never fires stays attached, one per activation. |
| `window.scrollTo(0, y)` | `behavior: "instant"` | The original site did not set `scroll-behavior: smooth`, so this never bit there. It bites anywhere that does. |

The `prefers-reduced-motion` handling came across unchanged: the original had
it, and it was already the right shape — an instant jump, not a shorter
animation.

### `offset` is added to `scroll-margin-top`, not offered instead of it

`scroll-margin-top` is the platform's own answer to "do not scroll this
element flush against the top edge". The browser already applies it to native
hash jumps and to `scrollIntoView`. Reading it means a page that has set it
for those cases gets the same result here, with no second source of truth.

The alternative — an `offset` option alone, ignoring the CSS — was rejected
because it produces a page where the same element lands in two different
places depending on whether the reader clicked a nav item or arrived on a deep
link. That difference is very hard to see and very annoying to debug.

So `offset` is *additional*: use it for a fixed header, which is a property of
the page rather than of the target, and leave per-element adjustments in CSS
where the rest of the layout lives. `scrollMargin: false` exists for the one
page that wants to own the whole number.

### Focus moves to the destination, immediately

The original moved focus to a fixed `#main-content` on "back to top", and not
at all on a section jump. Both halves are now the same option with the same
default: focus follows the scroll.

It moves at activation rather than on arrival. Waiting for the end sounds more
correct and is worse: the animation can be cancelled by the reader half way,
and then focus never moves at all — the keyboard reader is left behind by a
scroll that visibly happened. Moving immediately also makes the animated path
and the instant path (reduced motion, the watchdog) behave identically, which
is the property you want when a bug report says "only on my phone".

A destination that cannot hold focus gets `tabindex="-1"`, removed again on
blur — leaving it behind would permanently change every section the reader has
visited. An element that is *already* focusable is left alone: writing
`tabindex="-1"` onto a link would take it out of the tab order, which is the
opposite of the intent.

### `toTarget` returns a boolean, rather than throwing or logging

A nav that appears on every page has links to sections that exist on one page.
The library cannot know which page it is on — that is routing, and routing is
the consumer's — but it can ask the document whether the target is there. So
`false` means "not here, this one is yours", and one line covers both cases:

```js
if (scrollToTarget(link.hash)) event.preventDefault();
```

Throwing was rejected because a missing target is not exceptional, it is the
normal state of most links in a global nav. A promise was rejected because
the interesting answer — *can you handle this click* — is needed
synchronously, inside the event handler, before `preventDefault()` stops being
allowed.

### The core is framework-agnostic; React is one entry point

This is DOM work against `window`. The React entry is a hook and a component:
a hook that memoises the scroller, and a component that renders an anchor with
an `onClick`. So the core imports no React, and React is an optional peer
dependency.

There is no Vue, Svelte or Solid entry, and there should not be. Once the core
exists, a wrapper's whole job is to call a function in a click handler, and
every framework can do that without help. Three more thin wrappers would be
three more things to version.

`<ScrollLink>` renders a real `<a>` with a real `href` rather than a `<button>`
or a `<div>` with a handler. It has to be right-clickable, middle-clickable,
copyable, and readable by anything that walks links; the scroll is an
enhancement on top of a link, not a replacement for one. It also declines
modified clicks (⌘, Ctrl, Shift, Alt, middle button) — a reader doing that
wants the URL, not the scroll.

### Duration scales with distance

320ms plus 0.06ms per pixel, capped at 640ms. A fixed duration is wrong at
both ends of the range: it makes a 200px hop feel sluggish and a full-page
jump feel like a journey. The cap matters more than the slope — past about
two-thirds of a second, a moving page stops reading as "the page moved" and
starts reading as "something is loading".

The easing is a quartic ease-out: leaves fast, arrives slowly. Nothing with
overshoot, ever — a spring makes the destination appear to move as it
arrives, and the destination is the one thing a scroll must hold still.

### One animation at a time, in module scope

There is one window, and two animations moving it would produce a fight
neither wins, so starting a scroll always ends the previous one. That state is
module-level rather than per-scroller, because the thing it guards is
module-level too: `createScroller()` binds defaults, it does not create an
independent scrolling context.

This is also why the React entry imports the core rather than bundling its own
copy — two module instances would mean two registries, and `cancelScroll()`
from one would not stop an animation started by the other. A build test pins
it.

---

## What it will not do

- **Scroll anything but the window.** An element inside an `overflow: auto`
  panel is measured against the viewport, so the page scrolls instead of the
  panel. Supporting containers means a second measurement path, a second
  listener set and a second set of failure modes, and the anchor-nav case
  this exists for lives on the page. If you need it inside a panel, you need
  a different library.
- **Scroll sideways.** The vertical position is animated and the horizontal
  one is left where it is.
- **Follow a target that moves.** The position is measured once, at
  activation. If the document reflows during the animation — an image above
  the fold finishing its decode, a font swapping, a lazily rendered section
  expanding — the page arrives where the target *was*. Recomputing every
  frame sounds like the fix and is not: the distance changing under the
  easing produces a scroll that visibly speeds up and slows down. Reserve
  space for late content, which you want to do anyway.
- **Give way to a dragged scrollbar.** Wheel, touch and the scroll keys end
  the animation; a scrollbar dragged with the mouse, or a middle-click
  autoscroll, sends none of those, so the animation keeps writing the
  position until it arrives — at most 640ms with the default duration.
- **Watch frames after the first.** The watchdog waits for the first frame
  only. If frames stop after that — a tab sent to the background mid-flight —
  the page waits part-way and arrives in one step when frames resume.
- **Opt out of `scroll-behavior: smooth` in a browser that does not know
  `behavior: "instant"`.** The value is a dictionary enum, so a browser that
  predates it throws rather than ignoring it (older Safari), and the fallback
  is the two-argument `scrollTo`, which the CSS property applies to.
- **Keep the URL in step with the page.** The fragment is written once, at
  activation, and only from the target's `id`. Scroll by hand afterwards and
  the URL still names the last target; scroll to a target with no `id` and
  the previous fragment stays. There is no scroll-spy.
- **Know which page it is on.** `scrollToTarget` and `<ScrollLink>` ask the
  document whether the target is there, not whether the path matches.
  `<ScrollLink href="/#work">` scrolls on any page that has a `#work` element,
  not only on `/`. Give sections that repeat across pages distinct ids.
- **Undo a focus move when the reader cancels.** Focus moves at activation
  (see above), so a reader who stops the animation half way still has focus
  on the destination.
- **Watch `prefers-reduced-motion`.** It is read per activation. Changing the
  OS setting mid-animation does not stop the one in flight; the next
  activation sees the new value.
- **Handle the landing on another page.** A link to a section on another page
  is left to the browser or the router; when the new document loads, the
  browser's own hash handling applies, and this library is not involved. If
  that landing position needs the same header offset, set
  `scroll-margin-top` in CSS — which is the case for reading it here rather
  than inventing a parallel offset.

---

## Development

```sh
npm install
npm run build      # tsup → ESM + .d.ts
npm run typecheck  # tsc --noEmit
npm test           # builds first, then vitest (jsdom)
```

The tests are written against the failure modes rather than the surface: a
repeat activation on a target the URL already points at still scrolls; a wheel
mid-flight stops the animation where it stands and the watchdog does not then
teleport the reader; with `requestAnimationFrame` stubbed to a queue nothing
drains, the watchdog still lands them on the target; reduced motion arrives in
a single instant scroll with no frame requested; a far target is still
travelling at the moment a near one has arrived.

jsdom does no layout, does not scroll, and has no `matchMedia`, so
`test/helpers.ts` owns everything the engine asks the world: element
positions, viewport and document height, the scroll position, the frame clock,
and the media query.

Three things are asserted less directly than they should be, and are worth
knowing when reading the suite:

- **`html { scroll-behavior: smooth }` is not applied,** because jsdom has
  no CSS scrolling to apply it to. What the tests pin is the call: no code
  path asks for a native smooth scroll, and every scroll performed is
  asserted to carry `behavior: "instant"`.
- **`preventScroll` is asserted as an argument, not as an effect,** because
  focusing an element in jsdom does not scroll anything in the first place.
- **A suspended `requestAnimationFrame` is simulated,** by a queue that nothing
  drains, rather than observed in a webview. The queue is the accurate model of
  the failure — callbacks registered, never called — but it is a model.

---

## License

MIT
