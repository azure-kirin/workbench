# page-checks

Five build-time checks against a site that has already been built, each one
written down after it had gone wrong at least once.

None of them are clever. They are all things a careful person catches by
reading every page at three widths before every release, and stops catching in
the third month of doing that.

```sh
npx page-checks http://localhost:3000
```

```
page-checks · http://localhost:3000 · 10 pages

glue     ✗ 3 glued boundaries
           /guide:1 — no space at `</strong>i`
             a record is <strong>immutable</strong>in the store, so a writer
contrast ✗ 2 colour pairs below the threshold, on 7 text runs
           #5a627f on #080a15 — 3.27:1, needs 4.5:1 ×6
             e.g. p.meta on /about — "Remote"
           (1005 text runs, 64 distinct colour pairs, 12 text runs skipped)
overflow ✓ no horizontal scroll at 390 / 768 / 1440px
console  ✗ 1 distinct console error on 9 pages
           / — Failed to load resource: 404 — /_analytics/script.js ×9
links    ✓ 145 internal links followed

6 findings
```

Exit code 1 if anything is found. That is the whole interface.

---

## The checks

### 1. Whitespace swallowed at an inline-element boundary

Scans the served HTML for a letter, a dash or a quotation mark pressed directly
against the edge of an inline `<em>`, `<strong>` or `<code>`.

**The failure.** In JSX a newline and its indentation next to a tag are not
significant whitespace. So a line like

```jsx
<p>A record is <strong>immutable</strong> once it has been written.</p>
```

reflowed by a formatter to

```jsx
<p>
  A record is <strong>immutable</strong>
  {" "}once it has been written.
</p>
```

is fine — but the same reflow without the explicit `{" "}` produces
`immutableonce` in the built page, and nowhere else. The source looks correct.
The diff looks correct. Prose review catches it only if someone re-reads that
exact sentence after the reformat, which is the one moment nobody does. It kept
recurring across a run of editing sessions, always found by reading the live
page and never by anything in the build, which is what made it worth a check.

It reads the built HTML rather than the source, so it is not a JSX check —
anything that emits HTML through a formatter has the same failure, and the same
scan catches it.

**What it does not flag.** Punctuation that never takes a leading space
(`,` `.` `;` `:` `)` `'` `’`), because `<em>hers</em>’s` and `<em>both</em>,` are
correct. A plain hyphen, because `<em>daemon</em>-like` is correct. Scripts that
do not separate words with spaces (Han, Hiragana, Katakana, Hangul, Thai, Lao,
Khmer), where the whole premise does not hold. Anything inside `<script>` or
`<style>`, because serialised framework payloads carry markup that is not prose.

Genuine intra-word emphasis — `<em>re</em>entrant` — is a real construction and
the check cannot tell it from the bug. Add it to `glue.allow`, as a literal.

### 2. Contrast, against the colours a page actually renders

Loads each page, walks every element that paints its own text, and computes the
WCAG ratio between the computed `color` and the flattened background stack
behind it. Findings are grouped by **colour pair**, not by element.

**The failure.** The version this replaces read the design tokens out of the
stylesheet and checked each text role against each surface role — four
foregrounds, two backgrounds, eight assertions, no browser. It was fast and it
was reassuring and it was wrong in the two ways that matter.

It could not see a role used at reduced opacity. A tertiary text token chosen to
clear 4.5:1 was applied as `text-tertiary/70` in one place, which composites to
3.27:1 against the page background. Every token in the file still passed. The
rendered page did not.

And it could not see which surfaces a role actually lands on, so the pairing was
a guess written by hand — which meant it both checked pairs that never occur and
missed the ones nobody thought of. The colour a card gets when a translucent
tint sits over another translucent tint over the canvas is not in any token
file; it exists only once the page is composited.

Measuring instead of declaring removes both. There is nothing to configure:
whatever pairs the site produces are the pairs that get checked.

**Grouping is the point.** A per-element accessibility report on a real site is
several hundred rows describing about six colours. Deduplicating by
`(foreground, background, threshold)` turns that into a list you can act on, in
the order of how bad each one is, with one example element and a count. Six
findings, not six hundred.

**What it deliberately will not judge.** Text over a background image or
gradient on any element inside the page: no static reading of the DOM can say
what colour is behind those pixels, so those runs are counted and skipped rather
than guessed at. A texture or wash on `<html>` or `<body>` is treated as the
page's own canvas and does not disqualify anything — otherwise a single grain
overlay silences the check for the entire site. Gradient-clipped text
(`-webkit-text-fill-color: transparent`) has no foreground colour to measure and
is skipped. The skipped count is always printed, so the check never quietly
reports success because it stopped looking.

**This is not an accessibility audit.** It is one rule out of about ninety. If
you want the rest, run axe; this exists so that contrast fails the same build,
with the same exit code, in the same output, as the four checks next to it.

