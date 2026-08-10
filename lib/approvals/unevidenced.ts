/**
 * "Unevidenced" is the product's core value display (PLAN.md Phase 4): the
 * gap between what's been logged and what's actually been reviewed and
 * signed off, shown while there's still time to close it. This module is
 * pure aggregation — callers resolve "is this the current, approved
 * version of this record" beforehand (see lib/approvals/repository.ts).
 */

export interface TimeEvidenceLike {
  minutes: number;
  approved: boolean;
}

export interface TimeEvidenceSummary {
  totalMinutes: number;
  approvedMinutes: number;
  unevidencedMinutes: number;
}

export function summarizeTimeEvidence(entries: TimeEvidenceLike[]): TimeEvidenceSummary {
  const totalMinutes = entries.reduce((sum, e) => sum + e.minutes, 0);
  const approvedMinutes = entries.filter((e) => e.approved).reduce((sum, e) => sum + e.minutes, 0);
  return { totalMinutes, approvedMinutes, unevidencedMinutes: totalMinutes - approvedMinutes };
}

export interface CostEvidenceLike {
  apportionedAmountMinorUnits: number;
  approved: boolean;
}

export interface CostEvidenceSummary {
  totalMinorUnits: number;
  approvedMinorUnits: number;
  unevidencedMinorUnits: number;
}

export function summarizeCostEvidence(entries: CostEvidenceLike[]): CostEvidenceSummary {
  const totalMinorUnits = entries.reduce((sum, e) => sum + e.apportionedAmountMinorUnits, 0);
  const approvedMinorUnits = entries
    .filter((e) => e.approved)
    .reduce((sum, e) => sum + e.apportionedAmountMinorUnits, 0);
  return {
    totalMinorUnits,
    approvedMinorUnits,
    unevidencedMinorUnits: totalMinorUnits - approvedMinorUnits,
  };
}

/** Apportioned cost, computed from stored basis points — never a float. */
export function apportionedAmountMinorUnits(amountMinorUnits: number, apportionmentBps: number): number {
  return Math.round((amountMinorUnits * apportionmentBps) / 10_000);
}
