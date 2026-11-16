# self-motion

A page a person opens never moves on its own. Nothing scrolls, takes focus,
replays an entrance, swaps its font, pushes content down when an asset
arrives, or mounts a toast a second later. Only designed loops move — a
spinner, a shimmer, a drifting background — and those are named.

Each of those is invisible in review. A screenshot is taken after the motion
has finished; a test asserts the final state; the person reviewing a story in
the dev server has usually opened it before, with a warm cache and the fonts
already loaded. The first-time visitor is the one who sees it, and they do not
report it — the page just feels unsteady.

This tool opens every story in a Storybook, in headless Chromium, at each
viewport, waits for the story to finish rendering and for its fonts, and then
watches it for three seconds without touching it. Anything that changed is a
finding, printed under the story and the viewport it moved in. Exit code 1 on
any finding, so it gates CI.

It was extracted from a private design system, where its first run found
every failure in the log below.

## What it watches

From navigation on, before any page script runs:

- **layout-shift entries** (Chromium's), with the nodes that shifted and
  their boxes before and after — so a font swap during first paint counts
  even though it is over by the time the watch begins;
- **focus**: every `focusin`, with the time it landed.

Then three looks across the watch window, the first once the story has
reached Storybook's `finished` render phase and `document.fonts.ready` has
resolved:

- **scroll** of the window and of every scrolled element;
- **`document.activeElement`**;
- **boxes** of the watched elements, and how many of each there are;
- **finite animations** still running (an entrance replaying, a transition
  that never ends);
- **a screenshot**, compared with the previous one in 16 px tiles.

And, once: whether the story still has a **play function** in this build.

## What it excuses

- **Infinite animations** — CSS or Web Animations with `iterations:
  Infinity`: their targets leave the boxes, and their boxes, grown by half
  their size on every side (a ping doubles, a spinner turns), leave the
  pixels. Nothing to configure.
- **Masks** — selectors for designed motion that is *not* an animation: a
  canvas, a video, a background driven by `requestAnimationFrame`. Masked
  elements leave the boxes and the pixels.
- **Looping stories** — ids (or globs) that move on purpose, each with its
  reason. They are still checked for scroll and focus, and the reason is
  printed on every run, so a story parked there stays visible.

Everything else that moves is a bug in the story or in the component.

## Usage

Run it from the project you are watching — `playwright` is resolved from that
project's `node_modules` (a peer dependency; Chromium must be installed
there).

```sh
node ~/workbench/tools/self-motion/self-motion.mjs                        # every story at localhost:6006
node ~/workbench/tools/self-motion/self-motion.mjs --base-url http://localhost:6008
node ~/workbench/tools/self-motion/self-motion.mjs --static storybook-static   # serve a build (CI)
node ~/workbench/tools/self-motion/self-motion.mjs --viewport phone 'button--*' card--gallery
```

Installed as a dev dependency by path (`file:`; it is not on npm) it is also
available as `npx self-motion`.

In CI, watch a static build, not the dev server: `storybook build --quiet &&
self-motion --static storybook-static`. The build is what a visitor gets.

| Flag | |
|---|---|
| `--base-url <url>` | The Storybook to watch. Default `http://localhost:6006`. |
| `--static <dir>` | Serve a built Storybook from `<dir>` on a free port instead. |
| `--config <file>` | Config module. Default `./self-motion.config.mjs`, if there is one. |
| `--viewport <spec>` | Names from the config, `all` (or `both`), or `<w>x<h>`; comma-separated. Default: all. |
| `--watch <ms>` | How long each story is watched. Default `3000`. |
| `--mask <selector>` | Designed motion to mask. Repeatable; adds to the config's. |
| `--loop <id\|glob>` | A story that loops on purpose. Repeatable. |
| `--exclude <id\|glob>` | A story not to open. Repeatable. |
| `--boxes <selector>` | The elements whose boxes are watched. |
| `--box-name <attr>` | The attribute that names them in the report. |
| `--allow-plays` | A play left in the build is not a finding. |
| `--cold` | A fresh browser context per story: an empty cache every time. Slower. |
| `--concurrency <n>` | Stories watched at once. Default `4`. |
| `--json <file>` | Write the report as JSON. |

Positional arguments are story ids; `*` matches any run of characters.

Exit code `0` when nothing moved, `1` when a story moved, `2` on a usage
error, an unreadable `index.json` or no stories to watch.

## Config

A module that default-exports any of these; the command line adds to masks,
loops and exclusions and wins on everything else.

