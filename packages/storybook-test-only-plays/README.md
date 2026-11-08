# storybook-test-only-plays

Storybook plays that run in the test run and nowhere else.

A `play` function is an interaction test: it clicks, types, opens a menu,
asserts. Storybook runs it every time a story opens — in the dev server, in a
static build, on the showcase you publish from that build. So a person who
opens a story watches the test happen: a field cleared and refilled, a button
pressed, a menu opened and closed, a theme switched and back. The page moves
on its own, and the state it lands in is whatever the last assertion left,
not the state the story describes.

This is a Vite plugin. Outside Vitest it cuts every `play` out of the story
files before anything compiles them. Under Vitest — which is how
`@storybook/addon-vitest` runs stories — it stays out of the way, and the
plays run as tests.

Extracted from a private design system, where a watch over every story found
the plays before it found anything else (see
[`tools/self-motion`](../../tools/self-motion)).

---

## Why a build step

Checked against **Storybook 10.6.3**, the preview runtime decides to run a
play in one place:

```js
// storybook/dist/preview/runtime.js
shouldEmbed = ({ search }) => new URLSearchParams(search).get("embed") === "true",
shouldAutoplay = ({ search }) => !shouldEmbed({ search });
// …
if (this.renderOptions.autoplay && forceRemount && playFunction && this.phase !== "errored") { /* run it */ }
```

and the play itself is composed as

```js
playFunction = storyAnnotations?.play ?? componentAnnotations?.play
```

That leaves three ways to stop it, and two of them do not work:

1. **`?embed=true` on the iframe URL.** It is the only thing that turns
   `autoplay` off — and it also turns on embed mode, which changes how the
   preview sizes itself. It is a URL parameter, so it cannot be set for the
   sidebar, for a static build or for a link someone shares.
2. **Project annotations** (`.storybook/preview.ts`). There is no `play` at
   the project level to override, and nothing there can wrap or remove a
   story's: the story's play wins, then the meta's. A decorator or a
   `beforeEach` runs around the render, not instead of the play.
3. **Remove the plays from the code that ships.** That is this plugin.

Docs pages already render their stories without plays unless a story sets
`parameters.docs.story.autoplay`; this is about the story view.

---

## Install

```sh
npm install --save-dev storybook-test-only-plays
```

```ts
// .storybook/main.ts
import type { StorybookConfig } from "@storybook/react-vite";
import { mergeConfig } from "vite";
import { testOnlyPlays } from "storybook-test-only-plays";

const config: StorybookConfig = {
  framework: "@storybook/react-vite",
  stories: ["../src/**/*.stories.@(ts|tsx)"],
  addons: ["@storybook/addon-vitest"],
  viteFinal: (vite) => mergeConfig(vite, { plugins: [testOnlyPlays()] }),
};

export default config;
```

That is all. `storybook dev` (mode `development`) and `storybook build`
(mode `production`) cut the plays; `vitest` (mode `test`) keeps them. The
test button in Storybook's own UI starts Vitest in a child process
(`createVitest("test", …)` in `@storybook/addon-vitest` 10.6), so it keeps
them too.

### Options

```ts
testOnlyPlays({
  // Which modules are story files (the query string is removed first).
  include: /\.stories\.[cm]?[jt]sx?$/,         // the default
  // When plays stay in. The default is how Vitest starts Vite.
  keepPlays: ({ mode }) => mode === "test",     // the default
  // A play it found but could not cut: stop the build, warn, or say nothing.
  onUncut: "error",                             // the default
});
```

`keepPlays` is the switch for anything else that needs the plays in a build —
see the Chromatic note below.

### What it cuts

Every `play` member of an object literal the file's top level hands to
Storybook:

```ts
export default { title: "Player", play };                 // the meta's, or
const meta = { component: Player, play } satisfies Meta;  // a meta exported later
export const Paused: Story = { play: async () => {} };    // CSF 3, arrow
export const Method: Story = { async play() {} };         // CSF 3, method
const base = { args, play };                              // spread into a story below
export const Spread: Story = { ...base, play: pressPlay };
```

```ts
const meta = preview.meta({ play });                      // CSF factories
export const Primary = meta.story({ play });
export const Secondary = Primary.extend({ play });
```

