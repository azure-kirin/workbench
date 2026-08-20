# viewport-reveal

A scroll entrance built around the four ways the obvious implementation breaks.

Content fades and rises as it comes into view. That part is unremarkable, and
there are a dozen libraries that do it. What is different here is what happens
when the browser is not a browser, when hydration is slow, when the reader
scrolls fast, and when the tab was in the background — four situations in which
the usual implementation leaves parts of the page permanently invisible.

---

## The problem

### 1. A server-rendered `opacity: 0` hides content from readers that are not a browser

The common implementation — `whileInView`, or a hook that pairs `useState` with
an `IntersectionObserver` — starts from a hidden state and animates out of it.
That hidden state is in the server-rendered HTML. Every consumer of that HTML
that does not run your JavaScript sees an empty page: search crawlers that do
not execute scripts, link-preview fetchers, text-extraction pipelines, reader
mode, the reader with JavaScript disabled, and increasingly the automated
screeners that read a page on someone's behalf.

This library inverts it. Nothing is hidden in the markup. The hidden state
lives in a stylesheet rule that applies **only** under `html.vr-js` — a class
set synchronously by a blocking inline script before the first element paints.
JavaScript opts *into* the animation instead of being required to undo it. If
the script never runs, the page is simply finished-looking, which is the
correct fallback rather than a degraded one.

### 2. The reveal must not wait for hydration

Even in a browser, a framework's entrance animation cannot start until the
framework has hydrated. On a heavy page that is seconds, and for those seconds
a hidden-by-default page shows an empty hero and blank space where content
should be. It looks like a page that failed to load, because functionally it
is one.

The engine here is plain DOM code running from the first painted frame. There
is no framework in the critical path. The React wrapper renders a `<div>` with
an attribute on it and ships no JavaScript of its own.

### 3. An IntersectionObserver samples, and a fast flick can outrun it

An observer answers "is this element intersecting the viewport *right now*",
at whatever moments it happens to sample. A fast scroll can carry an element
from below the fold to entirely above the top of the viewport between two
samples. The observer never fires for it, and it stays at `opacity: 0` for the
rest of the session — permanently blank, in a region the reader has already
scrolled past and will scroll back to.

This engine sweeps instead. On each throttled frame it walks the set of
still-hidden elements and asks a different question: *is your top above the
fold line*. An element that has already passed the viewport answers yes, so
nothing can be skipped. The set only ever shrinks, so the cost of the sweep
trends to zero as the reader moves down the page.

### 4. `requestAnimationFrame` is frozen while a tab is hidden

Open a link in a background tab and the browser will lay the page out and
restore its scroll position without ever running a frame. A scroll handler that
schedules its work with `requestAnimationFrame` — which is the correct way to
throttle a scroll handler — queues a callback that never runs. The reader
switches to the tab and finds a blank page that only fills in when they nudge
the scroll wheel.

So `visibilitychange` and `pageshow` sweep **directly**, with no frame in the
path. Those two events are the moments at which the page might be visible for
the first time with work already outstanding.

### And two smaller ones

**Hydration mismatch.** A pre-hydration script that mutates `class` on elements
React owns causes hydration warnings on every page. React's hydration pass
walks every live attribute of a node and reports the ones it did not render
itself — not just the ones it recognises, so renaming the class to a `data-`
attribute does not help. The answer is a narrowly-scoped
`suppressHydrationWarning`, on the two elements that are genuinely co-owned
(`<html>` and each reveal wrapper) and nowhere else. Suppression is one level
deep, so children stay checked.

**Reduced motion.** `prefers-reduced-motion: reduce` is handled by the engine
declining to add the gate class at all, so nothing is ever hidden and there is
**no** animation — rather than a fast one, which is what a shortened duration
gives you.

---

## Install

```sh
npm install viewport-reveal
```

React is an optional peer dependency; the core has no dependencies at all.
The package is ESM only.

---

## Usage

### With React

