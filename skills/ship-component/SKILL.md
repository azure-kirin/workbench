---
name: ship-component
description: Takes one component change in a React/Storybook design-system repo from idea to a green PR — finds an existing match first, scaffolds or extends, adds story variants, runs the project's token gate, reviews it in Storybook, opens the draft PR, then self-reviews that PR until it converges. Use when the user says "create a new…", "build a card that…", "scaffold X", "add a Disabled story to X", "show me the result", "open a PR", "ship this", "self-review". Phases are individually enterable. Project-agnostic — reads commands, tiers and protected paths from the project's CLAUDE.md contract; a project-level skill of the same name overrides this one.
---

# ship-component

One component change, seven phases. Enter at the phase the request lands on; every phase after it still applies.

| # | Phase | Gate that must clear before the next phase |
|---|---|---|
| 1 | **Find similar** | Top-3 candidates shown; a 7+/10 match blocks until the operator says "yes, new" |
| 2 | **Create / extend** | Tier stated out loud and confirmed; `verify` command green |
| 3 | **Story variants** | A story exists for every state a reviewer must see |
| 4 | **Token gate** | `tokenGate` command exits 0 |
| 5 | **Storybook review** | Review URL + a11y result handed to the operator |
| 6 | **PR** | Four-item preview shown, explicit "yes" received |
| 7 | **Recursive review** | Converged (no findings) or explicitly reported as needing a human |

## Phase 0 — Read the project contract

This skill carries the method, not the project. Before the first write, read the project's `CLAUDE.md` and `package.json` and fill this table. Missing rows → ask once, then offer to record the answers under a `## ship-component contract` heading in `CLAUDE.md` so the next session does not ask again.

| Key | What it is | Typical source |
|---|---|---|
| `tiers` | Component folders and the one-line rule for choosing between them | `CLAUDE.md` |
| `barrel` | Where exports are registered | `src/**/index.ts` |
| `verify` | The full local check (format + lint + typecheck + unit tests), as one command line | `package.json` scripts |
| `tokenGate` | The deterministic raw-value scan (`lint:tokens` or equivalent). **If none exists, that is finding #1** — propose adding one before shipping; do not substitute eyeballing | `package.json`, CI config |
| `storyTests` | Story/interaction test command, if separate from unit tests | `package.json` |
| `reviewUrl` | The Storybook the operator reviews on (host:port). Never hand over an ephemeral dev port if a review stand is declared | `CLAUDE.md` |
| `protectedPaths` | Paths where an edit is "stop and ask" (load-bearing primitives, shared materials) | `CLAUDE.md` |
| `branching` | Branch naming, base branch, worktree protocol if any | `CLAUDE.md` |
| `prTemplate` / `changeset` | PR body skeleton; whether a changeset / changelog entry is mandatory | `.github/`, `.changeset/` |
| `exemptPaths` | Where DS gates do not apply (prototypes, labs, explorations) | `CLAUDE.md` |

Standing rules that hold in every project:

- **Tokens, never raw values** in canonical component code. Exempt paths are exempt by contract, not by judgement.
- **Never `git add -A`.** Untracked files you did not author may be another session's live work.
- **Story/spec before implementation** for new components only. Edits to existing components skip this.
- **Follow the project's branching protocol literally.** If it declares worktrees, never write in the standing checkout.

---

## Phase 1 — Find similar

Runs before anything is generated, every time the user describes wanting a new component.

1. Read the barrels for the full inventory.
2. For each candidate, read the first ~30 lines of its source for props and intent.
3. Match on **name** overlap ("stats" → `StatFrame`), **purpose** overlap ("show a user" → `ProfileCard`), and **shape** overlap ("card with image" → `Card`, `EntityTile`).
4. Return the top 3, each with import path, tier, and a one-line summary.
5. Close with: *"Closest match is X. Use existing, extend with a new variant, or scaffold new?"*

**Hard rule:** a closest match at 7+/10 on name+purpose blocks generation until the operator explicitly confirms **"yes, new"**. "Extend X with a variant" routes to Phase 3.

## Phase 2 — Create / extend

Entered only after "yes, new", or an explicit request to scaffold.

1. **State the tier out loud and wait** — folder + Storybook title are one decision; say which tier and the one-sentence reason from the contract's rule. Do not proceed without confirmation.
2. **Generate three co-located files**, kebab-case: `<name>.tsx` (variants via the project's variant utility, semantic tokens only, `className` passthrough), `<name>.stories.tsx` (autodocs, title in the project's taxonomy, `Overview` + `Playground`), `<name>.test.tsx` (render assertion + one per major prop). Copy the shape of the nearest existing component rather than inventing a template.
3. **Barrel export**, alphabetical.
4. **Run `verify`.** All of it must pass.

If the project has a story-authoring method (a `document-component` skill or a docs section), use it for the Overview — it also applies to editing existing stories, which never enters this phase.

## Phase 3 — Story variants

Adding a state to an existing story file without changing the component:

