import { describe, expect, it } from "vitest";
import { renderClaimPackPdf } from "@/lib/export/pdf";
import type { ClaimPackContent } from "@/lib/export/pack";

function buildContent(overrides: Partial<ClaimPackContent> = {}): ClaimPackContent {
  return {
    project: {
      id: "p1",
      name: "Widget Engine",
      description: "A widget-manufacturing engine",
      startDate: "2026-01-01T00:00:00.000Z",
      endDate: null,
      status: "ACTIVE",
      competentProfessionals: ["Dr. Ada Lovelace"],
    },
    generatedAt: "2026-08-11T00:00:00.000Z",
    uncertainties: [
      {
        id: "u1",
        title: "Will the cache scale?",
        baseline: "Unknown at 10x load",
        description: null,
        outcome: "RESOLVED",
        raisedWeek: "2026-W28",
        resolvedWeek: "2026-W31",
        chronology: [
          {
            weekKey: "2026-W29",
            type: "FAILED_ATTEMPT",
            body: "LRU thrashed under load",
            minutes: 300,
            submittedAt: "2026-07-20T00:00:00.000Z",
            isRetrospective: false,
            locked: true,
            lockedAt: "2026-08-01T00:00:00.000Z",
            amendments: [{ body: "Clarified: eviction policy specifically", authorName: "Ada", createdAt: "2026-08-02T00:00:00.000Z" }],
          },
        ],
        totalMinutes: 300,
        derivedCostMinorUnits: 30000,
      },
    ],
    planRevisions: [
      { versionNumber: 1, note: null, createdAt: "2026-07-01T00:00:00.000Z", createdByName: "Ada", supersededAt: null, totalPlannedMinutes: 480 },
    ],
    variance: [{ uncertaintyTitle: "Will the cache scale?", weekKey: "2026-W29", plannedMinutes: 480, actualMinutes: 300, varianceMinutes: -180 }],
    totals: { plannedMinutes: 480, actualMinutes: 300, derivedCostMinorUnits: 30000 },
    integrity: [
      {
        weekKey: "2026-W29",
        userName: "Eddie Eng",
        minutes: 300,
        basis: "TRACKED",
        submittedAt: "2026-07-20T00:00:00.000Z",
        isRetrospective: false,
        lockedAt: "2026-08-01T00:00:00.000Z",
        amendments: [],
      },
    ],
    includesCosts: true,
    ...overrides,
  };
}

describe("renderClaimPackPdf", () => {
  it("renders a well-formed PDF buffer", async () => {
    const pdf = await renderClaimPackPdf(buildContent());
    expect(Buffer.isBuffer(pdf)).toBe(true);
    expect(pdf.subarray(0, 5).toString("ascii")).toBe("%PDF-");
    expect(pdf.length).toBeGreaterThan(500);
  });

  it("renders an empty project without throwing", async () => {
    const content = buildContent({ uncertainties: [], planRevisions: [], variance: [], integrity: [], includesCosts: false, totals: { plannedMinutes: 0, actualMinutes: 0, derivedCostMinorUnits: null } });
    const pdf = await renderClaimPackPdf(content);
    expect(pdf.subarray(0, 5).toString("ascii")).toBe("%PDF-");
  });

  it("renders without costs when includesCosts is false", async () => {
    const content = buildContent({
      includesCosts: false,
      totals: { plannedMinutes: 480, actualMinutes: 300, derivedCostMinorUnits: null },
      uncertainties: [{ ...buildContent().uncertainties[0], derivedCostMinorUnits: null }],
    });
    const pdf = await renderClaimPackPdf(content);
    expect(pdf.subarray(0, 5).toString("ascii")).toBe("%PDF-");
  });

  it("handles a project with many uncertainties spanning multiple pages without throwing", async () => {
    const base = buildContent();
    const content = buildContent({
      uncertainties: Array.from({ length: 40 }, (_, i) => ({
        ...base.uncertainties[0],
        id: `u${i}`,
        title: `Uncertainty ${i}`,
      })),
    });
    const pdf = await renderClaimPackPdf(content);
    expect(pdf.subarray(0, 5).toString("ascii")).toBe("%PDF-");
    expect(pdf.length).toBeGreaterThan(5000);
  });
});
