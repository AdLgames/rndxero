import { NextRequest, NextResponse } from "next/server";
import type { DirectCostCategory } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db";
import { getCurrentUser, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { AuthorizationError, authorize } from "@/lib/authz/service";
import { createDirectCost, DirectCostError } from "@/lib/cost/direct-costs";

const CATEGORIES: DirectCostCategory[] = ["CONSUMABLES", "SOFTWARE_LICENCE", "CLOUD_COMPUTING", "SUBCONTRACTOR", "EPW", "CLINICAL_TRIAL_VOLUNTEERS", "OTHER"];

interface PostBody {
  companyId?: string;
  projectId?: string;
  uncertaintyId?: string | null;
  description?: string;
  category?: string;
  amountMinorUnits?: number;
  isOverseas?: boolean;
  isSubsidised?: boolean;
  date?: string;
}

export async function POST(request: NextRequest) {
  const currentUser = await getCurrentUser(prisma, request.cookies.get(SESSION_COOKIE_NAME)?.value);
  if (!currentUser) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const body = (await request.json()) as PostBody;
  if (!body.companyId || !body.projectId || !body.description || !body.amountMinorUnits || !body.date) {
    return NextResponse.json({ error: "projectId, description, amountMinorUnits, and date are required" }, { status: 400 });
  }
  if (body.category !== undefined && !CATEGORIES.includes(body.category as DirectCostCategory)) {
    return NextResponse.json({ error: "Invalid category" }, { status: 400 });
  }

  try {
    await authorize(prisma, { userId: currentUser.id, companyId: body.companyId, projectId: body.projectId, action: "cost:write" });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: "Not permitted to record costs on this project" }, { status: 403 });
    }
    throw error;
  }

  try {
    const cost = await createDirectCost(prisma, {
      projectId: body.projectId,
      uncertaintyId: body.uncertaintyId ?? null,
      description: body.description,
      category: (body.category as DirectCostCategory) ?? "OTHER",
      amountMinorUnits: body.amountMinorUnits,
      isOverseas: body.isOverseas ?? false,
      isSubsidised: body.isSubsidised ?? false,
      date: new Date(body.date),
      enteredById: currentUser.id,
    });
    return NextResponse.json({ cost });
  } catch (error) {
    if (error instanceof DirectCostError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }
}
