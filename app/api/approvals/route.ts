import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { canApprove, roleForCompany, type MembershipLike } from "@/lib/auth/roles";
import { decideApproval } from "@/lib/approvals/repository";
import { InvalidApprovalTransitionError } from "@/lib/approvals/state-machine";
import type { ApprovalTargetType } from "@/lib/generated/prisma/client";

/** Finance approves or queries a pending time entry / cost allocation. */
export async function POST(request: NextRequest) {
  const currentUser = await getCurrentUser(prisma, request.cookies.get(SESSION_COOKIE_NAME)?.value);
  if (!currentUser) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const body = (await request.json()) as {
    companyId?: string;
    targetType?: ApprovalTargetType;
    targetId?: string;
    action?: "approve" | "query";
    comment?: string;
  };
  const { companyId, targetType, targetId, action, comment } = body;
  if (!companyId || !targetType || !targetId || !action) {
    return NextResponse.json(
      { error: "companyId, targetType, targetId and action are required" },
      { status: 400 }
    );
  }

  const role = roleForCompany(currentUser.memberships as MembershipLike[], companyId);
  if (!role || !canApprove({ role, companyId })) {
    return NextResponse.json({ error: "Not permitted to approve for this company" }, { status: 403 });
  }

  const snapshotData =
    targetType === "TIME_ENTRY"
      ? await prisma.timeEntry.findUnique({ where: { id: targetId } })
      : await prisma.costAllocation.findUnique({ where: { id: targetId } });
  if (!snapshotData) {
    return NextResponse.json({ error: "Target not found" }, { status: 404 });
  }

  try {
    const approval = await decideApproval(prisma, {
      targetType,
      targetId,
      action,
      approverId: currentUser.id,
      comment,
      snapshotData,
    });
    return NextResponse.json({ approval }, { status: 201 });
  } catch (error) {
    if (error instanceof InvalidApprovalTransitionError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    throw error;
  }
}
