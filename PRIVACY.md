# Privacy & Data Protection Notice (Draft)

> **Draft — not legal advice.** This is a starting point for a real privacy notice and DPA, written from what the codebase actually does. It must be reviewed by someone qualified before it is published or relied on, and updated to match the actual legal entity, jurisdiction, and hosting arrangements in place at the time.

## What personal data this product holds

- **Account data**: name and email address for every `User` (`prisma/schema.prisma`).
- **Employment/role data**: which company a user belongs to and in what role (`Membership`) — admin, contributor, finance approver, or adviser.
- **Time data**: minutes worked per person, per project, per period, and the basis of that figure (`TimeEntry`).
- **Evidence content**: free-text descriptions of technical work (`EvidenceEntry`), which may incidentally name individuals.
- **Xero connection data**: OAuth tokens (encrypted at rest, `lib/xero/crypto.ts`) and a read-only mirror of general-ledger lines — no bank details, no full payroll records beyond what's imported via CSV.

This is precisely the kind of data GDPR calls "personal data" for the individuals named in it, so the product needs a lawful basis for processing (legitimate interest — supporting an R&D tax claim — is the likely candidate, but that's a legal judgment, not an engineering one).

## Data Processing Agreement (DPA)

Every customer relationship here is a controller (the customer)/processor (ClaimTrail) relationship for their employees' data. A DPA needs to be in place before any live customer data is processed. It should cover, at minimum: what's processed (above), sub-processors (hosting provider, Stripe, Xero, any email provider), international transfer safeguards if hosting is outside the UK/EEA, and breach notification timelines.

## Subject access & deletion requests

**Access**: an individual named in evidence records can be identified and their records located via `authorId`/`personId` on `EvidenceEntry` and `TimeEntry`. There is no self-service export scoped to *an individual* yet (Phase 5's export is scoped to a project/period, not a person) — building one is worth doing before this notice is finalised, since "we can find your data" is different from "we can give you your data" under a subject access request.

**Deletion**: see `RETENTION.md`. In short — evidence data is retained for six years by design, and there is no automated deletion path in this codebase yet. A subject erasure request against evidence data will collide with that retention purpose; GDPR itself recognises retention for legal-claim purposes as a valid basis to refuse or delay erasure, but which side of that line a given request falls on is a case-by-case legal call, not something this document or the code resolves automatically.

## Sub-processors currently integrated

- **Xero** — read-only access to accounting data (`lib/xero`), scoped to the minimal read scopes in `XERO_READ_SCOPES`.
- **Stripe** — billing and payment data (`lib/billing`); ClaimTrail never stores card details directly.
- **Sentry** (optional, off by default — see `instrumentation.ts`) — error tracking, which can incidentally capture request data; needs PII scrubbing configured before it's turned on with a real DSN.

## What is not built yet

- A public-facing privacy policy page.
- Consent/cookie handling for the marketing site (currently the default Next.js starter page).
- A person-scoped data export or erasure tool.

None of these block internal development, but all of them block having a real, paying customer.
