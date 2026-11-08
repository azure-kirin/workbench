# workbench

A scroll entrance is four lines of CSS until you notice that the `opacity: 0` it
starts from is what a search crawler sees, that it cannot begin until the
framework has hydrated, that an `IntersectionObserver` can be outrun by a fast
flick, and that `requestAnimationFrame` is frozen while a tab is in the
background. Each of those leaves part of the page permanently blank, in
production, for someone who will not report it.

The interesting part of a small front-end primitive is never the effect. It is
the list of conditions under which the obvious implementation quietly does
nothing. This repository is a place to write those lists down and build against
them.

The same is true one level up. A coding agent starts every session knowing
nothing — not who decides what, not where the spec lives, not that the approach
it is about to take was tried and rejected last month — and the parts you forget
to tell it are the parts that come back wrong.

## What's here

**[`docs/`](./docs)** — the method. A four-layer context system (vault,
`CLAUDE.md`, memory, skills) and the protocols that run on top of it: leaving an
agent working unattended overnight, turning a locked spec into an enumerated
state space, driving a design tool through its plugin API, porting a prototype
in either direction, auditing the whole harness when a new model lands. Most of
it reads as a failure log, because that is how it was learned.

**[`packages/viewport-reveal`](./packages/viewport-reveal)** — content fades and
rises as it comes into view. Nothing is hidden in the markup: the hidden state
lives behind a class set by a blocking inline script, so JavaScript opts *into*
the animation rather than being required to undo it, and a reader that does not
run scripts gets a finished page. No dependencies, optional React entry, ESM
only, 52 tests.

**[`packages/target-scroll`](./packages/target-scroll)** — scrolls the page
to an element by hand, because both native ways fail without a word: in
Chromium `overflow-x: clip` turns a smooth `scrollIntoView` into nothing, and
a hash link is inert once the hash already matches. Every frame is an instant
scroll, a watchdog jumps to the target when `requestAnimationFrame` never
ticks, and the reader's own wheel, touch or scroll key ends it. No
dependencies, optional React entry, ESM only, 62 tests.

**[`packages/storybook-test-only-plays`](./packages/storybook-test-only-plays)**
— Storybook runs a story's `play` every time the story opens, so a person
opening a page watches its test click and type. This Vite plugin cuts every
play from the story files outside Vitest, so the dev server and every build
open still, while `@storybook/addon-vitest` keeps them; a play it cannot cut
stops the build. ESM, typed, tested on CSF 3 and CSF factories fixtures and on
real Vite builds.

**[`tools/self-motion`](./tools/self-motion)** — opens every story a Storybook
lists, at each viewport, and watches it for three seconds without touching it:
scroll, focus, layout shifts, boxes, animations still running, pixels. It
names what moved on its own, with masks for the loops that are meant to. The
README is the failure log it was built from: plays, font swaps, popups taking
focus, late content, late toasts.

**[`tools/page-checks`](./tools/page-checks)** — five checks against a built
site, each written down after it had gone wrong: a space swallowed at an
inline tag in the served HTML, contrast for every colour pair a page actually
renders, sideways scroll a reader can actually perform, console errors, and
internal links and fragments that resolve. One binary, one exit code, and
every check prints what it skipped. The README keeps the two checks that were
cut, and why.

## Development

pnpm workspace, Node 22. Each package builds and tests on its own:

```sh
cd packages/viewport-reveal
npm install
npm test        # builds first, then vitest
```

The tools under `tools/` run from the project they check, with Playwright
resolved from that project. `tools/self-motion` (`node --test`) and
`tools/page-checks` (vitest) test the same way, with `npm install` and
`npm test`.

MIT licensed.
