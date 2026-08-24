# From a spec to a designable surface

*Three stages between "the spec describes the system" and "the designer has concrete frames to
fill": enumerate the end states, list the flows, then scaffold them.*

The output is a flow grid where every state has a placeholder set waiting for design.

> Worked examples use **Hearth**, an invented product — a supper-club app where home cooks host
> dinners and guests book seats.

## When to use it

- A spec just locked (or was substantially reframed) and the designer needs to start drawing
- The product has a non-trivial state space — account types, claim states, verification states,
  plan tiers — where one screen serves several states
- Several flows share screens, so a naive frame-per-screen approach would over-design

Skip it when the spec describes a single screen with no variations, when the flow is trivially
linear, or when the designer needs one specific screen rather than the whole surface.

## Stage 1 — Enumerate the end states

### Find the state axes

Read the spec and find the orthogonal dimensions that decide what the user sees. For Hearth's
onboarding:

| Axis | Values |
|---|---|
| Account | anonymous / authenticated / returning |
| Kitchen claim | no claim / claimed |
| ID check | unchecked / checked |
| Plan | free / plus |

Other projects have different axes. Guest profile views, for instance, has plan (free / plus), ID
status (unchecked / checked), private mode (on / off), and notification preference (push / email /
both / off).

That example used to read `viewer tier (free / plus / unchecked)` — one axis holding a plan and a
verification state at once. It is the error this stage exists to prevent: the two facts move
independently (an unchecked account can be on plus, a checked one can be free), so a single axis
cannot express them and every table built on it goes wrong downstream. If an axis's values do not
all answer the *same* question, it is two axes.

### Enumerate the combinations

Pick the combinations that are **realistic**. Some are theoretically possible and never happen.
For Hearth onboarding:

- `[anon]` — account axis only, the rest are n/a
- `[anon customized]` — optional, depends on an open question
- `[returning]` — login; status inherited
- `[no-claim]` — authenticated, no claim, unchecked, free
- `[no-claim id-checked]` — did the ID check to unlock a feature, without claiming a kitchen
- `[claimed]` — claim path; ID-checked by definition, since the claim requires it
- `[no-claim · plus]` — the plan overlay
- `[no-claim id-checked · plus]`
- `[claimed · plus]`

State labels use a **bracketed convention**: `[<axis values, space-separated>]`. The plan overlay
is a `· plus` modifier.

### Flag the impossible states

After enumerating, check for combinations the spec rules out:

- `[claimed id-unchecked]` is **not possible** — claiming a kitchen runs the ID check at the moment
  of claim.

Write these out explicitly: *"NOT a valid state: `<name>` — because `<spec rule>`."* It prevents
accidental designs.

### The compact reference matrix

Boil the state list down into a table for the spec or the handoff:

| State | Claim | ID | Plus | Gated actions |
|---|---|---|---|---|
| `[anon]` | — | — | — | ❌ |
| `[no-claim]` | ❌ | ❌ | ❌ | ❌ (gated) |
| `[no-claim id-checked]` | ❌ | ✅ | ❌ | ✅ |
| `[claimed]` | ✅ | ✅ | ❌ | ✅ |
| `[claimed · plus]` | ✅ | ✅ | ✅ | ✅ |
| … | | | | |

The matrix doubles as a sanity check, in both directions. Every column needs at least one ✅ and
at least one ❌, otherwise the axis is irrelevant and should be collapsed. And every axis has to
*fit* in one column: if its values cannot be read as one yes/no question — because they mix two
independent facts, the way a `free / plus / unchecked` tier mixes plan with verification — it is
two axes, and it needs two columns.

## Stage 2 — Enumerate the flows

### The format

One flow, one line:

```
entry-state → step → step → ... → end-state
```

Steps are concrete UI moments — state names, screens, modals. Use the bracketed names from stage 1
for states, and bare descriptive names for screens and modals (`Sign Up entry`, `ID check modal`,
`Pricing`).

### List every user-decision branch

From the entry state, enumerate every meaningful choice available. Cover:

- Active conversions (sign-up, login, customize, gated-action triggers)
- Passive paths (browsing, leaving)
- Recovery paths (forgot password, verification failure, "no, that isn't me")
- Modifier triggers (paywall, verify-for-feature gate)

Do not be shy about the count — 20 to 40 flows is normal. Compressing into "five main flows" loses
the fidelity you are doing this for.

### Branches get their own line

When a flow forks — the ID modal succeeds or fails — each branch is its own flow:

```
[no-claim] → tap [Message] → ID modal → Start → 3rd-party → success → action completes → [no-claim id-checked]
[no-claim] → tap [Message] → ID modal → Maybe later → action blocked → [no-claim] (unchanged)
```

### Output: a pure text scheme

The flow list is text only, no commentary. The designer reads it top to bottom and gets the whole
surface map:

```
[anon] discover → tap [Save] → sign-up popup → [Sign up] → Sign Up entry → email/SSO → password → email verify → Screen 1 → Match A → [This is me] → Screen 2 → [Claim kitchen] → ID modal → success → Screen 3 → [claimed] discover

[anon] discover → tap [Customize] → taste selection → [anon customized] discover

[no-claim] discover → tap [Message] → ID modal → success → [no-claim id-checked] discover
...
```

