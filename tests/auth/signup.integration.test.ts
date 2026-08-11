import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { signUpCompany } from "@/lib/auth/signup";

const hasDatabase = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDatabase)("signUpCompany (integration)", () => {
  beforeEach(async () => {
    await prisma.$executeRawUnsafe(
      'TRUNCATE "Membership", "Subscription", "Company", "User" RESTART IDENTITY CASCADE'
    );
  });

  afterAll(async () => {
    await prisma.$executeRawUnsafe(
      'TRUNCATE "Membership", "Subscription", "Company", "User" RESTART IDENTITY CASCADE'
    );
    await prisma.$disconnect();
  });

  it("creates a company with the signing-up user as its admin", async () => {
    const { user, company, membership } = await signUpCompany(prisma, {
      email: "founder@example.com",
      name: "Founder",
      companyName: "Acme R&D",
    });

    expect(user.email).toBe("founder@example.com");
    expect(company.name).toBe("Acme R&D");
    expect(membership.role).toBe("ADMIN");
    expect(membership.userId).toBe(user.id);
    expect(membership.companyId).toBe(company.id);
  });

  it("does not create a subscription — new companies are unentitled-gate-free until Stripe checkout", async () => {
    const { company } = await signUpCompany(prisma, {
      email: "founder@example.com",
      name: "Founder",
      companyName: "Acme R&D",
    });

    const subscription = await prisma.subscription.findUnique({ where: { companyId: company.id } });
    expect(subscription).toBeNull();
  });

  it("does not touch Xero — signup has no dependency on a Xero connection", async () => {
    const { company } = await signUpCompany(prisma, {
      email: "founder@example.com",
      name: "Founder",
      companyName: "Acme R&D",
    });

    const connection = await prisma.xeroConnection.findUnique({ where: { companyId: company.id } });
    expect(connection).toBeNull();
    expect(company.xeroTenantId).toBeNull();
  });

  it("lets the same email create a second, independent company", async () => {
    const first = await signUpCompany(prisma, {
      email: "founder@example.com",
      name: "Founder",
      companyName: "Acme R&D",
    });
    const second = await signUpCompany(prisma, {
      email: "founder@example.com",
      name: "Founder",
      companyName: "Sandbox Co",
    });

    expect(second.user.id).toBe(first.user.id);
    expect(second.company.id).not.toBe(first.company.id);

    const memberships = await prisma.membership.findMany({ where: { userId: first.user.id } });
    expect(memberships).toHaveLength(2);
    expect(memberships.every((m) => m.role === "ADMIN")).toBe(true);
  });
});
