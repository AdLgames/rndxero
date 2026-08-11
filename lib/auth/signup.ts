import type { PrismaClient } from "@/lib/generated/prisma/client";

/**
 * Self-service signup: creates a brand-new company with the signing-up
 * user as its admin. This is deliberately storage-agnostic — it has no
 * dependency on Xero (a company can exist, and this app can be used,
 * without ever connecting one — see lib/xero, which is opt-in and
 * separate) and no dependency on billing (no Subscription row is created
 * here; every company is unentitled-gate-free until Stripe checkout
 * creates one — see lib/billing/repository.ts's isEntitled, which is
 * computed but not currently enforced anywhere).
 *
 * A user can sign up more than once with the same email to spin up
 * additional companies (e.g. an adviser trying the product with their
 * own sandbox company alongside client companies they're invited into) —
 * a call with a *new* company name always creates a new Company + admin
 * Membership. A call repeating a company name the user already admins is
 * idempotent (returns the existing one) rather than creating a
 * duplicate — this matters because the API route sends a confirmation
 * email after this runs, and a transient email failure needs a retry of
 * signup to be safe, not something that piles up abandoned companies.
 */
export interface SignUpInput {
  email: string;
  name: string;
  companyName: string;
}

export async function signUpCompany(prisma: PrismaClient, input: SignUpInput) {
  const user = await prisma.user.upsert({
    where: { email: input.email },
    update: {},
    create: { email: input.email, name: input.name },
  });

  const existing = await prisma.membership.findFirst({
    where: { userId: user.id, role: "ADMIN", company: { name: input.companyName } },
    include: { company: true },
  });
  if (existing) {
    return { user, company: existing.company, membership: existing };
  }

  const company = await prisma.company.create({ data: { name: input.companyName } });

  const membership = await prisma.membership.create({
    data: { userId: user.id, companyId: company.id, role: "ADMIN" },
  });

  return { user, company, membership };
}
