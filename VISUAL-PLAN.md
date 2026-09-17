# ClaimTrail — Build Plan (v3: seeing the record)

This extends `BOARD-PLAN.md` Phases 5 (planner) and 6 (the board). It replaces neither
plan's data model — every phase below reads entities that already exist. Where this file
and `BOARD-PLAN.md` disagree on what a *view* should look like, this file wins; on schema,
permissions, capture or locking, `BOARD-PLAN.md` still wins.

**The problem this solves:** the app captures well and shows almost none of it back. A
week's work becomes a row in a list. A year's work becomes a 200-item queue. The planner
exists and is not linked from anywhere. Nothing in the product draws the shape of a
project, and the shape is what an adviser reads.

**The boundary, unchanged:** every view below displays what was recorded and where the
record is thin. None of them judges whether work qualifies as R&D, and none states a
relief value. "Evidence gap" is a statement about the record, never about eligibility.

Sizing: **S** = one session, **M** = two or three, **L** = a week of evenings.

---

## Phase 0 — Decisions locked before writing code

1. **The kanban stays; the week board comes back beside it.** `/board` currently groups
   projects by `ProjectStatus` (commit 37ef285). That view answers "where does this project
   stand" and is worth keeping. It does not answer "what did we actually do", which is the
   only question evidence answers. `/board` gets a **Stages / Weeks** toggle rather than one
   view replacing the other. `BOARD-PLAN.md` Phase 6's swimlane-by-week board is the Weeks view.
2. **The planner is a nav destination, not a page section.** It is currently reachable only
   by opening a project (`app/(app)/projects/[projectId]/CalendarPlanner.tsx`). It gets its
   own entry under Technical Register and a project picker.
3. **Colour grammar: one accent ramp for volume, one distinct mark for failure.**
   `ATTEMPT` at `bg-accent/40` and `FAILED_ATTEMPT` at `bg-accent/80` are two shades of the
   same green and are indistinguishable at the 9px the feed and board render them
   (`app/(app)/home/page.tsx` `CELL_STYLE`). Failure gets its own mark — filled plus ring —
   not a darker step on the same ramp. `BOARD-PLAN.md` Phase 6.4 is explicit that failed
   attempts are the strongest evidence in the product; they should be the loudest thing on
   the screen.
4. **Red/amber/green means evidence completeness, never qualification.** The existing
   `weekComplianceStatus()` (`lib/compliance/readiness.ts`) is the only source for this
   scale. No view introduces a second definition of "ready".
5. **Every new view is additive to the schema except Phase 5.** Phases 1–4 and 6–7 render
   entities that already exist. Phase 5 adds two nullable columns and nothing else.

---

## Phase P — Prerequisite: the hours roll-up (S, blocking)

Not a view, but every view below renders zeros without it.

`lib/export/pack.ts:165` sums a project's hours and derived cost from `note.minutes` — the
*optional* per-challenge hours box in capture. `WeeklySubmission.minutes`, the hours the
engineer actually logged and the only figure the capture flow requires, is never rolled in.
A project with 135 logged hours against a live `Rate` exports as:

```json
"totals": { "actualMinutes": 8100, "derivedCostMinorUnits": 0 }
```

Decide how a week's submission minutes distribute across that week's notes (proposal: split
evenly across the week's non-`NO_PROGRESS` notes, and state the basis in the pack, since an
invented per-challenge precision is worse than an honest split), then apply the same
function everywhere hours or cost are shown. Money stays in integer minor units throughout.

**Done when:** a project with logged hours and a rate exports a non-zero
`derivedCostMinorUnits`, and the board card, planner cell and claim pack all agree on the
same number for the same week.

---

## Phase 1 — Make the planner reachable (S)

1. Add `{ href: "/planner", label: "Planner" }` to the Technical Register group in
   `app/components/nav-groups.ts` — both nav surfaces read from it, so this is one edit.
2. `/planner` renders a project picker, then the existing `CalendarPlanner` unchanged.
   Default to the most recently active project, matching the "recency wins" rule
   `/projects` and the home board already use.
3. Board cards link into the planner for that project, so "Planned 0h" becomes an invitation
   rather than a dead statistic.

**Done when:** a lead who has never opened a project detail page can find the planner, build
a plan and get back to it a day later without using browser history.

---

## Phase 2 — The Weeks board (L)

`BOARD-PLAN.md` Phase 6, restored as the second view on `/board`.

