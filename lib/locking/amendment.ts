import type { Amendment, PrismaClient } from "@/lib/generated/prisma/client";
import { writeAuditLog } from "@/lib/locking/audit";

export class AmendmentError extends Error {}

export type AddAmendmentInput =
  | { noteId: string; submissionId?: undefined; companyId: string; authorId: string; body: string }
  | { submissionId: string; noteId?: undefined; companyId: string; authorId: string; body: string };

/**
 * The only sanctioned way to correct a locked WeeklySubmission or
 * UncertaintyNote (BOARD-PLAN.md Phase 4.5): the original is left
 * exactly as it was, and this appends a new, attributed, timestamped
 * row pointing at it. The database CHECK constraint already enforces
 * "exactly one of noteId/submissionId" — this validates the same thing
 * first so the error message is legible instead of a raw constraint
 * violation. Also writes to AuditLog — an amendment is exactly the kind
 * of action the audit trail exists for.
 */
export async function addAmendment(prisma: PrismaClient, input: AddAmendmentInput): Promise<Amendment> {
  if (!input.body.trim()) {
    throw new AmendmentError("Amendment body cannot be empty");
  }

  const amendment = await prisma.amendment.create({
    data: {
      noteId: input.noteId,
      submissionId: input.submissionId,
      authorId: input.authorId,
      body: input.body,
    },
  });

  await writeAuditLog(prisma, {
    companyId: input.companyId,
    actorId: input.authorId,
    action: input.noteId ? "note:amend" : "submission:amend",
    entityType: input.noteId ? "UncertaintyNote" : "WeeklySubmission",
    entityId: input.noteId ?? input.submissionId!,
    after: { amendmentId: amendment.id, body: amendment.body },
  });

  return amendment;
}