```tsx
// Root layout — once per app.
import "viewport-reveal/styles.css";
import { RevealScript } from "viewport-reveal/react";

export default function Layout({ children }) {
  return (
    // The engine adds a class to <html> before React hydrates.
    <html lang="en" suppressHydrationWarning>
      <body>
        {/* First thing in <body>, before anything that reveals. */}
        <RevealScript />
        {children}
      </body>
    </html>
  );
}
```

```tsx
import { Reveal } from "viewport-reveal/react";

export default function Page() {
  return (
    <main>
      {/* Above the fold: no entrance. The first screen paints finished. */}
      <Reveal trigger="none">
        <h1>Heading</h1>
      </Reveal>

      <Reveal>
        <p>Reveals when it reaches the fold line.</p>
      </Reveal>

      {/* A stagger, in plain milliseconds. */}
      <Reveal delay={0}>…</Reveal>
      <Reveal delay={80}>…</Reveal>
      <Reveal delay={160}>…</Reveal>
    </main>
  );
}
```

`Reveal` and `RevealScript` use no state, effects or refs, so neither needs
`"use client"`; in React Server Components both render on the server.

### Without React

The engine is plain DOM code and the contract is two attributes and one class.
Anything that can emit HTML can use it.

```js
import { revealScriptSource } from "viewport-reveal";

const html = `
  <body>
    <script>${revealScriptSource()}</script>
    <div data-reveal>…</div>
  </body>
`;
```

```astro
---
import { revealScriptSource } from "viewport-reveal";
import "viewport-reveal/styles.css";
---
<body>
  <script is:inline set:html={revealScriptSource()} />
  <div data-reveal>…</div>
</body>
```

Write the returned string into an inline `<script>` at the top of `<body>` —
not `<head>` (the engine observes `document.body`, which does not exist yet
there) and not lower down (everything above it would paint and then be
hidden).

---

## API

### `viewport-reveal`

| Export | Type | |
|---|---|---|
| `revealScriptSource(options?)` | `(o?: RevealEngineOptions) => string` | The engine as a string, for an inline `<script>`. The primary delivery mode. |
| `initReveal(options?)` | `(o?: RevealEngineOptions) => () => void` | Runs the engine against the current document; returns a teardown. See the caveat under Limitations. |
| `stagger(step)` | `(n: number) => string` | A delay of `n` steps of `--vr-stagger`. |
| `REVEAL_ROOT_CLASS` | `"vr-js"` | The gate class, for consumers writing their own CSS or assertions. |
| `REVEAL_ATTR` | `"data-reveal"` | |
| `REVEAL_MOUNT_ATTR` | `"data-reveal-mount"` | |
| `REVEALED_CLASS` | `"vr-revealed"` | |
| `REVEAL_DELAY_PROPERTY` | `"--vr-delay"` | |

`RevealEngineOptions` has one field, `offset` (default `24`): how far above the
bottom viewport edge the fold line sits, in px. An element reveals when its top
crosses that line.

### `viewport-reveal/react`

**`<Reveal>`**

| Prop | Type | Default | |
|---|---|---|---|
| `trigger` | `"view" \| "mount" \| "none"` | `"view"` | When the entrance plays. |
| `delay` | `number \| string` | — | Number is milliseconds. A string is used as-is, so any CSS `<time>` or `calc()` works. |
| `as` | `ElementType` | `"div"` | |
| …rest | — | — | Forwarded. The reveal attributes are applied after the spread, so a caller cannot clobber them. |

`trigger="mount"` plays the entrance on insertion as a pure CSS animation, for
content that appears in a dialog, a portal or a fixed overlay, where "scrolled
into view" has no meaning and the sweep would never fire.
`trigger="none"` renders the element plain and finished — use it above the
fold.

**`<RevealScript>`** takes `RevealEngineOptions` plus an optional `nonce` for
CSP.

### CSS custom properties

