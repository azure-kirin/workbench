# The four-layer context system

*How to give a coding agent the context it would otherwise ask you for, every session, forever.*

**TL;DR:** the agent starts every session blind — it doesn't know the stakeholders, the brand
decisions, or where the spec lives. Capture that once across four layers (vault / `CLAUDE.md` /
memory / skills), and the agent opens every session with the full picture. You get to show up with
an empty head.

This is not "PARA for designers" and it is not "how to set up Obsidian." It is about the
**integration layer** — how those four artifacts close into a single loop on a real task.

> Worked examples use **Hearth**, an invented product — a supper-club app where home cooks host
> dinners and guests book seats. The situations, failures and file shapes are real; the product is
> not.

## Five facts

1. **Vault = human memory.** `CLAUDE.md` = project context for the agent. `memory/` = continuity
   between sessions. Skills + MCP = codified workflows. Each layer alone is hygiene. Together
   they are a system.
2. **A spec is not a document, it is a scope contract.** While `status: draft`, the agent does not
   start the overnight build. The moment it is `status: signed`, the decisions are locked and the
   agent cannot step outside them.
3. **`CLAUDE.md` is not a README.** It is not for humans, it is for the agent: compact,
   operational — file keys, where the design system lives, which guides to read first. Mine is 44
   lines.
4. **Memory fills up from pain, not from planning.** Don't write "rules of work" up front. The
   moment the agent does something wrong and you correct it, save a feedback note. After a month
   you have ~15 files and they are your real rules, not your imagined ones.
5. **The vault is not an archive.** Distill, keep what is useful, delete what is stale. If a file
   hasn't been needed in a year, delete it. Git history keeps it.

## §1 What problem this solves

In a fresh session the agent does not know:

- Who the stakeholders are, and what each of them likes and dislikes
- The current brand color — because the vision doc is stale and the actual decision is in a chat
  thread from three weeks ago
- Where the production design system lives in code (the workspace has two — the old one and the
  new one)
- What was already decided with engineering about the backend
- That last week you worked out how to do glass popups properly and you do not want to explain it
  again

Without a system, every session costs 15–20 minutes of "let me remind you of the context." Times
five sessions a day. Plus you personally have to hold all of it in your head.

With the system: the agent opens a session, reads `CLAUDE.md` + memory + (optionally) the task
spec — and already knows. I arrive with an empty head, say "we're doing onboarding screen 2," and
we work.

Second-order benefit: decisions you argued through once with stakeholders no longer have to be
remembered. They live in the spec. In a month you will not remember why guest reviews slipped to
v2. The file will.

## §2 The four layers

| Layer | What it is | Where it lives |
|---|---|---|
| **vault** | human memory — decisions, specs, references, notes | `vault/` (Obsidian + a private git repo) |
| **`CLAUDE.md`** | project context for the agent, auto-loaded at session start | `<repo-root>/CLAUDE.md` (44 lines) |
| **`memory/`** | continuity between sessions of one project — feedback, preferences, recurring pitfalls | `~/.claude/projects/<project>/memory/` |
| **skills + MCP** | codified workflows + integrations with external services | `~/.claude/skills/`, MCP servers in your client config |

### Vault

**What:** everything a *human* needs to remember about the project — current state, decisions,
specs, references, decision logs.

**Where it lives:** an Obsidian vault on disk, synced through a private git repo. PARA structure:
`0-context/` (foundation, read first), `1-projects/` (active, with a deadline), `2-areas/`
(ongoing responsibilities — design system, brand), `3-resources/` (skills, guides, templates,
research), `4-archive/` (closed).

**What goes in:**

- A spec per project (`<area>/<area>-prd.md`)
- A decisions log (`<area>/<area>-decisions.md`)
- Discussion docs, for the period before a spec ripens (`<area>/<area>-discussion.md`)
- Audits, research, post-meeting notes
- Reports after finished tasks (`<area>/<area>-YYYY-MM-DD-report.md`)
- A map of content (MOC) per project

**What does not go in:**

- Anything derivable from code or git history — file paths, recent changes, function names
- Screenshots and temporary media; those go to disk or to the design tool, only the link goes in
  the vault
- Chat drafts and message drafts; those are ephemeral

### `CLAUDE.md`

**What:** project context for the agent. The agent automatically reads every `CLAUDE.md` down the
directory tree of the current working directory at session start. This is the place for the facts
it must know **every time**.

