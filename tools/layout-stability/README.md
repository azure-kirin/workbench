# layout-stability

UI jitter is chrome that moves when it shouldn't: a search bar that changes width when a filter
turns on, rows that squeeze when an in-flow bar appears, a header that stays collapsed after leaving
a mode. The eye catches it only in motion. This tool catches it in numbers.

It drives a page (or a Storybook story) in headless Chromium, measures the bounding boxes of named
**anchors**, performs each interactive **action**, and re-measures twice: *during* the action and
*after restoring* the initial state. Every anchor that moved or resized when it was expected to stay
put is printed as per-axis px deltas. Exit code 1 on any violation, so it gates CI.

## What it will not do

- It does not find anchors for you. The registry is the project's; an anchor that is not listed is
  not measured.
- It does not measure animation. Transitions and animations are disabled globally before the first
  measurement — the assertion is about settled layout per state, not frames in between.
- It cannot run in jsdom. `getBoundingClientRect` computes no layout there; the dev server or
  Storybook must be up and reachable at `--base-url`.
- It does not decide what counts as designed movement. Declare it per action (`mayChange`,
  `mayHide`); nothing is exempt after restore, by design — sticky drift after an undo is jitter too.

## Usage

Run it from the project you are auditing — `playwright` is resolved from that project's
`node_modules` (peer dependency; Chromium must be installed there).

```sh
node ~/workbench/tools/layout-stability/layout-stability.mjs                 # every audit in ./layout-audits.mjs
node ~/workbench/tools/layout-stability/layout-stability.mjs chats-requests  # one audit
node ~/workbench/tools/layout-stability/layout-stability.mjs --config scripts/layout-audits.mjs --base-url http://localhost:6008
```

Installed as a dev dependency (`file:` or from a registry) it is also available as `npx layout-stability`.

## Registry

A module that default-exports `{ audits, frameChecks? }`:

```js
export default {
  frameChecks: "ios",            // optional default for every audit; built-in preset or your own array
  audits: {
    "chats-requests": {
      story: "prototypes-ios-chat--chats-requests",   // or url: "/messages"
      viewport: { width: 480, height: 950 },          // optional
      anchors: {
        frame: "[data-prototype-frame]",
        search: 'input[placeholder="Search"]',
        firstRow: 'text="Maya Chen"',
        bottomBar: '[data-slot="bottom-bar"]',
      },
      actions: [
        {
          name: "saved filter ON (chips row appears)",
          perform: async (page) => { /* … */ },
          restore: async (page) => { /* … */ },
          mayChange: ["firstRow"],   // content legitimately shifts
          mayHide: [],               // anchors allowed to leave the DOM
        },
      ],
    },
  },
};
```

Anchors are Playwright locator strings; the first match wins, so keep them unambiguous.

`frameChecks` asserts baseline geometry. The built-in `"ios"` preset (artwork reaches the frame top,
status bar flush with frame top, top bar flush with status bar) expects anchors named `frame`,
`background`, `statusBar`, `topBar`; the frame's own border width is excluded from the gap via
computed style. Write your own checks as `{ name, measure(boxes, ctx), ok(value), describe(value) }`.

## Reading the report

- **`during` violation** — the action moved chrome it should not touch.
- **`after restore` violation** — state leaked: the screen did not return to baseline after undoing
  the action (a collapsed header that stayed collapsed).
- Tolerance is 0.5px: sub-pixel rendering noise is not jitter.
