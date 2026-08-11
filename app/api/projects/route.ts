import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { canManageCompany, roleForCompany, type MembershipLike } from "@/lib/auth/roles";
import { createProject } from "@/lib/projects/repository";

/** Creates a project. Admin-only — see lib/projects/repository.ts for why competent professionals are required here. */
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

  const role = roleForCompany(currentUser.memberships as MembershipLike[], companyId);
  if (!role || !canManageCompany({ role, companyId })) {
    return NextResponse.json({ error: "Only a company admin can create projects" }, { status: 403 });
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
