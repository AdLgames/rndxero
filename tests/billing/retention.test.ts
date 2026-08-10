import { describe, expect, it } from "vitest";
import { computeRetentionExpiry, isWithinRetentionWindow } from "@/lib/billing/retention";

describe("computeRetentionExpiry", () => {
  it("adds six years to the accounting period end date", () => {
    const expiry = computeRetentionExpiry(new Date("2026-03-31T00:00:00.000Z"));
    expect(expiry.toISOString()).toBe("2032-03-31T00:00:00.000Z");
  });
});

describe("isWithinRetentionWindow", () => {
  it("is true well before the expiry date", () => {
    const periodEnd = new Date("2026-03-31T00:00:00.000Z");
    expect(isWithinRetentionWindow(periodEnd, new Date("2027-01-01T00:00:00.000Z"))).toBe(true);
  });

  it("is false after the six-year window has passed", () => {
    const periodEnd = new Date("2026-03-31T00:00:00.000Z");
    expect(isWithinRetentionWindow(periodEnd, new Date("2033-01-01T00:00:00.000Z"))).toBe(false);
  });
});
