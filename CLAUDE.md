@AGENTS.md

# ClaimTrail

Read `PLAN.md` before working on this repo — it is the build plan and the source of truth for scope, phasing, and design rules. Build one phase at a time; each phase ends with a checklist that must pass before moving to the next.

## Conventions

- TypeScript strict mode everywhere (already enabled in `tsconfig.json`). No `any` escape hatches without a stated reason.
- Money is always stored and passed around as integer minor units (pence), never as floats.
- Evidence records are **append-only** — no destructive edits, ever. Corrections are new entries that supersede prior ones; both are retained. See `/lib/evidence`.
- Evidence and approval logic lives as pure, unit-tested functions in `/lib/evidence` and `/lib/approvals` — no side effects, no framework coupling.
- No new dependencies without a stated reason in the commit/PR description.
- This product records information; it does not decide what qualifies as R&D, calculate relief values, or file anything with HMRC. Keep that boundary visible in code and UI copy.

## Structure

```
/app                — routes (marketing, app, api)
/lib/xero           — OAuth, sync, GL mirror
/lib/evidence       — evidence model, immutability, export (pure functions)
/lib/approvals      — review/approval state machine
/prisma             — schema
/tests              — unit tests + fixtures
```
