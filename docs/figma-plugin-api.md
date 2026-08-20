# Driving Figma from an agent

*Everything the plugin API and the MCP bridge do that the docs do not warn you about. Read this
before the first Figma task of any session.*

Originally written in Ukrainian as a personal working guide; translated for this repo. Code is
unchanged.

## TL;DR — five facts

1. **Figma connects two ways, and neither needs re-connecting.**
   - The official Dev Mode MCP server, over your account's OAuth. Always on.
   - A personal-access-token server, which reads the REST API directly. The token expires every
     90 days.
2. **The plugin write call does not return a value.** The code runs; the result never reaches you.
   Workaround: `throw new Error("PREFIX::" + JSON.stringify(data))`.
3. **Most Dev Mode tools require a selected layer in the Figma desktop app** — variable dumps,
   design context, screenshots. Having the file merely *open* is not enough.
4. **Setting `selection` programmatically through the plugin API is invisible to the next tool
   call.** It only holds inside a single plugin execution.
5. **Know which design system in code is the production one.** A standalone component library and
   the app that users actually load are frequently two different repos with two different token
   files. Reconcile against the one users see.

## Health check

```bash
claude mcp list
```

You expect to see the Dev Mode server connected and the personal-token server connected. If the
token server is **missing**, the token expired — see [token setup](#token-setup).

## Which tool for which job

| Job | Tool | Requirement |
|---|---|---|
| Dump every variable in a file | the plugin write call + the `throw` trick | file open in the desktop app |
| Generate code from one frame | design-context tool | layer selected in the desktop app |
| Screenshot a node | screenshot tool | layer selected |
| Create or modify design in Figma | the plugin write call | file open |
| Find a component in the UI kit | design-system search | library published |
| List libraries attached to a file | libraries tool | ⚠️ often times out on large files |
| Map code ↔ component | code-connect tool | existing Code Connect setup |

## The pitfalls that cost the most

### 1. "Code executed with no return value"

The plugin API runs, but the MCP layer does not relay the return value. Send the data back through
the **error channel** instead:

```js
const data = { /* your data */ };
throw new Error("FIGMA_DUMP::" + JSON.stringify(data));
```

The `FIGMA_DUMP::` prefix is just a marker that makes parsing easy. You receive the full error
text.

**Limit:** roughly 4–5KB of returned error before it truncates. For bigger dumps, split into
separate calls per collection.

### 2. "You currently have nothing selected"

Dev Mode tools read from your desktop session. They need a **selected layer**, even when you pass
a `nodeId` in the parameters.

If you need data without a selection, use the plugin API and the `throw` trick above.

### 3. `figma.currentPage = page` does not work

```js
// ❌ WRONG
figma.currentPage = page;

// ✅ RIGHT
await figma.setCurrentPageAsync(page);
```

### 4. A programmatic selection does not survive between calls

`figma.currentPage.selection = [node]` inside a plugin call is visible only inside that same call.
The next tool call sees whatever is selected in the desktop app.

**Conclusion:** to extract data from a node without the user selecting it, do EVERYTHING inside
one plugin call and return it through `throw`.

### 5. Instance-swap default values

Pass the **component node id** (`"1204:31"`), NOT its `.key`. A key raises "Property value is
incompatible with component property type".

### 6. Remote variables

`getLocalVariableCollectionsAsync` returns ONLY collections local to the file. For variables that
come from a library, use `importVariableByKeyAsync(key)`.

### 7. Font style names — the spaces matter

For Inter the style is `"Semi Bold"` (with a space), not `"SemiBold"`. Same for `"Extra Bold"`.
Other families spell it without the space. Get it wrong and the font never loads.

### 8. Local-only named components are not published library assets

Components named inside feature files — `Guest/Ada Okafor`, `Guest/Luca Ferri` — are **local to
that file**, used as instance-swap targets inside published components (an avatar set, for
example). They do have a `.key`, but `importComponentByKeyAsync` from ANOTHER file raises
`Component with key X not found`.

Check before importing: the design-system search returns `libraryName: null` for local components,
or does not find them at all. Only results with a real `libraryName` are genuinely importable
across files.

**Workaround:** for avatars in social proof, use the published avatar variants with different
`type` values (image / initials / icon), not the named personas. Personalisation like that is only
possible inside the file where those named components exist.

### 9. Heading text styles may not use the family your token reference claims

The token reference says the web family is DM Sans, but the legacy kit's `Heading 1–6` text styles
are bound to **Inter** (Semi Bold / Bold). Without a preload you get `Cannot write to node with
unloaded font "Inter Regular"`.

Always preload **both** families in any build call:

```js
await Promise.all([
  figma.loadFontAsync({ family: "DM Sans", style: "Regular" }),
  figma.loadFontAsync({ family: "DM Sans", style: "Medium" }),
  figma.loadFontAsync({ family: "DM Sans", style: "SemiBold" }),
  figma.loadFontAsync({ family: "DM Sans", style: "Bold" }),
  figma.loadFontAsync({ family: "Inter", style: "Regular" }),
  figma.loadFontAsync({ family: "Inter", style: "Medium" }),
  figma.loadFontAsync({ family: "Inter", style: "Semi Bold" }), // note: the space
  figma.loadFontAsync({ family: "Inter", style: "Bold" })
]);
```

## Where the file keys live

Every one of these workflows needs a copy-paste table of file keys — foundations, UI kit, entity
pages, per-platform component files, plus the archived ones so nobody reaches for them by accident.
That table belongs in the project's `CLAUDE.md`, where the agent loads it automatically and it
stays private. Keep the archived entries in it, struck through with the date they were retired:
half the cost of a stale key is someone quietly using it.

The same goes for the mapping of *which repo holds the production tokens*. Write down, per
context — production web app, standalone component library, any satellite tool — the file that
owns the tokens and the format it uses. When you reconcile Figma against code, the first target is
always the repo users actually load, not the library that has not been integrated yet.

## Cookbook

### A. Dump all variables and text styles

Run against the file you need:

```js
function toHex({r,g,b}){const h=n=>Math.round(n*255).toString(16).padStart(2,"0").toUpperCase();return `#${h({r})}${h({g})}${h({b})}`}
function fmtColor({r,g,b,a}){const A=a??1;const hex=toHex({r,g,b});return A>=0.999?hex:`${hex}@${+A.toFixed(4)}`}
async function rv(val,t){if(val&&typeof val==="object"&&val.type==="VARIABLE_ALIAS"){const ref=await figma.variables.getVariableByIdAsync(val.id);return `alias:${ref?ref.name:"?"}`}if(t==="COLOR"&&val&&typeof val==="object"&&"r" in val)return fmtColor(val);return val}
const out={cols:[],ts:[]};
const cols=await figma.variables.getLocalVariableCollectionsAsync();
for(const col of cols){const vars=[];for(const vid of col.variableIds){const v=await figma.variables.getVariableByIdAsync(vid);if(!v)continue;const values={};for(const m of col.modes)values[m.name]=await rv(v.valuesByMode[m.modeId],v.resolvedType);vars.push({n:v.name,t:v.resolvedType,v:values})}out.cols.push({name:col.name,modes:col.modes.map(m=>m.name),vars})}
const ts=await figma.getLocalTextStylesAsync();
for(const t of ts)out.ts.push({n:t.name,f:t.fontName&&t.fontName.family,s:t.fontName&&t.fontName.style,sz:t.fontSize,lh:t.lineHeight,ls:t.letterSpacing});
throw new Error("FIGMA_DUMP::"+JSON.stringify(out));
```

If the payload truncates, split it into several calls filtered by `col.name`.

### B. Reconcile Figma tokens → CSS/SCSS

1. Dump the variables (A)
2. Read the target CSS/SCSS
3. Build a dictionary from each side
4. Diff:
   - **Drift** — same name, different value → update
   - **New** — in Figma, absent from code → note it
   - **Extra** — in code, absent from Figma → mark as legacy or app-specific
5. Minimal edit, then a report

### C. Navigate to a specific node

```js
const node = await figma.getNodeByIdAsync("742:1188");
let page = node;
while (page && page.type !== "PAGE") page = page.parent;
await figma.setCurrentPageAsync(page);
figma.currentPage.selection = [node];
figma.viewport.scrollAndZoomIntoView([node]);
```

⚠️ This moves the user's viewport. Warn them, or ask, before running it.

### D. Run code and get the result back

```js
// ... async work that builds `result` ...
throw new Error("RESULT::" + JSON.stringify(result));
```

### E. Hug-by-default frame helpers

Most autolayout bugs in generated drafts come from new frames defaulting to
`primaryAxisSizingMode = "FIXED"` at width 100. Wrap these helpers at the start of any build so
every container hugs its content by default, and set FILL deliberately only where you want it:

```js
function makeRow(name, gap, align) {
  const f = figma.createFrame();
  f.name = name; f.layoutMode = "HORIZONTAL"; f.itemSpacing = gap != null ? gap : 12;
  f.fills = [];
  f.primaryAxisSizingMode = "AUTO";   // hug width
  f.counterAxisSizingMode = "AUTO";   // hug height
  if (align) f.counterAxisAlignItems = align;
  return f;
}

function makeCol(name, gap) {
  const f = figma.createFrame();
  f.name = name; f.layoutMode = "VERTICAL"; f.itemSpacing = gap != null ? gap : 8;
  f.fills = [];
  f.primaryAxisSizingMode = "AUTO";   // hug height
  f.counterAxisSizingMode = "AUTO";   // hug width
  return f;
}

function glassCard(name, paintBoundFn, vTokens) {
  const c = figma.createFrame();
  c.name = name; c.layoutMode = "VERTICAL";
  c.paddingTop = 20; c.paddingBottom = 20; c.paddingLeft = 24; c.paddingRight = 24;
  c.itemSpacing = 16; c.cornerRadius = 16;
  c.fills = [paintBoundFn(vTokens.transSurface08, { color: { r: 1, g: 1, b: 1 }, opacity: 0.06 })];
  c.strokes = [paintBoundFn(vTokens.borderTr08, { color: { r: 1, g: 1, b: 1 }, opacity: 0.08 })];
  c.strokeWeight = 1;
  c.effects = [{ type: "BACKGROUND_BLUR", radius: 24, visible: true }];
  c.primaryAxisSizingMode = "AUTO"; c.counterAxisSizingMode = "AUTO";
  return c;
}
```

Then at the FILL points — children that should stretch along the parent's counter axis — call it
AFTER `appendChild`. The order matters:

```js
parent.appendChild(child);
child.layoutSizingHorizontal = "FILL";  // append FIRST, then set FILL
```

One overnight run burned two cycles on collapsed cards — frames rendering about 100px wide —
before adopting these helpers. Hug by default, explicit FILL only where needed, works first try.

⚠️ **Sizing-mode + resize order trap:** if you set `primaryAxisSizingMode = "AUTO"` and THEN call
`resize(w, 1)` BEFORE appending children, autolayout does not always recompute the height when the
children arrive later in the same transaction. Symptom: a frame 1px tall despite having many
children. Workaround: do not resize to a fixed height before `appendChild`, or set
`node.layoutSizingVertical = "HUG"` explicitly afterwards.

### F. Discovery from a sibling instance

Instead of guessing variable and text-style keys, or making dozens of design-system search calls,
walk an existing instance of the same "class" already on the target page. You get the real keys of
exactly the tokens in use next door:

```js
const out = { textStyles: {}, variables: {} };

const ref = await figma.getNodeByIdAsync("482:9137"); // any sibling instance
async function walk(n) {
  if (n.type === "TEXT" && n.textStyleId && typeof n.textStyleId === "string") {
    const s = await figma.getStyleByIdAsync(n.textStyleId);
    if (s) out.textStyles[s.name] = { key: s.key, sample: n.characters && n.characters.slice(0, 40) };
  }
  if ("fills" in n && Array.isArray(n.fills)) {
    for (const f of n.fills) {
      if (f.boundVariables && f.boundVariables.color) {
        const v = await figma.variables.getVariableByIdAsync(f.boundVariables.color.id);
        if (v) out.variables[v.name] = v.key;
      }
    }
  }
  if ("children" in n && n.children) for (const c of n.children) await walk(c);
}
await walk(ref);
throw new Error("DISCOVER::" + JSON.stringify(out));
```

This is more reliable than the design-system search, which frequently times out on popular terms
like "Icon Button" — you are reading the file's real state instead of a full-text search index.
It is especially useful when you are about to build a component that has to sit stylistically next
to a particular block: it already carries every token that block actually uses.

## Token setup

If the personal-token server disappeared from `claude mcp list` — 90 days are up:

1. Figma → Settings → Security → Personal access tokens
2. Generate a new token
   - Name: `claude-code`
   - Scopes: File content (R/W), Dev resources (R/W), Variables (R/W)
3. Copy it — it is shown once
4. In the terminal, remove the old server entry and add it back with the new token
5. Restart the client
6. Verify: `claude mcp list` → connected

⚠️ **Never paste the token into a chat with the agent** — terminal only. If you paste it by
accident, revoke it immediately and generate a new one.

## Troubleshooting

| Error | Cause | Fix |
|---|---|---|
| "nothing selected" | Dev Mode tool with no desktop selection | click the node in the desktop app |
| "Code executed with no return value" | the write call's return does not cross the bridge | `throw new Error("PREFIX::"+JSON.stringify(data))` |
| "figma.currentPage is not supported" | the setter does not work | `await figma.setCurrentPageAsync(page)` |
| libraries tool times out | large file | skip it, use the design-system search |
| token server missing from the MCP list | token expired | regenerate (above) |
| data truncated in the thrown error | ~4–5KB limit | split by collection |
| "Property value is incompatible" on an instance swap | you passed `.key` | pass the node id (`"1204:31"`) |

## Foundations sanity check

Keep a one-glance inventory of the foundations file so you can tell instantly when something
drifted. The shape (numbers here are from one real file, as an illustration):

| Collection | Variables | Modes |
|---|---|---|
| Color | 76 | Dark |
| Typography | 30 | Web / native |
| Dimensions (margins / radius / spacing / blur) | 40 | Value |
| Elevation (shadow sm / md / lg / xl) | 20 | Dark |
| Motion (duration / easing) | 7 | Value |

Plus 24 text styles: Heading 1–6, lg / md / sm / caption / button / symbol × weights.

## Other non-obvious behaviours

- Reordering variables requires delete + recreate in the order you want
- There is no `FRAME_PADDING` scope; use `GAP` + `WIDTH_HEIGHT` for spacing tokens
- An effect style's blur radius can be bound through `boundVariables` on the effect object; shadow
  parameters cannot be bound to variables through effect styles
- Variable names cannot carry dots or parentheses as meaningful characters
- Moving variables between collections: create the new ones → build an old→new id map → rebind the
  consumers → delete the originals
- Always fetch canvas metadata and variable collections in the same audit pass
- The plugin API is more reliable than the design-system search or the variable-definitions tool
  for bulk retrieval
- The Figma **desktop** app (not the browser) is required for write access through the plugin
- `combineAsVariants` requires every component to already be a child of the target page
- Tree walks: `children` does not exist on TEXT / VECTOR / RECTANGLE nodes — always guard with
  `if ('children' in node && node.children)`

## The overnight session that produced the rest of this file

Each item below cost real cycles.

### A. Writes to a non-current page silently fail

The critical bug in this setup. The plugin commits writes ONLY to the page that was
`figma.currentPage` when the plugin connected. `setCurrentPageAsync(otherPage)` changes
in-transaction state, but writes to that other page silently do not persist between transactions.

**Symptom:** the write call returns `Code executed with no return value`, which looks like
success. A read in the same transaction confirms the elements exist. A read in the **next**
transaction finds nothing.

**Reproduction:**

- Write a rect on `Cover` → committed ✅
- `setCurrentPageAsync` to a freshly created draft page → write a rect → visible in-transaction →
  next transaction: gone ❌
- Same for an existing second page that was not current at session start → also fails ❌
- Hypothesis: the plugin holds a view tied to the originally-active page. Writes to other pages
  happen against in-memory state, but the persist step only flushes the original page.

**Workaround:** build EVERYTHING on the originally-active page (usually `Cover`). Wrap it in a
clearly labelled outer section:

```
⚠️ [DRAFT] X work — DRAG TO Y PAGE in the morning
```

The operator drags it onto the right page in five seconds. Not elegant, but stable.

**Not a workaround:** calling `setCurrentPageAsync` insistently inside every call. Tested. It does
not help.

### B. Background instances plus autolayout equals an expanding frame

If a frame has vertical autolayout and you `appendChild` a background instance as its first child,
autolayout sucks it into the flow and the frame's height stretches. One real case: 1024 → 3725.

Backgrounds **must** be `layoutPositioning = "ABSOLUTE"` to leave the flow:

```js
const bg = variant.createInstance();
frame.appendChild(bg);
bg.layoutPositioning = "ABSOLUTE";  // critical
bg.x = 0; bg.y = 0;
bg.resize(frame.width, frame.height);
```

The same pattern applies to any behind-content decorative layer inside an autolayout frame.

### C. A `throw` used for status reporting inside a write call rolls back everything

This is in the pitfalls above, and it is repeated here because it cost four cycles in a row.

```js
// ❌ DEAD WRONG — looks like it works, every change rolls back
async function bigFix() {
  // ... useful writes ...
  const log = { framesChanged: 7, instancesAdded: 4 };
  throw new Error("FIX_LOG::" + JSON.stringify(log));  // ROLLS BACK
}

// ✅ CORRECT — the write commits, status comes from a separate read
async function bigFix() {
  // ... do all the writes ...
  // Just let it return. NO throw.
}
// Then a NEW plugin call (a separate tool invocation):
async function verify() {
  const log = { /* walk the tree, build the report */ };
  throw new Error("VERIFY::" + JSON.stringify(log));  // OK — read-only call
}
```

Detection: if you are writing `const log = ...; throw new Error("STATUS::"+...)` inside a call that
ALSO writes — STOP. Split it into two calls.

### D. Bound-variable opacity multiplication is unreliable

`setBoundVariableForPaint(paint, "color", variable)` where the variable carries an intrinsic 24%
alpha, plus `paint.opacity = 0.12` — the naive expectation of ~3% effective opacity does not hold.
The variable's alpha partly dominates. For thin glass tints, **inline RGBA is more predictable**:

```js
// ❌ unpredictable for fine-grained glass
fr.fills = [vp(transBrand24, fallback, 0.12)];

// ✅ predictable
fr.fills = [{ type: "SOLID", color: { r: 0.98, g: 0.86, b: 0.72 }, opacity: 0.06 }];
```

Trade-off: inline loses the design-system link. Acceptable for atmospheric and glass surfaces you
are fine-tuning by eye. For ordinary solid surfaces, variable bindings are better.

### E. Visual self-review through screenshots is mandatory

`Code executed with no return value` says NOTHING about visual quality. One run went four cycles
without a single screenshot, and then the operator saw slapdash background orbs, a broken icon,
overflowing text and broken autolayout — all of which a five-second screenshot would have caught.

After EVERY meaningful frame build, take a screenshot. Look at it honestly. If it looks like a
2018 dribbble mockup, rebuild it before the handoff.

### F. Inspect a kit component's variants before using it

Component names lie. One run picked the `Covers` variant of the page-background component,
thinking "22 inner shapes means rich content, good." It turned out to be an album-style collage
built for marketing and pricing pages, and it showed through the onboarding hero card.

Before using an unfamiliar or page-level component:

```js
const set = await figma.importComponentSetByKeyAsync(KEY);
const variantNames = set.children.map(v => v.name);
const sample = set.children[0];
function walk(n, depth = 0) {
  if (depth > 3) return null;
  return { name: n.name, type: n.type, kids: "children" in n ? n.children.map(c => walk(c, depth + 1)) : null };
}
throw new Error("INSPECT::" + JSON.stringify({ variants: variantNames, sampleStructure: walk(sample) }));
```

If it contains pre-populated imagery or content that does not suit your context: either (a) a
different variant, (b) override the children, or (c) build a custom one on the `Components` page
with full design-system hygiene.

### G. Atmospheric backgrounds — the design system or nothing

The anti-pattern: `figma.createEllipse()` plus a 200px layer blur, presented as "atmosphere". The
operator's verdict: *"that's slapdash."* The right answer is the page-background component, the
backgrounds set, or simply a plain canvas with no background at all. Never a bespoke blurred
shape.

If the system does not have what you need, build a proper component — do not drop in a half-baked
decorative shape.

## Refining the non-current-page rule

The earlier rule of thumb — *"the bridge blocks node creation on a non-current page, but property
changes to existing nodes persist"* — turns out to be too broad. Not all property changes persist.
The granularity is property by property.

### J. Repositioning on a non-current page silently fails

`existingNode.x = N` / `existingNode.y = N` on a node living on a non-current page — say a section
the user previously dragged off `Cover` — does NOT persist between transactions. The mutation
appears to succeed in-call, and a fresh read shows the original coordinates.

Verified by direct probe: changed `firstChild.x` from `50` to `12395` in transaction 1;
transaction 2 read `x = 50` again.

**Implication:** the build-on-Cover-then-drag workaround is **one-shot**. Once the user has
dragged a wrapper section to its target page, you cannot reposition its children remotely. If the
layout has to change after the drag:

1. Build a new wrapper section on `Cover` with the corrected layout
2. The user drags the new section over and deletes the old one

Annoying, but reliable.

### K. Property changes that DO persist cross-page (verified)

- `node.fills = [{ type: "IMAGE", imageHash, ... }]` — image fill assignment by hash
- `node.fills = [{ type: "SOLID", color, ... }]` — solid color reassignment (likely; not probed
  separately)
- `setEffectStyleIdAsync(...)` and inline `effects` — likely, by analogy
- `node.cornerRadius = N` — likely; not probed separately

### L. Property changes that DO NOT persist cross-page (verified)

- `node.x = N` / `node.y = N` — geometric repositioning (verified, see §J)
- `node.resize(w, h)` — likely, by extension; not probed separately
- Anything that requires recalculating sibling layout on a non-current page

### M. The practical rule

Treat ALL writes to a non-current page as suspect. If you must write cross-page, restrict yourself
to fills, effects and image hashes — the paint-over class of operations, which need no geometric
recalculation. Anything that moves nodes: build fresh on `Cover` and drag.

The minimum viable mental model:

- **Cross-page CAN do:** paint over an existing node (fills, image hashes, effect styles)
- **Cross-page CANNOT do:** move or create nodes (x/y, resize, `createFrame`, `appendChild`)

### N. Recovering after the user moves nodes — search by name

The companion to §J: when the user drags a SECTION between pages, the child node ids are
regenerated. The ids from your build call no longer resolve.

Recovery: search by name across every page.

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

After recovering the top-level ids, walk the children to re-derive the nested ones — those changed
too. This is the standard recovery path after the wrapper-section-then-drag pattern.

## Related

- [code-to-figma.md](./code-to-figma.md) — porting a code prototype into frames
- [overnight-runs.md](./overnight-runs.md) — the autonomous-run protocol these gotchas come from
