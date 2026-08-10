import type { PrismaClient } from "@/lib/generated/prisma/client";
import { assemblePackContent, type EvidencePackContent, type PackCostLine } from "@/lib/export/pack";
import { computeSnapshotHash } from "@/lib/evidence/snapshot";
import { apportionedAmountMinorUnits } from "@/lib/approvals/unevidenced";

/** Rows not superseded by a later correction — see lib/approvals/repository.ts for the same rule. */
function currentVersionsOnly<T extends { id: string; supersedes: string | null }>(entries: T[]): T[] {
  const supersededIds = new Set(entries.map((e) => e.supersedes).filter((id): id is string => id !== null));
  return entries.filter((e) => !supersededIds.has(e.id));
}

export async function gatherPackContent(
  prisma: PrismaClient,
  projectId: string,
  accountingPeriodId: string
): Promise<EvidencePackContent> {
  const [project, accountingPeriod] = await Promise.all([
    prisma.project.findUniqueOrThrow({
      where: { id: projectId },
      include: { competentProfessionals: true },
    }),
    prisma.accountingPeriod.findUniqueOrThrow({ where: { id: accountingPeriodId } }),
  ]);

  const [evidenceEntriesRaw, timeEntriesRaw, costAllocationsRaw, approvalsRaw] = await Promise.all([
    prisma.evidenceEntry.findMany({
      where: {
        projectId,
        createdAt: { gte: accountingPeriod.startDate, lt: accountingPeriod.endDate },
      },
      include: { author: true },
    }),
    prisma.timeEntry.findMany({
      where: { projectId, periodStart: { gte: accountingPeriod.startDate, lt: accountingPeriod.endDate } },
      include: { person: true },
    }),
    prisma.costAllocation.findMany({
      where: { projectId },
      include: { xeroJournalLine: true, manualCostLine: { include: { manualCostImport: true } } },
    }),
    prisma.approval.findMany({ include: { approver: true } }),
  ]);

  const currentTimeEntries = currentVersionsOnly(timeEntriesRaw);
  const currentCostAllocations = currentVersionsOnly(costAllocationsRaw);
  const relevantTargetIds = new Set([
    ...currentTimeEntries.map((e) => e.id),
    ...currentCostAllocations.map((c) => c.id),
  ]);

  const costLines: PackCostLine[] = currentCostAllocations.map((allocation) => ({
    id: allocation.id,
    category: allocation.xeroJournalLine?.costCategory ?? null,
    description:
      allocation.xeroJournalLine?.accountName ??
      allocation.manualCostLine?.description ??
      "Cost allocation",
    source:
      allocation.source === "XERO_JOURNAL_LINE" && allocation.xeroJournalLine
        ? {
            type: "xero" as const,
            xeroJournalId: allocation.xeroJournalLine.xeroJournalId,
            xeroJournalLineId: allocation.xeroJournalLine.xeroJournalLineId,
          }
        : {
            type: "manual_import" as const,
            filename: allocation.manualCostLine?.manualCostImport.filename ?? "unknown",
          },
    amountMinorUnits: allocation.amountMinorUnits,
    currency: allocation.currency,
    apportionmentBps: allocation.apportionmentBps,
    apportionedAmountMinorUnits: apportionedAmountMinorUnits(
      allocation.amountMinorUnits,
      allocation.apportionmentBps
    ),
    rationale: allocation.rationale,
  }));

  return assemblePackContent({
    project: {
      id: project.id,
      name: project.name,
      startDate: project.startDate.toISOString(),
      endDate: project.endDate?.toISOString() ?? null,
      status: project.status,
      competentProfessionals: project.competentProfessionals.map((cp) => cp.name),
    },
    accountingPeriod: {
      id: accountingPeriod.id,
      label: accountingPeriod.label,
      startDate: accountingPeriod.startDate.toISOString(),
      endDate: accountingPeriod.endDate.toISOString(),
    },
    evidenceEntries: evidenceEntriesRaw.map((e) => ({
      id: e.id,
      type: e.type,
      body: e.body,
      authorName: e.author.name,
      createdAt: e.createdAt.toISOString(),
      supersedes: e.supersedes,
    })),
    timeEntries: currentTimeEntries.map((e) => ({
      personName: e.person.name,
      minutes: e.minutes,
      basis: e.basis,
    })),
    costLines,
    approvals: approvalsRaw
      .filter((a) => relevantTargetIds.has(a.targetId))
      .map((a) => ({
        targetType: a.targetType,
        targetId: a.targetId,
        decision: a.decision,
        approverName: a.approver.name,
        createdAt: a.createdAt.toISOString(),
        comment: a.comment,
      })),
  });
}

/**
 * Idempotent: if a snapshot already exists for this project+period, it is
 * returned as-is (PeriodSnapshot is append-only and unique per
 * project+period — see the evidence_model migration). Otherwise the pack
 * is assembled fresh, hashed, and frozen.
 */
export async function getOrCreatePeriodSnapshot(
  prisma: PrismaClient,
  params: { projectId: string; accountingPeriodId: string; generatedById: string }
) {
  const existing = await prisma.periodSnapshot.findUnique({
    where: {
      projectId_accountingPeriodId: {
        projectId: params.projectId,
        accountingPeriodId: params.accountingPeriodId,
      },
    },
  });
  if (existing) return existing;

  const content = await gatherPackContent(prisma, params.projectId, params.accountingPeriodId);
  const snapshotHash = computeSnapshotHash(content);

  return prisma.periodSnapshot.create({
    data: {
      projectId: params.projectId,
      accountingPeriodId: params.accountingPeriodId,
      snapshotHash,
      dataJson: JSON.parse(JSON.stringify(content)),
      generatedById: params.generatedById,
    },
  });
}
