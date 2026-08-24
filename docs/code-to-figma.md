# Porting code into Figma

*Turning a working code prototype into faithful Figma frames — as static mockups for review,
comparison, or drawing on top of.*

This one is mechanism-focused: it assumes no particular design system, brand, or product. For
token and component reuse, layer your own design-system guide on top. For the deep plugin-API
gotchas, the canonical reference is [figma-plugin-api.md](./figma-plugin-api.md); this document
lifts only the parts that bear directly on porting.

## When to use it

Any time the input is **code that renders a UI** and the output is **Figma frames** that mirror it:

- A stakeholder sent an HTML prototype and the designer wants it in Figma to draw on top of
- An engineer built a working surface and needs a mockup for the inverse handoff
- An AI-generated artifact needs a designable Figma version
- "What would this code look like as something I can actually edit?"

Skip it for: building design-system components from scratch, designing screens from nothing, or
live Figma↔code reconciliation.

## Pre-flight checklist

Run before any write. Each failed item means stop and resolve.

### 1. Source analysis

- **Read the entire source tree** for the target screens — page files, shell and layout
  components, helpers, mock data, CSS or utility classes.
- **Run the prototype in a browser** if you can. "Code executed with no return value" says nothing
  about visual quality; the original render is the ground truth.
- **List the components:** which are shared shells (header, card wrapper), which are leaves
  (buttons, chips), which are one-off layouts. That drives the inline-vs-instance decision.
- **List the mock data:** copy strings, avatar references, array lengths. Vary it later — repeated
  mock data reads as "wireframe".

### 2. Identify the target file and page

