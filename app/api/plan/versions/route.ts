import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { AuthorizationError, authorize } from "@/lib/authz/service";
import { createPlanVersion, PlanError } from "@/lib/plan/repository";

export async function POST(request: NextRequest) {
  const currentUser = await getCurrentUser(prisma, request.cookies.get(SESSION_COOKIE_NAME)?.value);
  if (!currentUser) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const { companyId, projectId, note, allocations } = (await request.json()) as {
    companyId?: string;
    projectId?: string;
    note?: string;
    allocations?: Array<{ uncertaintyId: string; userId?: string; weekKey: string; plannedMinutes: number }>;
  };
  if (!companyId || !projectId || !Array.isArray(allocations)) {
    return NextResponse.json({ error: "companyId, projectId and allocations are required" }, { status: 400 });
  }

  try {
    await authorize(prisma, { userId: currentUser.id, companyId, projectId, action: "plan:write" });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: "Not permitted to write this project's plan" }, { status: 403 });
    }
    throw error;
  }

  try {
    const planVersion = await createPlanVersion(prisma, { projectId, createdById: currentUser.id, note, allocations });
    return NextResponse.json({ planVersion }, { status: 201 });
  } catch (error) {
    if (error instanceof PlanError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }
}