### 3. Horizontal scroll the reader can actually perform

Loads each page at each configured width, scrolls it top to bottom so anything
lazy or on-scroll exists, then asks the document to scroll sideways and reads
back how far it went.

**The failure.** The obvious measurement is
`documentElement.scrollWidth - clientWidth`, and it produced a permanent false
positive on every page of the site this came from. That site uses
`overflow-x: clip` on the root so that decorative layers extending past the
viewport cannot create document scroll — which is what `clip` is for, and which
still reports overflowing content in `scrollWidth`. A check that shouts on every
page every time is a check that gets commented out. Asking the browser to
actually scroll is the only measurement that answers the question the reader
cares about.

The reason to scroll the page first is separate and just as practical: entrance
animations, lazy images and virtualised lists all mean the widest thing on the
page frequently does not exist at load.

### 4. Console errors

Zero errors and zero uncaught exceptions per page, per width. Errors are grouped
by message across pages, so a single missing asset is one finding with a count
and not one finding per page per viewport.

The message includes the resource URL. Playwright's console text for a failed
request is `Failed to load resource: the server responded with a status of 404`
with no indication of *what* — the URL is only ever on the location, and without
it the finding is unactionable.

`console.ignore` takes substrings or regular expressions, for third-party
scripts whose noise you do not control. The common first use is an analytics
endpoint that only exists in production and 404s on every local run.

### 5. Internal links and fragments

Every `<a href>` on every visited page: internal page links must return 200,
and every `#fragment` must point at an element that exists on the target page.

**The failure.** Fragments are the half nobody checks. A link checker follows
URLs; an anchor is not a URL, so a heading renamed from `Install` to `Getting
started` leaves `/guide#install` returning a perfectly healthy 200 and landing
the reader at the top of the page. Cross-page fragments are worse than
same-page ones, because the person editing the heading is not looking at the
page that links to it.

So a fragment target is worth spending a render on: if a link points at
`/guide#options` and `/guide` has not been visited, the tool loads it in the
browser, scrolls it through, and collects its ids. If the budget runs out before
that happens, the count of unverified anchors is printed rather than passed over
in silence.

`#` and `#top` are defined by the browser as the top of the document and are not
checked. `mailto:`, `tel:` and friends are not links to documents. Off-site
links are not requested unless you ask (`--follow-external`) — they are slow,
they are flaky, and they are not your bug.

---

## Two checks that were deliberately left out

Both existed in the scripts this came from. Both work. Neither is publishable,
and the reasoning is more useful than a weakened version would be.

**Column balance.** A check that found two-column figure grids whose halves
differed in height by more than 140px, by matching utility class names. It was
worth having, because in that layout system a mismatched pair is always a
mistake. In general it is not: unequal columns are a design most of the time,
140px is a number with no meaning outside one grid, and finding the grids at all
required knowing the class-name convention of one CSS framework. Generalised, it
would be a config file describing your grid conventions in order to produce
warnings you would immediately learn to ignore. That is a worse tool than none.

**Documentation drift.** A check that diffed a table in a documentation file
against captions extracted from the built pages, so the docs could not silently
describe something that had shipped differently. The idea is excellent and
completely general. The implementation is a parser for one Markdown table
layout, one figure-numbering scheme, one route-to-page map and one copy-export
pipeline. Everything general about it is the idea; everything shipped about it is
the pipeline. The honest generalisation is a paragraph of advice — *extract
your docs' claims from the built artefact and diff them* — which is not a
package.

---

## Install

```sh
npm install --save-dev page-checks playwright
npx playwright install chromium
```

Playwright is a peer dependency: the tool drives a browser, and which browser
build you use is a decision for the project, not for a library. ESM only,
Node 18+.

## Use

```sh
# crawl from the root and check everything it links to
page-checks http://localhost:3000

# or name the routes and stay on them
page-checks http://localhost:3000 --routes /,/guide,/about --no-crawl
```

| Flag | |
|---|---|
| `--routes <a,b,c>` | Paths to check. Default `/`, plus everything it links to. |
| `--no-crawl` | Do not follow internal links out of the given routes. |
| `--max-pages <n>` | Ceiling on pages rendered. Default 50. |
| `--viewports <w,w,w>` | Widths in px. Default `390,768,1440`. The widest is the one contrast and links are collected at. |
| `--only <checks>` / `--skip <checks>` | `glue`, `contrast`, `overflow`, `console`, `links`. |
| `--level AA\|AAA` | Contrast threshold. Default AA. |
| `--follow-external` | Also request off-site links. |
| `--config <file>` | A `.js`/`.mjs` module default-exporting a config. Flags win over it. |
| `--json` | The report as JSON on stdout. |

