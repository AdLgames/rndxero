import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { AuthorizationError, authorize } from "@/lib/authz/service";
import { setClaimNotified } from "@/lib/finance/accounting-periods";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ periodId: string }> }) {
  const { periodId } = await params;

  const currentUser = await getCurrentUser(prisma, request.cookies.get(SESSION_COOKIE_NAME)?.value);
  if (!currentUser) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const period = await prisma.accountingPeriod.findUnique({ where: { id: periodId } });
  if (!period) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = (await request.json()) as { companyId?: string; notified?: boolean };
  if (!body.companyId || typeof body.notified !== "boolean") {
    return NextResponse.json({ error: "companyId and notified are required" }, { status: 400 });
  }

  try {
    await authorize(prisma, { userId: currentUser.id, companyId: body.companyId, action: "company:update" });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: "Not permitted to manage accounting periods" }, { status: 403 });
    }
    throw error;
  }

  const updated = await setClaimNotified(prisma, { id: periodId, notified: body.notified });
  return NextResponse.json({ period: updated });
}
