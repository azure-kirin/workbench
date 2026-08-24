# Overnight runs

*The protocol for leaving a coding agent working on design while you sleep: what it must do before
it earns the right to write, what it may never do, and how it hands the work back in the morning.*

**When to load this:** any task that combines significant scope (research plus multiple drafts)
with the operator being offline for the next several hours. Trigger phrases look like "make me
drafts for X overnight", "explore X while I sleep", "take this for the night". If the task is
one-off and short — under thirty minutes — this protocol is overkill; handle it inline.

Throughout, **the operator** is the human who left the task, and **you** is the agent running it.

> Worked examples use **Hearth**, an invented product — a supper-club app where home cooks host
> dinners and guests book seats. The failures behind the gotchas are real; the product is not.

## Pre-flight gate

Do not skip this. It catches roughly 80% of the failure modes on its own.

Before ANY write call into the design tool, every one of these must be true:

1. **Stream A done** — vault read (project memory, the active project folder including its
   decisions log, recent design-chat syncs) AND a search of team chat for the last 30 days in the
   product-design channel and the founder's threads. Output: notes you can quote, not "I read it."
2. **Stream B done** — competitive research per the north-star table below. Patterns extracted,
   not pixels copied. Output: three or more patterns to keep and three or more to explicitly not
   copy, each with a reason.
3. **Stream C done** — UI-kit inventory. You have a list of REAL component keys for every
   component you plan to use. If you do not have a key, you have not done Stream C.
