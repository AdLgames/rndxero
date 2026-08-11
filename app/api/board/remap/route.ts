import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { AuthorizationError, authorize } from "@/lib/authz/service";
import { BoardError, remapNote } from "@/lib/board/repository";

/** Board drag-to-remap: reassign a live note to a different uncertainty. Lead-and-above only (see lib/authz/permissions.ts). */
export async function POST(request: NextRequest) {
  const currentUser = await getCurrentUser(prisma, request.cookies.get(SESSION_COOKIE_NAME)?.value);
  if (!currentUser) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const { companyId, projectId, noteId, toUncertaintyId } = (await request.json()) as {
    companyId?: string;
    projectId?: string;
    noteId?: string;
    toUncertaintyId?: string;
  };
  if (!companyId || !projectId || !noteId || !toUncertaintyId) {
    return NextResponse.json(
      { error: "companyId, projectId, noteId and toUncertaintyId are required" },
      { status: 400 }
    );
  }

  try {
    await authorize(prisma, { userId: currentUser.id, companyId, projectId, action: "note:remap" });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: "Not permitted to remap notes on this project" }, { status: 403 });
    }
    throw error;
  }

  try {
    const note = await remapNote(prisma, { noteId, companyId, actorId: currentUser.id, toUncertaintyId });
    return NextResponse.json({ note });
  } catch (error) {
    if (error instanceof BoardError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    throw error;
  }
}
