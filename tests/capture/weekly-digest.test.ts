import { describe, expect, it } from "vitest";
import {
  buildWeekWindow,
  buildWeeklyDigest,
  confirmCandidate,
  mapGithubCommitsToCandidate,
  type DigestCandidate,
} from "@/lib/capture/weekly-digest";

describe("buildWeekWindow", () => {
  it("resolves to Monday..next Monday for a mid-week date", () => {
    // Wednesday 2026-08-12
    const { weekStart, weekEnd } = buildWeekWindow(new Date("2026-08-12T15:00:00.000Z"));
    expect(weekStart.toISOString()).toBe("2026-08-10T00:00:00.000Z");
    expect(weekEnd.toISOString()).toBe("2026-08-17T00:00:00.000Z");
  });

  it("treats Sunday as the end of its own week, not the start of the next", () => {
    const { weekStart, weekEnd } = buildWeekWindow(new Date("2026-08-16T12:00:00.000Z"));
    expect(weekStart.toISOString()).toBe("2026-08-10T00:00:00.000Z");
    expect(weekEnd.toISOString()).toBe("2026-08-17T00:00:00.000Z");
  });

  it("is idempotent for a Monday", () => {
    const { weekStart } = buildWeekWindow(new Date("2026-08-10T00:00:00.000Z"));
    expect(weekStart.toISOString()).toBe("2026-08-10T00:00:00.000Z");
  });
});

describe("buildWeeklyDigest", () => {
  it("sorts candidates by suggested minutes, descending", () => {
    const candidates: DigestCandidate[] = [
      { projectId: "p1", projectName: "Low", suggestedMinutes: 30, source: "manual", note: null },
      { projectId: "p2", projectName: "High", suggestedMinutes: 180, source: "github", note: null },
    ];

    const digest = buildWeeklyDigest("person-1", new Date("2026-08-12"), candidates);

    expect(digest.candidates.map((c) => c.projectName)).toEqual(["High", "Low"]);
  });
});

describe("mapGithubCommitsToCandidate", () => {
  it("weights minutes by commit count and caps at a working day", () => {
    const commits = Array.from({ length: 3 }, (_, i) => ({
      message: `commit ${i}`,
      authoredAt: new Date(),
    }));

    const candidate = mapGithubCommitsToCandidate("project-1", "ClaimTrail", commits);

    expect(candidate.suggestedMinutes).toBe(90);
    expect(candidate.source).toBe("github");
    expect(candidate.note).toContain("3 commits");
  });

  it("caps suggested minutes at a working day even with many commits", () => {
    const commits = Array.from({ length: 100 }, (_, i) => ({
      message: `commit ${i}`,
      authoredAt: new Date(),
    }));

    const candidate = mapGithubCommitsToCandidate("project-1", "ClaimTrail", commits);

    expect(candidate.suggestedMinutes).toBe(360);
  });

  it("returns a null note and zero minutes with no commits", () => {
    const candidate = mapGithubCommitsToCandidate("project-1", "ClaimTrail", []);
    expect(candidate.suggestedMinutes).toBe(0);
    expect(candidate.note).toBeNull();
  });
});

describe("confirmCandidate", () => {
  it("passes through a valid confirmation", () => {
    expect(confirmCandidate({ minutes: 120, basis: "SAMPLED" })).toEqual({
      minutes: 120,
      basis: "SAMPLED",
    });
  });

  it("rejects negative minutes", () => {
    expect(() => confirmCandidate({ minutes: -1, basis: "ESTIMATED" })).toThrow(/negative/);
  });
});
