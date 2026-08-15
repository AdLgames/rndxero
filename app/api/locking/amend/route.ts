import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { AuthorizationError, authorize } from "@/lib/authz/service";
import { addAmendment, AmendmentError } from "@/lib/locking/amendment";

/** Corrects a note or a submission by appending an Amendment — the only sanctioned edit once something's locked. */
export async function POST(request: NextRequest) {
  const currentUser = await getCurrentUser(prisma, request.cookies.get(SESSION_COOKIE_NAME)?.value);
  if (!currentUser) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const { companyId, noteId, submissionId, body } = (await request.json()) as {
    companyId?: string;
    noteId?: string;
    submissionId?: string;
    body?: string;
  };
  if (!companyId || !body || (!noteId && !submissionId) || (noteId && submissionId)) {
    return NextResponse.json(
      { error: "companyId, body, and exactly one of noteId/submissionId are required" },
      { status: 400 }
    );
  }

  let projectId: string;
  if (noteId) {
    const note = await prisma.uncertaintyNote.findUnique({
      where: { id: noteId },
      include: { submission: true },
    });
    if (!note) return NextResponse.json({ error: "Note not found" }, { status: 404 });
    projectId = note.submission.projectId;
  } else {
    const submission = await prisma.weeklySubmission.findUnique({ where: { id: submissionId } });
    if (!submission) return NextResponse.json({ error: "Submission not found" }, { status: 404 });
    projectId = submission.projectId;
  }

  try {
    await authorize(prisma, {
      userId: currentUser.id,
      companyId,
      projectId,
      action: noteId ? "note:amend" : "submission:amend",
    });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: "Not permitted to amend this" }, { status: 403 });
    }
    throw error;
  }

  try {
    const amendment = noteId
      ? await addAmendment(prisma, { noteId, companyId, authorId: currentUser.id, body })
      : await addAmendment(prisma, { submissionId: submissionId!, companyId, authorId: currentUser.id, body });
    // The caller is always the author of the amendment they just created, so this
    // avoids a second query for the name the UI needs to attribute the correction.
    return NextResponse.json({ amendment: { ...amendment, authorName: currentUser.name } }, { status: 201 });
  } catch (error) {
    if (error instanceof AmendmentError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }
}
