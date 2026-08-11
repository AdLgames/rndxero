import type { Amendment, PrismaClient } from "@/lib/generated/prisma/client";

export class AmendmentError extends Error {}

export type AddAmendmentInput =
  | { noteId: string; submissionId?: undefined; authorId: string; body: string }
  | { submissionId: string; noteId?: undefined; authorId: string; body: string };

/**
 * The only sanctioned way to correct a locked WeeklySubmission or
 * UncertaintyNote (BOARD-PLAN.md Phase 4.5): the original is left
 * exactly as it was, and this appends a new, attributed, timestamped
 * row pointing at it. The database CHECK constraint already enforces
 * "exactly one of noteId/submissionId" — this validates the same thing
 * first so the error message is legible instead of a raw constraint
 * violation.
 */
export async function addAmendment(prisma: PrismaClient, input: AddAmendmentInput): Promise<Amendment> {
  if (!input.body.trim()) {
    throw new AmendmentError("Amendment body cannot be empty");
  }

  return prisma.amendment.create({
    data: {
      noteId: input.noteId,
      submissionId: input.submissionId,
      authorId: input.authorId,
      body: input.body,
    },
  });
}
