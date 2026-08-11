import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { countBillableSeats, EntitlementError, isCompanyEntitled, requireEntitled } from "@/lib/billing/entitlement";

const hasDatabase = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDatabase)("entitlement (integration)", () => {
  let companyId: string;

  beforeEach(async () => {
    await prisma.$executeRawUnsafe('TRUNCATE "Subscription", "Membership", "Company", "User" RESTART IDENTITY CASCADE');
    const company = await prisma.company.create({ data: { name: "Test Co" } });
    companyId = company.id;
  });

  afterAll(async () => {
    await prisma.$executeRawUnsafe('TRUNCATE "Subscription", "Membership", "Company", "User" RESTART IDENTITY CASCADE');
    await prisma.$disconnect();
  });

  describe("isCompanyEntitled", () => {
    it("is entitled with no Subscription row at all (the pre-checkout free period)", async () => {
      expect(await isCompanyEntitled(prisma, companyId)).toBe(true);
    });

    it("is entitled while TRIALING or ACTIVE", async () => {
      await prisma.subscription.create({
        data: { companyId, stripeCustomerId: "cus_1", status: "TRIALING", seatCount: 1 },
      });
      expect(await isCompanyEntitled(prisma, companyId)).toBe(true);

      await prisma.subscription.update({ where: { companyId }, data: { status: "ACTIVE" } });
      expect(await isCompanyEntitled(prisma, companyId)).toBe(true);
    });

    it("is not entitled once PAST_DUE or CANCELED", async () => {
      await prisma.subscription.create({
        data: { companyId, stripeCustomerId: "cus_1", status: "PAST_DUE", seatCount: 1 },
      });
      expect(await isCompanyEntitled(prisma, companyId)).toBe(false);

      await prisma.subscription.update({ where: { companyId }, data: { status: "CANCELED" } });
      expect(await isCompanyEntitled(prisma, companyId)).toBe(false);
    });
  });

  describe("requireEntitled", () => {
    it("resolves silently when entitled", async () => {
      await expect(requireEntitled(prisma, companyId)).resolves.toBeUndefined();
    });

    it("throws EntitlementError when not entitled", async () => {
      await prisma.subscription.create({
        data: { companyId, stripeCustomerId: "cus_1", status: "CANCELED", seatCount: 1 },
      });
      await expect(requireEntitled(prisma, companyId)).rejects.toThrow(EntitlementError);
    });
  });

  describe("countBillableSeats", () => {
    it("counts every ACTIVE non-Adviser membership and excludes Advisers entirely", async () => {
      const users = await Promise.all(
        ["owner", "finance", "lead", "adviser1", "adviser2"].map((name) =>
          prisma.user.create({ data: { email: `${name}@example.com`, name } })
        )
      );
      await prisma.membership.createMany({
        data: [
          { userId: users[0].id, companyId, role: "OWNER", status: "ACTIVE" },
          { userId: users[1].id, companyId, role: "FINANCE", status: "ACTIVE" },
          { userId: users[2].id, companyId, role: "LEAD", status: "ACTIVE" },
          { userId: users[3].id, companyId, role: "ADVISER", status: "ACTIVE" },
          { userId: users[4].id, companyId, role: "ADVISER", status: "ACTIVE" },
        ],
      });

      expect(await countBillableSeats(prisma, companyId)).toBe(3);
    });

    it("excludes REMOVED/INVITED memberships even if not an Adviser", async () => {
      const user = await prisma.user.create({ data: { email: "removed@example.com", name: "Removed" } });
      await prisma.membership.create({ data: { userId: user.id, companyId, role: "CONTRIBUTOR", status: "REMOVED" } });
      expect(await countBillableSeats(prisma, companyId)).toBe(0);
    });
  });
});
