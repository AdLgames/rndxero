import { describe, expect, it } from "vitest";
import { buildCostDetailCsv } from "@/lib/export/csv";
import { assemblePackContent } from "@/lib/export/pack";

function buildContent() {
  return assemblePackContent({
    project: {
      id: "p1",
      name: "Project",
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
    costLines: [
      {
        id: "cost-1",
        category: "staff_costs",
        description: "Salaries, incl. \"bonus\" adjustment",
        source: { type: "xero", xeroJournalId: "journal-1", xeroJournalLineId: "line-1" },
        amountMinorUnits: 500000,
        currency: "GBP",
        apportionmentBps: 5000,
        apportionedAmountMinorUnits: 250000,
        rationale: "50% on the batching uncertainty, per confirmed weekly logs",
      },
      {
        id: "cost-2",
        category: null,
        description: "Contractor invoice",
        source: { type: "manual_import", filename: "april-salaries.csv" },
        amountMinorUnits: 100000,
        currency: "GBP",
        apportionmentBps: 10000,
        apportionedAmountMinorUnits: 100000,
        rationale: "Fully allocated, dedicated contractor",
      },
    ],
    approvals: [],
  });
}

describe("buildCostDetailCsv", () => {
  it("includes a header row and one row per cost line", () => {
    const csv = buildCostDetailCsv(buildContent());
    const lines = csv.split("\r\n");
    expect(lines[0]).toBe(
      "category,description,sourceType,sourceReference,amount,currency,apportionmentPercent,apportionedAmount,rationale"
    );
    expect(lines).toHaveLength(3);
  });

  it("renders minor units as a 2-decimal amount", () => {
    const csv = buildCostDetailCsv(buildContent());
    expect(csv).toContain("5000.00,GBP,50.00,2500.00");
  });

  it("traces a Xero-sourced line back to journal + line id", () => {
    const csv = buildCostDetailCsv(buildContent());
    expect(csv).toContain("xero,journal-1/line-1");
  });

  it("traces a manually-imported line back to its filename", () => {
    const csv = buildCostDetailCsv(buildContent());
    expect(csv).toContain("manual_import,april-salaries.csv");
  });

  it("quotes fields containing commas or quotes per RFC 4180", () => {
    const csv = buildCostDetailCsv(buildContent());
    expect(csv).toContain('"Salaries, incl. ""bonus"" adjustment"');
  });
});
