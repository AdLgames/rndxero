import type {
  Approval,
  ApprovalDecision,
  ApprovalTargetType,
  CostAllocation,
  PrismaClient,
  TimeEntry,
} from "@/lib/generated/prisma/client";
import { transition, type ApprovalAction, type ApprovalStatus } from "@/lib/approvals/state-machine";
import {
  apportionedAmountMinorUnits,
  summarizeCostEvidence,
  summarizeTimeEvidence,
  type CostEvidenceSummary,
  type TimeEvidenceSummary,
} from "@/lib/approvals/unevidenced";
import { computeSnapshotHash } from "@/lib/evidence/snapshot";

/** Approval records are append-only inserts, same as evidence and time entries. */
export async function recordApproval(
  prisma: PrismaClient,
  input: {
    targetType: ApprovalTargetType;
    targetId: string;
    decision: ApprovalDecision;
    snapshotHash: string;
    comment?: string;
    approverId: string;
  }
): Promise<Approval> {
  return prisma.approval.create({ data: input });
}

export async function getLatestApprovalStatus(
  prisma: PrismaClient,
  targetType: ApprovalTargetType,
  targetId: string
): Promise<ApprovalStatus> {
  const latest = await prisma.approval.findFirst({
    where: { targetType, targetId },
    orderBy: { createdAt: "desc" },
  });
  if (!latest) return "pending";
  return latest.decision === "APPROVED" ? "approved" : "queried";
}

/**
 * Validates the requested action against the target's current approval
 * status via the state machine, then records the decision. Throws
 * InvalidApprovalTransitionError (from the state machine) on an illegal
 * move — e.g. approving something that's already approved.
 */
export async function decideApproval(
  prisma: PrismaClient,
  input: {
    targetType: ApprovalTargetType;
    targetId: string;
    action: Extract<ApprovalAction, "approve" | "query">;
    approverId: string;
    comment?: string;
    /** The exact data being approved, hashed for the audit trail. */
    snapshotData: unknown;
  }
): Promise<Approval> {
  const currentStatus = await getLatestApprovalStatus(prisma, input.targetType, input.targetId);
  const nextStatus = transition(currentStatus, input.action);

  return recordApproval(prisma, {
    targetType: input.targetType,
    targetId: input.targetId,
    decision: nextStatus === "approved" ? "APPROVED" : "QUERIED",
    snapshotHash: computeSnapshotHash(input.snapshotData),
    comment: input.comment,
    approverId: input.approverId,
  });
}

/** Entries that are not themselves superseded by a later correction. */
function currentVersionsOnly<T extends { id: string; supersedes: string | null }>(entries: T[]): T[] {
  const supersededIds = new Set(entries.map((e) => e.supersedes).filter((id): id is string => id !== null));
  return entries.filter((e) => !supersededIds.has(e.id));
}

export async function getProjectTimeEvidenceSummary(
  prisma: PrismaClient,
  projectId: string
): Promise<TimeEvidenceSummary> {
  const all = await prisma.timeEntry.findMany({ where: { projectId } });
  const current = currentVersionsOnly(all);

  const withApproval = await Promise.all(
    current.map(async (entry: TimeEntry) => ({
      minutes: entry.minutes,
      approved: (await getLatestApprovalStatus(prisma, "TIME_ENTRY", entry.id)) === "approved",
    }))
  );

  return summarizeTimeEvidence(withApproval);
}

export async function getProjectCostEvidenceSummary(
  prisma: PrismaClient,
  projectId: string
): Promise<CostEvidenceSummary> {
  const all = await prisma.costAllocation.findMany({ where: { projectId } });
  const current = currentVersionsOnly(all);

  const withApproval = await Promise.all(
    current.map(async (entry: CostAllocation) => ({
      apportionedAmountMinorUnits: apportionedAmountMinorUnits(
        entry.amountMinorUnits,
        entry.apportionmentBps
      ),
      approved: (await getLatestApprovalStatus(prisma, "COST_ALLOCATION", entry.id)) === "approved",
    }))
  );

  return summarizeCostEvidence(withApproval);
}

export interface PendingQueueItem {
  targetType: "TIME_ENTRY" | "COST_ALLOCATION";
  targetId: string;
  projectId: string;
  projectName: string;
  summary: string;
}

/** Everything currently pending finance's review across a company's projects. */
export async function getPendingApprovalQueue(
  prisma: PrismaClient,
  companyId: string
): Promise<PendingQueueItem[]> {
  const projects = await prisma.project.findMany({
    where: { companyId },
    include: { timeEntries: true, costAllocations: true },
  });

  const items: PendingQueueItem[] = [];
  for (const project of projects) {
    for (const entry of currentVersionsOnly(project.timeEntries)) {
      const status = await getLatestApprovalStatus(prisma, "TIME_ENTRY", entry.id);
      if (status === "pending") {
        items.push({
          targetType: "TIME_ENTRY",
          targetId: entry.id,
          projectId: project.id,
          projectName: project.name,
          summary: `${entry.minutes} minutes (${entry.basis.toLowerCase()})`,
        });
      }
    }
    for (const allocation of currentVersionsOnly(project.costAllocations)) {
      const status = await getLatestApprovalStatus(prisma, "COST_ALLOCATION", allocation.id);
      if (status === "pending") {
        items.push({
          targetType: "COST_ALLOCATION",
          targetId: allocation.id,
          projectId: project.id,
          projectName: project.name,
          summary: `${(allocation.apportionmentBps / 100).toFixed(2)}% of ${(allocation.amountMinorUnits / 100).toFixed(2)} ${allocation.currency}`,
        });
      }
    }
  }
  return items;
}
