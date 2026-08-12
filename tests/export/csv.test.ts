import { describe, expect, it } from "vitest";
import { buildClaimPackCsv } from "@/lib/export/csv";
import type { ClaimPackContent } from "@/lib/export/pack";

function buildContent(): ClaimPackContent {
  return {
    project: {
      id: "p1",
      name: "Widget Engine",
      description: null,
      startDate: "2026-01-01T00:00:00.000Z",
      endDate: null,
      status: "ACTIVE",
      competentProfessionals: [],
    },
    generatedAt: "2026-08-11T00:00:00.000Z",
    uncertainties: [
      {
        id: "u1",
        title: 'Will the "cache" scale?',
        baseline: "Unknown",
        description: null,
        outcome: "OPEN",
        raisedWeek: "2026-W28",
        resolvedWeek: null,
        chronology: [
          {
            weekKey: "2026-W28",
            evidenceRef: null,
            type: "ATTEMPT",
            body: "Tried a two-tier cache, notes with, a comma",
            minutes: 120,
            submittedAt: "2026-07-13T00:00:00.000Z",
            isRetrospective: false,
            locked: false,
            lockedAt: null,
            amendments: [],
          },
          {
            weekKey: "2026-W29",
            evidenceRef: null,
            type: "FAILED_ATTEMPT",
            body: "Thrashed under load",
            minutes: null,
            submittedAt: "2026-07-20T00:00:00.000Z",
            isRetrospective: true,
            locked: true,
            lockedAt: "2026-08-01T00:00:00.000Z",
            amendments: [{ body: "correction", authorName: "Ada", createdAt: "2026-08-02T00:00:00.000Z" }],
          },
        ],
        totalMinutes: 120,
        derivedCostMinorUnits: null,
      },
    ],
    planRevisions: [],
    variance: [],
    totals: { plannedMinutes: 0, actualMinutes: 120, derivedCostMinorUnits: null },
    integrity: [],
    includesCosts: false,
  };
}

describe("buildClaimPackCsv", () => {
  it("has the expected header", () => {
    const csv = buildClaimPackCsv(buildContent());
    expect(csv.split("\r\n")[0]).toBe(
      "uncertainty,weekKey,type,body,hours,submittedAt,isRetrospective,locked,lockedAt,amendmentCount"
    );
  });

  it("emits one row per chronology entry, across every uncertainty", () => {
    const csv = buildClaimPackCsv(buildContent());
    const lines = csv.split("\r\n");
    expect(lines).toHaveLength(3); // header + 2 entries
  });

  it("quotes a title containing a comma-adjacent quote and a body containing a comma", () => {
    const csv = buildClaimPackCsv(buildContent());
    expect(csv).toContain('"Will the ""cache"" scale?"');
    expect(csv).toContain('"Tried a two-tier cache, notes with, a comma"');
  });

  it("renders hours to 2 decimal places, and an empty string when minutes is null", () => {
    const csv = buildClaimPackCsv(buildContent());
    const rows = csv.split("\r\n").slice(1);
    expect(rows[0]).toContain(",2.00,");
    expect(rows[1].split(",")[4]).toBe(""); // hours column, untagged
  });

  it("reflects locked/retrospective flags and amendment counts", () => {
    const csv = buildClaimPackCsv(buildContent());
    const rows = csv.split("\r\n").slice(1);
    expect(rows[0]).toContain(",false,false,");
    expect(rows[1]).toContain(",true,true,2026-08-01T00:00:00.000Z,1");
  });

  it("produces an empty body (header only) for a project with no uncertainties", () => {
    const content = buildContent();
    content.uncertainties = [];
    const csv = buildClaimPackCsv(content);
    expect(csv.split("\r\n")).toHaveLength(1);
  });
});