## Stage 3 — Group and scaffold

### The two-group split

- **Group 1 (base)** — the flows whose states need full design treatment. Between them they cover
  EVERY unique state at least once. These are the screens the designer actually draws.
- **Group 2 (schematic)** — flows that reuse group 1's states from different entry points or
  branches. No new screens, only different transitions. Text only.

### Picking group 1

Choose canonical paths through the surface. For Hearth onboarding:

- Flow 1: full sign-up + Match A claim + ID check → `[claimed]` (covers every sign-up screen,
  Match A, the ID modal, the claimed variant of screen 3, and the claimed discover surface)
- Flow 2: full sign-up + Match C, no claim → `[no-claim]` (covers Match C, the prefill, the
  no-claim variants of screens 2 and 3, and the no-claim discover surface)
- Flow 3: ID check triggered by messaging, from no-claim → `[no-claim id-checked]` (covers the
  verify-for-feature trigger and the checked state)
- Flow 4: login → `[returning]` (covers the login form, forgot password, the returning state)
- Flow 5: paywall → plus → `[* · plus]` (covers the paywall modal, pricing, welcome-to-plus, the
  plus state)
- Flow 6: anonymous customize → `[anon customized]` (covers taste selection and the customized
  anonymous state)

Six flows cover every unique state. Everything else is a variation, so it is group 2.

### Group 2 examples

- The Match B variant — same shape as A, different card content
- Match D's pick-row / narrow-by-dinner / create-new paths
- Match E's filter / create-new paths
- The header sign-up CTA — same sign-up flow as the gated-action trigger
- The customize-button gate variant, if the open question resolves the other way
- ID check triggered from the checklist task, from the hero CTA, or from the unverified badge —
  all reach the same modal
- Forgot password, when chained outside flow 4's main path

None of these need scaffolding frames. They are text in a side note.

### Confirm before scaffolding

Once you have the flow list and the group split, send the text scheme to the designer and ask:
*did I miss anything?* A designer's eye catches the branches the method missed.

After confirmation, build the scaffolding per
[code-to-figma.md → Flow scaffolding](./code-to-figma.md#flow-scaffolding) — the flow grid, one
set per state, header plus desktop plus mobile web plus mobile app per set.

## Hard rules

- **Use the bracketed state convention.** Don't invent prose names mid-flow.
- **Don't confuse "new user" with a state attribute.** "New" is recency, not state. Prefer
  permanent flags — claim, verification, plan.
- **One flow per branch.** Every fork gets its own line.
- **Group 1 must cover every unique state.** If a state is unreachable through any group 1 flow,
  the split is wrong. Re-pick.
- **Group 2 must introduce no new screens.** If a group 2 flow needs a screen group 1 lacks, it is
  actually group 1.
- **Don't pre-scaffold ambiguous states.** If a state depends on an open question, mark it
  optional and skip it. Don't draw frames you will throw away.

## Common pitfalls

### Too many combinations

Count combinations, not axes: the space is the **product of the values**, so a four-valued axis
costs as much as two binary ones. Guest profile views above is four axes and already 2 × 2 × 2 × 4
= 32 combinations; Hearth onboarding is also four axes but 3 × 2 × 2 × 2 = 24, of which nine are
realistic. Past roughly thirty the enumeration stops being readable.

Most projects settle at two to four meaningful axes. Collapse the ones that are 1:1 — if "verified"
and "can message" are derived from the same fact, that is one axis, not two. Then cut the
combinations that never occur in practice, which is usually most of them.

Collapsing is not the only failure. Splitting matters just as much: an axis whose values answer two
different questions inflates nothing and hides everything, and it will not fit a matrix column.

### A flow is a DAG, not a line

Some flows loop — verification fails then retries, forgot-password resets then logs in again.
Linearise them by writing each path as its own flow. The text scheme assumes linearity; the DAG
shows up in the design file as branching arrows afterwards.

### Skipping stage 1 and going straight to flows

Without the state enumeration you end up with three flows that all end in a vague `[home]` or
`[done]`, and the designer cannot tell the variations apart. Always do the matrix first.

### Group 1 too big

Twelve or more flows in group 1 means you are not de-duplicating. Push the variations into group 2.

### Group 2 lost

When group 2 is only text, the designer loses track of the branches. Put it in the same file
section as a long text frame, or in the spec's user-flows section. Do not dump it into a chat and
forget it.

## Output artefacts

1. **The state matrix** — in the spec's data-model section, or a side doc
2. **The flow text scheme** — grouped into group 1 and group 2, in the spec's flow section or a
   co-located `<area>-flows-YYYY-MM-DD.md`
3. **The scaffolding** — the flow grid, per the porting guide
4. **The designer's TODO** — group 1 states × platforms

## Related

- [code-to-figma.md](./code-to-figma.md) — stage 3's build details
- [context-system.md](./context-system.md) — where the spec lives and what `status: signed` means
  (this method runs downstream of locked decisions)