All four have defaults; set any of them anywhere — `:root` for the whole page,
or on a subtree to give one section its own rhythm.

| Property | Default | |
|---|---|---|
| `--vr-duration` | `220ms` | One element's travel. |
| `--vr-distance` | `12px` | How far it rises. |
| `--vr-easing` | `cubic-bezier(0.22, 1, 0.36, 1)` | |
| `--vr-stagger` | `60ms` | One step of `stagger()`. |

```css
:root {
  --vr-duration: 300ms;
  --vr-distance: 20px;
}
```

The entrance is opacity plus a short rise, and nothing else. A blur filter on
text is both the most expensive thing a compositor can be asked to do and the
one thing that makes copy unreadable for exactly as long as it plays.

---

## Design decisions

### The tokens are `var(--x, default)` fallbacks, not a `:root` block

The stylesheet ships no `:root` declarations. Each knob is read at its use site
as `var(--vr-duration, 220ms)`.

The alternative — declaring defaults in a `:root` block inside the package's
stylesheet — has the same specificity as the `:root` block in the consumer's
stylesheet, so which one wins depends on the order the bundler happened to
concatenate them in. That is a real and unpleasant class of bug: it works in
dev, where CSS is injected in import order, and inverts in a production build
where it is not. Written as fallbacks, a consumer declaration anywhere wins,
at any scope, in any order.

The cost is that the defaults are repeated at each use site rather than stated
once, which is slightly more to keep in sync. A test asserts that every knob
is read with a fallback and that no `:root` block has crept back in.

A third option — a JavaScript theme object passed to the script — was rejected
because it puts style values on the critical path and makes them impossible to
override from a stylesheet, which is where a consumer's design tokens already
live.

### `delay` is milliseconds

In the code this grew out of, `delay` was a step index in one site's
cascade rhythm, multiplied by a CSS token: `delay={0.15}` meant "0.15 of a
400ms budget", i.e. 60ms. That is a fine site convention and an indefensible
public API — a number that is neither a duration nor a count, whose meaning
lives in a token in another file.

`delay` is now milliseconds, which is what a stranger will assume it is. But
the site convention was solving something real: it let the whole page's rhythm
be re-tuned by moving one token. So the prop also accepts a string, used as-is,
and `stagger(n)` builds one:

```tsx
<Reveal delay={stagger(0)}>…</Reveal>
<Reveal delay={stagger(1)}>…</Reveal>
```

which is `calc(1 * var(--vr-stagger, 60ms))`. Override `--vr-stagger` and every
stepped delay moves. The obvious thing is the default; the powerful thing is
one function call away.

A second prop (`delay` *and* `step`) was rejected as two props for one concept,
where every caller would have to be told which one wins.

### The engine is framework-agnostic; React is one entry point

The React wrapper is fifty lines and renders an element with an attribute on
it. The engine is the whole library, and it has nothing to do with React. So
`viewport-reveal` is the engine plus the contract constants and imports no
React at all, and `viewport-reveal/react` is the optional wrapper. React is an
optional peer dependency.

The thing this deliberately does not do is ship a wrapper per framework. There
is no Vue, Svelte or Solid entry point, because there is nothing framework-
specific left to write once the engine exists: the wrapper's entire job is to
put `data-reveal` on an element, and every framework can do that without help
from this package. Shipping three more thin wrappers would be three more
things to version.

### The inline script is a stringified function, not a second copy

`revealScriptSource()` returns `revealEngine.toString()` wrapped in an IIFE.
There is one implementation, and the thing that runs inline is the same code
you read and test.

The alternative — hand-maintaining a minified string alongside the readable
source, which is what the original did — means two implementations that
drift. The cost of the approach chosen is a constraint that is easy to violate
silently: the function must reference nothing outside its own scope, or the
bundler will hoist an identifier out of it and the inline copy will throw a
`ReferenceError` in production while every unit test still passes. That is
pinned by a test that evaluates the generated string in a bare `new Function`
scope, against the **built** artifact rather than the source, and by turning
off esbuild's `keepNames` (which wraps functions in a helper that lives outside
the stringified body).

