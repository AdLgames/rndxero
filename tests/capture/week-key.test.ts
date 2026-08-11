import { describe, expect, it } from "vitest";
import { getIsoWeekKey, getWeekBoundaries, isRetrospective, shiftWeekKey } from "@/lib/capture/week-key";

describe("getIsoWeekKey", () => {
  it("assigns a plain mid-year week, evaluated in Europe/London (August = BST, UTC+1)", () => {
    expect(getIsoWeekKey(new Date("2026-08-10T12:00:00Z"))).toBe("2026-W33"); // Monday
    expect(getIsoWeekKey(new Date("2026-08-12T12:00:00Z"))).toBe("2026-W33"); // Wednesday
    expect(getIsoWeekKey(new Date("2026-08-16T20:00:00Z"))).toBe("2026-W33"); // Sunday 21:00 BST, still this week
    expect(getIsoWeekKey(new Date("2026-08-16T23:30:00Z"))).toBe("2026-W34"); // Monday 00:30 BST, next week already
  });

  it("assigns Jan 1 to week 1 when Jan 1 is itself a Thursday", () => {
    expect(getIsoWeekKey(new Date("2026-01-01T12:00:00Z"))).toBe("2026-W01");
  });

  it("assigns the last days of the calendar year to next year's week 1 when they share that ISO week", () => {
    expect(getIsoWeekKey(new Date("2025-12-31T12:00:00Z"))).toBe("2026-W01");
  });

  it("handles the classic ISO week-53 edge case (2020-12-31 / 2021-01-01)", () => {
    expect(getIsoWeekKey(new Date("2020-12-31T12:00:00Z"))).toBe("2020-W53");
    expect(getIsoWeekKey(new Date("2021-01-01T12:00:00Z"))).toBe("2020-W53");
  });
});

describe("getWeekBoundaries", () => {
  it("returns Monday 00:00 through the following Monday 00:00, both in Europe/London (BST here, UTC+1)", () => {
    const { start, end } = getWeekBoundaries("2026-W33");
    expect(start.toISOString()).toBe("2026-08-09T23:00:00.000Z");
    expect(end.toISOString()).toBe("2026-08-16T23:00:00.000Z");
  });

  it("correctly offsets across the BST-starts transition (clocks forward, last Sunday of March)", () => {
    const { start, end } = getWeekBoundaries("2026-W13"); // Mon 2026-03-23 .. Mon 2026-03-30
    expect(start.toISOString()).toBe("2026-03-23T00:00:00.000Z"); // still GMT
    expect(end.toISOString()).toBe("2026-03-29T23:00:00.000Z"); // already BST
  });

  it("correctly offsets across the BST-ends transition (clocks back, last Sunday of October)", () => {
    const { start, end } = getWeekBoundaries("2026-W43"); // Mon 2026-10-19 .. Mon 2026-10-26
    expect(start.toISOString()).toBe("2026-10-18T23:00:00.000Z"); // still BST
    expect(end.toISOString()).toBe("2026-10-26T00:00:00.000Z"); // already GMT
  });

  it("round-trips through getIsoWeekKey for every day in the week", () => {
    const { start } = getWeekBoundaries("2026-W33");
    for (let i = 0; i < 7; i++) {
      const day = new Date(start.getTime() + i * 86_400_000 + 12 * 3_600_000); // noon-ish each day
      expect(getIsoWeekKey(day)).toBe("2026-W33");
    }
  });

  it("throws on a malformed week key", () => {
    expect(() => getWeekBoundaries("not-a-week-key")).toThrow(/Invalid week key/);
    expect(() => getWeekBoundaries("2026-33")).toThrow(/Invalid week key/);
  });
});

describe("isRetrospective", () => {
  it("is false for a submission made during the week itself", () => {
    expect(isRetrospective(new Date("2026-08-12T10:00:00Z"), "2026-W33")).toBe(false);
  });

  it("is false right up to the week's close instant (23:00 UTC / Monday 00:00 BST)", () => {
    expect(isRetrospective(new Date("2026-08-16T22:59:59.999Z"), "2026-W33")).toBe(false);
  });

  it("is true from the week's close instant onward", () => {
    expect(isRetrospective(new Date("2026-08-16T23:00:00.000Z"), "2026-W33")).toBe(true);
  });

  it("is true for a submission made well after the week closed", () => {
    expect(isRetrospective(new Date("2026-09-01T00:00:00Z"), "2026-W33")).toBe(true);
  });
});

describe("shiftWeekKey", () => {
  it("steps forward and backward within a year", () => {
    expect(shiftWeekKey("2026-W33", 1)).toBe("2026-W34");
    expect(shiftWeekKey("2026-W33", -1)).toBe("2026-W32");
    expect(shiftWeekKey("2026-W33", 0)).toBe("2026-W33");
    expect(shiftWeekKey("2026-W01", 11)).toBe("2026-W12");
  });

  it("rolls over a calendar year boundary", () => {
    expect(shiftWeekKey("2026-W01", -1)).toBe("2025-W52"); // 2025 has no W53
    expect(shiftWeekKey("2025-W52", 1)).toBe("2026-W01");
  });

  it("rolls over a year with a 53rd ISO week", () => {
    expect(shiftWeekKey("2020-W53", 1)).toBe("2021-W01");
    expect(shiftWeekKey("2021-W01", -1)).toBe("2020-W53");
  });

  it("crosses both BST transitions without drifting a day", () => {
    // 2026-W13 (Mon 23 Mar, GMT) forward eight weeks, through the BST-starts
    // transition, should land on the calendar Monday eight weeks later.
    expect(shiftWeekKey("2026-W13", 8)).toBe("2026-W21");
    // 2026-W43 (Mon 19 Oct, BST) forward one week crosses BST-ends.
    expect(shiftWeekKey("2026-W43", 1)).toBe("2026-W44");
  });

  it("is consistent with getWeekBoundaries: the shifted key's Monday is exactly N*7 days after the original", () => {
    const base = getWeekBoundaries("2026-W13").start;
    for (const delta of [1, 4, 12, -1, -4]) {
      const shifted = getWeekBoundaries(shiftWeekKey("2026-W13", delta)).start;
      const days = Math.round((shifted.getTime() - base.getTime()) / 86_400_000);
      expect(days).toBe(delta * 7);
    }
  });
});
