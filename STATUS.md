# Build Status vs. PLAN.md

Snapshot as of this build session. Every phase in PLAN.md has code and tests where a phase means code; where a phase means a business action (interviews, insurance, a pilot), that's called out as **not something this session did or could do**, not as done.

## What's built, phase by phase

**Phase 1 — Skeleton.** Next.js (App Router, TS strict), Prisma/Postgres, the `/app`, `/lib/xero`, `/lib/evidence`, `/lib/approvals`, `/prisma`, `/tests` structure, CI (typecheck + test on push/PR). Deploys and migrates — verified against a real Postgres instance, not just Prisma's dry validation.

**Phase 2 — Evidence model.** Full schema: `Company`, `Project`, `EvidenceEntry`, `TimeEntry`, `CostAllocation`, `Approval`, `PeriodSnapshot`, plus identity/roles, Xero mirror, manual cost import, and billing tables. Append-only is enforced at the **database level** via triggers that reject UPDATE/DELETE on evidence, time, cost, approval, and snapshot tables — proven with an integration test that issues raw SQL against Postgres and asserts it fails, not just that the app layer chooses not to. Approval state machine and canonical-JSON snapshot hashing are pure and unit tested.

**Phase 3 — Xero (read-only).** OAuth requesting only read scopes (verified by a test that asserts no scope contains `.write`), tokens encrypted at rest. GL mirror pulls `/Journals` with offset pagination on `JournalNumber` — specifically not the Trial Balance report endpoint, per the plan's explicit steer away from it. Rate-limit handling retries on 429 honouring `Retry-After`. Staff costs come via CSV import as the primary path, since Payroll API access is restricted/region-dependent — the product doesn't depend on it.

**Phase 4 — Capture UX + roles.** Passwordless magic-link sign-in, DB-backed invitations as the only way an account/membership is created. Four roles (admin, contributor, finance approver, adviser), adviser access scoped per company — tested. Engineer-facing capture is a "confirm this week" form (project, hours, basis, optional uncertainty note that becomes a real `EvidenceEntry`), not a blank log. Finance gets a per-company review queue (approve/query, backed by the Phase 2 state machine) and an "unevidenced" gap display per project. Verified end-to-end against a live dev server, not just unit tests.

**Phase 5 — Export.** Evidence pack (project summary, chronological evidence timeline, time summary by person with basis stated plainly, cost summary traceable to a Xero journal/line id or manual-import filename, approval history, snapshot hash) as PDF (pdfkit) and CSV. Snapshot generation is idempotent and its hash is deterministic under regeneration — verified against a full fixture year in Postgres, not just a synthetic unit test.

**Phase 6 — Billing & compliance.** Stripe Checkout (subscription mode, seat-count for firm plans) + Customer Portal, admin-only. A single webhook is the only writer of subscription status; cancellation never deletes evidence data. `RETENTION.md`, `PRIVACY.md`, `TERMS.md` drafted (each explicitly marked as needing real legal review). Per-tenant Xero sync health admin page. Sentry wired but inert until a DSN is set.

**Phase 7 — Distribution.** `DISTRIBUTION.md` — a plan and templates, not executed outreach (see below).

**Test coverage**: 118 tests across 21 files — pure-logic unit tests (crypto, rate-limit backoff, cost-category classification, CSV/date parsing, state machine, snapshot hashing, retention math, Stripe status mapping) plus integration tests against a real Postgres instance (append-only trigger enforcement, approval workflow, full evidence-pack generation from a fixture year). CI runs all of it with a Postgres service on every push.

## What this session did not, and could not, do

These aren't gaps in the code — they're things that structurally require you, real credentials, or real people, and no amount of further building closes them:

- **Phase 0 validation was not conducted.** No adviser interviews, no claimant interviews, no landing-page/waitlist test, no engineer-adoption read. PLAN.md's own honest-expectations section says the build should only start once Phase 0 produces a firm willing to pilot — building continued anyway on your explicit instruction to go through all phases, which reverses that ordering. Worth doing before this goes in front of a real prospect.
- **No real credentials exist anywhere in this repo.** Xero Client ID/Secret, Stripe secret/webhook/price keys, `AUTH_SECRET`, `XERO_TOKEN_ENCRYPTION_KEY`, and `SENTRY_DSN` are all unset placeholders in `.env.example`. Every integration is built and tested against mocks or a local database, and none of it has touched a live Xero org or a live Stripe account.
- **No GitHub App / Jira integration is live.** The "confirm, don't create" digest module (`lib/capture/weekly-digest.ts`) and the GitHub-commit-to-candidate mapping are built and tested; registering an actual GitHub App (manifest, installation OAuth, webhook secret, a public URL to receive webhooks) is an operational step outside what this session can fabricate. The capture flow that ships today is the manual weekly-confirm form.
- **Legal documents are drafts, not finished terms.** `TERMS.md`, `PRIVACY.md`, `RETENTION.md` need a solicitor's review before any customer sees them.
- **Professional indemnity insurance is not in place** — cannot be, from a coding session. Called out in `TERMS.md` and `PLAN.md` as a blocker on the first paying customer.
- **No adviser pilot has happened.** `DISTRIBUTION.md` has the outreach template; nobody has been contacted.
- **No content has been published.** The Phase 7 article brief is written; the actual credentialed-author piece is not.
- **The marketing site is still the Next.js starter page** (`app/page.tsx`) — nothing customer-facing describing the product exists yet.
- **Subscription entitlement isn't enforced.** `isEntitled()` exists (`lib/billing/repository.ts`) but no route currently blocks a `PAST_DUE`/`CANCELED` company from using the product — a deliberate deferral, not an oversight, since the grace-period/read-only policy is a product decision, not a default to pick silently.

## Recommended next step

Given the above, the highest-leverage next action is almost certainly **not more code**: it's the Phase 0 conversations this build skipped past, or — if those have genuinely already happened outside this session — getting one real Xero sandbox connection and one real Stripe test-mode subscription running end to end against what's built here.
