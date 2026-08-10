import { classifyRnDCostCategory } from "@/lib/xero/cost-categories";
import { withXeroRateLimitRetry } from "@/lib/xero/rate-limit";

const XERO_API_BASE = "https://api.xero.com/api.xro/2.0";

/**
 * Xero's Accounting API still serialises dates as the .NET JSON date
 * format (`/Date(1701388800000+0000)/`) even in otherwise-modern JSON
 * responses. This parses that format; returns null if the string doesn't
 * match, so callers can fall back to `new Date(value)` for endpoints that
 * do return ISO strings.
 */
export function parseXeroDate(value: string): Date | null {
  const match = /\/Date\((\d+)([+-]\d{4})?\)\//.exec(value);
  if (!match) return null;
  return new Date(Number(match[1]));
}

export interface XeroJournalLineRaw {
  JournalLineID: string;
  AccountCode?: string;
  AccountName: string;
  Description?: string;
  NetAmount: number;
  TrackingCategories?: Array<{ Name: string; Option: string }>;
}

export interface XeroJournalRaw {
  JournalID: string;
  JournalNumber: number;
  JournalDate: string;
  SourceType: string;
  JournalLines: XeroJournalLineRaw[];
}

export interface XeroJournalsResponse {
  Journals: XeroJournalRaw[];
}

export interface MirroredJournalLine {
  companyId: string;
  xeroJournalId: string;
  xeroJournalLineId: string;
  journalDate: Date;
  accountCode: string;
  accountName: string;
  description: string | null;
  /** Rounded to the nearest minor unit (penny) — never a float downstream. */
  netAmountMinor: number;
  trackingCategory: string | null;
  trackingOption: string | null;
  sourceType: string;
  costCategory: ReturnType<typeof classifyRnDCostCategory>;
}

/** Flattens a page of Xero journals into mirror rows, tagging each line with a suggested cost category. */
export function mapJournalsToMirrorLines(
  companyId: string,
  journals: XeroJournalRaw[]
): MirroredJournalLine[] {
  const lines: MirroredJournalLine[] = [];
  for (const journal of journals) {
    const journalDate = parseXeroDate(journal.JournalDate) ?? new Date(journal.JournalDate);
    for (const line of journal.JournalLines) {
      const tracking = line.TrackingCategories?.[0];
      lines.push({
        companyId,
        xeroJournalId: journal.JournalID,
        xeroJournalLineId: line.JournalLineID,
        journalDate,
        accountCode: line.AccountCode ?? "",
        accountName: line.AccountName,
        description: line.Description ?? null,
        netAmountMinor: Math.round(line.NetAmount * 100),
        trackingCategory: tracking?.Name ?? null,
        trackingOption: tracking?.Option ?? null,
        sourceType: journal.SourceType,
        costCategory: classifyRnDCostCategory(line.AccountName),
      });
    }
  }
  return lines;
}

export interface FetchJournalsPageParams {
  tenantId: string;
  accessToken: string;
  /** The last JournalNumber already synced; Xero returns journals after this. */
  offsetJournalNumber: number;
}

export type FetchFn = typeof fetch;

/**
 * Fetches one page (up to 100 records) from Xero's /Journals endpoint,
 * using offset pagination on JournalNumber as PLAN.md Phase 3 specifies
 * (deliberately not the Trial Balance report endpoint, which can omit
 * tracking category detail). Retries on 429 honouring Retry-After.
 */
export async function fetchJournalsPage(
  params: FetchJournalsPageParams,
  fetchFn: FetchFn = fetch
): Promise<XeroJournalsResponse> {
  const url = `${XERO_API_BASE}/Journals?offset=${params.offsetJournalNumber}`;
  const response = await withXeroRateLimitRetry(() =>
    fetchFn(url, {
      headers: {
        Authorization: `Bearer ${params.accessToken}`,
        "xero-tenant-id": params.tenantId,
        Accept: "application/json",
      },
    })
  );
  if (!response.ok) {
    throw new Error(`Xero /Journals request failed: ${response.status} ${response.statusText}`);
  }
  return (await response.json()) as XeroJournalsResponse;
}
