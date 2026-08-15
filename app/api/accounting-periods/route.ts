import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { AuthorizationError, authorize } from "@/lib/authz/service";
import { AccountingPeriodError, createAccountingPeriod } from "@/lib/finance/accounting-periods";

export async function POST(request: NextRequest) {
  const currentUser = await getCurrentUser(prisma, request.cookies.get(SESSION_COOKIE_NAME)?.value);
  if (!currentUser) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const body = (await request.json()) as { companyId?: string; label?: string; startDate?: string; endDate?: string };
  if (!body.companyId || !body.label || !body.startDate || !body.endDate) {
    return NextResponse.json({ error: "companyId, label, startDate, and endDate are required" }, { status: 400 });
  }

  try {
    await authorize(prisma, { userId: currentUser.id, companyId: body.companyId, action: "company:update" });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: "Not permitted to manage accounting periods" }, { status: 403 });
    }
    throw error;
  }

  try {
    const period = await createAccountingPeriod(prisma, {
      companyId: body.companyId,
      label: body.label,
      startDate: new Date(body.startDate),
      endDate: new Date(body.endDate),
    });
    return NextResponse.json({ period });
  } catch (error) {
    if (error instanceof AccountingPeriodError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }
}