1. Read the component for its prop signature, then the existing stories to match format and import style.
2. Append a PascalCase export named for the state (`Disabled`, `Loading`, `WithLongLabel`).
3. `args`, not `render`. `render` only when several sub-components must be composed.
4. Run the formatter.

**Hard rule: do not modify the component file in this phase.** A state that needs a component change is Phase 2 work.

**The in-between case — a new variant (component + story together)** is a real component edit: check `protectedPaths` first, run Phase 4, run `verify` + `storyTests`, continue to Phase 5.

## Phase 4 — Token gate

Run `tokenGate`. It is the same check CI runs; a clean run is a positive signal worth reporting (*"Token lint clean."*). Never skip it because the diff looks fine.

Two things a line-level scanner cannot see — check by eye on the diff:

- **Inline `style={{ … }}` with literal values** (`color`, `background`, `padding`, `width`, `borderRadius`, `fontSize`…). Move into a class/variant or pass as a CSS custom property.
- **Whether a flagged off-scale number is the real problem.** `w-[37px]` usually means the value is off the spacing grid — the fix is a grid step or a token, not an ignore comment. For a flagged colour, name the intent and pick the matching semantic token.

## Phase 5 — Storybook review

Never declare visual work done without a URL the operator can open.

1. Ensure `reviewUrl` answers (`curl -sf -o /dev/null -w "%{http_code}" <reviewUrl>`); start it per the contract if not. The stand must show the branch under review.
2. Build the story URL from the title: Storybook lowercases and joins on `-` → `<reviewUrl>/?path=/story/<title-kebab>--<leaf>`. Verify the id against the running sidebar or `storybook-static/index.json` rather than guessing.
3. Screenshot the canvas headlessly to a timestamped file; Phase 6 embeds it.
4. Read the a11y addon's results: violations (blocking) · passes · incomplete (manual).
5. Report:

```
Story URL: <reviewUrl>/?path=/story/01-items-date-picker--overview
Screenshot: /tmp/storybook-review-<timestamp>.png
A11y: 0 violations · 12 passes · 1 incomplete (color contrast — manual)
Suggested visual checks: hover · focus via Tab · mobile viewport
```

## Phase 6 — PR

Confirmation-gated. Never write git state silently. Show all four before committing:

1. **Branch** — per `branching`. If on the base branch, propose `<type>/<slug>` and move the work first.
2. **Staged files** — listed individually from `git status`. Never `.env*`, build artifacts, logs, or files another session left untracked.
3. **Commit message** — conventional commits, `<type>(<scope>): <imperative summary>`; body says *why*. The harness appends its own trailers; do not hand-write a co-author line.
4. **PR body** — `prTemplate` as skeleton: summary · stories changed (with Phase 5 URLs) · screenshot · token gate ☒ · a11y ☒. Include the changeset if the contract requires one — it is part of the change, not an afterthought.

Then ask: *Ready to commit + push + open PR? (yes / change branch / change message / cancel)* — **wait for an explicit "yes"; do not proceed on silence.** After "yes": verify the branch in the same command as the commit (`[ "$(git symbolic-ref --short HEAD)" = "<branch>" ] && git commit …`), `git add <listed files>` → commit → `git push -u origin <branch>` → `gh pr create --draft`. Return the PR URL.

Offer this phase after any meaningful unit of work. One draft PR per cohesive branch, updated often; never one PR per file.

## Phase 7 — Recursive review

An independent cold read of the PR before a human is pinged. Up to 3 passes; each applies fixes, re-runs checks, pushes, re-reviews.

**Skip** for one-line fixes, merged/closed PRs, and while CI is red (fix CI first).

1. **CI green?** `gh pr view <num> --json statusCheckRollup,mergeStateStatus`. Failure → stop and report. Pending → poll every 30 s, cap 5 min.
2. **Pull the diff** to a per-pass numbered file so passes can be compared.
3. **Review cold**, as a reviewer who has not seen the implementation:
   - 🔴 **Blocker** — bug, broken contract, missing required file, raw values in canonical code, CI-breaking issue missed locally.
   - 🟡 **Should-fix** — dead code, stale doc comments, redundant utilities, a11y, type-safety.
   - 🟢 **Nice-to-have** — never auto-applied.
   Every pass also checks the project's own invariants: tier placement, co-located tests, Storybook hierarchy rules, doc comments matching code after renames, current framework idioms.
4. **Apply every 🔴 and 🟡.** Leave 🟢 unless asked.
5. **Local checks** (`verify`, `storyTests`) before commit. Any failure after a fix attempt → stop, surface, do not push.
6. **One commit per pass:** `chore(<scope>): recursive-review pass N (#<pr>)` + bulleted fixes.
7. **Wait for CI**, then iterate or stop: no edits → CLEAN · 3 passes with edits each → needs a human · CI red → blocked.
8. **Final signal on its own line:** ✅ READY FOR HUMAN REVIEW · 🟡 NEEDS HUMAN · 🔴 BLOCKED — each with a per-pass summary.

**Scope discipline:** fix issues *in* the diff, never adjacent code. No new features. Leave the PR's draft/ready state as it was. No option lists between passes — iterate.
