# Build Plan: R&D Evidence Capture — Xero Add-in

**Working name:** ClaimTrail (rename freely)
**One-line pitch:** Contemporaneous R&D record-keeping that runs all year, so the claim writes itself and survives an HMRC enquiry six years later.
**What it is NOT:** a claim-preparation tool, a tax advice product, or a filing tool. It is an evidence layer.

---

## The thesis (read this before building anything)

Every existing R&D tax product sits at the wrong point on the timeline. Tax Cloud, EmpowerRD, RDVault and the consultancies all engage *after* the accounting period ends, when the evidence either exists or doesn't. HMRC's Guidelines for Compliance (GfC3) ask for records created *at the time* the R&D took place. The enquiry window runs six years. Nothing bought at claim time can retrofit contemporaneous evidence.

The two weakest links in almost every claim:
1. **Staff time apportionment.** Usually the largest cost category, usually a retrospective estimate ("Dave was ~40% on R&D"). HMRC challenges exactly this.
2. **The technical narrative.** Written months later by a competent professional reconstructing what they were uncertain about. HMRC is practised at spotting post-rationalisation.

This product fixes both by capturing them as they happen, and uses Xero for the cost side.

**Positioning line:** "Your claim is only as good as what you wrote down while you were doing the work."

---

## Who buys it

**Primary channel — B2B2B (build for this first):** R&D tax consultancies and accounting firms. They hold the client base, they carry the enquiry risk, and better evidence makes their claims more defensible *and* cheaper to prepare. Sold as the tool they roll out to clients, optionally white-labelled. Your accountancy credibility is the entire sales pitch.

**Secondary — direct:** SMEs with repeat claims, especially anyone who has already been through an enquiry. Prior-enquiry companies are the fastest sale in the market; they need no education.

**Pricing shape:** subscription, not per-claim. Indicative: per-company monthly fee with tiering by headcount, plus a firm-level plan for advisers managing many clients. Deliberately below the £2,750–£4,000 per-claim floor of existing software so it reads as an operating cost, not a claim cost.

---

## Scope discipline (the most important section)

**In scope for v1:**
- Project records with contemporaneous entries (uncertainties, hypotheses, attempts, failures, resolutions)
- Time capture against R&D projects, per person, with approval workflow
- Cost aggregation from Xero (see Phase 3)
- Finance review and approval, with immutable history
- Export: an evidence pack per project per accounting period

**Explicitly out of scope for v1:**
- Deciding what qualifies as R&D (that is advice — the user decides, you record)
- Calculating relief or credit values
- Filing anything with HMRC
- Sector-specific tax logic

Why this matters: the moment the product tells someone their project qualifies, you are giving tax advice, and you inherit professional indemnity exposure and a regulatory posture you do not want as a solo founder. Record, don't rule. Every screen should reflect that.

---

## How to use this document with Claude Code

Put this file in the repo root as `PLAN.md` and reference it from `CLAUDE.md`. Build one phase at a time; each phase ends with a checklist that must pass before moving on.

Kickoff prompt:
> Read PLAN.md. We are starting Phase 1. Set up the project skeleton exactly as specified. Flag any deviation you think is necessary before making it, and stop at the Phase 1 checklist.

---

## Phase 0 — Validation (before writing real code)

**Kill criteria decided in advance.**

1. Interview 8–10 R&D consultancies or accounting firms with an R&D practice. Ask specifically: how do your clients currently evidence time apportionment, and what happens when HMRC opens an enquiry? Listen for whether they'd hand a tool to clients or see it as competition.
2. Interview 5+ companies that have had an enquiry. What did HMRC ask for that they couldn't produce?
3. Landing page + waitlist on the purchased domain.
4. **Kill criteria:** if no adviser firm says they'd pilot it with clients, and no claimant describes reconstructing evidence as painful, stop. Reposition or return to the departmental costing idea.
5. **Adoption risk test (do this one properly):** ask two engineering leads whether their developers would log anything at all. If the honest answer is no, the product must be built around pulling from Jira/GitHub with confirm-not-create UX, and that changes Phase 4 substantially.

**Checklist:** 8+ adviser interviews · 5+ claimant interviews · explicit read on engineer adoption · go/no-go recorded in writing.

---

## Phase 1 — Project skeleton