4. **Decisions document written** — either a visual frame in the draft file (sub-section 00) or a
   markdown block in the conversation. It lists keep / adapt / add / reject decisions, each with a
   one-sentence rationale.
   - **Q0 step, mandatory, before you list any decision:** scan the verbatim stakeholder scope for
     grammatical ambiguity — `or`, `/`, `and`, parentheses, elastic verbs ("post on X", "share
     with Y", "connect to Z"). Every fork with two or more valid parses is a **Q0 — interpretation
     ambiguity**, and it gets logged BEFORE any structural decision, with your default and the
     alternatives. Stream A finds *what was said*; Q0 finds *what was meant*. Skipping Q0 means
     buried assumptions surface at morning review. See [G14](#g14--q0-surface-interpretation-ambiguity-before-listing-decisions).
5. **Reuse-first verified** — for every component you plan to draw, you have checked whether the
   design system already has it. If it does, you will import it by key, not `createFrame()` your
   own.

**If any item is false, you have not earned the right to write yet.** Go back. The cost of wrong
drafts — which the operator then has to redirect — is far higher than thirty more minutes of
recon.

This gate exists because every overnight failure traced back to skipping one or more of these.
Even when the rule was already written down. Even when the model "knew" it. Document discipline
beats good intentions.

## Hard stop

**07:00 local. No exceptions.** If the work is unfinished, save the partial state, document where
you stopped and why, and prepare the morning handoff. Do not race to "finish" at reduced quality.

## Continuation

One transaction is one session. After the hard stop the operator reviews. If she says "continue
where you stopped", that is a *new* session: re-load this protocol, re-read the morning handoff to
recover state.

## Pre-night protocol

Run this in order.

### Step 1 — Verify the scope through the vault

The operator's active areas are listed in `0-context/project-memory.md`, in priority order. For
the Hearth example that list reads:

1. Guest profile views — shipping
2. **Host onboarding** (including the ID check and the Charter Host badge)
3. **Reviews & saves**
4. **Table requests & messages** (a request is not a follow — see the area template)
5. **Kitchen page** (the public host page) glow-up
6. Venue associations
7. Guest profile views, iteration 2 backlog

**Verify the list is current** by reading project memory yourself. Decisions move fast; what was
true a week ago may not be now.

If the task name you were given does not match an active area, escalate immediately into the
morning handoff as a question. Do not guess which area was meant.

### Step 2 — Read the context

**2a — "What changed since I last touched this area?"** Before reading anything in depth, get the
vault paths in modification order (`ls -lt` or equivalent). Anything in the relevant area that
moved in the last 24–72 hours is PRIORITY context. Surface it at the top of the decisions doc as
"Recent updates considered: <list>". This closes the gap where a run proceeds on stale
assumptions.

**2b — Read in priority order:**

1. **`1-projects/<area>/<area>-prd.md`**, if it exists. Status check:
   - `status: signed` → decisions are LOCKED and not open for re-debate. You may only argue the
     open questions, never the decided ones. The build order is a binding contract, per
     [G13](#g13--the-build-order-is-a-contract-not-a-wishlist).
   - `status: draft` → STOP. The spec is not finalized; the run cannot proceed on this area. Log
     it: "spec `status: draft`, awaiting answers — overnight skipped this area."
   - `status: signed` but `last_updated` much older than recent chat activity on the area → flag
     as a recent-updates concern (2a) and confirm the scope still holds before proceeding.
   - No spec at all → fall back to chat archaeology in Stream A, and log "no spec — recommend
     writing one before the next overnight" in the handoff.

   Note: spec status uses `draft / signed` to keep it distinct from *task* status (`in-progress /
   ready / done`). Older specs may still carry the task vocabulary; treat it as equivalent.
2. **`0-context/project-memory.md`** — current state, team, decisions, priority order
3. **The tracker task** for the area, if one exists — the title itself often carries a signal
   ("mobile-first")
4. **The rest of `1-projects/<area>/`** — deliverables, decisions log, chat syncs, prior reports,
   screenshots; all co-located with the spec
5. **Recent meeting notes** mentioning the area, last 30 days

If these contradict each other: the spec wins on decisions, otherwise the most recent timestamp
wins. If the conflict is significant, it becomes a handoff question.

**2c — Inventory prior drafts** (per [G15](#g15--prior-drafts-of-this-area-are-artifacts-not-templates)). List the section names and ids of
any previous work on this area in the draft file. Note them in the handoff as "Prior drafts
inventory". They are artifacts, not templates — do not pixel-inspect them as a starting point.
Build new sections at offset coordinates so they cannot visually collide with the old ones.

### Step 3 — Plan the time

Total time = now → hard stop, minus 30 minutes of handoff buffer. Roughly:

- Research 25%
- Draft generation 50%
- Self-review and iteration 15%
- Handoff prep 10%

Adjust for complexity. An eight-screen onboarding flow needs more drafting time than a set of
messaging primitives.

### Step 4 — Confirm the work zones

Before any write:

- **Draft design file** — the dedicated overnight file. Every draft and every new component lives
  there.
- **Handoff destination** — the notes tool, under the design parent page.
- **Production files** — read-only. One accidental write and the trust is gone.

Verify the draft file is reachable and current. If it errors or the auth is stale, stop and put it
in the handoff.

## Reversibility rules

Hard nos. No matter how confident you are, no matter how good the rationale.

| Action | Why never |
|---|---|
| Publish the UI kit | Even draft components in a published library break every downstream file |
| Edit production design frames | The operator reviews her own work, not yours layered on top of hers |
| Delete or rename production layers | Even when the cleanup is right, it is not your call |
| Send team chat messages | Drafts only, never send |
| Reply to a teammate's message | Even an @mention aimed at the operator — let her see it and answer |
| Create or assign tracker tasks to teammates | All of it goes into the handoff; she decides what becomes a task |
| Push to git or trigger CI | Code stays local |
| Auto-respond to anything | Even acknowledgements wait |
| Decide a contested question | Open questions go to the handoff, never get default-resolved |
| Write into production vault files | Drafts only; vault edits are decisions, and decisions wait |

If a task appears to *require* one of these to be "complete", that is the signal to stop and
write the blocker into the handoff.

## Research phase

Three streams, all three before any drafting.

### Stream A — Vault and team chat

What does the operator already know about this? What has been discussed?

- Search the vault for the area name
- Read every decisions log that touches it
- Search team chat for the area name over the last 30 days
- Read the founder's recent messages on the topic — primary stakeholder, the framing matters most

Output: a **research summary**, the first section of the morning handoff. Quote source decisions
verbatim, with dates.

### Stream B — Competitive analysis

North stars per area. For Hearth:

| Area | Primary | Secondary | Tertiary (atypical, still useful) |
|---|---|---|---|
| Host onboarding | Airbnb (host setup) | Resy (dining context) | Substack (creator setup) |
| Reviews & saves | Google Maps (review mechanics) | Airbnb (two-sided reviews) | Goodreads (long-form rating) |
| Table requests & messages | Airbnb (request → accept) | WhatsApp (thread mechanics) | Discord (community-DM hybrid) |
| Kitchen page (public) | Airbnb listing page | Resy restaurant page | Substack about page |
| Charter Host badge | Discord (server roles) | Airbnb (Superhost) | Reddit (status badges) |

Do not blind-copy. Take **patterns** ("the listing page keeps a sticky booking card from 1024px
up"), and note where your product's context demands divergence (in Hearth a table *request* is not
a *follow* — a host has to accept, which Airbnb's instant-book pattern would erase).

For copy: verbatim-from-the-north-star only where the surface genuinely mirrors it (the marketing
lead's rule since 2026-02-27: if it looks like an Airbnb booking flow, use Airbnb's words). Every
other surface gets product-voice copy grounded in the team's own language, the existing production
screens, and the brand line. Never `Lorem ipsum` — always realistic domain data.

### Stream C — Design-system inventory

Before drafting, map what already exists in the UI kit. The design system's own build guide
applies in full. Do not reinvent what exists:

- Open the UI kit
- List the items, components and organisms relevant to the area
- Note the empty placeholder pages — planned but unbuilt components are candidates if your draft
  needs them
- Find a reference component at the same level as anything you would build new

Output: an **inventory table** in the handoff — components I reused, components I created in the
draft file (needing promotion), components missing plus a recommendation.

## Where the work goes

### Design tool — one file

The dedicated overnight draft file. Inside it:

- **A page per area**, named `[Draft] <Area Name>`
- **Sections** for variations within the area
- **A `Components` page** for anything new built overnight — needs review before promotion to the
  kit
- **A `References` page** for competitive captures

Naming inside drafts follows the same conventions as production: functional names (`Title`,
`Section Header`, `List`). "Draft" is not an excuse for sloppy naming.

If a page already exists from a previous run, append below — never overwrite.

### Notes tool — one handoff page per session

`Overnight handoff — <Area Name> — <YYYY-MM-DD>`. This page is the morning artifact. Everything
needed to review what happened lives there.

### Vault — read-only overnight

Read everything you need. Write nothing. Vault edits are decisions, and decisions wait for someone
awake to make them.

This is a rule about the *unattended* run, not about the vault. A supervised session writes into it
freely — that is where the report at the end of the working loop goes
([the context system](./context-system.md#the-full-loop)). The night run's own output has a
destination of its own: the handoff page above.

## Drafts use the existing design system

Same rules as any production build:

- Variable bindings, not inline RGB
- Text styles, not inline font size and family
- Existing components reused as instances
- The system's hierarchy respected
- If a needed component does not exist:
  - Build it on the `Components` page of the draft file, never in the kit
  - Document it: "needs new component X — built a draft, recommend promotion"
  - Build it with full hygiene, as if it were going into the kit (same naming, tokens,
    descriptions)
  - The operator decides in the morning whether it gets promoted

### When a small variant would solve it

Build the variant in the draft file as a separate component. Do not extend a production component
overnight — that is a system-level decision, and it is hers. Document: "Production X has variants
A/B/C. I needed D. Built `[Draft] X-with-D-variant` for review."

### When the design system itself has a gap

You want a token that does not exist — a spacing step, a color. Do not add it to the foundations.
Use the closest existing token and document the gap: "system gap — recommend adding token X for
use case Y."

## Area templates

Quick-start patterns per area. Starting points, not constraints — adapt to what the research
actually finds. Two Hearth examples, to show the shape:

### Host onboarding

**Surfaces likely needed:**

- Welcome screen (first run)
- Account type selection (guest / host / venue)
- Verification step (ID check, per the Charter Host spec)
- Profile completion, minimum vs full
- Optional in-product tutorial moments
- Empty states for a brand-new account

**North-star sequence:** Airbnb sign-up → Resy-style taste selection → Substack-style creator
profile completion.

**Questions research has to answer:**

- Vertical (one input per screen) or horizontal (multi-input per screen)?
- Where does Charter Host eligibility get checked?
- Is the ID check automatic or manually reviewed?
- Mobile-first or desktop-first?

### Reviews & saves

**Surfaces likely needed:**

- Review composer, and the states around a dinner that has not happened yet
- Review display: on the kitchen page, on the dinner, in the guest's profile
- Save / unsave affordance and the saved-dinners collection
- Engagement notifications (overlaps with the profile-views notification pattern)

**North star:** Google Maps for review mechanics, Airbnb for the two-sided timing rule, Goodreads
for anything long-form.

**Questions:**

- Are reviews two-sided (host reviews guest as well), and are they blind until both land?
- Can you review without having attended? What proves attendance?
- Is a save private, or visible to the host as demand signal?

## Escalation gates

When you hit any of these: stop the current sub-task, log it, move to the next one. Do not push
past a blocker.

| Blocker | Action |
|---|---|
| **A decision only the operator or a stakeholder can make** | Log as an open question, default to the safest reading, mark the draft "tentative pending decision" |
| **Production state contradicts the research** | Stop, log, do not proceed in this sub-task |
| **A change with system-hygiene impact** | Stop, escalate, do not attempt |
| **Scope ambiguity** (multiple valid readings) | Take the most conservative reading, log every option |
| **Unexpected vault state** (file missing, wildly different from expected) | Stop entirely, prepare a handoff explaining what you found |
| **A design-system gap** (no pattern for what you need) | Build it in the draft file with full hygiene, recommend promotion |
| **Tool failure** | Retry once with diagnostics; still failing, log and skip |

The heuristic: **if a human designer would message the operator before doing this, you escalate
instead.**

## Self-review checklist

Before anything is "done":

**Token and system hygiene**

- Colors bound to variables, no inline RGB
- Text uses text styles, no inline font size or family
- Effects use effect styles wherever one exists
- Padding values come from the spacing scale

**Naming**

- Containers have functional names (`Title`, `Section Header`, `List`) — never `Frame 1597879795`,
  never `Today`
- Component sets follow the system's naming
- Variant axes in the system's order

**Reversibility**

- No production edits, no publish, no messages sent, no tasks assigned
- Everything lives in the draft file or under the draft handoff page

**Readability for the operator**

- Every decision has its rationale written down
- Open questions are clearly marked
- Every draft has a one-line caption saying what it explores
- The recommended next step is explicit — she should not have to guess what to do with this

**Realism**

- Mock copy is domain-appropriate
- No `Lorem ipsum`
- Verbatim north-star copy only where the surface mirrors it
- Names, avatars and roles look like real users of this product

**File state**

- Draft pages are clean and labelled
- The handoff page is published, not left in draft
- Links work in both directions

If an item fails, fix it or document the gap. Never quietly skip a check.

## Morning handoff format

Every section is mandatory unless explicitly N/A.

### TL;DR

Three to five sentences. What the task was, what got done, what needs attention first. Readable in
thirty seconds.

### Time spent

Research X, drafting Y, self-review Z, total.

### Research summary

Findings from Stream A and Stream B. Quote sources verbatim. Group by topic.

### Drafts produced

| Draft | Link | Status | Description |
|---|---|---|---|
| Welcome screen v1 | … | Tentative pending founder decision | Single-step, minimal |
| Welcome screen v2 | … | Ready for review | Multi-step with progress |

Each draft carries a link, a status (Ready for review / Tentative pending X / Stub / Blocked), one
or two sentences of description, and what is next on it.

### Components built in the draft file

| Component | Link | Recommendation |
|---|---|---|
| Account type selector | … | Promote to the kit (item level — composes avatar + text + radio) |
| Welcome hero | … | Do not promote — too specific to onboarding |

### Decisions made, with rationale

Every non-trivial choice you made without input:

> **Decision:** vertical step flow rather than horizontal multi-input.
> **Rationale:** matches the primary north star, and the secondary one too. Vertical lowers
> cognitive load for first-time users. The founder's framing emphasised completion rate over
> speed.
> **Alternatives considered:** multi-input form — faster, higher abandonment per the research.
> **Confidence:** medium-high. Reversible if she disagrees.

This section is where she scans for things to push back on.

### Open questions

Numbered. Each one phrased as a question, not as unease — "should X be Y or Z?", not "I'm not sure
about X". With options, with your recommendation, and with a priority marker
(must-resolve-before-continuing vs nice-to-resolve).

### Blockers hit

> **Blocker:** table requests — could not determine whether accept is one-step or two-step.
> **Found in:** the 2026-02-14 call notes say "request → accept"; the founder's 2026-02-22 message
> says "make it one tap".
> **Action taken:** drafted both, marked "needs alignment".

### Recommended next steps

Top three to five things, in order.

### Self-review issues

What you noticed and could not fix. The honesty section.

> Welcome screen v2 has a padding inconsistency on mobile (16 vs 20 in a couple of sections).
> Needs aligning.

### What I did NOT do

Explicit list of deferred scope, with reasons:

- Did not draft mobile versions of the kitchen page — the desktop draft is still pending a
  decision, and mobile would compound the risk
- Did not touch request notifications — depends on the messaging draft being approved first

## Common pitfalls

### Detaching instances from the design system

When in doubt, don't. If you must detach to debug, undo immediately. Detaching loses the link
forever.

### Mass font or color replace

Even in a draft file, never do a "fix all the fonts" sweep. Fix one node at a time. Mass replace
scatters instance overrides that compound forever.

### Scope creep

You started on onboarding, found a related problem on the profile page, and "fixed" the profile
page. No. Onboarding only. If the profile problem is critical, log it as a separate item in the
handoff.

### Claiming "done" before verification

After every write, run a separate read call to confirm the change took. Do not trust "code
executed with no return value" on its own.

### Sloppy mock data — three layers, not just copy

Mock data is more than copy. Three layers, each of which becomes a "this looks like a wireframe"
tell if you skip it:

1. **Copy.** "Home cook in London" appearing fifty times because you copy-pasted. Vary it: Noor
   Haddad (Home cook · Lisbon), Tomás Alvarez (Baker · Mexico City), Priya Raman (Supper club ·
   Leeds), Ben Osei (Pop-up chef · Accra), Ingrid Falk (Host · Malmö). Ground it in the real
   archetypes of the product's users.
2. **Avatars.** The avatar component's default variant resolves to ONE image. Five instances at
   the default gives you five copies of the same face — that reads as wireframe, not as a feed.
   Cycle variants per archetype: pick by index from the component set's children filtered to your
   scale, or walk the image-type variants explicitly. On one run this was the single biggest
   "this is a draft" tell.
3. **Visual props.** Dish photography, post media, file thumbnails, cover images. A flat colored
   square is fine for a proof of concept and reads as a wireframe in a handoff. Use the real
   primitives — the dish thumbnail component for dishes, the venue avatar for venues, real
   placeholder imagery for media. If the system lacks the right primitive, log a system gap.

In self-review, look at every populated frame and ask *"is this surface visually monotonous?"* If
yes, fix it before declaring done.

### Skipping research because "I know this area"

Always run A, B and C. Even on a topic you researched last week — the team may have moved a
decision since. Re-verifying is cheap. The wrong direction is expensive.

## Hard-won gotchas

Every entry below is a real mistake from a real run, and how not to repeat it.

### G1 — A stakeholder's prototype is not your design system

The founder's prototypes are concept exploration in his own marketing-editorial register:
high-contrast serif headlines, white pill CTAs, flat black backgrounds. **None of that is the
product's design language** — which is a warm paper canvas, one sans family, soft-elevation cards
and a single ink-green CTA.

When the prototype shows you X visually, ask: *does the design system already have a different
answer?* If it does, **the system wins** and the prototype loses. Document the divergence in the
decisions doc with a one-sentence reason. Concept patterns from the prototype: keep. Visual
treatments: adapt to the system.

The anti-example: a run that copied the founder's prototype pixel by pixel — editorial serif
headlines, white CTA, none of the system's surfaces. The operator's reaction: *"this doesn't look
like our design. Why did I set up the vault at all?"* That is the ground truth. Pixel reproduction
without system adaptation is a failure of the whole protocol.

### G2 — Writes to a non-current page silently fail

**The bug:** the plugin bridge commits writes only to whatever page was `figma.currentPage` when
the plugin connected. `setCurrentPageAsync(otherPage)` changes in-transaction state, but writes to
that other page do NOT persist between transactions. They look successful (`Code executed with no
return value`) and they are gone on the next read.

Reproduced by writing to a freshly created draft page, to a second existing page, and to the
originally-active page — only the originally-active one persisted across transactions.

**Workaround:** build everything on the page that was current at connect time (usually `Cover`),
wrapped in a clearly named outer section:

```
⚠️ [DRAFT] <area> work — DRAG TO <target> PAGE in the morning
```

Dragging the section to its page is a five-second action for the operator.

**Detection:** write to a non-current page, then read *in the same transaction* — the writes are
there. Read again in a NEW transaction — they are gone. That is the bug.

Full details and the property-by-property breakdown: [figma-plugin-api.md](./figma-plugin-api.md).

### G3 — Atmospheric backgrounds are components, not inline blurred ellipses

One run created 720×720 ellipses with a 200px layer blur and called it atmosphere. The operator's
verdict: *"that's slapdash."*

**Rule:** atmospheric and glass backgrounds are always design-system territory. Use the page
background component, or build the equivalent on the `Components` page with full hygiene. Never
`createEllipse()` plus a layer blur to fake "atmosphere".

### G4 — Inspect a component's variants before you use it

One run imported the page-background component and picked the `Covers` variant, reasoning "22
inner shapes means rich content, good." `Covers` turned out to be a pre-populated marketing
collage — product imagery leaking through an onboarding hero card.

**Rule:** before using any page-level or unfamiliar component, walk its inner children through the
plugin API and see what is actually inside. Do not trust names. Sometimes the right answer is a
different variant. Sometimes it is "remove the background entirely — the canvas and the glass card
already do the work."

### G5 — Background instances need absolute positioning

If your frame uses vertical autolayout and you `appendChild` a background instance, autolayout
absorbs it as a flow child and the frame height explodes (one real case: 1024 → 3725).
Backgrounds must not participate in the flow:

```js
const bg = variant.createInstance();
frame.appendChild(bg);
bg.layoutPositioning = "ABSOLUTE";  // ← critical, otherwise autolayout eats it
bg.x = 0; bg.y = 0;
bg.resize(frame.width, frame.height);
```

### G6 — Bound-variable opacity does not multiply the way you expect

`setBoundVariableForPaint(paint, "color", variable)` where the variable's intrinsic alpha is 24%,
plus `paint.opacity = 0.12`, should give roughly 3% effective opacity. In practice the result
landed much closer to 24% — the variable's alpha dominated. For fine-grained glass tints, **inline
RGBA is more predictable**:

```js
// ❌ unpredictable — the variable's alpha may dominate
fr.fills = [vp(transBrand24, brandFallback, 0.12)];

// ✅ predictable for tonal glass — inline RGBA
fr.fills = [{ type: "SOLID", color: { r: 0.98, g: 0.86, b: 0.72 }, opacity: 0.06 }];
```

The trade-off is a lost system link. For atmospheric and glass tones — very subtle, tuned by eye —
accept it and document it. For solid surfaces, keep the variable bindings.

### G7 — Reuse-first means real instances, not "a shape that looks similar"

One run called the design-system search for a search bar, an avatar and a pill item, found all
three keys, and then proceeded to `createFrame()` and draw similar shapes from primitives. That is
not reuse. That is a parallel rebuild.

**Rule:** if the search returns a real component key, you have exactly one acceptable next step —
import it by key and place an instance. If the variant does not fit, either use a different
variant, override its properties, or build a NEW component on the `Components` page as a last
resort, with full hygiene.

A key is necessary, not sufficient: components that live inside a feature file also have keys, and
importing one of those from another file fails with `Component with key X not found`. Check that
the search result carries a real library name before you plan around it — see
[figma-plugin-api.md](./figma-plugin-api.md#8-local-only-named-components-are-not-published-library-assets).
That failure is a Stream C finding, not a licence to hand-draw the shape.

The temptation is "I'll quick-build a custom version, faster than figuring out the variants." It
always costs more later: it gets spotted, you redo it, and the link is gone.

### G8 — Visual self-review means a screenshot per chunk, and it is mandatory

`Code executed with no return value` tells you *nothing* about visual quality. One run went four
cycles before its first visual check and then discovered slapdash backgrounds, broken icons, text
overflow and broken autolayout — every one of which a five-second screenshot would have caught.

**Rule:** after every meaningful frame or sub-section, screenshot it. Look at it honestly. If it
looks like a 2018 dribbble mockup, you will be told so; better to catch it yourself.

### G9 — Blunt feedback is signal, not failure

When the operator says "this is slapdash" or "I don't like it", that is not a process failure,
that is the highest-value information available. Don't spiral into apology. Fix it. The fact that
she is spending time on it means she thinks the work can be saved.

Share screenshots proactively mid-flow. Even while she is asleep, a "current state" message plus a
screenshot lands in the history — she reads it on waking and catches problems before the handoff.

### G10 — Scheduled wake-ups are the autonomous-pacing mechanism

The protocol says one transaction is one session. For a genuinely autonomous night, the working
pattern is a self-scheduling loop: at the end of every cycle, schedule the next wake-up about
25 minutes out with the full original prompt, verbatim. Each wake-up is a new turn in the same
conversation, so the context survives.

Caveat: the foreground session has to stay alive. Prevent the machine from sleeping (`caffeinate
-di` on macOS, lid open or the display-sleep setting adjusted).

### G11 — Update the handoff incrementally, not all at the end

One run had five hours of work between the first handoff write and the final state, and the page
described v1 while v2 was already built. Append a short progress note per cycle in a cycle-log
table. If the operator wakes mid-run, the handoff should reflect current truth, not a stale
snapshot.

Watch out for markdown tables being re-saved as HTML tables by the notes tool — subsequent
search-and-replace on the markdown then fails. If you cannot find your own text, fetch the page
first and look at the stored format.

### G12 — Emoji glyphs in a design file are a wireframe tell

`📷 🎵 😊 ⋯ ▶ ←` are convenient in chat and in copy mocks. In a design surface they:

- Render differently per OS — the reviewer's machine, the stakeholder's phone, a screenshot, an
  embed in the handoff
- Break system hygiene: emoji are not tokens, cannot be swapped through an instance-swap property,
  cannot carry hover or active states
- Read as "I couldn't be bothered to wire up icons" to anyone reviewing the draft

**Rule:** in any design surface, draft or production, action / control / navigation icons are icon
component instances with a proper instance-swap. Emoji are acceptable only as **content the user
would type** — a reaction pill showing a user-entered 🔥. Everything else — camera, send, more,
play, back — uses the icon component.

If the icon you need does not exist in the kit, that is a system gap. Log it. Do not paper over it
with an emoji.

The cost of skipping this: the operator spots emoji-as-action-icon at first glance and burns her
review budget on cosmetics instead of on the actual decision.

### G13 — The build order is a contract, not a wishlist

When the decisions doc lists "frames I'll build, in order", that list is binding. If you skip a
frame during the build — for time, complexity, or "it's similar to another one" — you MUST log the
skip under "What I did NOT do", with a one-sentence reason, BEFORE writing the TL;DR or marking
anything complete.

The anti-example: eight frames declared, six built, the two missing ones never logged. The
asymmetry got spotted on review — mobile composer expanded was built, web composer expanded was
not. That reads as silent scope creep, and it costs trust.

**Detection rule:** before writing the final TL;DR, re-open the build order and tick every frame.
Anything unticked either gets built now or gets documented as a skip. There is no third option.

### G14 — Q0: surface interpretation ambiguity BEFORE listing decisions

A scope line, exactly as it arrives from the founder: *"reviews, saves, and messages (host or venue)"*. That phrase
has at least three valid parses:

- (a) messages target a host OR a venue, and reviews/saves are about dinners
- (b) all three actions apply to hosts and to venues alike
- (c) both — every object has a target (host / venue / dinner) and an author (always a guest)

The run picked (a) implicitly, without flagging it, and logged only a downstream question ("is the
dinner attached to the review?"). The morning review found the buried assumption immediately.

**Rule:** scan the literal stakeholder sentence for `or`, `/`, `and`, parentheses, and elastic
verbs (post on, share with, connect to, view from). Each one is a fork. If a fork has more than
one reasonable reading, that is **Q0 — interpretation ambiguity**. Log it FIRST in open questions,
ahead of any structural decision, with your default and the alternatives.

Stream A finds what was *said*. Q0 finds what was *meant*. Different muscle, both required.

### G15 — Prior drafts of this area are artifacts, not templates

If the draft file already contains sections from a previous run on the SAME area, treat them as
evidence of prior thinking, not as a template to extend.

**Rule:** at session start, inventory the prior sections *by name only*. Do not pixel-inspect them
as a starting point. Pixel-inspect only when you are explicitly reusing a system instance.

Why: every run surfaces critique items that were logged in that run's handoff. Re-extending a
prior draft re-imports those exact critique items into the new work. One real critique list was
monotone avatars, emoji icons, missing empty states, an asymmetric mobile/web composer, and
collapsed captions. A fresh agent opening that draft as a "starting point" inherits all five.

**Workflow:**

1. List the draft page's children → section names and ids. Note them under "Prior drafts
   inventory".
2. Build the new section at clean coordinates (offset y by the sum of prior section heights plus a
   200px gap).
3. Read the spec, this protocol, and your Stream B/C findings. Those define your decisions — not
   "how I solved it last time".
4. If you catch yourself thinking "let me check how I did the composer last time" — STOP. The
   composer's specification comes from the spec's component-reuse plan, the system gaps, and G12.
   Not from the prior frame.

The exception: if the operator explicitly says "iterate on the prior draft" or "fix X in the
earlier work", then open it as a starting point. The default is new work, fresh from spec plus
protocol.

## End-of-night decision tree

```
T-30 min from the hard stop:
  → stop generating new drafts
  → begin the self-review checklist
  → begin the morning handoff page

T-15 min:
  → stop self-review
  → finish the handoff page
  → verify every link works
  → verify no production write happened

T-5 min:
  → final pass on the TL;DR (the most-read section)
  → save and close

Hard stop:
  → no more writes, regardless of state
```

If you finish everything early: do not add scope. Spend the remaining time on deeper self-review,
a more thorough research summary, and handoff readability. If it is genuinely complete, stop early
and note "completed at <time>, idle until the hard stop."

## Where the keys live

A run needs a table of concrete addresses: the draft file key, the UI kit and foundations keys,
the handoff parent page, the relevant chat channels, the tracker list. That table belongs in the
project's `CLAUDE.md` or in `memory/` — the layers the agent loads automatically, and the ones
that stay private. It does not belong in a shared document, and it does not belong in this one.

## Related

- [context-system.md](./context-system.md) — the four layers this protocol reads from
- [figma-plugin-api.md](./figma-plugin-api.md) — plugin-API gotchas in full
- [code-to-figma.md](./code-to-figma.md) — when the night's job is porting a prototype