1. Toggle at the top of `/board`: **Stages** (today's kanban) · **Weeks**.
2. Weeks view: vertical swimlanes are project workstreams, horizontal columns are ISO weeks,
   walked with `shiftWeekKey` from the project's start.
3. Each `UncertaintyNote` renders as a card at its lane × week intersection, typed by colour
   per Phase 0.3. Stacking with a count badge; expand on tap.
4. The lane bar spans the project's active period. Planned hours render as a ghost outline
   behind actuals once Phase 1 gives them somewhere to come from.
5. Locked weeks render visually distinct from live ones. Empty weeks show as visible gaps —
   the gap is the information.
6. Drag-to-remap for lead-and-above only, writing to `AuditLog` through the existing
   `/api/board/remap` route.
7. Lane collapse to a summary strip.

**Done when:** a twelve-week project with five uncertainties is legible at a glance on a 13"
screen without vertical scrolling, and a failed attempt is the first thing the eye lands on.

---

## Phase 3 — The coverage grid (M)

`PLAN.md` Phase 4 calls the unevidenced gap *"the product's core value display: it shows the
gap while there's still time to close it."* It does not exist in the product today.

1. People down, ISO weeks across, one cell per person-week, coloured by
   `weekComplianceStatus()`. Lock state as a cell border, not a fourth colour.
2. Scoped per company, filterable by project. Costs never appear in this view, so it is safe
   for every role that can already read submissions.
3. Clicking a cell opens that week's submission in the finance queue.
4. A column footer per week: how many people are still unlogged, and days to auto-lock.
5. This replaces the finance page's flat card list as the *entry point*; the card list stays
   as the detail view behind a cell. That list is capped at `take: 200` with no pagination
   (`app/(app)/finance/page.tsx:48`), which silently hides history for any team past a few
   months — the grid is queried per week and does not inherit that ceiling.

**Done when:** a finance lead can point at a single screen and say which person-weeks are
missing narrative before the period closes, on a company with a year of history.

---

## Phase 4 — Uncertainty lifecycle strip (M)

The claim pack already narrates this per uncertainty in `lib/export/pack.ts`. Nothing draws it.

1. One horizontal band per `Uncertainty`: raised (`raisedWeek`) → each attempt, blocker and
   failed attempt in week order → resolution or abandonment (`resolvedWeek`, `outcome`).
2. `baseline` shown as the band's opening statement — it is the field the narrative needs and
   the one most likely to be missing.
3. Hover or tap a marker for the note body, author, `submittedAt`, retrospective flag and
   evidence link.
4. Renders on the project page and in the PDF pack, from the same component data.

**Done when:** an accountant reading the strip cold can describe the project's technical
story without opening the chronology table underneath it.

---

## Phase 5 — Capacity and target weeks (M)

The only phase here that touches the schema. Two nullable columns, one migration.

1. `Membership.weeklyCapacityMinutes` (nullable). The planner turns a person-week cell red
   above it; capture warns when a week's total across projects exceeds it. Today the planner
   will allocate 60h to one person and capture will accept 42h across two projects without
   comment — and unexamined over-allocation is exactly the time-apportionment weakness
   `PLAN.md` opens by naming.
2. `Uncertainty.targetWeek` (nullable). Gives the product "overdue challenges": a real signal
   for the home page's Next steps (`lib/dashboard/tasks.ts`), the Monday nudge, and an amber
   marker on the Phase 4 strip.
3. Neither field is required, and neither blocks a submission. A warning is a prompt to
   check, never a refusal to record — the record is the product.

**Done when:** over-allocating a person is visible at the moment it happens, and a challenge
past its target week appears in Next steps without anyone running a report.

---

## Phase 6 — Plan versus actual, visibly (M)

1. Variance table per challenge: planned, actual, remaining. The export already computes a
   `variance` array; nothing renders it (`BOARD-PLAN.md` Phase 5.5 asked for the table
   before the visual view — the table is still missing).
2. Version diffs. Version history is currently a text list — "Version 2 · 340h planned ·
   current". Show what *changed* between consecutive `PlanVersion`s: which challenge gained
   or lost hours, which person moved. Plans are immutable and superseded versions stay
   queryable, so the diff is a pure function of two versions.
3. Burn-up per project: cumulative logged hours against cumulative planned, by week.
4. The plan appears at capture time — "you were planned 12h on SLAM drift this week" beside
   the hours box. This is what turns the planner from a management artefact into something
   that shapes the record. It is a prompt, never a prefill: the planned figure is never
   written into the hours input.

**Done when:** a lead can revise a plan, log three weeks against it, and see the original,
the revision, the reason and the actuals side by side.

---

## Phase 7 — The cheap visual wins (S)

Each of these is under an hour and each fixes something currently misleading.

1. Failed-attempt mark per Phase 0.3, applied to `CELL_STYLE` in the home feed, the Weeks
   board and the lifecycle strip from one shared definition.
2. Board cards get a twelve-week sparkline of logged versus planned instead of
   "Logged 115h · Planned 0h" as text. A stalled project should be obvious from the board.
3. Hours-by-challenge stacked bar on the project page.
4. The `/board` kanban clips its last column (`ABANDONED`) at 1280px, a common laptop width;
   make the column strip scroll with a visible affordance.
5. `BLOCKER` exists in `UncertaintyNoteType` and has a board colour, but no UI can produce
   one — the four-way tap emits `NO_PROGRESS`, `ATTEMPT`, `FAILED_ATTEMPT`, `RESOLUTION`.
   Either give it a tap or drop it from the enum; a type that renders but cannot be created
   is a trap for whoever reads the colour legend.

---

## Order of attack

Phase P first and alone — it is small, and Phases 2, 3, 6 and 7 all render its output.
Then Phase 1 (one file, immediate payoff). Phases 2 and 3 are the substance and can run in
parallel; 3 is the one a finance lead will thank you for, 2 is the one that sells the
product. Phase 4 is mostly assembly once 2 exists. Phase 5 is a migration, so it wants a
clear run. Phases 6 and 7 are independent and can fill any gap.

## Risks worth naming now

| Risk | Mitigation |
|---|---|
| **Drift into project management.** A Gantt with capacity planning and burn-up looks exactly like delivery software. | The test from `BOARD-PLAN.md` still applies: decline anything that only makes sense for shipping a product and not for evidencing one. Capacity exists to make apportionment honest, not to schedule people. |
| **A view implying eligibility.** Green cells and readiness percentages read like approval. | Label the scale as record completeness everywhere it appears, and keep the non-claim disclaimer visible. Record, never rule. |
| **Rendering a year of person-weeks in the browser.** | Query per visible week window, virtualise columns, and never inherit the finance page's unpaginated 200-row pattern. |
| **Costs leaking into a contributor's view.** The summary banner already shows company-wide qualifying expenditure to every role (`app/components/SummaryBanner.tsx`), which `BOARD-PLAN.md` Phase 2 forbids. | Fix the banner before adding views that carry money, and gate every new cost figure on `canViewCosts` at the query layer, not in the component. |
