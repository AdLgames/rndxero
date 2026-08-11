# ClaimTrail — Build Plan (v2: the board)

This supersedes the capture/cost/evidence architecture in `PLAN.md` Phases 2–5 (evidence model, Xero cost allocation, capture UX, export). `PLAN.md` Phase 1 (stack), Phase 3 (Xero read-only integration), Phase 6 (billing/compliance), and Phase 7 (distribution) mostly still hold and are extended here, not replaced. Where the two disagree, this file wins for anything related to capture, planning, or the board.

**Target state:** a contemporaneous R&D evidence platform where uncertainties are tracked as living workstreams on a Gantt-style board, fed by a sub-minute weekly capture, planned in advance with proposed hours, and shared across an org with role-based authority.

**Assumed stack:** Next.js + Prisma + Postgres on Vercel (unchanged from `PLAN.md`).

**Sequencing principle:** schema and permissions first. Retrofitting multi-tenancy and an audit trail onto a live app is the single most expensive mistake available here. The board and the planner are the visible payoff, but they sit on top of Phases 1–3.

Sizing: **S** = one session, **M** = two or three, **L** = a week of evenings.

---

## Phase 0 — Decisions locked before writing code

1. **Lane unit: Project workstream.** A Gantt lane is a project, not an individual uncertainty. `Uncertainty` still exists as a first-class entity (Section 1.2) with its own baseline/raised/resolved lifecycle — this decision only affects how Phase 6's board groups swimlanes (by project) and, per the original plan's own warning, means Phase 7's export needs to do more work to reconstruct the per-uncertainty narrative from a project-grouped board, since the board itself won't hand it over pre-grouped.
2. **Org model: many-to-many via Membership.** Already true of the existing schema — `Company` (kept as the tenant entity name; see note below) already supports a user holding multiple `Membership` rows across companies. No change needed here.
3. **Week boundary: Monday–Sunday, Europe/London, stored as an ISO week key** (e.g. `2026-W33`), never as a date range. Chosen for consistency with the UK/HMRC context and because `lib/capture/weekly-digest.ts` already used a Monday-start convention; this generalises it to a proper timezone-aware ISO week key and to `Europe/London` specifically (handles the GMT/BST transition correctly, which a fixed UTC offset would not).
4. **Lock timing: auto-lock at close + 7 days; finance approval can lock earlier.** Adopted as-is from the plan's own recommendation.
5. **Existing data: wipe and restart.** Confirmed explicitly by the product owner — everything in the live database at time of this rebuild is test/smoke data. The migration drops `TimeEntry`, `EvidenceEntry`, `EvidenceAttachment`, `CostAllocation`, `Approval`, and `PeriodSnapshot` outright rather than migrating rows into the new shape.

**Naming note:** the plan below refers to the tenant entity as "Org" throughout. The codebase keeps the existing name `Company` for it — same entity, same role, pure renaming churn with no functional upside across ~40 files that already reference `companyId` pervasively (Xero integration, billing, auth). Read "Org" as "Company" everywhere below.

---

## Phase 1 — Schema foundation (L)

The whole app is downstream of this. Done in one migration, not five.

### 1.1 Tenancy and identity
- `Company` (= Org) — unchanged: name, created, plan tier (via `Subscription`).
- `User` — unchanged.
- `Membership` — `userId`, `companyId`, `role` enum (`OWNER`, `FINANCE`, `LEAD`, `CONTRIBUTOR`, `ADVISER`), `canViewCosts` boolean, `status` (`INVITED`, `ACTIVE`, `REMOVED`).
  - `canViewCosts` is deliberately a separate column, not implied by role. Contributors and leads must not be able to infer colleagues' pay from a board.

### 1.2 Project and uncertainty
- `Project` — `companyId`, name, description, start date, expected end, status.
- `ProjectMember` — `projectId`, `userId`, project-level role. Company role sets the ceiling; project role sets access to that project.
- `Uncertainty` — `projectId`, title, description, `raisedWeek`, `resolvedWeek` (nullable), `outcome` enum (`RESOLVED`, `ABANDONED`, `OPEN`), `baseline` text (what the existing state of knowledge was — the field the claim narrative needs).

### 1.3 Capture
- `WeeklySubmission` — `companyId`, `projectId`, `userId`, `weekKey`, `hours`, `basis` (`ESTIMATED` / `TRACKED`), `submittedAt`, `isRetrospective` boolean, `lockedAt` nullable.
- `UncertaintyNote` — `submissionId`, `uncertaintyId`, `type` enum (`ATTEMPT`, `BLOCKER`, `FAILED_ATTEMPT`, `RESOLUTION`, `NO_PROGRESS`), `body` text, `hours` nullable. One submission produces several notes.
- `Amendment` — references a `UncertaintyNote` (or a `WeeklySubmission` directly), `authorId`, `body`, `createdAt`. Corrections append; nothing is ever overwritten — matches the append-only discipline already established for the v1 evidence model.

### 1.4 Plan
- `PlanVersion` — `projectId`, `versionNumber`, `createdBy`, `createdAt`, `note` (why it was revised), `supersededAt`.
- `PlannedAllocation` — `planVersionId`, `uncertaintyId`, `userId` nullable, `weekKey`, `plannedHours`.
- Plans are immutable once superseded. A revision creates a new version; the old one stays queryable forever.

### 1.5 Cost
- `Rate` — `companyId`, `userId`, `hourlyRateMinorUnits` (integer minor units, not a float), `effectiveFrom`, `effectiveTo`. Time-boxed so a raise doesn't retroactively rewrite last year's costs.
- `DirectCost` — `projectId`, `uncertaintyId` nullable, description, `amountMinorUnits`, `currency`, date, `enteredById`. Optional traceability back to a `XeroJournalLine` or `ManualCostLine`, matching the traceability requirement `PLAN.md` already established. For consumables and subcontractors only.
- Labour cost is **always derived** (`hours × rate at that week`), never stored and never typed by a user.