- Get the file key and the target node id from the target URL.
- Resolve the node → walk up to its PAGE → record the name and id.
- Compare against `figma.currentPage`. If the target page is NOT the current page, you are about
  to hit the non-current-page bug (see [Hard rules](#rule-writes-to-a-non-current-page-silently-fail)).

### 3. Probe for the non-current-page bug (mandatory when the target page differs)

Three calls. The first one writes and therefore must NOT throw — a throw would roll the probe back
and you would be measuring your own rollback instead of the bug. Because nothing comes back from a
write call, the probe carries a **unique name** and the second call finds it by that name rather
than by id.

```js
// call 1 — WRITE. Creates the probe and ends naturally. No throw.
const targetPage = await figma.getNodeByIdAsync("<target-page-id>");
await targetPage.loadAsync();
const probe = figma.createFrame();
probe.name = "__PROBE__20260820T2114";   // unique per run — this is the handle
probe.resize(50, 50);
probe.x = -10000; probe.y = -10000;
targetPage.appendChild(probe);
// nothing else. The function ends here so the write can commit.
```

```js
// call 2 — READ-ONLY, a separate call. Find it by name and report through the throw.
const page = await figma.getNodeByIdAsync("<target-page-id>");
await page.loadAsync();
const hit = page.findOne(n => n.name === "__PROBE__20260820T2114");
throw new Error("PROBE::" + JSON.stringify({ exists: !!hit, id: hit ? hit.id : null }));
```

```js
// call 3 — WRITE. Clean up if it survived. No throw.
const page = await figma.getNodeByIdAsync("<target-page-id>");
await page.loadAsync();
const probe = page.findOne(n => n.name === "__PROBE__20260820T2114");
if (probe) probe.remove();
```

`exists: false` means the bug is active — and there is nothing to clean up, because the write
never landed. Use the workaround below. `exists: true` means writes to that page commit; run
call 3 to remove the probe before you build anything real.

### 4. Layout plan

Before writing, decide:

- **Frame count** — one frame per discrete state: default, loading, error, expanded variant.
- **Widths per platform** — typically 1440 and 768 for web, 390 for mobile web, 390 or 360 for
  native. Pick what the source actually targets.
- **Initial frame heights** — start platform-native (900 for web), resize to content afterwards.
- **Spacing** — group frames by platform and state, with clear gaps: 100–200px between frames,
  200–300px between groups. Never stack frames on the same coordinates.
- **Section wrapper** — one labelled section around the whole port:
  `[PORT FROM CODE YYYY-MM-DD] <area> — <note>`.

### 5. Design-system hygiene level

Decide this explicitly, with the person who asked:

- **Literal port** — match the source's pixel values (`#4A90E2`, `padding: 14px`, `Inter 15/22`).
  Reads as "not from our system", but preserves the source's intent exactly.
- **Token-mapped port** — replace source values with the nearest system variables and text styles.
  Reads native, may drift visually from the source.
- **Hybrid** — system variables for color and spacing, source values for typography, or the
  reverse.

Token-mapped is the default for a system-aligned codebase. Confirm before building — people have
strong opinions here.

## Build loop, per frame

### 1. Preload fonts

Load every family and weight you might touch, in the same call. A missing preload errors
mid-build:

```js
await Promise.all([
  figma.loadFontAsync({ family: "DM Sans", style: "Regular" }),
  figma.loadFontAsync({ family: "DM Sans", style: "Medium" }),
  figma.loadFontAsync({ family: "DM Sans", style: "SemiBold" }),
  figma.loadFontAsync({ family: "DM Sans", style: "Bold" }),
  figma.loadFontAsync({ family: "Inter", style: "Regular" }),
  figma.loadFontAsync({ family: "Inter", style: "Semi Bold" }), // note: a space, not "SemiBold"
  figma.loadFontAsync({ family: "Inter", style: "Bold" })
]);
```

> ⚠️ Some legacy text styles are bound to a different family than the token catalog claims. If you
> are touching headings, preload both.

### 2. Import keys

```js
const v = {};
for (const [name, key] of Object.entries(VAR_KEYS)) {
  try { v[name] = await figma.variables.importVariableByKeyAsync(key); } catch(e) { v[name] = null; }
}
const ts = {};
for (const [name, key] of Object.entries(STYLE_KEYS)) {
  try { ts[name] = await figma.importStyleByKeyAsync(key); } catch(e) { ts[name] = null; }
}
```

If you do not know the keys, use the discover-from-a-sibling-instance pattern in
[figma-plugin-api.md](./figma-plugin-api.md#f-discovery-from-a-sibling-instance). Do not
blind-search by name; it is slower and less reliable.

### 3. Hug-by-default helpers

New frames default to width 100 and fixed sizing, and autolayout does not retroactively
recalculate. Wrap the primitives so every container hugs unless told otherwise:

```js
function makeCol(name, gap) {
  const f = figma.createFrame();
  f.name = name; f.layoutMode = "VERTICAL"; f.itemSpacing = gap ?? 8;
  f.fills = [];
  f.primaryAxisSizingMode = "AUTO";   // hug height
  f.counterAxisSizingMode = "AUTO";   // hug width
  return f;
}
function makeRow(name, gap, align, justify) {
  const f = figma.createFrame();
  f.name = name; f.layoutMode = "HORIZONTAL"; f.itemSpacing = gap ?? 12;
  f.fills = [];
  f.primaryAxisSizingMode = "AUTO"; f.counterAxisSizingMode = "AUTO";
  if (align) f.counterAxisAlignItems = align;
  if (justify) f.primaryAxisAlignItems = justify;
  return f;
}
async function makeText(name, content, styleObj, fillVarObj, sizeOverride) {
  const t = figma.createText();
  t.name = name;
  if (styleObj) await t.setTextStyleIdAsync(styleObj.id);
  t.characters = content;
  if (sizeOverride) t.fontSize = sizeOverride;
  if (fillVarObj) t.fills = [/* bind to variable */];
  return t;
}
```

### 4. Set FILL after `appendChild`

Order matters. Set `layoutSizingHorizontal = "FILL"` AFTER attaching the child; before, it errors
with "must have an autolayout parent":

```js
parent.appendChild(child);
child.layoutSizingHorizontal = "FILL";  // append FIRST, then set FILL
```

### 5. HUG vertically AFTER every child is in place

The single most expensive trap. If you set `primaryAxisSizingMode = "AUTO"` AND `resize(w, 1)`
BEFORE appending children, autolayout does not recalculate the height when they arrive — you get a
1px-tall frame.

```js
// at the end of building the hero card, before the screenshot:
hero.layoutSizingHorizontal = "FIXED";
hero.layoutSizingVertical = "HUG";
```

Symptom: the container renders as a thin horizontal line.

### 6. Auto-fit the outer frame to its content

```js
const hero = findByName(s, "Hero card");
const targetH = Math.ceil(hero.height + 200); // hero y-offset + bottom padding
s.resize(s.width, targetH);
const bg = findByName(s, "Background layer");
if (bg) bg.resize(s.width, targetH);
```

### 7. Visual review

After every meaningful chunk, screenshot the node and download the PNG. Look at it. Compare it
against the running source. Skip this loop and you discover the problems at handoff instead.

## Hard rules

Non-negotiable. Skipping these costs cycles, not minutes.

### Rule: never throw at the end of a write call

The plugin bridge rolls back the ENTIRE transaction if any exception escapes. Throwing at the end
to "report status" silently destroys every write before it. Symptom: the writes "succeed" and a
separate read shows nothing committed.

```js
// ❌ DEAD WRONG — every change above rolls back
async function writeAndReport() {
  // ... do all the writes ...
  throw new Error("STATUS::" + JSON.stringify(log));  // ROLLS BACK
}

// ✅ CORRECT — the write call returns naturally
async function writeOnly() {
  // ... do all the writes ...
  // No throw. The function just ends.
}
// Then in a SEPARATE call:
async function readStatus() {
  // ... walk the tree, build the report ...
  throw new Error("STATUS::" + JSON.stringify(report));  // OK — read-only
}
```

Detection: you are building a `log` / `STATUS` / `FIX_LOG` object and throwing it inside a call
that ALSO writes. Stop. Split it in two.

### Rule: writes to a non-current page silently fail

The bridge commits writes only to whatever page was `figma.currentPage` when the plugin connected.
`setCurrentPageAsync(otherPage)` changes in-transaction state, but the written nodes do not
persist between transactions. They look successful in-call and are gone on the next read. Asset
upload with a `nodeId` inherits the same bug.

**Workarounds:**

A. **Wrapper section** (build phase)
   - Build everything on the originally-current page (likely `Cover`).
   - Wrap it in a single labelled section:
     `[PORT FROM CODE YYYY-MM-DD] <area> — DRAG TO <target page>`.
   - The user drags the section onto the target page in seconds; Figma handles the move.
   - Note: moving the section between pages changes the child node ids. Recover by name (below).

B. **Image-fill cross-page writes**
   - Image-fill assignment by hash is the confirmed cross-page exception. Treat every other write
     as suspect until a fresh second-call read verifies it.
   - Pattern: upload the image, capture the `imageHash`, then in a separate call set
     `node.fills = [{ type: "IMAGE", imageHash: HASH, scaleMode: "FILL", opacity }]` on the target
     node — this is the one write that has been probed working when the node lives on a
     non-current page.
   - Solid fills, effect styles and corner radius are *plausible* extensions of that one result
     and have never been probed. Repositioning has been probed and it fails. The property-by-
     property evidence, with its labels, is in
     [figma-plugin-api.md](./figma-plugin-api.md#k-property-changes-that-appear-to-persist-cross-page).

### Rule: one transaction is one write or one read

Don't mix. Build → return naturally. Then verify in a fresh call with a `throw`-returned report.

### Rule: image fills go through the two-step pattern

Bulk uploads are fine, but to set a fill reliably:

```js
// Step 1: upload the asset, POST the bytes, capture imageHash
//         (multipart/form-data with a 'file' field is the reliable path)
// Step 2: in a plugin call, set the fill on each target node
for (const id of nodeIds) {
  const n = await figma.getNodeByIdAsync(id);
  if (n) n.fills = [{ type: "IMAGE", scaleMode: "FILL", imageHash: HASH, opacity: 0.55 }];
}
```

Limits: PNG / JPG / GIF / WebP, max 10MB per asset. Inline base64 inside a plugin call will not
work above ~30KB of image (there is a 50KB code limit per call).

## Common pitfalls

| Symptom | Mechanism | Fix |
|---|---|---|
| Frame renders as a 1px line | `primaryAxisSizingMode = AUTO` + `resize(w, 1)` before `appendChild`; autolayout never recalculates | set `layoutSizingVertical = "HUG"` AFTER appending children |
| "Can only set layoutPositioning = ABSOLUTE if the parent has layoutMode !== NONE" | absolute-positioning a child of a plain frame | give the parent autolayout, or just set `child.x` / `child.y` directly |
| "cannot read property 'layoutMode' of TEXT node" | tree walk reading `layoutMode` on TEXT / VECTOR / RECTANGLE | guard: `if (n.type === "FRAME" && n.layoutMode && n.layoutMode !== "NONE")` |
| "figma.currentPage is not supported" | assigning currentPage as a setter | `await figma.setCurrentPageAsync(page)` — and remember it will not help cross-call |
| "Property value is incompatible with component property type" on an instance swap | passed the component `.key` instead of a node id | pass the node id string (`"1204:31"`) |
| A font fails to load | style name `"SemiBold"` where the family spells it `"Semi Bold"` | Inter uses `"Semi Bold"`; DM Sans uses `"SemiBold"` |
| Bound-variable opacity behaves unpredictably | `setBoundVariableForPaint` + `paint.opacity` do not multiply cleanly when the variable carries intrinsic alpha | inline RGBA for fine-grained glass; keep bindings for solid surfaces |
| Frame height balloons when a background is added | the background got absorbed into the vertical flow | `bg.layoutPositioning = "ABSOLUTE"` after `appendChild` |
| Asset upload reports success but the fill does not change | the non-current-page bug, inherited through `nodeId` | two-step: upload for the hash, then set fills cross-page |
| Mock data looks like a wireframe (five identical avatars, repeated copy) | the avatar component's default variant resolves to one image; copy-pasted strings | cycle the image-type variants; vary the copy with realistic alternates |
| Emoji render inconsistently between reviewers | `📷 🎵 ⋯ ▶ ←` are OS-dependent and cannot be instance-swapped | icon component instances for action / control / nav icons; emoji only for user-content reactions |

## Recovery patterns

### 1. The user moved nodes between pages, so the ids changed

The usual aftermath of the wrapper-section drag. Recover by name across every page:

```js
const targets = ["My Frame Name 1", "My Frame Name 2"];
const found = {};
for (const p of figma.root.children) {
  await p.loadAsync();
  function walk(n, depth) {
    if (depth > 6) return;
    if (targets.includes(n.name)) {
      found[n.name] = { id: n.id, page: p.name };
    }
    if ("children" in n && n.children) for (const c of n.children) walk(c, depth + 1);
  }
  for (const c of p.children) walk(c, 0);
}
throw new Error("FOUND::" + JSON.stringify(found));
```

Then re-derive the nested ids by walking the new parent — the children changed too.

### 2. The frame is too short for its content

```js
const inner = findByName(frame, "Hero card");
const newH = Math.ceil(inner.height + topOffset + bottomPadding);
frame.resize(frame.width, newH);
for (const bgName of ["Background", "Backdrop", "Top wash"]) {
  const bg = findByName(frame, bgName);
  if (bg) bg.resize(frame.width, newH);
}
```

### 3. Wrong stacking order

In Figma, `parent.children[0]` is the BACK and the last child is the FRONT. To bring a node
forward, re-append it:

```js
parent.appendChild(nodeToBringForward); // moves to the top of the z-order
```

### 4. Search by name inside a known parent

```js
function findByName(parent, name) {
  if (!parent) return null;
  if (parent.name === name) return parent;
  if ("children" in parent && parent.children) {
    for (const c of parent.children) {
      const r = findByName(c, name);
      if (r) return r;
    }
  }
  return null;
}
```

## Code ↔ Figma mapping

### Layout

| Code | Figma | Notes |
|---|---|---|
| `display: flex; flex-direction: row` | `layoutMode = "HORIZONTAL"` | |
| `display: flex; flex-direction: column` | `layoutMode = "VERTICAL"` | |
| `gap: 12px` | `itemSpacing = 12` | |
| `padding: 16px 24px` | `paddingTop / Bottom = 16; paddingLeft / Right = 24` | all four sides individually |
| `justify-content: space-between` | `primaryAxisAlignItems = "SPACE_BETWEEN"` | |
| `align-items: center` | `counterAxisAlignItems = "CENTER"` | |
| `flex-wrap: wrap; gap: 8px` | `layoutWrap = "WRAP"; itemSpacing = 8; counterAxisSpacing = 8` | both axes |
| `flex: 1` / `width: 100%` | `child.layoutSizingHorizontal = "FILL"` AFTER `appendChild` | |
| `width: auto` (hug) | `layoutSizingHorizontal = "HUG"` | the default in the helpers above |
| `position: absolute; top: 0; left: 0` | `layoutPositioning = "ABSOLUTE"; x = 0; y = 0` | the parent must have autolayout |
| `width: 720px; max-width: 720px` | `resize(720, h)` + sizing modes | |

### Visuals

| Code | Figma | Notes |
|---|---|---|
| `background-color: #C2704A` | `fills = [{ type: "SOLID", color: { r, g, b }, opacity }]` | or bound to a variable |
| `background-image: url(...)` | `fills = [{ type: "IMAGE", imageHash, scaleMode }]` | use the two-step upload |
| `background: linear-gradient(...)` | `fills = [{ type: "GRADIENT_LINEAR", gradientStops, gradientTransform }]` | direction lives in the transform matrix |
| `background: radial-gradient(...)` | `fills = [{ type: "GRADIENT_RADIAL", ... }]` | |
| `border: 1px solid X` | `strokes = [{ ... }]; strokeWeight = 1` | |
| `border-radius: 12px` | `cornerRadius = 12` | per-corner via `topLeftRadius` etc. |
| `backdrop-filter: blur(24px)` | `effects = [{ type: "BACKGROUND_BLUR", radius: 24, visible: true }]` | |
| `box-shadow: 0 24px 80px rgba(0,0,0,0.6)` | `effects = [{ type: "DROP_SHADOW", offset, radius, color }]` | |
| `opacity: 0.55` | `node.opacity = 0.55` (whole node) OR `paint.opacity = 0.55` (one fill) | different scope |
| `border-style: dashed` | `dashPattern = [6, 4]` on the stroke owner | |

### Components and state

| Code | Figma | Notes |
|---|---|---|
| A reusable component | `importComponentSetByKeyAsync(key)` → `.createInstance()` | reuse beats inline rebuild |
| Boolean / enum props | variant axes on a component set | one variant per state combination |
| A string prop | `instance.componentProperties = { "Label": "..." }` | or set the TEXT child directly |
| `{condition && <X />}` | a separate frame per state, or a variant axis | each state gets its own canvas slot |
| `items.map(item => <Row item={item} />)` | a list inside an autolayout container | loop the same row builder |
| `useState` interactive state | static — one state per frame, other states as separate frames | frames do not toggle |

### Text

| Code | Figma | Notes |
|---|---|---|
| `font-family: "DM Sans"; font-weight: 600` | `fontName = { family: "DM Sans", style: "SemiBold" }` | Inter spells it `"Semi Bold"` |
| `font-size: 16px; line-height: 24px` | `fontSize = 16; lineHeight = { value: 24, unit: "PIXELS" }` | |
| `letter-spacing: -0.015em` | `letterSpacing = { value: -1.5, unit: "PERCENT" }` | |
| `text-transform: uppercase` | upper-case the characters, or `textCase = "UPPER"` | |
| `\n` in JSX | the same — `characters = "Line one\nLine two"` | |

## Decisions to flag before building

Stop and ask. Flagging these earns trust faster than guessing.

1. **Hygiene level** — literal vs token-mapped port. Default token-mapped, but confirm.
2. **Fidelity to the source** — pixel-match, or interpret in the system's idiom (the source uses
   14/22 type; the nearest system step is 14/20). Surface the mismatches.
3. **Reuse vs inline** — when the source has a custom component the system lacks: build it once as
   an instance, or repeat it inline per frame? Repeated inline is a candidate for promotion later.
4. **Interactive states** — hover / focus / active / disabled as separate frames, or default only?
   Time-box it.
5. **Platforms** — web first, or every platform in one pass. Web is faster; mobile reveals the
   layout problems.
6. **Mock-data realism** — the source says "Test User". Replace with realistic mock, or preserve
   verbatim?
7. **Background images** — the source may reference assets that are not in Figma yet. Upload them,
   or substitute the nearest system background component?

## Flow scaffolding

When the target is not one screen but a **whole flow** — onboarding, sign-up plus verification,
login, paywall — scaffolding gives the designer empty per-state platform frames, ready to fill.
It is the inverse of porting one screen at a time: lay every state of every flow out as a grid
first, fill the content later.

### The per-state set

A "set" is one product state — one route, one screen, one modal. Each set contains:

- **A header strip** — a full-width band naming the state. Example dimensions `2366 × 96`, dark
  accent fill (`#241A14`), `cornerRadius: 8`, horizontal autolayout, 40px left/right padding. Its
  TEXT child is the state name, at 32px, bound to the secondary-text token.
- **Three platform frames**, side by side beneath the header:
  - **Desktop** — `1440 × 896`
  - **Mobile web** — `376 × 896`, at `x = 1520` inside the set
  - **Mobile app** — `390 × 896`, at `x = 1976`
  - Frame fills bound to the canvas-background token

State names use the bracketed convention for end states (`[anon] discover`, `[claimed] kitchen`)
and bare descriptive names for steps (`Sign Up entry`, `Screen 1 · Find your kitchen · default`).

### The flow grid

With multiple flows, lay out **horizontally per flow, vertically across flows**:

```
Flow 1:   [entry] → [step] → [step] → [step] → ... → [end state]
Flow 2:   [entry] → [step] → [step] → [end state]
Flow 3:   [entry] → [step] → ... → [end state]
...
Flow N:   [entry] → ... → [end state]
```

Each flow row is a label (40px bold, in the brand accent) plus a sequence of sets, with the set
header at `labelY + 160` and the platform frames 256px below the header.

Layout constants, from a real onboarding scaffolding:

```
SET_WIDTH         = 2366   (header + three platform frames)
SET_GAP_X         =  240   (between sets within a flow)
SET_PITCH_X       = 2606   (width + gap)
SET_BLOCK_HEIGHT  = 1152   (header offset + frame height)
FLOW_LABEL_HEIGHT =   80
FLOW_LABEL_GAP    =   80
FLOW_INTER_GAP    =  400
FLOW_PITCH_Y      = 1712
```

### Duplicate or deduplicate?

- **Deduplicated (a vertical inventory):** one set per unique state, stacked. A state catalog for
  the first design pass. Does not show sequence.
- **Duplicated (a horizontal flow grid):** a set repeats in every flow it belongs to. `[anon]
  discover` shows up at the start of flows 1, 2, 4 and 6. Reads as a sequence.

Default to duplicated for handoff — the designer reads left to right, "this is what the user
sees". Deduplicated is a one-shot inventory step.

### The two-group handoff convention

For a large surface, split it:

- **Group 1 — base:** the unique states that need full design treatment. The designer draws these.
- **Group 2 — schematic:** variations and branches that introduce no new screens. Shown only as
  transition arrows and text.

Group 2 needs no scaffolding frames, only the flow text in a side note. That keeps the file's
scope manageable. The method for producing those two groups is
[prd-to-flows.md](./prd-to-flows.md).

### The build call

One transaction builds the whole grid:

1. Preload the label fonts
2. Import the variables you need (canvas background, secondary text, brand accent)
3. Create the wrapper section on the current page (the non-current-page workaround)
4. Per flow: create the label, then loop the states → header strip plus three platform frames each
5. Return naturally — no throw
6. Verify in a separate call
7. Screenshot for visual self-review

The build is one-shot. Once the user drags the section to the target page, the child positions are
locked — `x` / `y` mutations do not persist cross-page. If the layout has to change afterwards,
build a fresh section, drag, delete the old one.

**Anti-pattern:** trying to rearrange already-dragged sets in place. It fails silently. Build
fresh.

## Related

- [figma-plugin-api.md](./figma-plugin-api.md) — the full plugin-API gotcha list
- [prd-to-flows.md](./prd-to-flows.md) — how the state and flow list that feeds a scaffolding gets
  built
- [prototype-intake.md](./prototype-intake.md) — what to do with a prototype before you port it
- [overnight-runs.md](./overnight-runs.md) — the autonomous wrapper, orthogonal to porting itself
