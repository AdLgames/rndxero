# Terms of Service (Draft)

> **Draft — not legal advice, and not yet reviewed by a solicitor.** Do not present this to a real customer as-is. It exists so the product's core boundary (below) is written down somewhere from day one, not invented after the fact.

## The one thing these terms must say plainly

ClaimTrail (working name) is a record-keeping tool. It captures and organises information a company chooses to enter — project details, time, cost allocations, and free-text notes about technical work.

**ClaimTrail does not:**

- decide whether any project, activity, or cost qualifies for R&D tax relief;
- calculate the value of any relief or credit claim;
- file anything with HMRC or any other tax authority;
- provide tax, legal, or accounting advice of any kind.

Every judgment about eligibility, valuation, and filing remains the customer's (or their appointed adviser's) responsibility. This is not a formality — see PLAN.md's scope discipline section: the moment this product tells someone their project qualifies, it has given tax advice, and the whole reason it's positioned as an evidence layer rather than a claim tool is to avoid exactly that exposure.

## Data ownership and portability

The customer owns the data they put into the product. They can export it in full (PDF and CSV evidence packs, Phase 5) at any time, including after cancellation, for as long as their account exists. See `RETENTION.md` for what happens to data on cancellation (short version: nothing is deleted).

## Liability

Standard SaaS limitation-of-liability language belongs here once drafted by counsel — capped liability, no consequential damages, etc. Not drafted here because getting this specific clause wrong is exactly the kind of thing that needs a real lawyer, not a template.

## Professional indemnity insurance

This is a business action, not a code change: **professional indemnity (PI) insurance must be in place before the first paying customer**, per PLAN.md Phase 6. Nothing in this repository can satisfy that requirement — it's tracked here as a blocker on go-live, not something automatable.

## What's still missing

- Actual legal review of every section above.
- A registered legal entity and jurisdiction to name in these terms.
- Acceptable use policy, SLA (if any), and a real cancellation/refund policy.
- Signature/acceptance flow (currently nothing in the product requires accepting these terms).
