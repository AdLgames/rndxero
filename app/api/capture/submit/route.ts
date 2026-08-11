import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { AuthorizationError, authorize } from "@/lib/authz/service";
import { submitWeek, type NoteInput } from "@/lib/capture/repository";
import type { SubmissionBasis } from "@/lib/generated/prisma/client";

/**
 * One project's week in one call — the client fires one of these per
 * project with data on the single "Log this week" action, which is what
 * makes the multi-project pass feel like one submit even though each
 * project's week is its own row (BOARD-PLAN.md Phase 3.2).
 */
export async function POST(request: NextRequest) {
  const currentUser = await getCurrentUser(prisma, request.cookies.get(SESSION_COOKIE_NAME)?.value);
  if (!currentUser) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const body = (await request.json()) as {
    companyId?: string;
    projectId?: string;
    weekKey?: string;
    minutes?: number;
    basis?: SubmissionBasis;
    notes?: NoteInput[];
  };
  const { companyId, projectId, weekKey, minutes, basis } = body;
  if (!companyId || !projectId || !weekKey || minutes === undefined || !basis) {
    return NextResponse.json(
      { error: "companyId, projectId, weekKey, minutes and basis are required" },
      { status: 400 }
    );
  }

  try {
    await authorize(prisma, { userId: currentUser.id, companyId, projectId, action: "submission:create" });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: "Not permitted to log time on this project" }, { status: 403 });
    }
    throw error;
  }

  try {
    const submission = await submitWeek(prisma, {
      companyId,
      projectId,
      userId: currentUser.id,
      weekKey,
      minutes,
      basis,
      notes: body.notes ?? [],
    });
    return NextResponse.json({ submission }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not submit this week";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
