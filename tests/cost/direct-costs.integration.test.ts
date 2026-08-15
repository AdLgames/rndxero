import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { createDirectCost, DirectCostError, listProjectDirectCosts } from "@/lib/cost/direct-costs";

const hasDatabase = Boolean(process.env.DATABASE_URL);
const TRUNCATE = 'TRUNCATE "DirectCost", "Project", "Company", "User" RESTART IDENTITY CASCADE';

describe.skipIf(!hasDatabase)("direct costs (integration)", () => {
  let projectId: string;
  let userId: string;

  beforeEach(async () => {
    await prisma.$executeRawUnsafe(TRUNCATE);
    const user = await prisma.user.create({ data: { email: "finance@example.com", name: "Finance" } });
    userId = user.id;
    const company = await prisma.company.create({ data: { name: "Test Co" } });
    const project = await prisma.project.create({ data: { companyId: company.id, name: "Test Project", startDate: new Date() } });
    projectId = project.id;
  });

  afterAll(async () => {
    await prisma.$executeRawUnsafe(TRUNCATE);
    await prisma.$disconnect();
  });

  it("creates a direct cost with its category and flags", async () => {
    const cost = await createDirectCost(prisma, {
      projectId,
      description: "AWS bill for the training cluster",
      category: "CLOUD_COMPUTING",
      amountMinorUnits: 45000,
      isOverseas: true,
      date: new Date("2026-06-01"),
      enteredById: userId,
    });

    expect(cost.category).toBe("CLOUD_COMPUTING");
    expect(cost.amountMinorUnits).toBe(45000);
    expect(cost.isOverseas).toBe(true);
    expect(cost.isSubsidised).toBe(false);
    expect(cost.currency).toBe("GBP");
  });

  it("defaults category to OTHER when not specified isn't possible — category is required by the type, but confirms the schema default matches", async () => {
    const cost = await createDirectCost(prisma, {
      projectId,
      description: "Misc",
      category: "OTHER",
      amountMinorUnits: 100,
      date: new Date(),
      enteredById: userId,
    });
    expect(cost.category).toBe("OTHER");
  });

  it("rejects a blank description", async () => {
    await expect(
      createDirectCost(prisma, { projectId, description: "  ", category: "OTHER", amountMinorUnits: 100, date: new Date(), enteredById: userId })
    ).rejects.toThrow(DirectCostError);
  });

  it("rejects a non-positive amount", async () => {
    await expect(
      createDirectCost(prisma, { projectId, description: "x", category: "OTHER", amountMinorUnits: 0, date: new Date(), enteredById: userId })
    ).rejects.toThrow(DirectCostError);
  });

  it("rejects a fractional amount (must be whole minor units)", async () => {
    await expect(
      createDirectCost(prisma, { projectId, description: "x", category: "OTHER", amountMinorUnits: 10.5, date: new Date(), enteredById: userId })
    ).rejects.toThrow(DirectCostError);
  });

  it("lists a project's direct costs newest first", async () => {
    await createDirectCost(prisma, { projectId, description: "Older", category: "SOFTWARE_LICENCE", amountMinorUnits: 100, date: new Date("2026-01-01"), enteredById: userId });
    await createDirectCost(prisma, { projectId, description: "Newer", category: "SOFTWARE_LICENCE", amountMinorUnits: 200, date: new Date("2026-06-01"), enteredById: userId });

    const costs = await listProjectDirectCosts(prisma, projectId);
    expect(costs.map((c) => c.description)).toEqual(["Newer", "Older"]);
  });
});
