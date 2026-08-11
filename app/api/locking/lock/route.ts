import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { AuthorizationError, authorize } from "@/lib/authz/service";
import { lockSubmission, LockingError } from "@/lib/locking/repository";

export async function POST(request: NextRequest) {
  const currentUser = await getCurrentUser(prisma, request.cookies.get(SESSION_COOKIE_NAME)?.value);
  if (!currentUser) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const { companyId, projectId, submissionId } = (await request.json()) as {
    companyId?: string;
    projectId?: string;
    submissionId?: string;
  };
  if (!companyId || !projectId || !submissionId) {
    return NextResponse.json({ error: "companyId, projectId and submissionId are required" }, { status: 400 });
  }

  try {
    await authorize(prisma, { userId: currentUser.id, companyId, projectId, action: "submission:lock" });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: "Not permitted to lock this project's weeks" }, { status: 403 });
    }
    throw error;
  }

  try {
    const submission = await lockSubmission(prisma, { submissionId, companyId, actorId: currentUser.id });
    return NextResponse.json({ submission });
  } catch (error) {
    if (error instanceof LockingError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    throw error;
  }
}
