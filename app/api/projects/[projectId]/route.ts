import { NextRequest, NextResponse } from "next/server";
import type { ProjectStatus, QualificationStatus } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db";
import { getCurrentUser, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { AuthorizationError, authorize } from "@/lib/authz/service";
import { updateProject, type UpdateProjectInput } from "@/lib/projects/repository";

const PROJECT_STATUSES: ProjectStatus[] = ["PLANNED", "ACTIVE", "PAUSED", "COMPLETED", "ABANDONED"];
const QUALIFICATION_STATUSES: QualificationStatus[] = ["UNDECIDED", "QUALIFYING", "NON_QUALIFYING"];

interface PatchBody {
  companyId?: string;
  description?: string | null;
  status?: string;
  fieldOfScienceOrTechnology?: string | null;
  advanceSought?: string | null;
  qualificationStatus?: string;
}

/** A partial update — each field is only touched when the caller actually sent it, so e.g. changing just status never clobbers the description. */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;

  const currentUser = await getCurrentUser(prisma, request.cookies.get(SESSION_COOKIE_NAME)?.value);
  if (!currentUser) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const body = (await request.json()) as PatchBody;
  if (!body.companyId) {
    return NextResponse.json({ error: "companyId is required" }, { status: 400 });
  }

  try {
    await authorize(prisma, { userId: currentUser.id, companyId: body.companyId, projectId, action: "project:update" });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: "Not permitted to edit this project" }, { status: 403 });
    }
    throw error;
  }

  if (body.status !== undefined && !PROJECT_STATUSES.includes(body.status as ProjectStatus)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }
  if (body.qualificationStatus !== undefined && !QUALIFICATION_STATUSES.includes(body.qualificationStatus as QualificationStatus)) {
    return NextResponse.json({ error: "Invalid qualificationStatus" }, { status: 400 });
  }

  const input: UpdateProjectInput = { projectId };
  if (body.description !== undefined) input.description = body.description?.trim() || null;
  if (body.status !== undefined) input.status = body.status as ProjectStatus;
  if (body.fieldOfScienceOrTechnology !== undefined) input.fieldOfScienceOrTechnology = body.fieldOfScienceOrTechnology?.trim() || null;
  if (body.advanceSought !== undefined) input.advanceSought = body.advanceSought?.trim() || null;
  if (body.qualificationStatus !== undefined) input.qualificationStatus = body.qualificationStatus as QualificationStatus;

  const updated = await updateProject(prisma, input);
  return NextResponse.json({ project: updated });
}
