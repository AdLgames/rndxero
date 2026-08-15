import type { PrismaClient, SubmissionComment } from "@/lib/generated/prisma/client";
import { writeAuditLog } from "@/lib/locking/audit";

export class CommentError extends Error {}

export interface AddCommentInput {
  companyId: string;
  submissionId: string;
  authorId: string;
  body: string;
}

/**
 * A threaded discussion on a weekly submission — lighter-weight than an
 * Amendment (an attributed correction to the record itself). Comments
 * never modify the submission or its notes; they're append-only, same as
 * every other evidence-adjacent record (SubmissionComment's DB trigger).
 */
export async function addComment(prisma: PrismaClient, input: AddCommentInput): Promise<SubmissionComment> {
  if (!input.body.trim()) {
    throw new CommentError("Comment body is required");
  }

  const comment = await prisma.submissionComment.create({
    data: { submissionId: input.submissionId, authorId: input.authorId, body: input.body.trim() },
  });

  await writeAuditLog(prisma, {
    companyId: input.companyId,
    actorId: input.authorId,
    action: "comment:create",
    entityType: "SubmissionComment",
    entityId: comment.id,
    after: { submissionId: input.submissionId, body: comment.body },
  });

  return comment;
}

export async function listComments(prisma: PrismaClient, submissionId: string): Promise<Array<SubmissionComment & { author: { name: string } }>> {
  return prisma.submissionComment.findMany({
    where: { submissionId },
    include: { author: { select: { name: true } } },
    orderBy: { createdAt: "asc" },
  });
}