Each cut keeps its line breaks, so every line after it keeps its number, and
the transform returns a source map. The rest of the story — `args`, `render`,
the shared function a play referred to — is left as written; a bundler drops
a function nothing references any more.

It does **not** touch a `play` that is data or someone else's: a `play` arg
(`args: { play: true }` on a media component), anything under `parameters`,
`argTypes` or `globals`, a top-level helper object nothing exports or spreads
(`const controls = { play() { video.play(); } }`), or `video.play()` in a
render function.

### The guard

A play the transform can see but cannot safely cut stops the build, with the
file, the line and the reason:

```text
test-only-plays: 3 plays it cannot cut:
  src/card.stories.tsx:9:1 — a play assigned after the story (Assigned.play = …)
  src/card.stories.tsx:12:3 — an object passed to a call that makes a story (a factory or a wrapper)
  src/card.stories.tsx:18:5 — an object shaped like a story that is not a top-level story or meta
Write the play on the exported story object itself (`export const A = { play }`), or set `onUncut`.
```

The alternative — letting it through — is a play that runs on every open
while the config says none do. To check every story file without a build (a
unit test that walks the repo, say), call the same analysis directly:

```ts
import { analysePlays, stripPlays } from "storybook-test-only-plays";

const { cuts, uncut } = analysePlays(source, "button.stories.tsx");
const { code } = stripPlays(source, "button.stories.tsx"); // also returns cuts and uncut
```

A file that does not parse throws, rather than passing its plays through
untouched.

---

## What it will not do

- **Find a play assigned dynamically.** `Object.assign(Story, { play })`, a
  play added in a loop, a story object returned by a function it cannot see
  into, a story object imported from a non-story module and spread
  (`{ ...sharedStory }` where `sharedStory` lives in `shared.ts`). It reads
  the source of one story file; it does not run it. Some of these the guard
  reports; some are invisible to it. A runtime check catches the rest:
  `window.__STORYBOOK_PREVIEW__.currentRender.story.playFunction` is set on a
  story that still has one, and [`tools/self-motion`](../../tools/self-motion)
  fails a story on exactly that.
- **Cut `.test()` from CSF factories.** `Primary.test("saves", fn)` creates a
  child entry in the sidebar whose play *is* the test. Opening a test entry is
  asking for the test, so it is left alone and not reported.
- **Keep a story's look when its play set it up.** A play that prepares the
  story — `async ({ mount }) => { mockApi(); await mount(); }`, or one that
  opens a menu so the story shows it open — is the story's setup, not only
  its test. Cut, the story renders without it. Move setup to `loaders`,
  `beforeEach` or args, and keep the play for the checks.
- **Run under webpack.** It is a Vite plugin. Storybook's webpack builders
  are not covered.
- **Read MDX, Svelte CSF or Vue SFC stories.** It parses JavaScript and
  TypeScript CSF (`.js`, `.jsx`, `.ts`, `.tsx`, and the `.m`/`.c` variants).
- **Leave anything for tools that read plays from the build.**
  `@storybook/test-runner` (the Jest and Playwright one) drives a running
  Storybook and finds no plays in it; Chromatic captures a story after its
  play, so a build without plays snapshots the story as it opens. Both are
  the point for a person, and wrong for those tools. Give their build its own
  switch — `keepPlays: () => process.env.KEEP_PLAYS === "1"` (or'ed with the
  default) — and set the variable in that CI job only.
- **Show interactions in the dev server.** The Interactions panel has no
  steps, because there is no play. That is the trade: the steps are in the
  Vitest run, where a failing one fails the build.

---

## Development

```sh
npm install
npm run build      # tsup → ESM + .d.ts
npm run typecheck  # tsc --noEmit
npm test           # builds first, then vitest
```

The tests are fixtures, not snippets: real CSF 3 and CSF factories files with
markers in the play bodies, checked for what is cut, what is kept, and that
every line keeps its number; a file of plays it cannot cut, checked for the
line and the reason of each; and two real Vite builds of the same story file —
mode `production` ships none of the play code, mode `test` ships all of it.
The plugin tests import the built package, so what is tested is what ships.

What is not tested here is Storybook itself: the claims about
`shouldAutoplay` and play composition above were read from the 10.6.3
preview runtime, not exercised by these tests. Re-read them when you move to
a Storybook major.

---

## License

MIT
