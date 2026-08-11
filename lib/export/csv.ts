import type { ClaimPackContent } from "@/lib/export/pack";

/** Escapes a CSV field per RFC 4180: quote if it contains a comma, quote, or newline. */
function csvField(value: string | number): string {
  const str = String(value);
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

const HEADER = [
  "uncertainty",
  "weekKey",
  "type",
  "body",
  "hours",
  "submittedAt",
  "isRetrospective",
  "locked",
  "lockedAt",
  "amendmentCount",
];

/**
 * The chronological evidence timeline as CSV — one row per note, across
 * every uncertainty, structured for a spreadsheet rather than the
 * PDF/JSON's narrative grouping (BOARD-PLAN.md Phase 7.4: "PDF plus
 * structured JSON/CSV"). Money is deliberately absent here: derived cost
 * is a per-uncertainty/project total, not a per-note figure, and belongs
 * in the JSON export or PDF roll-up instead of a misleadingly per-row CSV column.
 */
export function buildClaimPackCsv(content: ClaimPackContent): string {
  const rows = content.uncertainties.flatMap((u) =>
    u.chronology.map((entry) =>
      [
        u.title,
        entry.weekKey,
        entry.type,
        entry.body,
        entry.minutes !== null ? (entry.minutes / 60).toFixed(2) : "",
        entry.submittedAt,
        entry.isRetrospective ? "true" : "false",
        entry.locked ? "true" : "false",
        entry.lockedAt ?? "",
        entry.amendments.length,
      ]
        .map(csvField)
        .join(",")
    )
  );

  return [HEADER.join(","), ...rows].join("\r\n");
}
