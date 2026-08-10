import { describe, expect, it } from "vitest";
import { classifyRnDCostCategory } from "@/lib/xero/cost-categories";

describe("classifyRnDCostCategory", () => {
  it.each([
    ["Salaries and Wages", "staff_costs"],
    ["Employer NI", "staff_costs"],
    ["Subcontractor Costs", "subcontractor_external_worker"],
    ["Freelance Design", "subcontractor_external_worker"],
    ["Software Subscriptions", "software"],
    ["AWS Hosting", "data_cloud"],
    ["Google Cloud Platform", "data_cloud"],
    ["Prototype Materials", "consumables"],
  ] as const)("classifies %s as %s", (accountName, expected) => {
    expect(classifyRnDCostCategory(accountName)).toBe(expected);
  });

  it("returns null for an unrelated account", () => {
    expect(classifyRnDCostCategory("Office Rent")).toBeNull();
  });

  it("is case-insensitive", () => {
    expect(classifyRnDCostCategory("SALARIES")).toBe("staff_costs");
  });
});