```js
// page-checks.config.mjs
export default {
  routes: ["/", "/guide", "/about"],
  viewports: [390, 768, 1440],
  console: {
    ignore: [/\/_analytics\//],
  },
  glue: {
    tags: ["em", "strong", "code", "b", "i"],
    allow: ["<em>re</em>entrant"],
  },
  contrast: { level: "AA" },
};
```

Or from a script, if you want the findings rather than the exit code:

```js
import { runChecks, formatReport } from "page-checks";

const report = await runChecks({ baseUrl: "http://localhost:3000" });
for (const finding of report.findings)
  console.log(finding.check, finding.where, finding.message);
```

Every piece is also exported on its own — `findGluedBoundaries(html)`,
`analyseSamples(samples)`, `classifyHref(href, from, origin)`,
`contrastRatio(a, b)` — and none of them need a browser.

---

## Design decisions

### One binary, five checks, one exit code

The checks are unrelated in what they look for and identical in what they need:
a list of routes, a browser, and a decision about whether the build ships. Split
into five packages they would be five installs, five configs and five CI steps
producing five separately-ignorable outputs. The cost of keeping them together
is that a project wanting only the link check still pulls in the rest of a small
dependency-free package — which is a smaller cost than the alternative.

### Every check reports what it did not check

`12 text runs skipped`, `3 anchors into unrendered pages not verified`. A gate
that only ever says ✓ or ✗ trains people to read one character, and the day its
coverage silently collapses to nothing it will still say ✓. Printing the
denominator makes that visible without adding a failure mode.

### Colours are normalised by the browser, not parsed in Node

`getComputedStyle` returns whatever colour space the author wrote, and `oklch()`
is now the default output of at least one widely-used framework. Rather than
implement those conversions, the probe paints each colour onto a 1×1 canvas and
reads the pixel back — exact, and always current with the browser. The first
version parsed strings, treated `oklab(… / 0.08)` as opaque because it did not
start with `rgba(`, and consequently gave up on every element under a modern
translucent surface. Node only ever sees `rgba()`.

### The DOM probes are stringified functions

Playwright serialises anything passed to `page.evaluate` with
`Function.prototype.toString()`. That makes the probes a constrained kind of
code: they can reference page globals and nothing else, because a binding the
bundler hoists out of the body lives outside the string and throws a
`ReferenceError` in the page while every unit test still passes. So they are
duplicative on purpose, the bundler runs with `keepNames` and minification off,
and a test asserts on the built artefact that no helper has crept in. The
benefit is that the probes are ordinary testable functions: the contrast check
is exercised end to end in jsdom against a fixture, with no browser involved.

### Findings are grouped, not listed

Applies to contrast pairs and to console errors, for the same reason: the
quantity a reader needs is *how many distinct problems are there*, and the
quantity a naive implementation reports is *how many times did I encounter one*.
On the run that produced the sample output above, the two numbers were 6 and 32.

---

## Limitations

**Partial ancestor opacity is not modelled.** An ancestor with `opacity: 0`
correctly hides its text from the check. An ancestor with `opacity: 0.5` reduces
the effective contrast of everything inside it, and the probe ignores that.
Modelling it properly means compositing the whole subtree as a group, which is
more machinery than the case deserves; the result is that the check can be
optimistic inside a faded container.

**Backgrounds painted by anything other than an ancestor are invisible.** The
background stack is the ancestor chain. A fixed decorative layer behind
transparent content, a sibling positioned underneath, a `::before` overlay — the
walk does not see them, and neither does any other static contrast checker. The
answer is correct for the overwhelmingly common case of text on a surface on a
canvas, and unreliable for text on top of a picture, which is why text on top of
a picture is skipped rather than reported.

**The contrast pass runs at one width.** The widest configured viewport. Colours
that change with a media query at a narrower width are not seen. This is a
deliberate trade — running the pass at every width triples the slowest part of
the run to catch a case that is rare.

**Crawling is bounded and breadth-first.** `--max-pages` exists because a
crawler pointed at a site with pagination or a large archive will otherwise
render all of it. If your site is bigger than the budget, name your routes.

**A page that needs authentication cannot be reached.** There is no mechanism
for cookies, headers or a login step. Point it at a build that serves its pages.

**Console errors are only the ones that happen during a load and a scroll
through.** Anything behind an interaction — a menu opening, a form submitting —
is not exercised. This is a smoke check, not a test suite.

---

## Development

```sh
npm install
npm test          # builds first: the probe tests assert on the built artefact
npm run typecheck
```

The tests use fixtures, never a live site. `test/fixtures/*.html` carry seeded
faults — a glued boundary, a dangling fragment, a colour pair 0.02 under the
threshold — and each check is asserted to find exactly those and nothing else.

MIT licensed.
