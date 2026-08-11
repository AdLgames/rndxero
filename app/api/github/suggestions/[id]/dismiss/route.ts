import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { AuthorizationError, authorize } from "@/lib/authz/service";
import { dismissSuggestion, SuggestionError } from "@/lib/github/repo-links";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const currentUser = await getCurrentUser(prisma, request.cookies.get(SESSION_COOKIE_NAME)?.value);
  if (!currentUser) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const { companyId, projectId } = (await request.json()) as { companyId?: string; projectId?: string };
  if (!companyId || !projectId) {
    return NextResponse.json({ error: "companyId and projectId are required" }, { status: 400 });
  }

  try {
    await authorize(prisma, { userId: currentUser.id, companyId, projectId, action: "note:create" });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: "Not permitted to dismiss suggestions on this project" }, { status: 403 });
    }
    throw error;
  }

  try {
    const suggestion = await dismissSuggestion(prisma, { suggestionId: id, resolvedById: currentUser.id });
    return NextResponse.json({ suggestion });
  } catch (error) {
    if (error instanceof SuggestionError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    throw error;
  }
}
