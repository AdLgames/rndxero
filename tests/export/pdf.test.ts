import { describe, expect, it } from "vitest";
import { renderEvidencePackPdf } from "@/lib/export/pdf";
import { assemblePackContent } from "@/lib/export/pack";

function buildContent() {
  return assemblePackContent({
    project: {
      id: "p1",
      name: "Batching engine",
      startDate: "2025-04-01T00:00:00.000Z",
      endDate: null,
      status: "ACTIVE",
      competentProfessionals: ["Dr. Ada Lovelace"],
    },
    accountingPeriod: {
      id: "period-1",
      label: "FY2025",
      startDate: "2025-04-01T00:00:00.000Z",
      endDate: "2026-03-31T00:00:00.000Z",
    },
    evidenceEntries: [
      {
        id: "e1",
        type: "UNCERTAINTY_RAISED",
        body: "Not sure batching holds under load.",
        authorName: "Ada",
        createdAt: "2025-05-01T00:00:00.000Z",
        supersedes: null,
      },
    ],
    timeEntries: [{ personName: "Ada", minutes: 120, basis: "ESTIMATED" }],
    costLines: [
      {
        id: "cost-1",
        category: "staff_costs",
        description: "Salaries",
        source: { type: "xero", xeroJournalId: "journal-1", xeroJournalLineId: "line-1" },
        amountMinorUnits: 500000,
        currency: "GBP",
        apportionmentBps: 5000,
        apportionedAmountMinorUnits: 250000,
        rationale: "50% on batching",
      },
    ],
    approvals: [
      {
        targetType: "COST_ALLOCATION",
        targetId: "cost-1",
        decision: "APPROVED",
        approverName: "Finance Lead",
        createdAt: "2026-01-05T10:00:00.000Z",
        comment: null,
      },
    ],
  });
}

describe("renderEvidencePackPdf", () => {
  it("produces a valid PDF buffer", async () => {
    const content = buildContent();
    const pdf = await renderEvidencePackPdf(content, {
      snapshotHash: "a".repeat(64),
      generatedAt: new Date("2026-01-06T00:00:00.000Z"),
    });

    expect(Buffer.isBuffer(pdf)).toBe(true);
    expect(pdf.subarray(0, 5).toString("ascii")).toBe("%PDF-");
    expect(pdf.length).toBeGreaterThan(500);
  });

  it("renders an empty-period pack without throwing", async () => {
    const content = assemblePackContent({
      project: {
        id: "p1",
        name: "Empty project",
        startDate: "2025-04-01T00:00:00.000Z",
        endDate: null,
        status: "ACTIVE",
        competentProfessionals: [],
      },
      accountingPeriod: {
        id: "period-1",
        label: "FY2025",
        startDate: "2025-04-01T00:00:00.000Z",
        endDate: "2026-03-31T00:00:00.000Z",
      },
      evidenceEntries: [],
      timeEntries: [],
      costLines: [],
      approvals: [],
    });

    const pdf = await renderEvidencePackPdf(content, {
      snapshotHash: "b".repeat(64),
      generatedAt: new Date(),
    });
    expect(pdf.subarray(0, 5).toString("ascii")).toBe("%PDF-");
  });
});
