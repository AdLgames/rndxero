/**
 * The evidence pack — PLAN.md Phase 5. This is the canonical shape both
 * the PDF and the CSV are rendered from, and it is exactly what gets
 * hashed for a PeriodSnapshot (lib/evidence/snapshot.ts). Every figure in
 * it must be traceable back to a specific source record — nothing here
 * is computed opinion, only assembled fact.
 *
 * `generatedAt` deliberately lives outside this type: it changes on every
 * render and must never be part of what gets hashed, or "regenerating a
 * snapshotted period produces an identical hash" (Phase 5 checklist)
 * would be impossible by construction.
 */

export interface PackProject {
  id: string;
  name: string;
  startDate: string;
  endDate: string | null;
  status: string;
  competentProfessionals: string[];
}

export interface PackAccountingPeriod {
  id: string;
  label: string;
  startDate: string;
  endDate: string;
}

export interface PackEvidenceEntry {
  id: string;
  type: string;
  body: string;
  authorName: string;
  createdAt: string;
  supersedes: string | null;
}

export interface PackTimeSummaryRow {
  personName: string;
  totalMinutes: number;
  basisBreakdownMinutes: Record<string, number>;
}

export interface PackCostLine {
  id: string;
  category: string | null;
  description: string;
  /** Where this line traces back to in Xero, or the manual import filename. */
  source:
    | { type: "xero"; xeroJournalId: string; xeroJournalLineId: string }
    | { type: "manual_import"; filename: string };
  amountMinorUnits: number;
  currency: string;
  apportionmentBps: number;
  apportionedAmountMinorUnits: number;
  rationale: string;
}

export interface PackApprovalRow {
  targetType: string;
  targetId: string;
  decision: string;
  approverName: string;
  createdAt: string;
  comment: string | null;
}

export interface EvidencePackContent {
  project: PackProject;
  accountingPeriod: PackAccountingPeriod;
  evidenceTimeline: PackEvidenceEntry[];
  timeSummary: PackTimeSummaryRow[];
  costSummary: PackCostLine[];
  approvalHistory: PackApprovalRow[];
}

/**
 * Assembles the pack content from already-resolved rows. This function is
 * pure and does no ordering/grouping decisions beyond what's specified:
 * evidence chronological, time grouped by person, cost grouped by
 * category-then-line.
 */
export function assemblePackContent(input: {
  project: PackProject;
  accountingPeriod: PackAccountingPeriod;
  evidenceEntries: PackEvidenceEntry[];
  timeEntries: Array<{ personName: string; minutes: number; basis: string }>;
  costLines: PackCostLine[];
  approvals: PackApprovalRow[];
}): EvidencePackContent {
  const evidenceTimeline = [...input.evidenceEntries].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  const timeByPerson = new Map<string, PackTimeSummaryRow>();
  for (const entry of input.timeEntries) {
    const row = timeByPerson.get(entry.personName) ?? {
      personName: entry.personName,
      totalMinutes: 0,
      basisBreakdownMinutes: {},
    };
    row.totalMinutes += entry.minutes;
    row.basisBreakdownMinutes[entry.basis] = (row.basisBreakdownMinutes[entry.basis] ?? 0) + entry.minutes;
    timeByPerson.set(entry.personName, row);
  }
  const timeSummary = [...timeByPerson.values()].sort((a, b) => a.personName.localeCompare(b.personName));

  const costSummary = [...input.costLines].sort((a, b) => {
    const categoryCompare = (a.category ?? "").localeCompare(b.category ?? "");
    return categoryCompare !== 0 ? categoryCompare : a.id.localeCompare(b.id);
  });

  const approvalHistory = [...input.approvals].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  return {
    project: input.project,
    accountingPeriod: input.accountingPeriod,
    evidenceTimeline,
    timeSummary,
    costSummary,
    approvalHistory,
  };
}
