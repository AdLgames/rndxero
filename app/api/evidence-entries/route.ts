import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { canLogOwnTime, roleForCompany, type MembershipLike } from "@/lib/auth/roles";
import { recordEvidenceEntry } from "@/lib/evidence/repository";
import type { EvidenceEntryType } from "@/lib/generated/prisma/client";

export async function POST(request: NextRequest) {
  const currentUser = await getCurrentUser(prisma, request.cookies.get(SESSION_COOKIE_NAME)?.value);
  if (!currentUser) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const body = (await request.json()) as {
    companyId?: string;
    projectId?: string;
    type?: EvidenceEntryType;
    body?: string;
  };
  const { companyId, projectId, type, body: entryBody } = body;
  if (!companyId || !projectId || !type || !entryBody) {
    return NextResponse.json(
      { error: "companyId, projectId, type and body are required" },
      { status: 400 }
    );
  }

  const role = roleForCompany(currentUser.memberships as MembershipLike[], companyId);
  if (!role || !canLogOwnTime({ role, companyId })) {
    return NextResponse.json({ error: "Not permitted to log evidence for this company" }, { status: 403 });
  }

  const entry = await recordEvidenceEntry(prisma, {
    projectId,
    type,
    body: entryBody,
    authorId: currentUser.id,
  });

  return NextResponse.json({ evidenceEntry: entry }, { status: 201 });
}
