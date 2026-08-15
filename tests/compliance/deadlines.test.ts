import { describe, expect, it } from "vitest";
import { claimNotificationDeadline, daysUntil } from "@/lib/compliance/deadlines";

describe("claimNotificationDeadline", () => {
  it("adds six months to the period end date", () => {
    const deadline = claimNotificationDeadline(new Date("2026-03-31T00:00:00.000Z"));
    expect(deadline.toISOString().slice(0, 10)).toBe("2026-09-30");
  });

  it("handles a year rollover", () => {
    const deadline = claimNotificationDeadline(new Date("2026-12-31T00:00:00.000Z"));
    expect(deadline.toISOString().slice(0, 10)).toBe("2027-06-30");
  });
});

describe("daysUntil", () => {
  it("is positive for a future date", () => {
    const now = new Date("2026-01-01T00:00:00.000Z");
    const future = new Date("2026-01-11T00:00:00.000Z");
    expect(daysUntil(future, now)).toBe(10);
  });

  it("is negative for a past date", () => {
    const now = new Date("2026-01-11T00:00:00.000Z");
    const past = new Date("2026-01-01T00:00:00.000Z");
    expect(daysUntil(past, now)).toBe(-10);
  });

  it("is zero for the same instant", () => {
    const now = new Date("2026-01-01T00:00:00.000Z");
    expect(daysUntil(now, now)).toBe(0);
  });
});
