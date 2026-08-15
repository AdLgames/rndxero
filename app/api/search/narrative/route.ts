import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { AuthorizationError, authorize, listAccessibleProjectIds } from "@/lib/authz/service";
import { searchNarrative } from "@/lib/search/narrative-search";
import type { UncertaintyNoteType } from "@/lib/generated/prisma/client";

const VALID_TYPES = new Set<UncertaintyNoteType>(["ATTEMPT", "BLOCKER", "FAILED_ATTEMPT", "RESOLUTION", "NO_PROGRESS"]);

export async function GET(request: NextRequest) {
  const currentUser = await getCurrentUser(prisma, request.cookies.get(SESSION_COOKIE_NAME)?.value);
  if (!currentUser) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const companyId = searchParams.get("companyId");
  const query = searchParams.get("q");
  const projectId = searchParams.get("projectId");
  const typeParam = searchParams.get("type");

  if (!companyId || !query?.trim()) {
    return NextResponse.json({ error: "companyId and q are required" }, { status: 400 });
  }
  if (typeParam && !VALID_TYPES.has(typeParam as UncertaintyNoteType)) {
    return NextResponse.json({ error: "Invalid type" }, { status: 400 });
  }

  // note:read is project-scoped (BOARD-PLAN.md Phase 2), so there's no
  // single company-wide check to make here — listAccessibleProjectIds
  // below already narrows results to projects this specific user has
  // standing on, the same scoping capture/board/planner use. A single
  // requested project still gets an explicit authorize() so a request for
  // a project the user can't see 403s cleanly instead of silently
  // returning zero results.
  if (projectId) {
    try {
      await authorize(prisma, { userId: currentUser.id, companyId, projectId, action: "note:read" });
    } catch (error) {
      if (error instanceof AuthorizationError) {
        return NextResponse.json({ error: "Not permitted" }, { status: 403 });
      }
      throw error;
    }
  }

  const accessibleProjectIds = await listAccessibleProjectIds(prisma, { userId: currentUser.id, companyId });
  const projectIds = projectId ? accessibleProjectIds.filter((id) => id === projectId) : accessibleProjectIds;

  const results = await searchNarrative(prisma, {
    projectIds,
    query: query.trim(),
    type: typeParam as UncertaintyNoteType | undefined,
  });

  return NextResponse.json({ results });
}
