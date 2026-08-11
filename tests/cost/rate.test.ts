import { describe, expect, it } from "vitest";
import { findApplicableRate } from "@/lib/cost/rate";
import type { Rate } from "@/lib/generated/prisma/client";

function rate(overrides: Partial<Rate>): Rate {
  return {
    id: "r1",
    companyId: "c1",
    userId: "u1",
    hourlyRateMinorUnits: 5000,
    effectiveFrom: new Date("2026-01-01"),
    effectiveTo: null,
    createdAt: new Date("2026-01-01"),
    ...overrides,
  };
}

describe("findApplicableRate", () => {
  it("returns undefined when no rate exists for the user", () => {
    expect(findApplicableRate([], "u1", new Date("2026-06-01"))).toBeUndefined();
  });

  it("returns undefined when the date is before effectiveFrom", () => {
    const rates = [rate({ effectiveFrom: new Date("2026-06-01") })];
    expect(findApplicableRate(rates, "u1", new Date("2026-01-01"))).toBeUndefined();
  });

  it("returns undefined once the date reaches effectiveTo (exclusive)", () => {
    const rates = [rate({ effectiveFrom: new Date("2026-01-01"), effectiveTo: new Date("2026-06-01") })];
    expect(findApplicableRate(rates, "u1", new Date("2026-06-01"))).toBeUndefined();
    expect(findApplicableRate(rates, "u1", new Date("2026-05-31"))).toBeDefined();
  });

  it("ignores rates for other users", () => {
    const rates = [rate({ userId: "someone-else" })];
    expect(findApplicableRate(rates, "u1", new Date("2026-06-01"))).toBeUndefined();
  });

  it("picks the most recently started rate when more than one covers the date", () => {
    const rates = [
      rate({ id: "old", hourlyRateMinorUnits: 4000, effectiveFrom: new Date("2025-01-01") }),
      rate({ id: "new", hourlyRateMinorUnits: 8000, effectiveFrom: new Date("2026-01-01") }),
    ];
    const applicable = findApplicableRate(rates, "u1", new Date("2026-06-01"));
    expect(applicable?.id).toBe("new");
  });

  it("has no effectiveTo means still open-ended", () => {
    const rates = [rate({ effectiveFrom: new Date("2026-01-01"), effectiveTo: null })];
    expect(findApplicableRate(rates, "u1", new Date("2030-01-01"))).toBeDefined();
  });
});
