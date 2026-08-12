import type {
  PrismaClient,
  SubmissionBasis,
  UncertaintyNoteType,
  UncertaintyOutcome,
} from "@/lib/generated/prisma/client";
import { getWeekBoundaries } from "@/lib/capture/week-key";
import { findApplicableRate } from "@/lib/cost/rate";
import { getPlanVsActual, listPlanVersions, type WeekVariance } from "@/lib/plan/repository";

export interface ClaimPackAmendment {
  body: string;
  authorName: string;
  createdAt: string;
}

/** One entry in an uncertainty's chronology — an UncertaintyNote plus the integrity facts of the week it was logged in. */
export interface ClaimPackNoteEntry {
  weekKey: string;
  type: UncertaintyNoteType;
  body: string;
  evidenceRef: string | null;
  minutes: number | null;
  submittedAt: string;
  isRetrospective: boolean;
  locked: boolean;
  lockedAt: string | null;
  amendments: ClaimPackAmendment[];
}

export interface ClaimPackUncertainty {
  id: string;
  title: string;
  baseline: string;
  description: string | null;
  outcome: UncertaintyOutcome;
  raisedWeek: string;
  resolvedWeek: string | null;
  /** Chronological — baseline is fixed above, this is the "statement → attempts including failures → resolution" run (Phase 7.1). */
  chronology: ClaimPackNoteEntry[];
  /** Sum of tagged note minutes only — see the same caveat as the planner's variance table: untagged time isn't zero, just unattributed to this uncertainty. */
  totalMinutes: number;
  derivedCostMinorUnits: number | null;
}

export interface ClaimPackPlanRevision {
  versionNumber: number;
  note: string | null;
  createdAt: string;
  createdByName: string;
  supersededAt: string | null;
  totalPlannedMinutes: number;
}

export interface ClaimPackVarianceRow extends WeekVariance {
  uncertaintyTitle: string;
}

export interface ClaimPackSubmissionIntegrity {
  weekKey: string;
  userName: string;
  minutes: number;
  basis: SubmissionBasis;
  submittedAt: string;
  isRetrospective: boolean;
  lockedAt: string | null;
  amendments: ClaimPackAmendment[];
}

export interface ClaimPackContent {
  project: {
    id: string;
    name: string;
    description: string | null;
    startDate: string;
    endDate: string | null;
    status: string;
    competentProfessionals: string[];
  };
  generatedAt: string;
  uncertainties: ClaimPackUncertainty[];
  planRevisions: ClaimPackPlanRevision[];
  variance: ClaimPackVarianceRow[];
  totals: { plannedMinutes: number; actualMinutes: number; derivedCostMinorUnits: number | null };
  integrity: ClaimPackSubmissionIntegrity[];
  includesCosts: boolean;
}

/**
 * Assembles the full claim pack for one project (BOARD-PLAN.md Phase 7):
 * per-uncertainty narrative, a project roll-up with plan-vs-actual and
 * revision history, and integrity metadata for every submission. This
 * product records evidence — it does not decide what qualifies as R&D or
 * calculate relief; see the disclaimer every renderer stamps on the
 * output (lib/export/pdf.ts, lib/export/csv.ts).
 *
 * `includeCosts` should only be true when the caller has already checked
 * cost:read for the requesting user (finance/canViewCosts) — this
 * function does no authorization itself.
 */
