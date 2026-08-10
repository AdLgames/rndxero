/**
 * Pure permission checks over a membership role. `Membership` here is
 * intentionally a minimal shape (not the Prisma model) so this stays
 * framework-free and cheap to test.
 */

export type Role = "ADMIN" | "CONTRIBUTOR" | "FINANCE_APPROVER" | "ADVISER";

export interface MembershipLike {
  role: Role;
  companyId: string;
}

/** Admins manage the company: invitations, connections, billing. */
export function canManageCompany(membership: MembershipLike): boolean {
  return membership.role === "ADMIN";
}

/** Contributors and admins can log/confirm their own time and evidence. */
export function canLogOwnTime(membership: MembershipLike): boolean {
  return membership.role === "ADMIN" || membership.role === "CONTRIBUTOR";
}

/** Only finance approvers and admins can approve or query submissions. */
export function canApprove(membership: MembershipLike): boolean {
  return membership.role === "ADMIN" || membership.role === "FINANCE_APPROVER";
}

/**
 * Advisers (and everyone else) only ever see companies they hold a
 * membership for — there is no global "see everything" role. This
 * function exists to make that rule a single, tested place rather than a
 * per-query convention every route has to remember.
 */
export function isScopedToCompany(
  memberships: MembershipLike[],
  companyId: string
): boolean {
  return memberships.some((m) => m.companyId === companyId);
}

export function roleForCompany(
  memberships: MembershipLike[],
  companyId: string
): Role | null {
  return memberships.find((m) => m.companyId === companyId)?.role ?? null;
}