```js
// self-motion.config.mjs
export default {
  baseUrl: "http://localhost:6006",
  viewports: {
    desktop: { width: 1280, height: 900 },
    phone: { width: 390, height: 844 },
  },
  // Designed motion that is not a CSS animation.
  mask: ["[data-animated-background]", "canvas.confetti"],
  // Stories that move on purpose, each with why. Scroll and focus still count.
  looping: {
    "examples-easing--*": "the easing demos loop",
    "charts--live": "streams sample data on a timer",
  },
  exclude: ["playground--stress-test"],
  // Which index entries count: every `include` tag, no `exclude` tag.
  tags: { include: ["dev"], exclude: [] },
  // Opt in to named boxes, if your components carry a name attribute.
  boxes: { selector: "[data-part]", name: "data-part" },
  watch: 3000,        // ms
  shots: 3,           // screenshots across the watch
  tile: 16,           // px
  pixelTolerance: 8,  // per colour channel, 0–255
  boxTolerance: 0.5,  // px
  concurrency: 4,
};
```

**Which stories.** Every `type: "story"` entry in `index.json` that has the
`dev` tag — the stories in the sidebar. Docs entries are never opened; nor
are stories tagged `!dev` (test rigs that exist to carry a play), nor CSF
factories' `.test()` children, which are tests a person opens on purpose.
An index without tags (Storybook 7) counts every story.

**Which boxes.** By default, the boxes watched are the story root and the
two levels under it, whatever is mounted straight into `<body>` (a portal, a
toast region), and the landmarks and media anywhere on the page: `header`,
`nav`, `main`, `aside`, `footer`, `dialog`, `img`, `video`, `iframe`, and the
landmark, `dialog`, `status`, `alert` and `log` roles. They are named by tag,
`id` and `role`. If your components carry a name attribute — a `data-part`,
a `data-testid` — set `boxes` to watch every one of them by that name; the
report then reads `[menu-item#3] moved …` instead of `[div#3] moved …`, and
focus findings say which named part the focused element sits in.

## Reading the report

```text
desktop 1280 × 900: 84 stories in 41s
  · examples-easing--curves: pixels, boxes and layout shifts not compared: the easing demos loop
  ✗ card--with-image
      layout shift 0.0412 at -1840 ms: img "Cover" {"x":24,"y":96,"w":320,"h":0}→{"x":24,"y":96,"w":320,"h":180}
      [div#1] moved [24,96,320,48] → [24,276,320,48]
```

(An illustration, not a real run.) Times are relative to the start of the
watch: a negative time happened between navigation and the first look.

- **`the story has a play in this build`** — Storybook runs it on every open.
- **`scrolled at load` / `scroll changed`** — the page or a scroller is not
  where it opened, or moved while watched.
- **`focus on load` / `focus moved` / `focus landed at … ms`** — something
  took focus without being asked. Focus taken and released before the first
  look never painted and is not reported.
- **`layout shift <score> at <t> ms`** — content moved under the reader, any
  time since navigation, with the nodes that moved.
- **`[name#n] moved [x,y,w,h] → [x,y,w,h]`**, **`[name] count a → b`** — a
  watched box moved or resized, or one appeared or left.
- **`animation running after load`** — a finite animation still playing at
  the second or third look.
- **`pixels changed (shot i→j): n tiles in x …, y …`** — the picture changed
  outside every mask, with the box around the changed tiles.
- **`page error`**, **`the story threw`**, **`could not watch`** — the story
  failed; that is a finding too.

## The failure log

What the first run found, and what fixed each.

### 1. Storybook runs a story's `play` on every open

*What it looked like.* A gallery opened, and then a field cleared itself and
refilled, a button pressed, a menu opened and closed, a theme switched and
back — the checks, performed in front of whoever opened the page. And since
a play runs once and is not undone, the page ended in whatever state its last
step left.

*Cause.* A `play` is an interaction test, and Storybook's preview runs it on
every render of the story view. The only switch is `?embed=true` on the
iframe URL, which also turns on embed sizing, and nothing in the project
annotations can skip a story's play (checked against Storybook 10.6.3).

*Fix.* Cut the plays from every build that is not a test run, with
[`storybook-test-only-plays`](../../packages/storybook-test-only-plays).
Vitest keeps them. A play that survives the cut — `Story.play = …`, a story
built by a factory — is what this tool reports as `the story has a play in
this build`: it reads `currentRender.story.playFunction` from the preview,
because the play itself is over by the time the watch begins.

### 2. Web fonts swapping after first paint

*What it looked like.* On a first open the text set in the fallback face,
then re-set in the web font a moment later. Every line under the swap moved:
wrapped lines changed count, columns changed width, a pill grew. On every
later open the font was cached and nothing moved, which is why nobody had
seen it.

