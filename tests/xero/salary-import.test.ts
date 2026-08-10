import { describe, expect, it } from "vitest";
import { parseSalaryCsv } from "@/lib/xero/salary-import";

describe("parseSalaryCsv", () => {
  it("parses valid rows and converts amounts to integer minor units", () => {
    const csv = [
      "personName,periodStart,periodEnd,amount,currency,description",
      "Dave Jones,2025-04-01,2025-04-30,3250.50,GBP,April salary apportionment",
    ].join("\n");

    const { lines, errors } = parseSalaryCsv(csv);

    expect(errors).toHaveLength(0);
    expect(lines).toEqual([
      {
        personName: "Dave Jones",
        periodStart: new Date("2025-04-01"),
        periodEnd: new Date("2025-04-30"),
        amountMinorUnits: 325050,
        currency: "GBP",
        description: "April salary apportionment",
      },
    ]);
  });

  it("defaults currency to GBP when omitted", () => {
    const csv = ["personName,periodStart,periodEnd,amount", "Dave,2025-04-01,2025-04-30,100"].join(
      "\n"
    );
    const { lines } = parseSalaryCsv(csv);
    expect(lines[0].currency).toBe("GBP");
  });

  it("reports a missing required column", () => {
    const csv = ["personName,periodStart,amount", "Dave,2025-04-01,100"].join("\n");
    const { lines, errors } = parseSalaryCsv(csv);
    expect(lines).toHaveLength(0);
    expect(errors[0].message).toMatch(/periodEnd/);
  });

  it("reports an invalid amount without dropping the whole import", () => {
    const csv = [
      "personName,periodStart,periodEnd,amount",
      "Dave,2025-04-01,2025-04-30,not-a-number",
      "Priya,2025-04-01,2025-04-30,200",
    ].join("\n");

    const { lines, errors } = parseSalaryCsv(csv);

    expect(lines).toHaveLength(1);
    expect(lines[0].personName).toBe("Priya");
    expect(errors).toEqual([{ row: 2, message: 'amount "not-a-number" is not a valid decimal' }]);
  });

  it("reports periodEnd before periodStart", () => {
    const csv = [
      "personName,periodStart,periodEnd,amount",
      "Dave,2025-04-30,2025-04-01,100",
    ].join("\n");
    const { errors } = parseSalaryCsv(csv);
    expect(errors[0].message).toMatch(/periodEnd is before periodStart/);
  });

  it("handles an empty CSV", () => {
    const { lines, errors } = parseSalaryCsv("");
    expect(lines).toHaveLength(0);
    expect(errors[0].message).toBe("CSV is empty");
  });
});
