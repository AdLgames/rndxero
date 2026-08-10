import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { canLogOwnTime, roleForCompany, type MembershipLike } from "@/lib/auth/roles";
import { confirmCandidate } from "@/lib/capture/weekly-digest";
import { recordTimeEntry } from "@/lib/time/repository";
import type { TimeEntryBasis } from "@/lib/generated/prisma/client";

/** Confirms one weekly-digest candidate into a real (append-only) TimeEntry. */
export async function POST(request: NextRequest) {
  const currentUser = await getCurrentUser(prisma, request.cookies.get(SESSION_COOKIE_NAME)?.value);
  if (!currentUser) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const body = (await request.json()) as {
    companyId?: string;
    projectId?: string;
    periodStart?: string;
    periodEnd?: string;
    minutes?: number;
    basis?: TimeEntryBasis;
  };
  const { companyId, projectId, periodStart, periodEnd, minutes, basis } = body;
  if (!companyId || !projectId || !periodStart || !periodEnd || minutes === undefined || !basis) {
    return NextResponse.json(
      { error: "companyId, projectId, periodStart, periodEnd, minutes and basis are required" },
      { status: 400 }
    );
  }

  const role = roleForCompany(currentUser.memberships as MembershipLike[], companyId);
  if (!role || !canLogOwnTime({ role, companyId })) {
    return NextResponse.json({ error: "Not permitted to log time for this company" }, { status: 403 });
  }

  const confirmed = confirmCandidate({ minutes, basis });

  const entry = await recordTimeEntry(prisma, {
    projectId,
    personId: currentUser.id,
    periodStart: new Date(periodStart),
    periodEnd: new Date(periodEnd),
    minutes: confirmed.minutes,
    basis: confirmed.basis,
    authorId: currentUser.id,
  });

  return NextResponse.json({ timeEntry: entry }, { status: 201 });
}