export async function getProjectClaimPack(
  prisma: PrismaClient,
  params: { projectId: string; includeCosts: boolean }
): Promise<ClaimPackContent> {
  const project = await prisma.project.findUniqueOrThrow({
    where: { id: params.projectId },
    include: { competentProfessionals: true },
  });

  const uncertainties = await prisma.uncertainty.findMany({
    where: { projectId: params.projectId },
    orderBy: { raisedWeek: "asc" },
  });

  const submissions = await prisma.weeklySubmission.findMany({
    where: { projectId: params.projectId },
    include: {
      user: { select: { name: true } },
      notes: {
        include: { amendments: { include: { author: { select: { name: true } } }, orderBy: { createdAt: "asc" } } },
        orderBy: { createdAt: "asc" },
      },
    },
    orderBy: { weekKey: "asc" },
  });

  const submissionAmendments = await prisma.amendment.findMany({
    where: { submissionId: { in: submissions.map((s) => s.id) } },
    include: { author: { select: { name: true } } },
    orderBy: { createdAt: "asc" },
  });

  const rates = params.includeCosts
    ? await prisma.rate.findMany({ where: { companyId: project.companyId } })
    : [];

  const uncertaintyPacks: ClaimPackUncertainty[] = uncertainties.map((u) => {
    const chronology: ClaimPackNoteEntry[] = [];
    let totalMinutes = 0;
    let costMinorUnits = params.includeCosts ? 0 : null;

    for (const submission of submissions) {
      for (const note of submission.notes) {
        if (note.uncertaintyId !== u.id) continue;
        chronology.push({
          weekKey: submission.weekKey,
          type: note.type,
          body: note.body,
          evidenceRef: note.evidenceRef,
          minutes: note.minutes,
          submittedAt: submission.submittedAt.toISOString(),
          isRetrospective: submission.isRetrospective,
          locked: submission.lockedAt !== null,
          lockedAt: submission.lockedAt ? submission.lockedAt.toISOString() : null,
          amendments: note.amendments.map((a) => ({
            body: a.body,
            authorName: a.author.name,
            createdAt: a.createdAt.toISOString(),
          })),
        });

        if (note.minutes) {
          totalMinutes += note.minutes;
          if (params.includeCosts) {
            const { start } = getWeekBoundaries(submission.weekKey);
            const rate = findApplicableRate(rates, submission.userId, start);
            if (rate) {
              costMinorUnits = (costMinorUnits ?? 0) + Math.round((note.minutes / 60) * rate.hourlyRateMinorUnits);
            }
          }
        }
      }
    }

    return {
      id: u.id,
      title: u.title,
      baseline: u.baseline,
      description: u.description,
      outcome: u.outcome,
      raisedWeek: u.raisedWeek,
      resolvedWeek: u.resolvedWeek,
      chronology,
      totalMinutes,
      derivedCostMinorUnits: costMinorUnits,
    };
  });

  const planVersions = await listPlanVersions(prisma, params.projectId);
  const creatorIds = [...new Set(planVersions.map((v) => v.createdById))];
  const creators = await prisma.user.findMany({ where: { id: { in: creatorIds } }, select: { id: true, name: true } });
  const creatorNameById = new Map(creators.map((c) => [c.id, c.name]));

  const planRevisions: ClaimPackPlanRevision[] = planVersions.map((v) => ({
    versionNumber: v.versionNumber,
    note: v.note,
    createdAt: v.createdAt.toISOString(),
    createdByName: creatorNameById.get(v.createdById) ?? "unknown",
    supersededAt: v.supersededAt ? v.supersededAt.toISOString() : null,
    totalPlannedMinutes: v.plannedAllocations.reduce((sum, a) => sum + a.plannedMinutes, 0),
  }));

  const variance: ClaimPackVarianceRow[] = (
    await Promise.all(
      uncertainties.map(async (u) => {
        const weeks = await getPlanVsActual(prisma, { projectId: params.projectId, uncertaintyId: u.id });
        return weeks.map((w) => ({ uncertaintyTitle: u.title, ...w }));
      })
    )
  ).flat();

  const integrity: ClaimPackSubmissionIntegrity[] = submissions.map((s) => ({
    weekKey: s.weekKey,
    userName: s.user.name,
    minutes: s.minutes,
    basis: s.basis,
    submittedAt: s.submittedAt.toISOString(),
    isRetrospective: s.isRetrospective,
    lockedAt: s.lockedAt ? s.lockedAt.toISOString() : null,
    amendments: submissionAmendments
      .filter((a) => a.submissionId === s.id)
      .map((a) => ({ body: a.body, authorName: a.author.name, createdAt: a.createdAt.toISOString() })),
  }));

  const currentPlan = planVersions.find((v) => v.supersededAt === null);
  const totalPlannedMinutes = currentPlan?.plannedAllocations.reduce((sum, a) => sum + a.plannedMinutes, 0) ?? 0;
  const totalActualMinutes = submissions.reduce((sum, s) => sum + s.minutes, 0);
  const totalCostMinorUnits = params.includeCosts
    ? uncertaintyPacks.reduce((sum, u) => sum + (u.derivedCostMinorUnits ?? 0), 0)
    : null;

  return {
    project: {
      id: project.id,
      name: project.name,
      description: project.description,
      startDate: project.startDate.toISOString(),
      endDate: project.endDate ? project.endDate.toISOString() : null,
      status: project.status,
      competentProfessionals: project.competentProfessionals.map((c) => c.name),
    },
    generatedAt: new Date().toISOString(),
    uncertainties: uncertaintyPacks,
    planRevisions,
    variance,
    totals: { plannedMinutes: totalPlannedMinutes, actualMinutes: totalActualMinutes, derivedCostMinorUnits: totalCostMinorUnits },
    integrity,
    includesCosts: params.includeCosts,
  };
}
