/**
 * Evidence-quality signals for a logged week — not a claim value and not
 * a decision about R&D qualification. These read the same data the
 * export/claim pack already draws on and turn it into a glanceable
 * "is this week backed up" signal, so gaps get closed before a week
 * locks rather than discovered later during review.
 */

export interface ReadinessNote {
  body: string;
  evidenceRef?: string | null;
}

/** A minimal body length so a one-word placeholder doesn't count as a narrative. */
const MIN_NARRATIVE_LENGTH = 15;

export function hasNarrative(note: ReadinessNote): boolean {
  return note.body.trim().length >= MIN_NARRATIVE_LENGTH;
}

export function hasEvidenceLink(note: ReadinessNote): boolean {
  return (note.evidenceRef?.trim().length ?? 0) > 0;
}

export function isNoteBacked(note: ReadinessNote): boolean {
  return hasNarrative(note) && hasEvidenceLink(note);
}

/** Percentage (0-100) of notes that are fully backed — narrative and evidence link both present. */
export function readinessScore(notes: ReadinessNote[]): number {
  if (notes.length === 0) return 0;
  const backed = notes.filter(isNoteBacked).length;
  return Math.round((backed / notes.length) * 100);
}

export type WeekComplianceStatus = "green" | "amber" | "red";

export interface SubmittedWeekComplianceInput {
  submitted: true;
  minutes: number;
  notes: ReadinessNote[];
}

export interface UnsubmittedWeekComplianceInput {
  submitted: false;
  /** Days remaining before this week auto-locks (BOARD-PLAN.md: close + 7 days). Negative once it's overdue. */
  daysUntilAutoLock: number;
}

export type WeekComplianceInput = SubmittedWeekComplianceInput | UnsubmittedWeekComplianceInput;

const APPROACHING_DEADLINE_DAYS = 3;

/**
 * green  — hours logged, and every note has both a narrative and a linked
 *          piece of evidence.
 * amber  — hours logged, but at least one note is missing its narrative
 *          or its evidence link (or no notes were left at all).
 * red    — nothing submitted yet and the week is close to (or past) its
 *          auto-lock deadline.
 *
 * An unsubmitted week that isn't close to its deadline yet has no badge
 * at all — the caller should treat `null` as "no signal", not amber.
 */
export function weekComplianceStatus(input: WeekComplianceInput): WeekComplianceStatus | null {
  if (!input.submitted) {
    return input.daysUntilAutoLock <= APPROACHING_DEADLINE_DAYS ? "red" : null;
  }
  if (input.minutes === 0) return "green"; // an explicit "nothing this week" is a confirmed, backed state
  if (input.notes.length === 0) return "amber";
  return input.notes.every(isNoteBacked) ? "green" : "amber";
}
