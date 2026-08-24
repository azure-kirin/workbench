# Auditing the harness

*Periodically re-examine everything wrapped around the model — memory files, `CLAUDE.md` layers,
skills, settings — for staleness, over-engineering, and self-model drift.*

**When to run it:** on a major model-intelligence jump, or on demand. A smarter model can see cruft
the old one could not. Scaffolding a weaker model needed becomes dead weight; every model jump is
a chance to shed it.

Adapted from Daniel Miessler's idea of the prompts worth re-running whenever a new model lands —
the tactical meta-prompts that benefit most from added intelligence.

## Rule 0 — enumerate the whole surface first

The number-one mistake is auditing only the memory store of the current working directory. Memory
is **fragmented per project path**: a session in the component-library repo sees a different store
from one at the workspace root. Before auditing anything, list the whole surface:

```bash
# All memory stores across all projects, not just this cwd
for d in ~/.claude/projects/*/memory; do [ -d "$d" ] && echo "$(ls "$d"/*.md 2>/dev/null | wc -l) — $d"; done
# The global always-on layer
ls ~/.claude/CLAUDE.md ~/.claude/skills/ ~/.claude/settings.json 2>/dev/null
# Every CLAUDE.md and AGENTS.md in the workspace
find ~/work/<workspace> -maxdepth 2 \( -name CLAUDE.md -o -name AGENTS.md \)
# Skill bodies — read the content, not just the names
find ~ -path '*/.claude/skills/*/SKILL.md' 2>/dev/null
```

Watch for **orphan stores from path drift** — near-identical directory names differing only by a
trailing dash or segment are usually dead weight from a working directory that moved. Confirm they
are abandoned, then delete. Git and the filesystem are the audit trail.

## The four lenses

Run every memory file, `CLAUDE.md` and skill through all four:

1. **Bitter Lesson.** What is over-engineered scaffolding that a smarter model no longer needs?
   Exhaustive tool blocklists, model-name enumerations, step-by-step rules for things the model now
   derives from principle. Trim to the principle plus one example.
2. **Staleness.** What live state got frozen into memory and rotted? "In flight", "currently N", a
   pinned "the canonical pull request is number N", version pins, dated ownership. Verify against
   the current code **empirically** — this is the verify-don't-recall rule applied to the harness
   itself. Never trust the memory's own claim about itself.
3. **Self-model.** Does the harness model the user correctly, and in one place? A missing
   consolidated `user`-type anchor is the common gap: identity scattered across a dozen feedback
   files. One clean anchor makes every future session bootstrap faster.
4. **Goal-orientation.** Does anything actively work against what the user is trying to do?
   Redundant pairs that should merge; contradictions between layers — root versus nested
   `CLAUDE.md` versus memory.

## Procedure

1. **Enumerate** the whole surface (rule 0). Report the map before touching anything.
2. **Prioritise by leverage** — the biggest and most canonical store first. Orphan cleanup is the
   cheap win.
3. **Read, don't skim.** Dump each store's files with headers. Read skill bodies and settings, not
   just names.
4. **Verify empirically.** Every staleness suspicion gets checked against current code or config
   before you assert drift.
5. **Propose in tiers:** tier 1 fix-now factual drift · tier 2 merge and trim · tier 3 self-model
   gaps · tier 4 cosmetic, or watch. Lead with the deletion option — bias to deletion.
6. **Apply** on the user's go, one batch per tier. Keep the `MEMORY.md` index in sync with every
   add, delete and rename.
7. **Spin off code findings** that the empirical pass surfaced as separate tasks. Keep the harness
   audit clean of code work.

## Scale

A small store, or a single-lens check, runs inline. A full sweep — every store × four lenses, plus
orphan reconciliation — is a fan-out: offer a multi-agent run, but only launch it on an explicit
yes. Never auto-spawn dozens of agents.

## Gotchas

- **Leading-dash paths break shell tools.** Memory store directories start with `-` (they encode an
  absolute path), which `cat`, `ls`, `grep` and `find` all parse as a flag. Always pass the full
  absolute path starting from `/`.
- **Concurrent sessions.** If a store's repo has a live parallel session, keep your agents
  READ-ONLY there and make changes surgically. File deletions and stub writes are safe, but that
  other session also writes the store's `MEMORY.md` — sometimes dropping newlines and concatenating
  entries. Prefer a targeted edit over a full rewrite on a live index, and defer index
  reconciliation until no session is active.
- **Personal stores are off-limits by default.** Anything unrelated to the work — a personal
  project's store — is audit-only. Never delete or merge without being asked.
- **Trim versus delete a project memory.** If the only content is a changelog of merged work,
  delete it (verify everything really merged first). If it still names an OPEN follow-up, trim it
  down to the open tail. Giant port logs — 40KB and up — get stubbed to a backlog plus the
  invariants; the real specification lives in the spec, not in memory.

## Run log

Keep one. Each entry: the date, what triggered the run, the before/after counts, what was deleted,
and what was deliberately deferred. The log is what tells the next run whether the last one
actually held.

> **2026-07-03 — first full run, triggered by a model jump.** 13 stores → 10. Deleted two
> path-drift orphans and the store of a project that had finished. The largest store went 109 → 101
> files: two 40KB port logs stubbed down to backlog plus invariants, eight dead snapshots removed.
> The two application stores went 24 → 7 and 23 → 16. At the workspace root: merged a redundant
> feedback pair, added the missing consolidated `user` anchor, corrected two stale factual claims
> about the architecture. **Deferred:** roughly 14 small changelog trims, two more feedback merges,
> and a dead-link cleanup across ten files — that store had a live parallel session and the index
> writes were colliding. Do it in one pass when nothing else is running.

## Related

- [context-system.md](./context-system.md) — what the four layers are supposed to contain, which is
  what the audit measures them against
