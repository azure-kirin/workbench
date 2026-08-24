# Prototype intake

*What to do when someone hands you a code prototype — a stakeholder's HTML, an engineer's React
proof of concept, an outside collaborator's sandbox.*

Six steps. The first five keep the port honest; the sixth is the one that pays for the whole
exercise.

## 1. Receive

When the prototype arrives:

1. Drop the source into a new folder: `2-areas/prototypes/active/<source>-<short-name>-<YYYY-MM>/`
2. Save the original artifact, unchanged, in `original/` inside that folder.
3. Add an `intake.md` recording:
   - Who sent it, and when
   - What it is meant to demonstrate — the **intent** behind it, not the pixels
   - Deadline, and political context if there is any
   - Why it is being ported at all: a show-and-tell, a real upcoming feature, an exploration?

The third bullet is the one people skip. A prototype built to win an argument and a prototype
built to specify a feature look identical and need completely different treatment.

## 2. Audit

Before porting a single pixel, audit the prototype against the design system:

- Which parts map to components that already exist?
- Which need new components?
- Which are **anti-patterns** in your system and need reworking rather than porting?
- Which tokens does it reference — color, type, radii, motion — and do they map cleanly onto
  yours?

Capture it as `audit.md` in the prototype folder.

## 3. Plan

A short `plan.md`:

- The component map: prototype → design system
- New components to add, and which tier each belongs in (`ui/` primitives, `patterns/`
  compositions, `product/` domain widgets)
- Tokens to add, if any — **with justification**. No token additions without a reason.
- Porting order: foundations → compositions → screens
- The branch name in the design-system repo

## 4. Port

Implementation happens in the design-system repo, on a feature branch. The prototype folder tracks
intent, decisions and outcomes — not the code.

Log decisions in `decisions.md` as you go:

- Why this component landed in `patterns/` rather than `product/`
- Why this token was added, or rejected
- Where the original prototype's design did not survive contact with the system, and why

That last one matters more than it looks. A prototype is one person's argument; the system is the
accumulated argument of everybody who came before. When they disagree, the disagreement is the
interesting artifact, and it is the thing you will be asked about in three months.

## 5. Extract back into the design system

This is the point of the whole exercise. A port is not a translation job — it is a survey of what
your system is missing, run by someone else's imagination.

When the port is done:

- List every new component, token and pattern the port introduced.
- Open a pull request back into the design system for the reusable extractions — not the
  screen-specific ones, the reusable ones.
- Add an entry to the prototypes index under "design-system contributions extracted from ports".

A port that ends without an extraction list either found nothing new — possible, worth stating out
loud — or quietly built a parallel system next to yours. It is almost always the second one.

## 6. Move to `completed/`

When the port ships (or is shelved):

- Move the folder from `active/` to `completed/`.
- Add to it:
  - Links to the implementation and to the extraction pull requests
  - The outcome: shipped / shelved / folded into a larger feature
  - Lessons learned, if any are non-obvious

## Related

- [code-to-figma.md](./code-to-figma.md) — when the port runs the other direction, into design
- [context-system.md](./context-system.md) — where these folders live in the vault
