import type { PrismaClient, User } from "@/lib/generated/prisma/client";
import { writeAuditLog } from "@/lib/locking/audit";

export class DeletionError extends Error {}

/**
 * Days between a deletion request and it actually being processed —
 * mirrors AUTO_LOCK_GRACE_DAYS's shape (lib/locking/repository.ts): a
 * short window so an accidental click, or a change of mind, can be
 * undone via cancelDeletionRequest before anything happens.
 */
export const DELETION_GRACE_DAYS = 7;

/** Every anonymized account's email lands in this domain — how processPendingDeletions tells "already done" from "still owed." */
const ANONYMIZED_EMAIL_DOMAIN = "removed.claimtrail.invalid";

function isAnonymized(email: string): boolean {
  return email.endsWith(`@${ANONYMIZED_EMAIL_DOMAIN}`);
}

export async function requestAccountDeletion(prisma: PrismaClient, userId: string): Promise<User> {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (isAnonymized(user.email)) {
    throw new DeletionError("This account has already been removed");
  }
  if (user.deletionRequestedAt) return user;
  return prisma.user.update({ where: { id: userId }, data: { deletionRequestedAt: new Date() } });
}

export async function cancelAccountDeletionRequest(prisma: PrismaClient, userId: string): Promise<User> {
  return prisma.user.update({ where: { id: userId }, data: { deletionRequestedAt: null } });
}

/**
 * The actual erasure: overwrites identifying fields only. Every
 * evidence-adjacent record the account ever created — WeeklySubmission,
 * UncertaintyNote, Amendment, SubmissionComment, AuditLog — is left
 * exactly as it was; the row still points at this same user id, it just
 * no longer resolves to a real name or a working email. Nothing about
 * the append-only tables is touched, by design (CLAUDE.md: evidence is
 * append-only, and retention obligations outlive the account).
 */
export async function anonymizeUser(prisma: PrismaClient, userId: string): Promise<User> {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, include: { memberships: true } });
  if (isAnonymized(user.email)) return user;

  const anonymized = await prisma.user.update({
    where: { id: userId },
    data: {
      name: "Removed user",
      email: `${userId}@${ANONYMIZED_EMAIL_DOMAIN}`,
      lastMagicLinkSentAt: null,
    },
  });

  for (const membership of user.memberships) {
    await writeAuditLog(prisma, {
      companyId: membership.companyId,
      actorId: null,
      action: "user:anonymize",
      entityType: "User",
      entityId: userId,
      reason: "GDPR erasure request processed after the grace period",
    });
  }

  return anonymized;
}

/**
 * Intended to run daily via a cron route (same shape as
 * /api/cron/auto-lock) — finds every account whose grace period has
 * elapsed and anonymizes it.
 */
export async function processPendingDeletions(prisma: PrismaClient, params: { now?: Date } = {}): Promise<{ anonymizedCount: number }> {
  const now = params.now ?? new Date();
  const cutoff = new Date(now.getTime() - DELETION_GRACE_DAYS * 24 * 60 * 60 * 1000);

  const due = await prisma.user.findMany({
    where: { deletionRequestedAt: { lte: cutoff }, NOT: { email: { endsWith: `@${ANONYMIZED_EMAIL_DOMAIN}` } } },
  });

  for (const user of due) {
    await anonymizeUser(prisma, user.id);
  }

  return { anonymizedCount: due.length };
}
