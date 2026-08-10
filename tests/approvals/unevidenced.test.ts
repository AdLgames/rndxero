import { describe, expect, it } from "vitest";
import {
  apportionedAmountMinorUnits,
  summarizeCostEvidence,
  summarizeTimeEvidence,
} from "@/lib/approvals/unevidenced";

describe("summarizeTimeEvidence", () => {
  it("splits total minutes into approved and unevidenced", () => {
    const summary = summarizeTimeEvidence([
      { minutes: 120, approved: true },
      { minutes: 60, approved: false },
      { minutes: 30, approved: false },
    ]);

    expect(summary).toEqual({ totalMinutes: 210, approvedMinutes: 120, unevidencedMinutes: 90 });
  });

  it("handles an empty project (nothing logged yet)", () => {
    expect(summarizeTimeEvidence([])).toEqual({
      totalMinutes: 0,
      approvedMinutes: 0,
      unevidencedMinutes: 0,
    });
  });

  it("shows fully evidenced when everything is approved", () => {
    const summary = summarizeTimeEvidence([{ minutes: 100, approved: true }]);
    expect(summary.unevidencedMinutes).toBe(0);
  });
});

describe("summarizeCostEvidence", () => {
  it("splits apportioned cost into approved and unevidenced", () => {
    const summary = summarizeCostEvidence([
      { apportionedAmountMinorUnits: 50000, approved: true },
      { apportionedAmountMinorUnits: 25000, approved: false },
    ]);

    expect(summary).toEqual({
      totalMinorUnits: 75000,
      approvedMinorUnits: 50000,
      unevidencedMinorUnits: 25000,
    });
  });
});

describe("apportionedAmountMinorUnits", () => {
  it("computes apportioned cost from basis points without floats", () => {
    // 50.00% of £1,234.56
    expect(apportionedAmountMinorUnits(123456, 5000)).toBe(61728);
  });

  it("rounds to the nearest minor unit", () => {
    // 33.33% of £100.00 = 3333.0 pence -> 3333
    expect(apportionedAmountMinorUnits(10000, 3333)).toBe(3333);
  });

  it("handles 100% apportionment as a no-op", () => {
    expect(apportionedAmountMinorUnits(99999, 10000)).toBe(99999);
  });
});
