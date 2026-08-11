import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { AuthorizationError, authorize } from "@/lib/authz/service";
import { EntitlementError, requireEntitled } from "@/lib/billing/entitlement";
import { createProject } from "@/lib/projects/repository";

/** Creates a project. See lib/authz/permissions.ts for who — project:create is Owner-only. */
export async function POST(request: NextRequest) {
  const currentUser = await getCurrentUser(prisma, request.cookies.get(SESSION_COOKIE_NAME)?.value);
  if (!currentUser) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const body = (await request.json()) as {
    companyId?: string;
    name?: string;
    startDate?: string;
    endDate?: string;
    competentProfessionals?: string[];
  };
  const { companyId, name, startDate, competentProfessionals } = body;
  if (!companyId || !name || !startDate || !competentProfessionals?.length) {
    return NextResponse.json(
      { error: "companyId, name, startDate and at least one competentProfessional are required" },
      { status: 400 }
    );
  }

  try {
    await authorize(prisma, { userId: currentUser.id, companyId, action: "project:create" });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: "Only a company owner can create projects" }, { status: 403 });
    }
    throw error;
  }

  try {
    await requireEntitled(prisma, companyId);
  } catch (error) {
    if (error instanceof EntitlementError) {
      return NextResponse.json({ error: error.message }, { status: 402 });
    }
    throw error;
  }

  try {
    const project = await createProject(prisma, {
      companyId,
      name,
      startDate: new Date(startDate),
      endDate: body.endDate ? new Date(body.endDate) : null,
      competentProfessionals,
    });
    return NextResponse.json({ project }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not create project";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
