---
name: layout-stability
description: Audit an interactive page or prototype story for UI jitter — chrome that moves, resizes or squeezes when the user toggles states (filters, select mode, search, sheets), and state that leaks after undo. Use when the user says "екран сіпається", "layout stability", "перевір на стрибки", "something jumps when I…", reports elements shifting between actions, or before declaring an interactive page done. Drives the page headlessly with the layout-stability tool and reports per-axis px deltas; includes the fix recipes for the recurring root causes.
---

# Layout stability

UI jitter = chrome that moves when it shouldn't. The eye catches it only in motion — this audit
catches it in numbers, so a fix is verified by a re-run, not by "looks fine now".

## 1. Locate the harness and the registry

- **Tool:** `layout-stability` (workbench `tools/layout-stability`). If the project does not have it,
  add it as a dev dependency or run it from the workbench checkout — never re-implement the
  measuring loop inline.
- **Registry:** the project's `layout-audits.mjs` (or the path its `CLAUDE.md` names). No registry
  yet → create one next to the project's other scripts; it is project code and gets committed.
- **Target server:** Storybook or the dev server must be running. Read the port from the project
  contract (review stand vs. dev loop — worktrees run their own); pass it as `--base-url`.

```sh
npx layout-stability --base-url http://localhost:6006                 # all audits
npx layout-stability <audit-name> --base-url http://localhost:6006    # one
```

Exit 0 = stable. Exit 1 = violations, each printed as `anchor: Δx Δy Δw Δh` per phase
(`during` / `after restore`).

## 2. Add an audit for a page

1. **Anchors** — selectors for chrome that must stay put: the frame/shell, status and top bars,
   search inputs, tab pills, the first list row, the bottom bar. Prefer stable hooks
   (`data-slot`, `aria-label`) over text. Add a `data-*` attribute to the shell if the page uses a
   custom viewport rather than fighting a brittle selector.
2. **Actions** — every interactive state the page offers, each with `perform` + `restore`.
   Declare designed movement explicitly: `mayChange: ["firstRow"]` (content legitimately shifts),
   `mayHide: ["bottomBar"]` (legitimately leaves the DOM). Nothing is exempt after restore.
3. **Frame checks** — for device-frame prototypes use the built-in `"ios"` preset; for web pages
   skip them or write the two or three that matter (sticky header height, sidebar width).
4. Run, then **classify each violation before fixing**: designed behaviour → move it into
   `mayChange`/`mayHide`; everything else is a bug.

## 3. Fix recipes — the recurring root causes

| Symptom | Cause | Fix |
|---|---|---|
| Sibling width jumps when a control's content swaps (icon ↔ count) | trailing content has a different intrinsic width | fixed-width slot, swap inside it |
| Everything above/below shifts ±1–5px when a row appears/disappears | fixed-height flex column; an in-flow height change makes flex **shrink** compress chrome rows | `flex-shrink: 0` on every chrome row; only the scroller flexes |
| Whole column squeezes when a mode bar appears | the bar is in-flow while the bar it replaces is an overlay | render mode bars as overlays too (`position: absolute; inset-inline: 0; bottom: 0`) |
| Row swap shifts content below | the two states have different row heights (different text sizes) | give both states the same fixed height |
| Header collapses after entering a mode without scrolling | content-height change fires a synthetic scroll event into collapse logic | gate collapse handlers on real user scroll / lock during state swaps |
| Band above a device status bar | background artwork shorter than the frame | `object-fit: cover; object-position: bottom` on the artwork; check for custom backgrounds bypassing the shared one |
| Jitter only on the first toggle | lazy-mounted content or fonts loading late | wait for `networkidle` / font load before baseline; if real users see it too, reserve the space |

## 4. After the audit

- Re-run until exit 0; paste the final report in the PR or the handoff.
- Fixes follow the project's own rules for the surface they touch: prototype/lab paths may use raw
  values if the contract exempts them; canonical design-system code goes through the token gate
  and the protected-paths check (see `ship-component`, Phase 4).
- A pattern that needed a fix twice belongs in the table above — extend it in the project's skill
  copy or propose it upstream here.
