import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { withCompanyScope } from "@/lib/authz/scoped-client";

const hasDatabase = Boolean(process.env.DATABASE_URL);

/**
 * Proves the query-layer scoping is real, not just documented: a client
 * scoped to company A cannot read, update, or (accidentally) create data
 * for company B, even if a route handler forgets to add its own
 * `where: { companyId }` — the whole point of doing this in the query
 * layer instead of trusting every call site to remember.
 */
describe.skipIf(!hasDatabase)("withCompanyScope (integration)", () => {
  let companyAId: string;
  let companyBId: string;

  beforeEach(async () => {
    await prisma.$executeRawUnsafe(
      'TRUNCATE "Rate", "Project", "Membership", "Company", "User" RESTART IDENTITY CASCADE'
    );

    const companyA = await prisma.company.create({ data: { name: "Company A" } });
    companyAId = companyA.id;
    const companyB = await prisma.company.create({ data: { name: "Company B" } });
    companyBId = companyB.id;

    await prisma.project.create({ data: { companyId: companyAId, name: "A's project", startDate: new Date() } });
    await prisma.project.create({ data: { companyId: companyBId, name: "B's project", startDate: new Date() } });
  });

  afterAll(async () => {
    await prisma.$executeRawUnsafe(
      'TRUNCATE "Rate", "Project", "Membership", "Company", "User" RESTART IDENTITY CASCADE'
    );
    await prisma.$disconnect();
  });

  it("findMany only ever returns rows for the scoped company, even with no explicit where", async () => {
    const scoped = withCompanyScope(prisma, companyAId);
    const projects = await scoped.project.findMany();
    expect(projects).toHaveLength(1);
    expect(projects[0].name).toBe("A's project");
  });

  it("findUnique on a row that belongs to a different company returns null, not the row", async () => {
    const bProject = await prisma.project.findFirstOrThrow({ where: { companyId: companyBId } });
    const scopedToA = withCompanyScope(prisma, companyAId);

    const result = await scopedToA.project.findUnique({ where: { id: bProject.id } });
    expect(result).toBeNull();
  });

  it("create forces companyId to the scoped company regardless of what's passed", async () => {
    const scoped = withCompanyScope(prisma, companyAId);
    // Deliberately passing the wrong companyId to prove the extension overrides it.
    const created = await scoped.project.create({
      data: { companyId: companyBId, name: "sneaky", startDate: new Date() },
    });
    expect(created.companyId).toBe(companyAId);
  });

  it("update cannot touch a row belonging to a different company", async () => {
    const bProject = await prisma.project.findFirstOrThrow({ where: { companyId: companyBId } });
    const scopedToA = withCompanyScope(prisma, companyAId);

    await expect(
      scopedToA.project.update({ where: { id: bProject.id }, data: { name: "renamed by A" } })
    ).rejects.toThrow();

    const unchanged = await prisma.project.findUniqueOrThrow({ where: { id: bProject.id } });
    expect(unchanged.name).toBe("B's project");
  });

  it("does not scope models outside its coverage list (documented gap, not silent)", async () => {
    // AccountingPeriod carries a direct companyId column but is deliberately
    // not in DIRECT_COMPANY_ID_MODELS yet. Proving that plainly — rather
    // than leaving it untested — is what keeps this gap honest instead of
    // an accidental false sense of coverage.
    await prisma.accountingPeriod.create({
      data: { companyId: companyAId, label: "A period", startDate: new Date(), endDate: new Date() },
    });
    await prisma.accountingPeriod.create({
      data: { companyId: companyBId, label: "B period", startDate: new Date(), endDate: new Date() },
    });

    const scopedToB = withCompanyScope(prisma, companyBId);
    const result = await scopedToB.accountingPeriod.findMany();

    expect(result).toHaveLength(2); // both companies' rows come back — genuinely unscoped, as documented
  });
});