**Stack:**
- Next.js (App Router, TypeScript)
- PostgreSQL (Neon or Supabase), Prisma
- Vercel deployment
- Stripe for subscription billing
- Xero OAuth 2.0 + Accounting API

**Structure:**
```
/app                — routes (marketing, app, api)
/lib/xero           — OAuth, sync, GL mirror
/lib/evidence       — evidence model, immutability, export (pure functions)
/lib/approvals      — review/approval state machine
/prisma             — schema
/tests              — unit tests + fixtures
```

**CLAUDE.md conventions:** TypeScript strict; money as integer minor units; **all evidence records are append-only — no destructive edits, ever** (see Phase 2); evidence and approval logic as pure, tested functions; no new dependencies without a stated reason.

**Checklist:** deploys · migrates · CI runs typecheck and tests · append-only helper in place and unit-tested.

---

## Phase 2 — The evidence model (build this before any UI)

This is the product. Get it wrong and everything downstream is worthless.

**Core principle: append-only with attribution.** An evidence entry, once written, is never mutated or deleted. Corrections are new entries that supersede prior ones, with both retained. Every entry carries author identity, server-side timestamp, and the entity/period it belongs to. If a claim is challenged in 2032, the value of this system is being able to show *when* something was written and *by whom* — a record that can be silently edited later is worth nothing at enquiry.

**Entities:**
- `Company` (maps to one Xero tenant)
- `Project` — name, start/end, status, competent professional(s) named
- `EvidenceEntry` — append-only; type (uncertainty raised / approach attempted / result observed / resolution / decision), free text, author, timestamp, optional attachments
- `TimeEntry` — person, project, period, hours or percentage, basis (timesheet / sampled / estimated), author, timestamp
- `CostAllocation` — links a Xero transaction line to a project with an apportionment percentage and a rationale field
- `Approval` — who approved what, when, and the exact snapshot hash of what they approved
- `PeriodSnapshot` — immutable freeze of a project-period once signed off

**Design rules:**
- Time entries must record their **basis**, not just a number. "Estimated" vs "timesheet" is exactly the distinction HMRC probes, and being honest about it in the record is a feature, not a weakness.
- Never auto-fill an apportionment percentage. Suggest, require a human to confirm, and log who confirmed.
- Attachments stored with content hashes so tampering is detectable.

**Checklist:** append-only enforced at the database level (not just app code) · supersede-not-edit flow tested · snapshot hashing tested · a deliberate attempt to mutate history fails.

---

## Phase 3 — Xero integration (read-only)

**Goal: the cost side, without asking anyone to re-enter data.**

1. OAuth with minimal read scopes. Read-only — this product never writes to the ledger.
2. Build a GL mirror from `/Journals` using offset pagination. Do not build on the Trial Balance report endpoint; it can omit tracking category breakdowns.
3. Pull the cost categories that matter for R&D: staff costs, subcontractor and external worker bills, consumables, software, and data/cloud spend. Present them as an allocable list, not as a conclusion.
4. **Rate limits:** 60 calls/minute and 5,000/day per tenant, 10,000/minute app-wide. Pagination returns 100 records at a time. Backfill needs a proper job queue with retry on HTTP 429 using the `Retry-After` header.
5. **Payroll is the hard part.** Staff cost is the biggest category, and Xero Payroll API access is restricted and region-dependent. Plan for a manual/CSV salary-cost import path as the reliable route, with payroll API as an enhancement where available. Do not let the whole product depend on payroll API access.
6. Where a company already uses Xero tracking categories or Projects for R&D, import those as a starting suggestion for allocation — but the allocation still lives in your database, so you're not bound by the two-tracking-category limit.

**Checklist:** dev org connects · GL mirror reconciles to Xero's own reports · rate-limit backoff tested against a large backfill · salary import path works without payroll API.

---

## Phase 4 — Capture UX (where the product lives or dies)

Two audiences, two completely different screens.

**Engineers — confirm, don't create.** This is the adoption battle. Options in rough order of preference:
- Integrations: pull from Jira issues, GitHub PRs/commits, or Linear, and periodically ask "was this work resolving a technical uncertainty?" with a one-tap yes/no and an optional sentence.
- A weekly digest email/Slack prompt: here's what you worked on, confirm the split.
- Manual entry as a fallback, never as the primary flow.

If a developer has to remember to open your app, the product fails. Design for zero unprompted visits.

