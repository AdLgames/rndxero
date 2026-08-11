import type { PrismaClient } from "@/lib/generated/prisma/client";
import { isEntitled } from "@/lib/billing/repository";

export class EntitlementError extends Error {}

/**
 * A company with no Subscription row at all has never been through
 * checkout — that's the free period before anyone's paid anything
 * ("Free while we're building this with early customers", the homepage
 * still says), not a lapsed one. Only an explicit non-entitled status
 * (PAST_DUE/CANCELED) blocks anything.
 */
export async function isCompanyEntitled(prisma: PrismaClient, companyId: string): Promise<boolean> {
  const subscription = await prisma.subscription.findUnique({ where: { companyId } });
  if (!subscription) return true;
  return isEntitled(subscription.status);
}

/**
 * Billable seats (BOARD-PLAN.md Phase 8.1/8.2): every ACTIVE Membership
 * except role ADVISER. Adviser seats are free and must never inflate a
 * company's bill or count toward a seat limit — enforced here, server
 * side, rather than left to a UI convention a client could bypass.
 */
export async function countBillableSeats(prisma: PrismaClient, companyId: string): Promise<number> {
  return prisma.membership.count({ where: { companyId, status: "ACTIVE", role: { not: "ADVISER" } } });
}

/**
 * Gates project creation and export — Phase 8.2's "gate on project count
 * and export, never on capture." Capture (submission:create) and
 * everything else deliberately never calls this: losing the ability to
 * log a week because of a billing lapse would corrupt the record's
 * contemporaneous nature in a way that can't be undone later, which is a
 * far worse outcome than a company temporarily not being able to add a
 * new project or pull an export.
 */
export async function requireEntitled(prisma: PrismaClient, companyId: string): Promise<void> {
  if (!(await isCompanyEntitled(prisma, companyId))) {
    throw new EntitlementError(
      "This company's subscription has lapsed. Project creation and export are paused until billing is resolved — capture is never affected."
    );
  }
}
