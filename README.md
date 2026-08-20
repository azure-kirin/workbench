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

## What's here

**[`packages/viewport-reveal`](./packages/viewport-reveal)** — content fades and
rises as it comes into view. Nothing is hidden in the markup: the hidden state
lives behind a class set by a blocking inline script, so JavaScript opts *into*
the animation rather than being required to undo it, and a reader that does not
run scripts gets a finished page. No dependencies, optional React entry, ESM
only, 52 tests.

That is one package. Two more — an interruptible scroll-to-target, and a set of
build-time page checks — are on branches, and land here once each has a README
that says plainly what it will not do.

## Development

pnpm workspace, Node 22. Each package builds and tests on its own:

```sh
cd packages/viewport-reveal
npm install
npm test        # builds first, then vitest
```

MIT licensed.
