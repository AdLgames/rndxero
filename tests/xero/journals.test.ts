import { describe, expect, it, vi } from "vitest";
import { fetchJournalsPage, mapJournalsToMirrorLines, parseXeroDate } from "@/lib/xero/journals";

describe("parseXeroDate", () => {
  it("parses the .NET JSON date format", () => {
    const parsed = parseXeroDate("/Date(1701388800000+0000)/");
    expect(parsed?.toISOString()).toBe("2023-12-01T00:00:00.000Z");
  });

  it("returns null for a non-matching string", () => {
    expect(parseXeroDate("2023-12-01")).toBeNull();
  });
});

describe("mapJournalsToMirrorLines", () => {
  it("flattens journal lines, converts amounts to minor units, and tags a cost category", () => {
    const lines = mapJournalsToMirrorLines("company-1", [
      {
        JournalID: "journal-1",
        JournalNumber: 42,
        JournalDate: "/Date(1701388800000+0000)/",
        SourceType: "ACCPAY",
        JournalLines: [
          {
            JournalLineID: "line-1",
            AccountCode: "477",
            AccountName: "Salaries and Wages",
            NetAmount: 1234.56,
            TrackingCategories: [{ Name: "Department", Option: "Engineering" }],
          },
          {
            JournalLineID: "line-2",
            AccountCode: "500",
            AccountName: "Office Rent",
            NetAmount: 500,
          },
        ],
      },
    ]);

    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatchObject({
      xeroJournalLineId: "line-1",
      accountName: "Salaries and Wages",
      netAmountMinor: 123456,
      trackingCategory: "Department",
      trackingOption: "Engineering",
      costCategory: "staff_costs",
    });
    expect(lines[1].costCategory).toBeNull();
    expect(lines[1].trackingCategory).toBeNull();
  });
});

describe("fetchJournalsPage", () => {
  it("requests the offset-paginated endpoint with tenant + bearer headers", async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ Journals: [] }), { status: 200 })
    );

    await fetchJournalsPage(
      { tenantId: "tenant-1", accessToken: "token-1", offsetJournalNumber: 99 },
      fetchFn
    );

    expect(fetchFn).toHaveBeenCalledWith(
      "https://api.xero.com/api.xro/2.0/Journals?offset=99",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer token-1",
          "xero-tenant-id": "tenant-1",
        }),
      })
    );
  });

  it("throws on a non-ok, non-429 response", async () => {
    const fetchFn = vi.fn().mockResolvedValue(new Response("error", { status: 500 }));

    await expect(
      fetchJournalsPage({ tenantId: "t", accessToken: "a", offsetJournalNumber: 0 }, fetchFn)
    ).rejects.toThrow(/500/);
  });
});
