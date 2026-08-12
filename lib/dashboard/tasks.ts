/**
 * Turns already-fetched counts into the Home dashboard's "what to do
 * next" list — pure and unit-tested like lib/compliance/readiness.ts,
 * no framework coupling or DB access here. The page assembles the raw
 * counts (unlogged projects, notes missing evidence, unlocked settled
 * weeks, pending GitHub suggestions) and this just decides which of
 * those are worth surfacing, and in what order.
 */

export type NextActionKind = "log_week" | "add_evidence" | "lock_weeks" | "review_suggestions";

export interface NextAction {
  kind: NextActionKind;
  title: string;
  description: string;
  href: string;
  count: number;
}

export interface UnloggedProject {
  projectId: string;
  projectName: string;
}

export interface BuildNextActionsInput {
  weekKey: string;
  /** Days remaining before the current week auto-locks — negative once overdue. */
  daysUntilAutoLock: number;
  /** Active projects this person can log time against but hasn't touched this week. */
  unloggedProjects: UnloggedProject[];
  /** This year's notes (excluding NO_PROGRESS) missing a narrative or an evidence link. */
  amberNoteCount: number;
  /** Submitted, unlocked weeks from a prior (closed) week — only non-zero for Owner/Finance. */
  unlockedSubmissionCount: number;
  /** Pending GitHub suggestions across projects this person can review. */
  pendingSuggestionCount: number;
}

const APPROACHING_DEADLINE_DAYS = 3;

function pluralize(count: number, singular: string, plural: string): string {
  return count === 1 ? singular : plural;
}

/** Ordered by urgency: your own unfinished week first, then evidence gaps, then reviewer/finance duties. */
export function buildNextActions(input: BuildNextActionsInput): NextAction[] {
  const actions: NextAction[] = [];

  if (input.unloggedProjects.length > 0) {
    const count = input.unloggedProjects.length;
    const closing = input.daysUntilAutoLock <= APPROACHING_DEADLINE_DAYS;
    actions.push({
      kind: "log_week",
      title: `Log week ${input.weekKey}`,
      description: `${count} ${pluralize(count, "project", "projects")} still ${pluralize(count, "needs", "need")} this week logged${
        closing ? " — closing soon" : ""
      }: ${input.unloggedProjects.map((p) => p.projectName).join(", ")}.`,
      href: "/capture",
      count,
    });
  }

  if (input.amberNoteCount > 0) {
    const count = input.amberNoteCount;
    actions.push({
      kind: "add_evidence",
      title: "Add missing evidence",
      description: `${count} logged ${pluralize(count, "note", "notes")} this year ${pluralize(
        count,
        "is",
        "are"
      )} missing a narrative or a linked piece of evidence.`,
      href: "/capture",
      count,
    });
  }

  if (input.unlockedSubmissionCount > 0) {
    const count = input.unlockedSubmissionCount;
    actions.push({
      kind: "lock_weeks",
      title: "Lock settled weeks",
      description: `${count} submitted ${pluralize(count, "week", "weeks")} from before this week ${pluralize(
        count,
        "is",
        "are"
      )} still open — review and lock ${pluralize(count, "it", "them")}.`,
      href: "/finance",
      count,
    });
  }

  if (input.pendingSuggestionCount > 0) {
    const count = input.pendingSuggestionCount;
    actions.push({
      kind: "review_suggestions",
      title: "Review GitHub suggestions",
      description: `${count} commit-based ${pluralize(count, "suggestion", "suggestions")} ${pluralize(
        count,
        "is",
        "are"
      )} waiting for confirmation.`,
      href: "/github",
      count,
    });
  }

  return actions;
}
