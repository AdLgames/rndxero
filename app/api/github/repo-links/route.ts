import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { AuthorizationError, authorize } from "@/lib/authz/service";
import { createRepoLink } from "@/lib/github/repo-links";

/** Links a GitHub repo to a project. Gated on project:update — Owner-only, matching other project-admin actions. */
export async function POST(request: NextRequest) {
  const currentUser = await getCurrentUser(prisma, request.cookies.get(SESSION_COOKIE_NAME)?.value);
  if (!currentUser) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const { companyId, projectId, repoFullName } = (await request.json()) as {
    companyId?: string;
    projectId?: string;
    repoFullName?: string;
  };
  if (!companyId || !projectId || !repoFullName) {
    return NextResponse.json({ error: "companyId, projectId and repoFullName are required" }, { status: 400 });
  }

  try {
    await authorize(prisma, { userId: currentUser.id, companyId, projectId, action: "project:update" });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: "Not permitted to link a repo to this project" }, { status: 403 });
    }
    throw error;
  }

  try {
    const repoLink = await createRepoLink(prisma, { companyId, projectId, repoFullName });
    return NextResponse.json({
      repoLink: { id: repoLink.id, repoFullName: repoLink.repoFullName, webhookSecret: repoLink.webhookSecret },
      webhookUrl: `${request.nextUrl.origin}/api/github/webhook`,
    });
  } catch {
    return NextResponse.json({ error: "That repo may already be linked to a project" }, { status: 400 });
  }
}
