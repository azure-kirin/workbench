# docs

The method. Each file is written to be loaded by an agent as a skill, or read by a person once and
then kept nearby.

| Document | What it covers |
|---|---|
| [context-system.md](./context-system.md) | The four layers — vault, `CLAUDE.md`, memory, skills — and how they close into one loop on a real task. Start here; everything else assumes it. |
| [overnight-runs.md](./overnight-runs.md) | Leaving an agent working unattended for a night: the pre-flight gate, the actions that are never reversible, escalation, the morning handoff format, and fifteen gotchas from runs that failed. |
| [prd-to-flows.md](./prd-to-flows.md) | Getting from a locked spec to a designable surface: enumerate the end states, list every flow, split them into what gets drawn and what gets reused. |
| [figma-plugin-api.md](./figma-plugin-api.md) | Driving a design tool through its plugin API and an MCP bridge — silent cross-page write failures, transaction rollback on `throw`, autolayout sizing traps, plus a cookbook. Translated from Ukrainian. |
| [code-to-figma.md](./code-to-figma.md) | Porting a running code prototype into design frames, including scaffolding a whole flow grid at once. |
| [prototype-intake.md](./prototype-intake.md) | What to do when someone hands you their prototype — six steps, of which the last (extracting reusable patterns back into the design system) is the one that pays. |
| [harness-audit.md](./harness-audit.md) | Re-auditing memory, instructions and skills on a model jump, through four lenses. The maintenance ritual for the context system. |
| [motion-assets.md](./motion-assets.md) | ffmpeg recipes for shipping a video background: VP9 primary, H.264 fallback, webp poster, and the reduced-motion contract. |

## Conventions

**Worked examples use an invented product** — Hearth, a supper-club app where home cooks host
dinners and guests book seats. The situations, the failures and the file shapes are real; the
product is not. Where a lesson only makes sense through a concrete example, the example was
rebuilt around Hearth rather than deleted.

**"The operator"** is the human who set the task; **"you"** is the agent doing it. Several of these
documents are written to be read by the agent, not about it.

**No keys, ids or addresses.** File keys, channel ids, tracker lists and repo paths belong in a
project's own `CLAUDE.md` and `memory/`, where they load automatically and stay private. Wherever
a document needs one, it says so and stops there.
