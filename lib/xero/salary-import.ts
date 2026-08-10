/**
 * Manual salary/cost CSV import — the reliable primary path for staff
 * costs (PLAN.md Phase 3 §5). Xero Payroll API access is restricted and
 * region-dependent, so this product must not depend on it; CSV import
 * works regardless of what payroll product (or none) a company uses.
 *
 * Expected columns: personName, periodStart, periodEnd, amount, currency,
 * description. `amount` is a decimal string in major units (e.g. "3250.00")
 * and is converted to integer minor units here — money never travels as a
 * float past this boundary.
 */

export interface ParsedSalaryLine {
  personName: string;
  periodStart: Date;
  periodEnd: Date;
  amountMinorUnits: number;
  currency: string;
  description: string | null;
}

export interface SalaryCsvRowError {
  row: number;
  message: string;
}

export interface ParseSalaryCsvResult {
  lines: ParsedSalaryLine[];
  errors: SalaryCsvRowError[];
}

const REQUIRED_COLUMNS = ["personName", "periodStart", "periodEnd", "amount"] as const;

function parseCsvLine(line: string): string[] {
  return line.split(",").map((cell) => cell.trim().replace(/^"|"$/g, ""));
}

function parseAmountToMinorUnits(raw: string): number | null {
  if (!/^-?\d+(\.\d{1,2})?$/.test(raw)) return null;
  const [whole, fraction = ""] = raw.split(".");
  const paddedFraction = fraction.padEnd(2, "0");
  return Number(whole) * 100 + Number(paddedFraction) * (whole.startsWith("-") ? -1 : 1);
}

function parseDate(raw: string): Date | null {
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function parseSalaryCsv(csvText: string): ParseSalaryCsvResult {
  const rows = csvText.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (rows.length === 0) {
    return { lines: [], errors: [{ row: 0, message: "CSV is empty" }] };
  }

  const header = parseCsvLine(rows[0]);
  const missing = REQUIRED_COLUMNS.filter((col) => !header.includes(col));
  if (missing.length > 0) {
    return {
      lines: [],
      errors: [{ row: 0, message: `Missing required column(s): ${missing.join(", ")}` }],
    };
  }

  const lines: ParsedSalaryLine[] = [];
  const errors: SalaryCsvRowError[] = [];

  for (let i = 1; i < rows.length; i++) {
    const rowNumber = i + 1;
    const cells = parseCsvLine(rows[i]);
    const record = Object.fromEntries(header.map((col, idx) => [col, cells[idx] ?? ""]));

    const personName = record.personName?.trim();
    if (!personName) {
      errors.push({ row: rowNumber, message: "personName is required" });
      continue;
    }

    const periodStart = parseDate(record.periodStart);
    const periodEnd = parseDate(record.periodEnd);
    if (!periodStart || !periodEnd) {
      errors.push({ row: rowNumber, message: "periodStart/periodEnd must be valid dates" });
      continue;
    }
    if (periodEnd < periodStart) {
      errors.push({ row: rowNumber, message: "periodEnd is before periodStart" });
      continue;
    }

    const amountMinorUnits = parseAmountToMinorUnits(record.amount);
    if (amountMinorUnits === null) {
      errors.push({ row: rowNumber, message: `amount "${record.amount}" is not a valid decimal` });
      continue;
    }

    lines.push({
      personName,
      periodStart,
      periodEnd,
      amountMinorUnits,
      currency: record.currency?.trim() || "GBP",
      description: record.description?.trim() || null,
    });
  }

  return { lines, errors };
}