**Finance — review and approve.** A queue of pending time and cost allocations, each with the underlying evidence one click away, an approve/query action, and a running view of what's evidenced vs unevidenced per project. The "unevidenced" number is the product's core value display: it shows the gap while there's still time to close it.

**Invitations and roles:** company admin, contributor (log/confirm own time and evidence), finance approver, external adviser (read-only or approver, scoped per client). Adviser access is what makes the B2B2B channel work.

**Checklist:** an engineer can log a week's confirmation in under 60 seconds · finance can approve a period without leaving the queue · adviser sees only their assigned clients · a non-accountant can explain what "unevidenced" means from the screen alone.

---

## Phase 5 — Export: the claim-ready pack

The deliverable that makes advisers want this. Per project, per accounting period:

- Project summary with named competent professionals
- Chronological evidence timeline with authorship and timestamps
- Time summary by person, with basis of each figure stated plainly
- Cost summary by category with per-line apportionment and rationale, traceable back to Xero transaction IDs
- Approval history
- Snapshot hash and generation timestamp

Formats: PDF for the pack, CSV/XLSX for the cost detail so advisers can work with it. Note that HMRC does not mandate a particular format or template for contemporaneous records, so the pack should be organised for a human reviewer, not to mimic any official form.

**Checklist:** pack generated from a full fixture year · every figure traceable to a source record · regenerating a snapshotted period produces an identical hash.

---

## Phase 6 — Billing, compliance, launch

1. Stripe Checkout + Customer Portal; entitlement flag by webhook. Firm-level plans need seat/client-count metering.
2. **Data retention is a product feature, not an afterthought.** Records must survive the six-year enquiry window — build export-everything and a documented retention policy, and never hard-delete evidence on cancellation without an explicit, warned, confirmed action.
3. GDPR: this holds employee names and time data. DPA with customers, subject access and deletion handling, UK/EU data residency worth deciding early.
4. Professional indemnity insurance, and terms that state plainly the product records information and does not provide tax advice or determine eligibility.
5. Sentry + a per-tenant sync health admin page.

**Checklist:** connect → trial → pay → cancel → full export all work · retention policy written · terms reviewed · PI in place before first paying customer.

---

## Phase 7 — Distribution

- **Advisers first.** Pilot with 2–3 firms, free, in exchange for shaping the product and a reference.
- **Content that only you can write:** an accountant explaining what HMRC actually asks for at enquiry and what evidence answers it. The AI-generated competition cannot write this credibly.
- **The pack is the referral loop** — it lands on an adviser's desk with your product name on it.
- **Xero App Store listing** as a second channel once reliability and reviews are solid. Note the App Store is a marketplace listing, not a distribution guarantee.
- Consider a Xero App Partner listing alongside the accounting-firm channel, since accountant referral is precisely how comparable tools in this ecosystem grew.

---

## Risks, stated honestly

| Risk | Severity | Mitigation |
|---|---|---|
| Selling prevention, not money | High | Sell to post-enquiry companies and to advisers who carry the risk |
| Engineers won't log anything | High | Confirm-don't-create UX; integrations over manual entry; test in Phase 0 |
| Scheme rules change | Medium | Stay an evidence layer — rule changes affect claim tools far more than record-keeping tools |
| Consultancies see you as a threat | Medium | Position as making their claims defensible and their prep cheaper; white-label option |
| Payroll data access | Medium | CSV import as the primary path, payroll API as a bonus |
| You are giving tax advice by accident | High | Scope discipline in Phase 0 §Scope; record, never rule; PI insurance |

---

## Things only you can decide

These need your professional judgment, not Claude Code's, and should be settled before Phase 2:

- Which cost categories the product presents, and how apportionment rationale should be worded to be useful at enquiry
- Whether the time-entry "basis" taxonomy (timesheet / sampled / estimated) matches how HMRC actually distinguishes evidence quality
- How the pack should be structured so an inspector can follow it
- Whether to scope v1 to UK only, or design the data model to allow other regimes later (recommendation: UK only in v1, but don't hard-code UK assumptions into the schema)

---

## Honest expectations

Compliance products sell slower than consumer tools but churn far less and command higher prices. The realistic path is 2–3 adviser firms piloting within six months, and the build only starts if Phase 0 produces a firm willing to pilot. Cost to validate: a domain and your evenings.

**Claude Code docs:** https://docs.claude.com/en/docs/claude-code/overview
