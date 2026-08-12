import { describe, expect, it } from "vitest";
import { hasEvidenceLink, hasNarrative, isNoteBacked, readinessScore, weekComplianceStatus } from "@/lib/compliance/readiness";

describe("hasNarrative", () => {
  it("rejects an empty or trivial body", () => {
    expect(hasNarrative({ body: "" })).toBe(false);
    expect(hasNarrative({ body: "done" })).toBe(false);
  });

  it("accepts a real narrative", () => {
    expect(hasNarrative({ body: "Debugging asynchronous memory leak in the core API." })).toBe(true);
  });
});

describe("hasEvidenceLink", () => {
  it("rejects a missing or blank evidenceRef", () => {
    expect(hasEvidenceLink({ body: "x", evidenceRef: null })).toBe(false);
    expect(hasEvidenceLink({ body: "x", evidenceRef: "  " })).toBe(false);
    expect(hasEvidenceLink({ body: "x" })).toBe(false);
  });

  it("accepts a non-blank evidenceRef", () => {
    expect(hasEvidenceLink({ body: "x", evidenceRef: "https://github.com/acme/repo/commit/abc" })).toBe(true);
  });
});

describe("isNoteBacked", () => {
  it("requires both a narrative and an evidence link", () => {
    expect(isNoteBacked({ body: "Debugging the caching layer under load.", evidenceRef: "PROJ-123" })).toBe(true);
    expect(isNoteBacked({ body: "Debugging the caching layer under load." })).toBe(false);
    expect(isNoteBacked({ body: "done", evidenceRef: "PROJ-123" })).toBe(false);
  });
});

describe("readinessScore", () => {
  it("is 0 for no notes", () => {
    expect(readinessScore([])).toBe(0);
  });

  it("is the percentage of backed notes, rounded", () => {
    const notes = [
      { body: "Debugged the caching layer under concurrent writes.", evidenceRef: "PR#12" },
      { body: "Debugged the caching layer under concurrent writes.", evidenceRef: "PR#13" },
      { body: "no evidence here", evidenceRef: null },
    ];
    expect(readinessScore(notes)).toBe(67);
  });
});

describe("weekComplianceStatus", () => {
  it("is green for an explicit nothing-this-week submission", () => {
    expect(weekComplianceStatus({ submitted: true, minutes: 0, notes: [] })).toBe("green");
  });

  it("is amber when hours are logged with no notes at all", () => {
    expect(weekComplianceStatus({ submitted: true, minutes: 300, notes: [] })).toBe("amber");
  });

  it("is amber when a note is missing its narrative or evidence link", () => {
    expect(
      weekComplianceStatus({
        submitted: true,
        minutes: 300,
        notes: [{ body: "Debugged the caching layer under concurrent writes.", evidenceRef: null }],
      })
    ).toBe("amber");
  });

  it("is green when every note is fully backed", () => {
    expect(
      weekComplianceStatus({
        submitted: true,
        minutes: 300,
        notes: [{ body: "Debugged the caching layer under concurrent writes.", evidenceRef: "PR#12" }],
      })
    ).toBe("green");
  });

  it("is red when unsubmitted and close to the auto-lock deadline", () => {
    expect(weekComplianceStatus({ submitted: false, daysUntilAutoLock: 2 })).toBe("red");
    expect(weekComplianceStatus({ submitted: false, daysUntilAutoLock: -1 })).toBe("red");
  });

  it("is null when unsubmitted but not yet close to the deadline", () => {
    expect(weekComplianceStatus({ submitted: false, daysUntilAutoLock: 6 })).toBeNull();
  });
});
