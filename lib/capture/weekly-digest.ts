/**
 * "Confirm, don't create" weekly digest for engineers (PLAN.md Phase 4).
 * The product's adoption bet is that nobody opens this app unprompted, so
 * the digest is built from signals that already exist (e.g. commits) and
 * a person just confirms or corrects it — manual entry from a blank page
 * is the fallback, never the primary flow.
 *
 * Everything here is a *suggestion*. Nothing in this module writes a
 * TimeEntry; see lib/time/repository.ts for that, and note it always
 * requires an explicit basis from the confirming human — this module
 * never invents one.
 */

export type DigestSource = "github" | "manual";

export interface DigestCandidate {
  projectId: string;
  projectName: string;
  /** A starting-point estimate only — always human-overridable. */
  suggestedMinutes: number;
  source: DigestSource;
  note: string | null;
}

export interface WeeklyDigest {
  personId: string;
  weekStart: Date;
  weekEnd: Date;
  candidates: DigestCandidate[];
}

/** Monday 00:00 through the following Monday 00:00, in the given date's week. */
export function buildWeekWindow(referenceDate: Date): { weekStart: Date; weekEnd: Date } {
  const day = referenceDate.getUTCDay(); // 0 = Sunday
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const weekStart = new Date(
    Date.UTC(referenceDate.getUTCFullYear(), referenceDate.getUTCMonth(), referenceDate.getUTCDate() + diffToMonday)
  );
  const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);
  return { weekStart, weekEnd };
}

export function buildWeeklyDigest(
  personId: string,
  referenceDate: Date,
  candidates: DigestCandidate[]
): WeeklyDigest {
  const { weekStart, weekEnd } = buildWeekWindow(referenceDate);
  return {
    personId,
    weekStart,
    weekEnd,
    candidates: [...candidates].sort((a, b) => b.suggestedMinutes - a.suggestedMinutes),
  };
}

export interface GithubCommitSignal {
  message: string;
  authoredAt: Date;
}

const MINUTES_PER_COMMIT = 30;
const MAX_SUGGESTED_MINUTES_PER_DAY = 6 * 60;

/**
 * Turns a person's commits against one project into a single candidate
 * row. The per-commit minute weighting is a crude starting point, not a
 * claim of accuracy — it exists so the digest has *something* pre-filled
 * to confirm or correct, which is the whole adoption bet.
 */
export function mapGithubCommitsToCandidate(
  projectId: string,
  projectName: string,
  commits: GithubCommitSignal[]
): DigestCandidate {
  const suggestedMinutes = Math.min(
    commits.length * MINUTES_PER_COMMIT,
    MAX_SUGGESTED_MINUTES_PER_DAY
  );
  const note =
    commits.length === 0
      ? null
      : `${commits.length} commit${commits.length === 1 ? "" : "s"}, most recent: "${commits[commits.length - 1].message}"`;

  return { projectId, projectName, suggestedMinutes, source: "github", note };
}

export interface ConfirmedEntry {
  minutes: number;
  basis: "TIMESHEET" | "SAMPLED" | "ESTIMATED";
}

/**
 * Packages a human's confirmation of a candidate into what
 * lib/time/repository.recordTimeEntry needs. `minutes` and `basis` must
 * both come from the confirming person — this function only shapes the
 * data, it does not decide either value.
 */
export function confirmCandidate(confirmed: ConfirmedEntry): ConfirmedEntry {
  if (confirmed.minutes < 0) {
    throw new Error("minutes cannot be negative");
  }
  return confirmed;
}
