import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { AuthorizationError, authorize } from "@/lib/authz/service";
import type { WorkerCostCategory } from "@/lib/generated/prisma/client";

const VALID_CATEGORIES: WorkerCostCategory[] = ["DIRECT_PAYE", "SUBCONTRACTOR_CONNECTED", "SUBCONTRACTOR_UNCONNECTED", "EPW", "CONSUMABLES"];

/** Tags a project member's time with an R&D expenditure class (Finance-only — same gate as rates/derived cost). */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const currentUser = await getCurrentUser(prisma, request.cookies.get(SESSION_COOKIE_NAME)?.value);
  if (!currentUser) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const body = (await request.json()) as { companyId?: string; costCategory?: WorkerCostCategory | null };
  const { companyId, costCategory } = body;
  if (!companyId) {
    return NextResponse.json({ error: "companyId is required" }, { status: 400 });
  }
  if (costCategory !== null && costCategory !== undefined && !VALID_CATEGORIES.includes(costCategory)) {
    return NextResponse.json({ error: "Invalid cost category" }, { status: 400 });
  }

  const member = await prisma.projectMember.findUnique({ where: { id }, include: { project: true } });
  if (!member || member.project.companyId !== companyId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    await authorize(prisma, { userId: currentUser.id, companyId, projectId: member.projectId, action: "cost:write" });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: "Not permitted to set cost categories" }, { status: 403 });
    }
    throw error;
  }

  const updated = await prisma.projectMember.update({
    where: { id },
    data: { costCategory: costCategory ?? null },
  });

  return NextResponse.json({ member: updated });
}
