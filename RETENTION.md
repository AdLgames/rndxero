# Data Retention Policy

> **Draft — not legal advice.** This is an engineering-facing policy statement describing what the product does, written to be reviewed and adopted (or revised) by someone with legal authority before it is shown to a customer. Same caution the product itself takes with tax advice: this describes behaviour, it doesn't establish obligations on its own.

## Why retention is a product feature here

HMRC's enquiry window into an R&D claim runs up to six years after the end of the relevant accounting period (PLAN.md). A record that can be deleted before that window closes is worthless as claim evidence — retention isn't a storage-cost afterthought, it's the point of the product.

## What is retained, and for how long

- **Evidence records** (`EvidenceEntry`, `TimeEntry`, `CostAllocation`, `Approval`, `PeriodSnapshot`) are retained for **at least six years** after the end of the accounting period they relate to. `lib/billing/retention.ts` computes this date (`computeRetentionExpiry`) for internal reference; it does not trigger deletion.
- These records are **append-only** end to end: enforced by database triggers (see `prisma/migrations/*_evidence_model`), never mutated or deleted by application code, and never deleted by a subscription lapsing or being cancelled.
- **Xero GL mirror data** (`XeroJournalLine`) is a cache, not a record of claim evidence, and may be dropped and re-synced at any time without affecting the retained evidence above.

## What cancellation does and does not do

- Cancelling a subscription changes `Subscription.status` to `CANCELED`. It does **not** delete any evidence, time, cost, approval, or snapshot data.
- A cancelled company retains full read and export access to its data for as long as the account exists, specifically so a lapsed subscription never becomes the reason a claim can't be evidenced at enquiry.
- **Full export** (PDF + CSV evidence packs, Phase 5) is always available regardless of subscription state — this is deliberate: retention as a policy is only credible if a customer can get their own data out at any time.

## Account / data deletion

There is currently **no automated deletion path** in this codebase, by design. Evidence must survive exactly the kind of "clean up old accounts" script that would otherwise be tempting to write. Before any deletion capability is built:

1. It must require **explicit, informed confirmation** from a company admin — not a side effect of cancellation, inactivity, or an admin script.
2. It must warn, specifically, that deleting data before the six-year window closes may remove evidence a live or future HMRC enquiry could require.
3. It should default to **export-then-delete**, not delete-only.

Until that is built and reviewed, "the customer wants their data gone" is a support conversation, not a self-service button.

## Data residency

Not yet decided. Given the product's UK tax-compliance purpose and its likely customers (UK-based advisers and SMEs), UK/EU hosting is the natural default — needs a decision from whoever owns infrastructure before the first customer with a residency requirement is onboarded.