### 1.6 Audit
- `AuditLog` — `companyId`, `actorId`, `action`, `entityType`, `entityId`, `before` JSON, `after` JSON, `reason` nullable, `createdAt`.
- Written from a single service wrapper, not from individual route handlers.

**Done when:** migration runs clean, seed script creates a company with one of each role, and every table has `companyId` reachable in one join.

---

## Phase 2 — Authorisation layer (M)

1. Build a single `authorize(user, action, resource)` service. Every data access goes through it.
2. Enforce `companyId` scoping in the **query layer**, not in the UI and not in route guards alone.
3. Define the permission matrix explicitly in one file:
   - Owner: everything, plus billing and membership.
   - Finance: rates, approve/lock weeks, all costs, export claim pack. Cannot edit submissions.
   - Lead: create uncertainties, own the plan, invite contributors to *their* projects, see hours. Costs only if `canViewCosts`.
   - Contributor: submit own capture, read the board for projects they're on. No rates, no other users' costs.
   - Adviser: read-only on shared projects, plus export. Submits nothing, edits nothing.
4. **Hard rule, enforced server-side:** no user can update another user's `WeeklySubmission` or `UncertaintyNote`. Not leads, not finance, not owners. The only path is an `Amendment`.
5. Tests for the matrix before building UI against it.

**Done when:** a contributor's session provably cannot read a rate or another project's board, verified by test.

---

## Phase 3 — Rebuild weekly capture (M)

1. Entry point accepts `?week=` and `?project=` for deep-linking from a Monday email.
2. Multi-project in one pass, with a per-project "nothing this week" toggle.
3. Prefill hours from the previous week, plus quick chips (5/10/20/40).
4. Per-uncertainty cards: four-way tap (No progress / Tried something / Hit a wall / Solved it), revealing a one-line text box on anything but "no progress."
5. New-uncertainty flow: title + baseline.
6. `isRetrospective` derived automatically from `submittedAt` vs. week close, never asked.
7. Confirmation state showing the running record.

**Done when:** a user on three projects with four open uncertainties completes a full week in under 60 seconds on a phone, measured.

---

## Phase 4 — Locking, amendments and integrity (S)

1. Auto-lock at close + 7 days.
2. Finance early-lock writes to `AuditLog`.
3. Unlock requires a typed reason, finance-only, shown permanently on the affected week.
4. Locked notes render visually distinct.
5. Amendment UI on locked notes only offers "add correction."

**Done when:** a full history of a corrected week is demonstrable, original text still visible and attributed.

---

## Phase 5 — Project planner (M)

1. Plan builder: pick uncertainties, assign people, set proposed hours per week.
2. Save as `PlanVersion 1`; show total planned hours and derived planned cost (finance/`canViewCosts` only).
3. Revision creates version N+1 with a required "why" note; old versions stay viewable.
4. Plan-vs-actual query per uncertainty.
5. Variance table before the visual view.

**Done when:** create a plan, log three weeks, revise the plan, see original and actuals side by side.

---

## Phase 6 — The board (L)

1. Vertical swimlanes = **project workstreams** (per the Phase 0 decision), horizontal columns = ISO weeks.
2. Lane bar spans the project's active period; planned hours render as a ghost outline behind actuals.
3. Sticky notes: each `UncertaintyNote` is a card at the lane × week intersection, colour by type.
4. Failed attempts get the strongest visual treatment — the best evidence available, not a warning sign.
5. Stacking with count badge, expand on tap.
6. Locked vs live rendering.
7. Drag-to-remap (lead-and-above, writes to `AuditLog`).
8. Lane collapse → summary strip.
9. Empty weeks show as visible gaps.

**Done when:** a twelve-week project with five uncertainties is legible at a glance on a 13" screen without vertical scrolling.

---

## Phase 7 — Claim pack export v2 (M)

1. Per uncertainty: baseline → statement → chronological attempts including failures → resolution/abandonment → hours and derived cost.
2. Project-level roll-up with plan-vs-actual and revision history appendix.
3. Integrity metadata: submission timestamps, retrospective flags, lock dates, amendment history.
4. PDF plus structured JSON/CSV.
5. Explicit non-claim disclaimer on every page, and visible in the product too.

**Done when:** an accountant can read the export cold and understand the project without asking a question.

---

## Phase 8 — Distribution and commercials (M)

1. Adviser seats free; inviting one is a prominent action.
2. Entitlement gating tied to `Membership` where role ≠ `ADVISER`; gate on project count and export, never on capture.
3. Weekly nudge email on week-close day, deep-linked per user with projects prefilled.
4. GitHub App webhook ingestion — suggestion only, human confirms.
5. Marketing page led by the board screenshot.

**Done when:** an accountant can be invited, view a project, and export a pack without an account upgrade or a support message.

---

## Suggested order of attack

Phases 1 → 2 → 3 → 4 are one continuous block; don't ship in the middle of it. Phases 5 and 6 can run in parallel. Phase 7 is mostly assembly. Phase 8 items are independent.

## Risks worth naming now

- **Capture fatigue is the product-killing risk.** If Phase 3 doesn't hit the 60-second bar, nothing downstream matters.
- **Migration debt.** Avoided here — Phase 0 chose wipe-and-restart specifically to not carry a nullable `uncertaintyId` forever.
- **Scope drift into project management.** The board is an evidence artefact that happens to look like a Gantt chart. Decline anything that only makes sense for delivery management.
