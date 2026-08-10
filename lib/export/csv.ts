import type { EvidencePackContent } from "@/lib/export/pack";

/** Escapes a CSV field per RFC 4180: quote if it contains a comma, quote, or newline. */
function csvField(value: string | number): string {
  const str = String(value);
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

const HEADER = [
  "category",
  "description",
  "sourceType",
  "sourceReference",
  "amount",
  "currency",
  "apportionmentPercent",
  "apportionedAmount",
  "rationale",
];

/** Minor units (pence) rendered as a decimal string with exactly 2 places. */
function minorUnitsToDecimalString(minorUnits: number): string {
  const negative = minorUnits < 0;
  const abs = Math.abs(minorUnits);
  const whole = Math.floor(abs / 100);
  const fraction = String(abs % 100).padStart(2, "0");
  return `${negative ? "-" : ""}${whole}.${fraction}`;
}

/** Cost detail as CSV — every row traceable back to its Xero or manual-import source. */
export function buildCostDetailCsv(content: EvidencePackContent): string {
  const rows = content.costSummary.map((line) => {
    const sourceReference =
      line.source.type === "xero"
        ? `${line.source.xeroJournalId}/${line.source.xeroJournalLineId}`
        : line.source.filename;

    return [
      line.category ?? "",
      line.description,
      line.source.type,
      sourceReference,
      minorUnitsToDecimalString(line.amountMinorUnits),
      line.currency,
      (line.apportionmentBps / 100).toFixed(2),
      minorUnitsToDecimalString(line.apportionedAmountMinorUnits),
      line.rationale,
    ]
      .map(csvField)
      .join(",");
  });

  return [HEADER.join(","), ...rows].join("\r\n");
}
