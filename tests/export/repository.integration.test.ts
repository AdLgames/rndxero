import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { gatherPackContent, getOrCreatePeriodSnapshot } from "@/lib/export/repository";
import { buildCostDetailCsv } from "@/lib/export/csv";
import { renderEvidencePackPdf } from "@/lib/export/pdf";

const hasDatabase = Boolean(process.env.DATABASE_URL);

/**
 * "A full fixture year" (Phase 5 checklist): one accounting period with a
 * named competent professional, evidence entries (including a
 * supersession), time entries from two people, a Xero-sourced cost line
 * and a manually-imported one, and an approval — enough surface to prove
 * every figure in the pack traces back to a real row.
 */
describe.skipIf(!hasDatabase)("evidence pack export (integration)", () => {
  let projectId: string;
  let periodId: string;
  let adaId: string;
  let boId: string;
  let financeId: string;

  beforeEach(async () => {
    await prisma.$executeRawUnsafe(
      'TRUNCATE "PeriodSnapshot", "Approval", "CostAllocation", "TimeEntry", "EvidenceEntry", "ManualCostLine", "ManualCostImport", "XeroJournalLine", "ProjectCompetentProfessional", "Project", "AccountingPeriod", "Company", "User" RESTART IDENTITY CASCADE'
    );

    const ada = await prisma.user.create({ data: { email: "ada@example.com", name: "Ada" } });
    adaId = ada.id;
    const bo = await prisma.user.create({ data: { email: "bo@example.com", name: "Bo" } });
    boId = bo.id;
    const finance = await prisma.user.create({ data: { email: "finance@example.com", name: "Finance Lead" } });
    financeId = finance.id;

    const company = await prisma.company.create({ data: { name: "Fixture Co" } });

    const period = await prisma.accountingPeriod.create({
      data: {
        companyId: company.id,
        label: "FY2025",
        startDate: new Date("2025-04-01T00:00:00.000Z"),
        endDate: new Date("2026-04-01T00:00:00.000Z"),
      },
    });
    periodId = period.id;

    const project = await prisma.project.create({
      data: {
        companyId: company.id,
        name: "Batching engine",
        startDate: new Date("2025-04-01T00:00:00.000Z"),
        status: "ACTIVE",
        competentProfessionals: { create: [{ name: "Dr. Ada Lovelace" }] },
      },
    });
    projectId = project.id;

    const original = await prisma.evidenceEntry.create({
      data: {
        projectId,
        type: "UNCERTAINTY_RAISED",
        body: "Not sure batching holds under load.",
        authorId: adaId,
        createdAt: new Date("2025-05-01T00:00:00.000Z"),
      },
    });
    await prisma.evidenceEntry.create({
      data: {
        projectId,
        type: "RESOLUTION",
        body: "Confirmed batching holds under 10x load in staging.",
        authorId: adaId,
        supersedes: original.id,
        createdAt: new Date("2025-06-01T00:00:00.000Z"),
      },
    });

    const adaTime = await prisma.timeEntry.create({
      data: {
        projectId,
        personId: adaId,
        periodStart: new Date("2025-05-01T00:00:00.000Z"),
        periodEnd: new Date("2025-05-08T00:00:00.000Z"),
        minutes: 600,
        basis: "TIMESHEET",
        authorId: adaId,
      },
    });
    await prisma.timeEntry.create({
      data: {
        projectId,
        personId: boId,
        periodStart: new Date("2025-05-01T00:00:00.000Z"),
        periodEnd: new Date("2025-05-08T00:00:00.000Z"),
        minutes: 300,
        basis: "ESTIMATED",
        authorId: boId,
      },
    });

    const journalLine = await prisma.xeroJournalLine.create({
      data: {
        companyId: company.id,
        xeroJournalId: "journal-1",
        xeroJournalLineId: "line-1",
        journalDate: new Date("2025-05-15T00:00:00.000Z"),
        accountCode: "477",
        accountName: "Salaries and Wages",
        netAmountMinor: 500000,
        sourceType: "ACCPAY",
        costCategory: "staff_costs",
      },
    });

    const manualImport = await prisma.manualCostImport.create({
      data: {
        companyId: company.id,
        filename: "april-salaries.csv",
        importedById: financeId,
        lines: {
          create: [
            {
              personName: "Contractor Co",
              periodStart: new Date("2025-05-01T00:00:00.000Z"),
              periodEnd: new Date("2025-05-31T00:00:00.000Z"),
              amountMinorUnits: 200000,
              description: "Contractor invoice",
            },
          ],
        },
      },
      include: { lines: true },
    });

    const xeroCostAllocation = await prisma.costAllocation.create({
      data: {
        projectId,
        source: "XERO_JOURNAL_LINE",
        xeroJournalLineId: journalLine.id,
        amountMinorUnits: 500000,
        apportionmentBps: 5000,
        rationale: "50% of Dave's salary was on the batching uncertainty, per confirmed weekly logs.",
        authorId: financeId,
      },
    });
    await prisma.costAllocation.create({
      data: {
        projectId,
        source: "MANUAL_IMPORT",
        manualCostLineId: manualImport.lines[0].id,
        amountMinorUnits: 200000,
        apportionmentBps: 10000,
        rationale: "Contractor was dedicated full-time to this project.",
        authorId: financeId,
      },
    });

    await prisma.approval.create({
      data: {
        targetType: "COST_ALLOCATION",
        targetId: xeroCostAllocation.id,
        decision: "APPROVED",
        snapshotHash: "irrelevant-for-this-fixture",
        approverId: financeId,
      },
    });
    await prisma.approval.create({
      data: {
        targetType: "TIME_ENTRY",
        targetId: adaTime.id,
        decision: "APPROVED",
        snapshotHash: "irrelevant-for-this-fixture",
        approverId: financeId,
      },
    });
  });

  afterAll(async () => {
    await prisma.$executeRawUnsafe(
      'TRUNCATE "PeriodSnapshot", "Approval", "CostAllocation", "TimeEntry", "EvidenceEntry", "ManualCostLine", "ManualCostImport", "XeroJournalLine", "ProjectCompetentProfessional", "Project", "AccountingPeriod", "Company", "User" RESTART IDENTITY CASCADE'
    );
    await prisma.$disconnect();
  });

  it("assembles a pack where every figure traces back to a source record", async () => {
    const content = await gatherPackContent(prisma, projectId, periodId);

    expect(content.project.competentProfessionals).toEqual(["Dr. Ada Lovelace"]);

    // Only the current (non-superseded) evidence entry chain is visible, both versions retained.
    expect(content.evidenceTimeline).toHaveLength(2);
    expect(content.evidenceTimeline[0].body).toContain("Not sure batching holds");
    expect(content.evidenceTimeline[1].supersedes).toBe(content.evidenceTimeline[0].id);

    const ada = content.timeSummary.find((r) => r.personName === "Ada");
    expect(ada?.totalMinutes).toBe(600);
    expect(ada?.basisBreakdownMinutes).toEqual({ TIMESHEET: 600 });

    const xeroLine = content.costSummary.find((l) => l.source.type === "xero");
    expect(xeroLine?.source).toEqual({
      type: "xero",
      xeroJournalId: "journal-1",
      xeroJournalLineId: "line-1",
    });
    expect(xeroLine?.apportionedAmountMinorUnits).toBe(250000);

    const manualLine = content.costSummary.find((l) => l.source.type === "manual_import");
    expect(manualLine?.source).toEqual({ type: "manual_import", filename: "april-salaries.csv" });

    expect(content.approvalHistory).toHaveLength(2);
    expect(content.approvalHistory.every((a) => a.approverName === "Finance Lead")).toBe(true);
  });

  it("regenerating a snapshotted period produces an identical hash and does not duplicate the row", async () => {
    const first = await getOrCreatePeriodSnapshot(prisma, {
      projectId,
      accountingPeriodId: periodId,
      generatedById: financeId,
    });
    const second = await getOrCreatePeriodSnapshot(prisma, {
      projectId,
      accountingPeriodId: periodId,
      generatedById: financeId,
    });

    expect(second.id).toBe(first.id);
    expect(second.snapshotHash).toBe(first.snapshotHash);

    const rows = await prisma.periodSnapshot.findMany({ where: { projectId, accountingPeriodId: periodId } });
    expect(rows).toHaveLength(1);
  });

  it("renders the snapshotted content as a valid PDF and a traceable CSV", async () => {
    const snapshot = await getOrCreatePeriodSnapshot(prisma, {
      projectId,
      accountingPeriodId: periodId,
      generatedById: financeId,
    });
    const content = snapshot.dataJson as never;

    const pdf = await renderEvidencePackPdf(content, {
      snapshotHash: snapshot.snapshotHash,
      generatedAt: new Date(),
    });
    expect(pdf.subarray(0, 5).toString("ascii")).toBe("%PDF-");

    const csv = buildCostDetailCsv(content);
    expect(csv).toContain("journal-1/line-1");
    expect(csv).toContain("april-salaries.csv");
  });
});
