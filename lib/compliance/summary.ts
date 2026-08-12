import type { PrismaClient } from "@/lib/generated/prisma/client";
import { getWeekBoundaries } from "@/lib/capture/week-key";
import { findApplicableRate } from "@/lib/cost/rate";
import { readinessScore } from "@/lib/compliance/readiness";

export interface CompanySummary {
  totalMinutesYtd: number;
  /** Sum of hours logged this year × the applicable rate for whoever logged them — a real derived cost, not an estimated relief value. */
  qualifyingExpenditureMinorUnits: number;
  /** Percentage (0-100) of this year's notes that carry both a narrative and a linked piece of evidence. */
  auditReadinessPct: number;
}

/**
 * The sticky workspace summary (spec: "Sticky Summary Header... fixed
 * across navigation tabs"). Deliberately stops at "qualifying expenditure
 * logged" — real cost from real hours × real rates — rather than an
 * estimated tax credit or relief figure, which CLAUDE.md keeps out of
 * this product's scope.
 */
export async function getCompanySummary(prisma: PrismaClient, companyId: string): Promise<CompanySummary> {
  const currentYear = String(new Date().getFullYear());

  const [submissions, rates, notes] = await Promise.all([
    prisma.weeklySubmission.findMany({
      where: { companyId, weekKey: { startsWith: currentYear } },
      select: { userId: true, weekKey: true, minutes: true },
    }),
    prisma.rate.findMany({ where: { companyId } }),
    prisma.uncertaintyNote.findMany({
      where: { submission: { companyId, weekKey: { startsWith: currentYear } } },
      select: { body: true, evidenceRef: true },
    }),
  ]);

  const totalMinutesYtd = submissions.reduce((sum, s) => sum + s.minutes, 0);

  let qualifyingExpenditureMinorUnits = 0;
  for (const submission of submissions) {
    const { start } = getWeekBoundaries(submission.weekKey);
    const rate = findApplicableRate(rates, submission.userId, start);
    if (!rate) continue;
    qualifyingExpenditureMinorUnits += Math.round((submission.minutes / 60) * rate.hourlyRateMinorUnits);
  }

  return {
    totalMinutesYtd,
    qualifyingExpenditureMinorUnits,
    auditReadinessPct: readinessScore(notes),
  };
}