**Where it lives:** `<repo-root>/CLAUDE.md`. You can have several — nested files act as extensions
of their parents (a general workspace file, plus one inside the design system repo).

**What goes in** (using my 44-line file as the example):

- Where things live in the workspace — production code, vault, working folders
- Design-file keys, as a copy-paste table
- Which guides to read before working in a particular domain
- Where the agent should look first for a specific kind of knowledge ("for any design-system task,
  read `design-system/CLAUDE.md`")

**What does not go in:**

- Long explanations of "what our product is" — that is for humans; for the agent it lives in
  `0-context/project-memory.md`
- Instructions like "be friendly" or "answer in Ukrainian" — personal preferences, those belong in
  memory
- Setup commands — that is a developer README, not agent context

> **Sanity check.** Open a fresh chat and ask "what do you know about this project?" If the answer
> is precise and short, `CLAUDE.md` works. If it floats, add specifics.

### `memory/`

**What:** persistent feedback, preferences and rules that must survive **across sessions within
one project store**. Not notes for a human — instructions to the agent about how to work and how
not to.

**Where it lives:** `~/.claude/projects/<project-id>/memory/`. At the root, `MEMORY.md` — the
index, not the content — with one file per topic alongside it. Each file carries frontmatter with
`name / description / type` (`user / feedback / project / reference`).

> **The store is per project path, and it does not travel.** A session started in the component
> library sees a different store from a session started at the workspace root — same machine, same
> person, different memory. So a preference you want everywhere has to be saved in each store that
> needs it; nothing synchronises them. The always-on layer that *is* global is `~/.claude/CLAUDE.md`
> (see [harness-audit.md](./harness-audit.md#rule-0--enumerate-the-whole-surface-first), which
> enumerates both). Assuming one store speaks for all of them is how a "rule I already saved" turns
> out to be missing in the next repo.

**What goes in:**

- **feedback** — the agent did something wrong, or confirmed a non-obvious decision. Example from
  my own memory: `feedback_glass_popup_pattern.md` — "a popup / modal / tooltip is TWO layers (an
  overlay scrim at 80% dim, plus an inner surface bound to the translucent-surface token with the
  shared blur effect style). NEVER a single translucent card."
- **user** — facts about me that help the agent calibrate: role, expertise level, mental model.
- **project** — meta-facts about the work in flight: deadlines, freeze windows, why approach X was
  chosen over Y.
- **reference** — pointers into external systems ("bugs live in the issue tracker project INGEST").

**What does not go in:**

- Code architecture, paths, patterns — derivable from the codebase
- The current task list — that is a todo, not memory
- Anything already in `CLAUDE.md`

> **`MEMORY.md` is an index, not content.** It is pulled into context every session, and anything
> past ~200 lines gets truncated. Keep it as a list of links: `- [Title](file.md) — one-line
> hook`. The content lives in the files next to it.

### Skills + MCP

**What:** repeatable workflows written down as standalone markdown files (skills), and
integrations with external services (MCP). The agent decides for itself when to pull a given skill
in.

**Where it lives:**

- Personal skills: `~/.claude/skills/<skill-name>/SKILL.md`
- Project skills: `<repo>/.claude/skills/<skill-name>/SKILL.md`
- MCP servers: your client config

**What goes in:**

- A workflow you have repeated three or more times and keep re-explaining from scratch
- Integration playbooks with their gotchas — the design-token reference the agent needs on every
  component, or [the overnight run protocol](./overnight-runs.md)

**What does not go in:**

- One-off instructions; faster to type into the chat
- Anything that changes weekly; it will go stale faster than you remember to update it

## §3 How it closes into a loop

A worked example, Hearth's host onboarding. On March 3 the founder published a prototype of a new
onboarding flow as the north star. Design review March 13, production April 2. Here is how the
four layers carried it from that trigger to the moment an overnight run could start.

> **"Overnight run"** = a long autonomous session that works while I sleep — building a large
> scope of screens against a locked spec. The protocol is [its own
> document](./overnight-runs.md); it comes up a few times below because it is part of the loop,
> but it is not the subject of this one.

### Step 1 — External trigger → audit

The founder published the prototype. The sync that followed (founder + marketing + engineering
lead + me) ran an hour. Everything that mattered went into a file immediately:

```
vault/1-projects/host-onboarding/
└── host-onboarding-prototype-audit-2026-03-03.md   (820 lines)
```

This is the **audit doc** — a full dump of the prototype, plus the meeting's decisions, plus the
reasoning. Not a spec yet. Raw material the spec grows out of.

### Step 2 — Audit → discussion → spec

I do not say "write me a spec from the audit." The pattern is already locked in
`feedback_prd_brainstorming_flow.md`:

> when writing a new spec, ask questions first → surface 2–3 alternatives per decision → validate
> section by section, never dump a full draft.

The agent reads that feedback and behaves accordingly: asks, then offers alternatives, then goes
section by section. I don't have to say it again.

Result:

```
vault/1-projects/host-onboarding/
├── host-onboarding.md                              (103 lines — MOC)
├── host-onboarding-prd.md                          (734 lines — spec v0)
└── host-onboarding-prototype-audit-2026-03-03.md   (820 lines)
```

The spec has a strict schema — frontmatter, then sections 1–12: Overview / Goals / Scope / Flows /
Functional requirements / Edge cases / Decisions / Open questions / Dependencies / Timeline /
Related / Update log.

### Step 3 — The spec locks, which unblocks the overnight

Spec frontmatter:

```yaml
---
title: "Host onboarding"
type: prd
status: draft     # ← while this says draft, no overnight run starts
version: v0
deadline: 2026-03-13
---
```

Once `status` flips to `signed` after review, the decisions are locked. That is where
`feedback_prd_scope_contract.md` kicks in:

> Specs at `vault/1-projects/<area>/<area>-prd.md` lock their decisions when `status: signed`.
> Skip the overnight run if `status: draft`.

The agent checks `status` at the start of every overnight run. Draft → stop, ask for review.
Signed → work strictly inside the scope.

### Step 4 — The MOC updates and becomes the entry point

`host-onboarding.md` (the MOC, 103 lines) is what you and the agent open **first** whenever the
topic comes up:

- Frontmatter with `deadline`, `priority`, design-file links
- A lead paragraph: the goal and the timeline
- A `Documents in this folder` table — where to dig for detail
- External anchors — user-flow file, baseline, prototype
- v1 scope, locked: what we build / what we refresh / what we don't touch
- Architectural decisions (cross-referenced into the spec)
- Open questions and pending work, as a checklist
- A timeline table
- Related — cross-links to parallel work and to `0-context/`

The MOC is **navigation, not content**. Content lives in the spec and the audit. The MOC tells you
where to go.

### Step 5 — Skills and `CLAUDE.md` activate at execution time

When the build starts:

| What's needed | Where the agent gets it |
|---|---|
| The design file key for the UI kit | the `CLAUDE.md` table |
| Token reference (what is that mint border actually called?) | the design-system token skill |
| How to build a component in the design tool without errors | the design-system build skill |
| Plugin-API gotchas (a plugin call does not relay its return value) | [figma-plugin-api.md](./figma-plugin-api.md) |
| How to run an overnight task with contract phases | [overnight-runs.md](./overnight-runs.md) |
| Whether the design-tool access token is still valid | `memory/reference_figma_credentials.md` |

Every one of those addresses is known to the agent without explanation. I do not paste "here's our
palette", "here are the file keys", "watch out for emoji glyphs in draft files" into the chat. It
knows.

### Step 6 — Memory updates when new knowledge appears

Mid-build we found that the glass popup the agent drew did not look like the one in the design
system. We dug in: in the system it is **two layers** (an overlay scrim at 80% dim, plus a surface
with the translucent fill and the shared blur effect style), and the agent had drawn a single
translucent card.

Instead of fixing only this instance, I asked it to save the rule →
`memory/feedback_glass_popup_pattern.md`. One line in `MEMORY.md`:

```
- [Glass popup pattern](feedback_glass_popup_pattern.md) — popup/modal/tooltip = TWO layers (outer overlay 80% dim + inner surface with the translucent fill and bound blur effect style), NEVER a single glass card.
```

Next session, next component: the agent applies it without a reminder. Memory is *hurt once, stays
forever*.

### Step 7 — Report after execution

The overnight run finished. Pattern from `feedback_md_reports_pattern.md`:

> feature-report requests → `vault/1-projects/<area>/<area>-YYYY-MM-DD-report.md`, co-located with
> the spec and the plan; snapshot form, English, no recipient names in the filename.

The file lands next to the spec. It is a snapshot of a state on a date — what was done, what is
open, which gotchas surfaced. Not for people in a chat window. For you, in three months.

### The full loop

```
[External event / trigger]
            │
            ▼
[Audit / discussion in the vault]
            │
            ▼
[Spec draft] ──── feedback_prd_brainstorming_flow.md
            │
            ▼
[Spec signed] ─── feedback_prd_scope_contract.md
            │           ▲
            ▼           │
[MOC updates]           │
            │           │
            ▼           │
[Build / overnight] ←── skills + CLAUDE.md + design-tool MCP
            │           │
            ▼           │
[New knowledge → memory] ┘  (the next session knows it automatically)
            │
            ▼
[Report YYYY-MM-DD] ──── feedback_md_reports_pattern.md
            │
            ▼
[MOC updates with the result; loop ready for the next iteration]
```

None of the layers is unique on its own. The loop is. The agent always starts from the whole
picture, and I never explain the same thing twice.

## §4 Where to start

You do not have to build all of it at once. This is the minimum that already changes how the work
feels:

1. **A vault with a PARA structure.** Obsidian plus a private git repo. Four folders:
   `0-context / 1-projects / 2-areas / 3-resources`. Filenames in kebab-case. Every file gets
   frontmatter with `title / type / updated`.

2. **`0-context/project-memory.md`** — one file with everything a human needs to know about the
   project: the team and who does what, brand direction, current priorities, stack and tools, key
   IDs. This is **the file you read to get back into context**.

3. **`CLAUDE.md` at the root of the working folder.** Five to fifteen lines. Where to go for what,
   which guides to read before which kind of task, which file keys to use. Test it: fresh chat,
   "what do you know about this project?" — if the answer is reasonable, it works.

4. **`memory/` — start with zero files.** Do not invent rules up front. The moment the agent does
   something wrong and you correct it, ask it to save the correction. After a month you will have
   five to ten files, and they will be your *real* working rules.

5. **One skill, for one repeated workflow.** Which task do you do three or more times a month and
   re-explain from scratch every time? For me the first two were the design-token reference and
   the component-build pipeline — the two things the agent needs on every single component. Write
   yours as `~/.claude/skills/<workflow>/SKILL.md`. Next time you say "do X", and it knows the
   whole pipeline.

> **Don't start from someone else's template vault.** It is tempting to clone a structure and
> start "from there." Don't. The structure only works once you have **personally** filled it with
> your own working reality. Take the pattern, fill it yourself.

## §5 Typical pitfalls

### 1. Duplicating context between memory and `CLAUDE.md`

Both layers are scoped to the project, so the split is not "project versus everywhere" — it is
what each layer is *for*. `CLAUDE.md` holds the durable facts of the repo: where the design system
lives, which file keys, which guides to read first. It sits in the tree, and anyone who opens the
repo gets it. Memory holds what accumulated from being corrected: your preferences, the patterns
you never want to see again, the reasoning behind a decision. It sits in that project's store, and
only sessions of that project see it. Mix them and you get drift, plus a fight over which one is
the source of truth.

### 2. Writing `CLAUDE.md` like a README

It is not for humans. Don't write "This is the product workspace, where the design team works
on…". Write "for any design-system task, read `design-system/CLAUDE.md`." Operational, compact,
no spare words.

### 3. Keeping things in memory that are derivable from the code

"File X lives at Y" is not memory — the agent will grep. "Function Z does W" is not memory — the
agent will read it. Memory is for what is *not* in the code, git, or files: your preferences, the
why behind decisions, the pitfalls that cost you real money.

### 4. A bloated `MEMORY.md`

It is the **index**, not the content. Past ~200 lines it gets truncated when pulled into context.
Keep one-line links. The content lives in the files alongside.

### 5. The vault as an archive

PARA is not a mausoleum. `4-archive/` is for closed projects, not for "just in case". If a file
hasn't been needed in a year, delete it — git history keeps it. A bloated vault is a useless
vault; you and the agent both get lost in it.

### 6. Specs without `status:` discipline

`status: draft` has to actually block overnight runs. `status: signed` has to actually lock
decisions. If you have patched a "locked" spec three times in one week, either the spec was never
locked or the alignment process upstream of it is broken.

### 7. Screenshots and big dumps pasted into chat

The agent sees the entire conversation as its context window. A 200KB screenshot is roughly 50K
tokens. A large PDF or JSON dump is more. Everything goes to disk, to the design tool, or to code,
and only the path goes into the chat. Otherwise the window burns for nothing and the agent starts
"forgetting" what was said at the beginning.

### 8. Not reading the guide before entering a new domain

The plugin-API guide exists precisely so nobody steps on the same rake twice. Before you enter a
new domain — a new plugin API, a new service integration, a new scheduling system — check whether
a guide exists. If it does, read its TL;DR. If it doesn't, start one from the first pitfall you
hit. In three months you have a library of years you did not waste twice.

## §6 Terminology renames

When product terminology shifts (`browse` → `discover`, `Host` → `Charter Host`), the vault needs
a consistent sweep across every doc that references the old term. This is recurring work — write
the procedure down once so future renames don't burn cycles or create silent drift.

### When to run a rename sweep

- A team decision changes the canonical name for a concept
- A product surface gets renamed and the internal docs have to follow
- A new internal-vs-product distinction appears (spec says `Charter Host`, the product UI still
  says `Host`)

### Phase 1 — Audit

`grep -rni "<old term>" vault --include="*.md"` across the whole vault. Then categorize each hit
by **context**, not by literal match:

| Hit category | Example, for a `Host` → `Charter Host` rename | Action |
|---|---|---|
| Target meaning | "Host badge", meaning the loyalty tier | RENAME |
| Different meaning | "host a dinner" — the verb | KEEP |
| Different meaning | "Superhost" — a competitor's term | KEEP |
| Verbatim quote | a stakeholder quote using the old word | KEEP — quotes stay verbatim |
| Asset name | `host_badge_fill` — an actual layer name | KEEP — renamed in that system separately |
| Historical record | "2026-02-22 — Host tier reframed as Charter Host" | KEEP — it is a timeline entry |

The audit step is **manual judgment**, not pattern matching. Wrong context = wrong rename =
confusion downstream.

### Phase 2 — Surgical edits vs `replace_all`

- Use `replace_all` ONLY for **unambiguous full-phrase patterns** that always carry the target
  meaning — `"host badge" → "Charter Host badge"`.
- Use single-occurrence edits wherever context decides whether the hit renames.
- Never `replace_all` a short or common substring. It will match places you did not mean.

### Phase 3 — The cascading-substring trap

The single biggest pitfall. When you `replace_all "X" → "Y X"`, any line that *already* contains
`"Y X"` — because you wrote it by hand earlier — matches on the substring `"X"` and becomes
`"Y Y X"`.

What happened here:

- I had already hand-written `"Charter Host badge"` in a few spec sections.
- Then I ran `replace_all "Host badge" → "Charter Host badge"` to catch the rest.
- The substring match found `"Host badge"` *inside* the existing `"Charter Host badge"` and
  double-prefixed it into `"Charter Charter Host badge"`.

**Mitigation:**

1. Plan the rename order. Run `replace_all` BEFORE any hand-written prefixes exist, or clean the
   hand-written ones back to plain first.
2. After any `replace_all` that adds a prefix to an existing word, run the cleanup pass:
   `grep "Y Y " → replace_all "Y Y " → "Y "`.
3. Greppable invariant: after the rename, `grep -r "<doubled prefix>"` MUST be empty.

### Phase 4 — Cross-reference updates

If sections renumber as part of the rename (adding §4.1 pushes everything down), grep the whole
file for `§<old number>` references and update them. A long spec has a lot of cross-refs.

### Phase 5 — Update-log entry

Every rename pass adds one line to the spec's update log: what was renamed, why, which files were
touched. Future sessions can then reconstruct the decision history.

### Phase 6 — A memory link, if the rename was methodologically interesting

If the sweep revealed a convention worth keeping ("internal docs say `Charter Host`, the product
UI keeps `Host`"), add a one-line link in `MEMORY.md` so nobody re-litigates it later.

### Files not to touch in a rename

- **Historical audit docs.** They describe a state at a point in time, including the old term as
  it appeared then.
- **Verbatim quotes.** Keep the speaker's wording.
- **Asset names** — layer names, CSS variable names, filenames referenced by other systems. Those
  rename inside their own system, on their own schedule.
- **Vault-internal taxonomy** — tags in frontmatter, unrelated to product terminology.

When a file falls into "do not touch" and you skip it, say so explicitly in the update-log entry:
*"NOT touched: <list> — historical / verbatim / unrelated meaning."*

## Related

- [overnight-runs.md](./overnight-runs.md) — the autonomous long-session protocol this loop feeds
- [prd-to-flows.md](./prd-to-flows.md) — what happens after a spec locks
- [figma-plugin-api.md](./figma-plugin-api.md) — the domain guide whose structure this one is
  modelled on