The script is ~3.3 kB unminified, and it is left unminified deliberately: it is
the one piece of code that appears in the page source of every page that uses
this, and it should be readable there. It compresses with the rest of the
document.

### The names are constants, not options

`vr-js`, `data-reveal`, `vr-revealed` are not configurable. The shipped
stylesheet keys on those literals, so making them options would only let a
consumer break the pairing between the script and the CSS. They are exported as
constants instead, for consumers who write their own CSS or assert on rendered
markup. Only behaviour is configurable — currently just `offset`.

### Four start triggers

`DOMContentLoaded` may have already fired, `load` waits on images, and both can
be missed on a bfcache restore, so there is also a 2000ms backstop. `start()`
is idempotent, which makes the redundancy free.

---

## Limitations

**An inline script is required, and some setups cannot have one.** The gate
class has to be on `<html>` before the first `[data-reveal]` element paints.
A `<script src>` is a network round trip and a `type="module"` script is
deferred by definition; either one lets the page paint content, then hide it,
then animate it back — a flash on every load. So an inline classic script is
the only mechanism that works, and if your platform strips inline scripts or
does not let you control the top of `<body>`, this library cannot do what it
claims. Use something else rather than accepting the flash.

**A strict CSP needs a hash or a nonce.** `script-src 'self'` will block the
inline script. Either pass a nonce (`<RevealScript nonce={nonce} />`) or add
the hash of the exact source you ship:

```sh
node -e "import('viewport-reveal').then(async m=>{const{createHash}=await import('node:crypto');console.log('sha256-'+createHash('sha256').update(m.revealScriptSource()).digest('base64'))})"
```

The hash changes whenever the engine or the options change, so compute it in
the build rather than pasting it into a config.

**`initReveal()` is not equivalent to the inline script.** It exists for tests
and for setups that mount the engine from an application bundle. By the time a
bundle runs, the page has painted — so the content appears, then hides, then
animates in. That is exactly the flash the design avoids. It is exported
because it is occasionally the right trade, not because it is a supported
substitute.

**The sweep is not free on very large pages.** It is O(still-hidden elements)
per frame, throttled to one frame, and the set only shrinks — but a page with
several thousand `[data-reveal]` elements above the reader will do measurable
work on the first frames. If that is your page, the entrance is probably not
your biggest problem, but it is worth knowing.

**A `[data-reveal]` element inside a scrollable container is not handled.** The
fold line is the viewport's. An element that scrolls within an overflow
container, rather than with the page, will reveal when the container's position
in the viewport crosses the line, not when the element does.

**Reduced motion is decided once, at start.** The engine checks the preference
when it runs and, if set, never adds the gate class. Flipping the OS setting
afterwards will not start animating a page that is already loaded — the
stylesheet only guarantees that nothing is left hidden.

---

## Development

```sh
npm install
npm run build      # tsup → ESM + .d.ts
npm run typecheck  # tsc --noEmit
npm test           # builds first, then vitest (jsdom)
```

The tests are written against the failure modes rather than the surface: an
element that is already past the viewport reveals; a frozen `requestAnimation-
Frame` does not stop a `visibilitychange` sweep; reduced motion leaves the gate
class absent so nothing is ever hidden; the server-rendered markup contains no
hidden state; the generated inline script evaluates in a bare scope.

One thing is asserted less strongly than it should be: jsdom returns `""`
rather than the initial value for a property no rule sets, so "this element is
visible without the gate class" is tested as *no rule makes it transparent*
plus *the hidden rule's selector does not match it*, rather than as a computed
`opacity` of exactly `1`. Real hydration is not tested either — `<Reveal>`'s
`suppressHydrationWarning` is asserted on the rendered element rather than by
observing React's hydration warnings, which would need a real browser.

---

## License

MIT