*Cause.* `font-display: swap`. The story renders as soon as it can, with
whatever face is ready; the real one arrives after paint and the text is laid
out again. Measurements taken at render (a popup's position, a truncation)
are taken against the wrong face and are then wrong.

*Fix.* Load the faces before the story renders: a Storybook loader that
awaits `document.fonts.load()` for each family and weight the theme uses, in
`.storybook/preview.ts`. (Preloading in `preview-head.html` helps the first
paint but does not hold the render.) The tool sees the swap as `layout shift`
entries with a negative time — before the watch, after navigation. Run with
`--cold` to give every story an empty cache; with a shared cache only the
first stories opened pay for the fonts.

### 3. A held-open popup taking focus and scrolling the page

*What it looked like.* A gallery that shows a menu or a list held open, so a
screenshot shows it, opened scrolled halfway down, with a row highlighted.

*Cause.* A menu or a listbox focuses itself when it opens — correct for a
person who opened it, wrong for a page that opens with it already open. The
browser scrolls the focused element into view.

*Fix.* In the wrapper that holds the popup open for a gallery, let that focus
go (blur it, or open with `initialFocus` off where the library has one) and
put the scroll back, until the visitor first touches the page. The tool
reports it as `focus on load` and `scrolled at load`; a popup that takes
focus and lets it go in the same task never paints, and is not reported.

### 4. Async content arriving after paint and pushing content down

*What it looked like.* Three reference pages jumped a moment after opening.
On each, something arrived after the first paint — a count, an icon set, an
image — and pushed everything under it down.

*Cause.* Anything the story fetches, imports lazily or measures after mount
lands after the first paint. If the space it needs was not held, everything
after it moves.

*Fix.* Hold the space: an image gets its `width` and `height` (or an
`aspect-ratio`); a number that arrives later sits in a box sized for its
widest value; a list that loads renders a skeleton of its final size. Or
load it before the render, in a loader, so the story renders once with it.
The tool reports a `layout shift` with the nodes that moved, the boxes that
moved, and the changed tiles.

### 5. A toast or other portal content mounting after first paint

*What it looked like.* A toast appeared after the page had opened and
settled, in a corner of the viewport, outside the story's own frame.

*Cause.* A demo that calls `toast()` from an effect or a timer, or a popup
that positions itself after measuring, mounts into `<body>`, outside the
story root, after the render that Storybook waits for.

*Fix.* A gallery shows a toast rendered in place, open, with no timer — the
same component, not the toaster. A demo that fires real toasts does it from
a button. The tool watches whatever is mounted straight into `<body>`, so a
late portal shows as `[div[role=status]] count 0 → 1` and as changed tiles
where it landed.

## What it will not catch

- **A colour-only flicker on the sampling rhythm.** It compares three
  screenshots, at the start, the middle and the end of the watch. A change
  that is back where it was at each of those moments — a blink, a colour that
  pulses on a period that divides the sampling interval — is invisible to it.
  Boxes and layout shifts do not help: a colour change moves nothing.
- **Anything slower than the watch window.** A timer at five seconds, a poll,
  a lazy image that arrives after three seconds, an entrance on a long delay.
  Raise `--watch` to look longer; there is no length that proves nothing will
  ever move.
- **Motion that needs a person.** Hover, scroll-linked effects, anything
  after an input. It never touches the page, by design; interactive states
  belong to [`layout-stability`](../layout-stability).
- **What a mask hides.** A mask is trusted. Everything inside a masked
  element leaves the boxes and the pixels — mask the moving layer, not its
  container.
- **Docs pages.** It opens story entries in the story view only.
- **Other engines.** Layout-shift entries are Chromium's; it runs Chromium
  only, so a Safari-only reflow is not seen.
- **The cause.** It names what moved and when. Why is still a person's job,
  and the failure log above is where that work starts.

## Development

```sh
npm install          # Playwright, for the fixture test
npm test             # node --test
```

The comparison and the decisions are pure modules, tested on their own:
`lib/tiles.mjs` (changed tiles, the tolerance boundary, masks with their
margin, and that the function still works from its own source text, which is
how the runner ships it into the browser), `lib/judge.mjs` (every finding and
every excuse, on recorded samples) and `lib/options.mjs` (flags, config,
viewports, story selection). `test/fixture.test.mjs` runs the whole tool
against `test/fixture/storybook-static` — not Storybook, but a page with the
four things the tool reads from a Storybook preview and one scenario per
failure — and is skipped, with the reason, when Chromium cannot launch.
