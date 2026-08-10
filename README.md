# ClaimTrail

Contemporaneous R&D evidence capture for Xero — see [`PLAN.md`](./PLAN.md) for the full build plan, scope, and phasing. This repo is currently at Phase 1 (project skeleton).

## Stack

- Next.js (App Router, TypeScript strict)
- PostgreSQL via Prisma
- Vercel (deployment)
- Stripe (subscription billing, Phase 6)
- Xero OAuth 2.0 + Accounting API (Phase 3)

## Getting started

```bash
npm install
cp .env.example .env   # set DATABASE_URL to a local/dev Postgres
npm run dev
```

Other scripts:

```bash
npm run typecheck   # tsc --noEmit
npm test            # vitest
npx prisma migrate dev   # apply schema changes to your database
```

`GET /api/health` round-trips a query through Prisma, useful for confirming the database connection is live.

## Structure

```
/app                — routes (marketing, app, api)
/lib/xero           — OAuth, sync, GL mirror
/lib/evidence       — evidence model, immutability, export (pure functions)
/lib/approvals      — review/approval state machine
/prisma             — schema and migrations
/tests              — unit tests + fixtures
```

See [`CLAUDE.md`](./CLAUDE.md) for repo conventions.
