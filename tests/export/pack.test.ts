import { describe, expect, it } from "vitest";
import { assemblePackContent, type PackApprovalRow, type PackCostLine } from "@/lib/export/pack";
import { computeSnapshotHash } from "@/lib/evidence/snapshot";

const project = {
  id: "project-1",
  name: "Batching engine",
  startDate: "2025-04-01T00:00:00.000Z",
  endDate: null,
  status: "ACTIVE",
  competentProfessionals: ["Dr. Ada Lovelace"],
};

const accountingPeriod = {
  id: "period-1",
  label: "FY2025",
  startDate: "2025-04-01T00:00:00.000Z",
  endDate: "2026-03-31T00:00:00.000Z",
};

function buildInput() {
  const costLines: PackCostLine[] = [
    {
      id: "cost-1",
      category: "staff_costs",
      description: "Salaries and Wages",
      source: { type: "xero", xeroJournalId: "journal-1", xeroJournalLineId: "line-1" },
      amountMinorUnits: 500000,
      currency: "GBP",
      apportionmentBps: 5000,
      apportionedAmountMinorUnits: 250000,
      rationale: "50% of Dave's time was on the batching uncertainty per confirmed weekly logs.",
    },
  ];

  const approvals: PackApprovalRow[] = [
    {
      targetType: "COST_ALLOCATION",
      targetId: "cost-1",
      decision: "APPROVED",
      approverName: "Finance Lead",
      createdAt: "2026-01-05T10:00:00.000Z",
      comment: null,
    },
  ];

  return {
    project,
    accountingPeriod,
    evidenceEntries: [
      {
        id: "e2",
        type: "RESOLUTION",
        body: "Resolved: batching holds under load.",
        authorName: "Ada",
        createdAt: "2025-05-02T00:00:00.000Z",
        supersedes: null,
      },
      {
        id: "e1",
        type: "UNCERTAINTY_RAISED",
        body: "Not sure batching holds under load.",
        authorName: "Ada",
        createdAt: "2025-05-01T00:00:00.000Z",
        supersedes: null,
      },
    ],
    timeEntries: [
      { personName: "Ada", minutes: 120, basis: "ESTIMATED" },
      { personName: "Ada", minutes: 60, basis: "TIMESHEET" },
      { personName: "Bo", minutes: 90, basis: "SAMPLED" },
    ],
    costLines,
    approvals,
  };
}

describe("assemblePackContent", () => {
  it("orders the evidence timeline chronologically regardless of input order", () => {
    const content = assemblePackContent(buildInput());
    expect(content.evidenceTimeline.map((e) => e.id)).toEqual(["e1", "e2"]);
  });

  it("groups time entries by person and sums minutes by basis", () => {
    const content = assemblePackContent(buildInput());
    const ada = content.timeSummary.find((row) => row.personName === "Ada");

    expect(ada?.totalMinutes).toBe(180);
    expect(ada?.basisBreakdownMinutes).toEqual({ ESTIMATED: 120, TIMESHEET: 60 });
    expect(content.timeSummary.map((r) => r.personName)).toEqual(["Ada", "Bo"]);
  });

  it("keeps every cost line traceable to its Xero or manual-import source", () => {
    const content = assemblePackContent(buildInput());
    expect(content.costSummary[0].source).toEqual({
      type: "xero",
      xeroJournalId: "journal-1",
      xeroJournalLineId: "line-1",
    });
  });

  it("carries the full approval history", () => {
    const content = assemblePackContent(buildInput());
    expect(content.approvalHistory).toHaveLength(1);
    expect(content.approvalHistory[0].decision).toBe("APPROVED");
  });
});

describe("pack content hashing (determinism)", () => {
  it("produces an identical hash when regenerated from equivalent data", () => {
    const first = assemblePackContent(buildInput());
    const second = assemblePackContent(buildInput());

    expect(computeSnapshotHash(first)).toBe(computeSnapshotHash(second));
  });

  it("changes hash when a figure changes", () => {
    const first = assemblePackContent(buildInput());
    const mutatedInput = buildInput();
    mutatedInput.costLines[0].apportionmentBps = 6000;
    const second = assemblePackContent(mutatedInput);

    expect(computeSnapshotHash(first)).not.toBe(computeSnapshotHash(second));
  });

  it("is unaffected by input array order (evidence, approvals)", () => {
    const input = buildInput();
    const reordered = { ...input, evidenceEntries: [...input.evidenceEntries].reverse() };

    const a = assemblePackContent(input);
    const b = assemblePackContent(reordered);

    expect(computeSnapshotHash(a)).toBe(computeSnapshotHash(b));
  });
});
