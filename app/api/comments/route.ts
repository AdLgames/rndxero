import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { AuthorizationError, authorize } from "@/lib/authz/service";
import { addComment, CommentError } from "@/lib/comments/repository";

export async function POST(request: NextRequest) {
  const currentUser = await getCurrentUser(prisma, request.cookies.get(SESSION_COOKIE_NAME)?.value);
  if (!currentUser) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const { companyId, submissionId, body } = (await request.json()) as { companyId?: string; submissionId?: string; body?: string };
  if (!companyId || !submissionId || !body?.trim()) {
    return NextResponse.json({ error: "companyId, submissionId, and body are required" }, { status: 400 });
  }

  const submission = await prisma.weeklySubmission.findUnique({ where: { id: submissionId } });
  if (!submission) {
    return NextResponse.json({ error: "Submission not found" }, { status: 404 });
  }

  try {
    await authorize(prisma, { userId: currentUser.id, companyId, projectId: submission.projectId, action: "comment:create" });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: "Not permitted to comment on this submission" }, { status: 403 });
    }
    throw error;
  }

  try {
    const comment = await addComment(prisma, { companyId, submissionId, authorId: currentUser.id, body });
    return NextResponse.json({ comment: { ...comment, authorName: currentUser.name } }, { status: 201 });
  } catch (error) {
    if (error instanceof CommentError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }
}
