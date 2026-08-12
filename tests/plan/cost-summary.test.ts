import { describe, expect, it } from "vitest";
import { summarizeCostByPerson, summarizeCostByRole, type CostedRow } from "@/lib/plan/cost-summary";

const MEMBERS = [
  { userId: "u1", name: "Ada Lovelace", role: "LEAD" as const },
  { userId: "u2", name: "Bo Chen", role: "CONTRIBUTOR" as const },
  { userId: "u3", name: "Cy Osei", role: "CONTRIBUTOR" as const },
];

describe("summarizeCostByPerson", () => {
  it("sums minutes and cost across weeks for each member", () => {
    const rows: CostedRow[] = [
      { userId: "u1", weekKey: "2026-W01", plannedMinutes: 480, actualMinutes: 420, plannedCostMinorUnits: 24000, actualCostMinorUnits: 21000 },
      { userId: "u1", weekKey: "2026-W02", plannedMinutes: 480, actualMinutes: 480, plannedCostMinorUnits: 24000, actualCostMinorUnits: 24000 },
      { userId: "u2", weekKey: "2026-W01", plannedMinutes: 240, actualMinutes: 0, plannedCostMinorUnits: 8000, actualCostMinorUnits: 0 },
    ];
    const summary = summarizeCostByPerson(MEMBERS, rows);
    expect(summary).toHaveLength(3);
    expect(summary[0]).toMatchObject({ userId: "u1", plannedMinutes: 960, actualMinutes: 900, plannedCostMinorUnits: 48000, actualCostMinorUnits: 45000 });
    expect(summary[1]).toMatchObject({ userId: "u2", plannedMinutes: 240, actualMinutes: 0, plannedCostMinorUnits: 8000, actualCostMinorUnits: 0 });
  });

  it("is zeroed out (not missing) for a member with no rows at all", () => {
    const summary = summarizeCostByPerson(MEMBERS, []);
    expect(summary[2]).toEqual({ userId: "u3", name: "Cy Osei", role: "CONTRIBUTOR", plannedMinutes: 0, actualMinutes: 0, plannedCostMinorUnits: null, actualCostMinorUnits: null });
  });

  it("keeps cost null when no rate ever covered the person, rather than treating it as zero", () => {
    const rows: CostedRow[] = [{ userId: "u2", weekKey: "2026-W01", plannedMinutes: 120, actualMinutes: 60, plannedCostMinorUnits: null, actualCostMinorUnits: null }];
    const summary = summarizeCostByPerson(MEMBERS, rows);
    expect(summary[1].plannedCostMinorUnits).toBeNull();
    expect(summary[1].actualCostMinorUnits).toBeNull();
    expect(summary[1].plannedMinutes).toBe(120);
  });

  it("sums a mix of costed and rate-less weeks without losing the costed portion", () => {
    const rows: CostedRow[] = [
      { userId: "u1", weekKey: "2026-W01", plannedMinutes: 480, actualMinutes: 480, plannedCostMinorUnits: 24000, actualCostMinorUnits: 24000 },
      { userId: "u1", weekKey: "2026-W02", plannedMinutes: 480, actualMinutes: 480, plannedCostMinorUnits: null, actualCostMinorUnits: null },
    ];
    const summary = summarizeCostByPerson(MEMBERS, rows);
    expect(summary[0].plannedCostMinorUnits).toBe(24000);
    expect(summary[0].plannedMinutes).toBe(960);
  });
});

describe("summarizeCostByRole", () => {
  it("rolls up person summaries by role", () => {
    const personSummaries = summarizeCostByPerson(MEMBERS, [
      { userId: "u1", weekKey: "2026-W01", plannedMinutes: 480, actualMinutes: 480, plannedCostMinorUnits: 24000, actualCostMinorUnits: 24000 },
      { userId: "u2", weekKey: "2026-W01", plannedMinutes: 240, actualMinutes: 240, plannedCostMinorUnits: 6000, actualCostMinorUnits: 6000 },
      { userId: "u3", weekKey: "2026-W01", plannedMinutes: 120, actualMinutes: 0, plannedCostMinorUnits: 3000, actualCostMinorUnits: 0 },
    ]);
    const byRole = summarizeCostByRole(personSummaries);
    expect(byRole).toHaveLength(2);
    const lead = byRole.find((r) => r.role === "LEAD")!;
    const contributor = byRole.find((r) => r.role === "CONTRIBUTOR")!;
    expect(lead).toMatchObject({ plannedMinutes: 480, plannedCostMinorUnits: 24000 });
    expect(contributor).toMatchObject({ plannedMinutes: 360, actualMinutes: 240, plannedCostMinorUnits: 9000, actualCostMinorUnits: 6000 });
  });
});
