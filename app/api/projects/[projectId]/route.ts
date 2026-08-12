import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { AuthorizationError, authorize } from "@/lib/authz/service";
import { updateProjectDescription } from "@/lib/projects/repository";

/** Description is currently the only post-creation edit — see the note at the top of lib/projects/repository.ts. */
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

  const body = (await request.json()) as { companyId?: string; description?: string | null };
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

  const description = typeof body.description === "string" ? body.description.trim() || null : null;
  const updated = await updateProjectDescription(prisma, { projectId, description });
  return NextResponse.json({ project: updated });
}
