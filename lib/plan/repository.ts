import type { PlannedAllocation, PlanVersion, PrismaClient } from "@/lib/generated/prisma/client";
import { getWeekBoundaries } from "@/lib/capture/week-key";
import { findApplicableRate } from "@/lib/cost/rate";

export class PlanError extends Error {}

export interface PlannedAllocationInput {
  uncertaintyId: string;
  userId?: string;
  weekKey: string;
  plannedMinutes: number;
}

export interface CreatePlanVersionInput {
  projectId: string;
  createdById: string;
  note?: string;
  allocations: PlannedAllocationInput[];
}

export type PlanVersionWithAllocations = PlanVersion & { plannedAllocations: PlannedAllocation[] };

/**
 * Plans are insert-only (BOARD-PLAN.md Phase 1.4): a revision never edits
 * an existing PlanVersion, it supersedes it and writes a fresh one with
 * its own PlannedAllocation rows. Version 1 needs no note; every version
 * after that requires one — "why" is the whole point of keeping the old
 * version queryable at all.
 */
export async function createPlanVersion(
  prisma: PrismaClient,
  input: CreatePlanVersionInput
): Promise<PlanVersionWithAllocations> {
  if (input.allocations.length === 0) {
    throw new PlanError("A plan needs at least one allocation");
  }
  for (const allocation of input.allocations) {
    if (allocation.plannedMinutes <= 0) {
      throw new PlanError("Planned minutes must be greater than zero");
    }
    getWeekBoundaries(allocation.weekKey); // throws on a malformed week key
  }

  const current = await prisma.planVersion.findFirst({
    where: { projectId: input.projectId, supersededAt: null },
    orderBy: { versionNumber: "desc" },
  });

  const versionNumber = (current?.versionNumber ?? 0) + 1;
  if (versionNumber > 1 && !input.note?.trim()) {
    throw new PlanError("A note explaining the revision is required");
  }

  return prisma.$transaction(async (tx) => {
    if (current) {
      await tx.planVersion.update({ where: { id: current.id }, data: { supersededAt: new Date() } });
    }
    return tx.planVersion.create({
      data: {
        projectId: input.projectId,
        versionNumber,
        createdById: input.createdById,
        note: input.note?.trim() || null,
        plannedAllocations: {
          createMany: {
            data: input.allocations.map((a) => ({
              uncertaintyId: a.uncertaintyId,
              userId: a.userId,
              weekKey: a.weekKey,
              plannedMinutes: a.plannedMinutes,
            })),
          },
        },
      },
      include: { plannedAllocations: true },
    });
  });
}

/** The one PlanVersion that hasn't been superseded — null if a project has never had a plan. */
export async function getCurrentPlanVersion(
  prisma: PrismaClient,
  projectId: string
): Promise<PlanVersionWithAllocations | null> {
  return prisma.planVersion.findFirst({
    where: { projectId, supersededAt: null },
    include: { plannedAllocations: true },
  });
}

/** Every version ever created for a project, oldest first — old versions "stay viewable forever" (Phase 1.4). */
export async function listPlanVersions(
  prisma: PrismaClient,
  projectId: string
): Promise<PlanVersionWithAllocations[]> {
  return prisma.planVersion.findMany({
    where: { projectId },
    include: { plannedAllocations: true },
    orderBy: { versionNumber: "asc" },
  });
}

export interface WeekVariance {
  weekKey: string;
  plannedMinutes: number;
  actualMinutes: number;
  varianceMinutes: number;
}

/**
 * Plan-vs-actual for one uncertainty (Phase 5.4): planned comes from the
 * current PlanVersion's allocations; actual comes from UncertaintyNote's
 * optional per-note `minutes` field, the only place capture records hours
 * against a specific uncertainty rather than a whole week. A week the
 * planner allocated but no one tagged minutes on shows actual 0, not
 * missing — the gap itself is the signal.
 */
export async function getPlanVsActual(
  prisma: PrismaClient,
  params: { projectId: string; uncertaintyId: string }
): Promise<WeekVariance[]> {
  const currentPlan = await getCurrentPlanVersion(prisma, params.projectId);
  const planned = new Map<string, number>();
  for (const allocation of currentPlan?.plannedAllocations ?? []) {
    if (allocation.uncertaintyId !== params.uncertaintyId) continue;
    planned.set(allocation.weekKey, (planned.get(allocation.weekKey) ?? 0) + allocation.plannedMinutes);
  }

  const notes = await prisma.uncertaintyNote.findMany({
    where: { uncertaintyId: params.uncertaintyId, minutes: { not: null } },
    include: { submission: { select: { weekKey: true } } },
  });
  const actual = new Map<string, number>();
  for (const note of notes) {
    const weekKey = note.submission.weekKey;
    actual.set(weekKey, (actual.get(weekKey) ?? 0) + (note.minutes ?? 0));
  }

  const weekKeys = [...new Set([...planned.keys(), ...actual.keys()])].sort();
  return weekKeys.map((weekKey) => {
    const plannedMinutes = planned.get(weekKey) ?? 0;
    const actualMinutes = actual.get(weekKey) ?? 0;
    return { weekKey, plannedMinutes, actualMinutes, varianceMinutes: actualMinutes - plannedMinutes };
  });
}

/**
 * Derived planned cost — never stored (BOARD-PLAN.md Phase 1.5: "always
 * derived... never stored and never typed by a user"). Only allocations
 * with a userId can be costed at all: an unassigned allocation has no
 * rate to apply. Uses whichever Rate covers the allocation's week.
 */
export async function computePlannedCostMinorUnits(
  prisma: PrismaClient,
  params: { companyId: string; planVersion: PlanVersionWithAllocations }
): Promise<number> {
  const userIds = [...new Set(params.planVersion.plannedAllocations.map((a) => a.userId).filter((id): id is string => id !== null))];
  if (userIds.length === 0) return 0;

  const rates = await prisma.rate.findMany({ where: { companyId: params.companyId, userId: { in: userIds } } });

  let totalMinorUnits = 0;
  for (const allocation of params.planVersion.plannedAllocations) {
    if (!allocation.userId) continue;
    const { start } = getWeekBoundaries(allocation.weekKey);
    const applicable = findApplicableRate(rates, allocation.userId, start);
    if (!applicable) continue;
    totalMinorUnits += Math.round((allocation.plannedMinutes / 60) * applicable.hourlyRateMinorUnits);
  }
  return totalMinorUnits;
}
