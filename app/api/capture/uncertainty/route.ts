import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { AuthorizationError, authorize } from "@/lib/authz/service";
import { createUncertainty } from "@/lib/capture/repository";
import { getIsoWeekKey } from "@/lib/capture/week-key";

/** "Something new came up" (BOARD-PLAN.md Phase 3.5) — the only place typing a title + baseline is genuinely required. */
export async function POST(request: NextRequest) {
  const currentUser = await getCurrentUser(prisma, request.cookies.get(SESSION_COOKIE_NAME)?.value);
  if (!currentUser) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const body = (await request.json()) as {
    companyId?: string;
    projectId?: string;
    title?: string;
    baseline?: string;
    description?: string;
  };
  const { companyId, projectId, title, baseline } = body;
  if (!companyId || !projectId || !title || !baseline) {
    return NextResponse.json({ error: "companyId, projectId, title and baseline are required" }, { status: 400 });
  }

  try {
    await authorize(prisma, { userId: currentUser.id, companyId, projectId, action: "uncertainty:create" });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: "Not permitted to raise an uncertainty on this project" }, { status: 403 });
    }
    throw error;
  }

  const uncertainty = await createUncertainty(prisma, {
    projectId,
    title,
    baseline,
    description: body.description,
    weekKey: getIsoWeekKey(new Date()),
  });

  return NextResponse.json({ uncertainty }, { status: 201 });
}
