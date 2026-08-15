import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { AccountingPeriodError, createAccountingPeriod, listCompanyAccountingPeriods, setClaimNotified } from "@/lib/finance/accounting-periods";

const hasDatabase = Boolean(process.env.DATABASE_URL);
const TRUNCATE = 'TRUNCATE "AccountingPeriod", "Company" RESTART IDENTITY CASCADE';

describe.skipIf(!hasDatabase)("accounting periods (integration)", () => {
  let companyId: string;

  beforeEach(async () => {
    await prisma.$executeRawUnsafe(TRUNCATE);
    const company = await prisma.company.create({ data: { name: "Test Co" } });
    companyId = company.id;
  });

  afterAll(async () => {
    await prisma.$executeRawUnsafe(TRUNCATE);
    await prisma.$disconnect();
  });

  it("creates an accounting period", async () => {
    const period = await createAccountingPeriod(prisma, {
      companyId,
      label: "FY2026",
      startDate: new Date("2026-01-01"),
      endDate: new Date("2026-12-31"),
    });
    expect(period.label).toBe("FY2026");
    expect(period.claimNotifiedAt).toBeNull();
  });

  it("rejects an end date before the start date", async () => {
    await expect(
      createAccountingPeriod(prisma, { companyId, label: "Bad", startDate: new Date("2026-12-31"), endDate: new Date("2026-01-01") })
    ).rejects.toThrow(AccountingPeriodError);
  });

  it("rejects a blank label", async () => {
    await expect(
      createAccountingPeriod(prisma, { companyId, label: "  ", startDate: new Date("2026-01-01"), endDate: new Date("2026-12-31") })
    ).rejects.toThrow(AccountingPeriodError);
  });

  it("lists a company's periods newest-ending first", async () => {
    await createAccountingPeriod(prisma, { companyId, label: "FY2025", startDate: new Date("2025-01-01"), endDate: new Date("2025-12-31") });
    await createAccountingPeriod(prisma, { companyId, label: "FY2026", startDate: new Date("2026-01-01"), endDate: new Date("2026-12-31") });

    const periods = await listCompanyAccountingPeriods(prisma, companyId);
    expect(periods.map((p) => p.label)).toEqual(["FY2026", "FY2025"]);
  });

  it("marks and un-marks a period as notified", async () => {
    const period = await createAccountingPeriod(prisma, { companyId, label: "FY2026", startDate: new Date("2026-01-01"), endDate: new Date("2026-12-31") });

    const notified = await setClaimNotified(prisma, { id: period.id, notified: true });
    expect(notified.claimNotifiedAt).not.toBeNull();

    const unnotified = await setClaimNotified(prisma, { id: period.id, notified: false });
    expect(unnotified.claimNotifiedAt).toBeNull();
  });
});
