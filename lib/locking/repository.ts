import type { PrismaClient, WeeklySubmission } from "@/lib/generated/prisma/client";
import { getWeekBoundaries } from "@/lib/capture/week-key";
import { writeAuditLog } from "@/lib/locking/audit";

const AUTO_LOCK_GRACE_DAYS = 7;

export class LockingError extends Error {}

/**
 * Finance locking a week early (BOARD-PLAN.md Phase 4.2). The database
 * trigger already prevents this from touching a row that's already
 * locked; this just does the locking and logs it. No reason required —
 * that's specifically an unlock requirement (Phase 4.3).
 */
export async function lockSubmission(
  prisma: PrismaClient,
  params: { submissionId: string; companyId: string; actorId: string }
): Promise<WeeklySubmission> {
  const before = await prisma.weeklySubmission.findUnique({ where: { id: params.submissionId } });
  if (!before) {
    throw new LockingError(`Submission ${params.submissionId} not found`);
  }
  if (before.lockedAt) {
    throw new LockingError("Already locked");
  }

  const after = await prisma.weeklySubmission.update({
    where: { id: params.submissionId },
    data: { lockedAt: new Date() },
  });

  await writeAuditLog(prisma, {
    companyId: params.companyId,
    actorId: params.actorId,
    action: "submission.lock",
    entityType: "WeeklySubmission",
    entityId: params.submissionId,
    before,
    after,
  });

  return after;
}

/**
 * Unlocking always requires a typed reason (Phase 4.3) — enforced here,
 * not just left to a UI convention, since this is the one sanctioned way
 * to reopen a row the database would otherwise refuse to touch at all.
 */
export async function unlockSubmission(
  prisma: PrismaClient,
  params: { submissionId: string; companyId: string; actorId: string; reason: string }
): Promise<WeeklySubmission> {
  if (!params.reason.trim()) {
    throw new LockingError("A reason is required to unlock a submission");
  }

  const before = await prisma.weeklySubmission.findUnique({ where: { id: params.submissionId } });
  if (!before) {
    throw new LockingError(`Submission ${params.submissionId} not found`);
  }
  if (!before.lockedAt) {
    throw new LockingError("Not locked");
  }

  const after = await prisma.weeklySubmission.update({
    where: { id: params.submissionId },
    data: { lockedAt: null },
  });

  await writeAuditLog(prisma, {
    companyId: params.companyId,
    actorId: params.actorId,
    action: "submission.unlock",
    entityType: "WeeklySubmission",
    entityId: params.submissionId,
    before,
    after,
    reason: params.reason,
  });

  return after;
}

/**
 * Auto-lock everything past its close + grace period (Phase 0 decision
 * #4). Idempotent and safe to call repeatedly (e.g. from a daily cron):
 * only touches rows that are both unlocked and past the deadline, and
 * each lock is individually audit-logged with a system actor so it's
 * distinguishable from a human finance action.
 */
export async function autoLockOverdueSubmissions(
  prisma: PrismaClient,
  params: { now?: Date } = {}
): Promise<{ lockedCount: number }> {
  const now = params.now ?? new Date();
  const candidates = await prisma.weeklySubmission.findMany({ where: { lockedAt: null } });

  let lockedCount = 0;
  for (const submission of candidates) {
    const { end } = getWeekBoundaries(submission.weekKey);
    const deadline = new Date(end.getTime() + AUTO_LOCK_GRACE_DAYS * 24 * 60 * 60 * 1000);
    if (now < deadline) continue;

    const after = await prisma.weeklySubmission.update({
      where: { id: submission.id },
      data: { lockedAt: now },
    });
    await writeAuditLog(prisma, {
      companyId: submission.companyId,
      actorId: null,
      action: "submission.auto_lock",
      entityType: "WeeklySubmission",
      entityId: submission.id,
      before: submission,
      after,
      reason: `Auto-locked ${AUTO_LOCK_GRACE_DAYS} days after week close`,
    });
    lockedCount++;
  }

  return { lockedCount };
}
