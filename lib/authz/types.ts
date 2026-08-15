import type { MembershipRole, MembershipStatus, ProjectRole } from "@/lib/generated/prisma/client";

/**
 * Every distinct thing the app can be asked to do. Deliberately granular
 * (separate read/write, separate lock/unlock) so the permission matrix in
 * permissions.ts can say exactly what it means rather than approximating
 * with a handful of coarse verbs.
 */
export type Action =
  | "billing:manage"
  | "membership:manage"
  | "company:update"
  | "project:create"
  | "project:read"
  | "project:update"
  | "projectMember:invite"
  | "uncertainty:create"
  | "uncertainty:read"
  | "uncertainty:update"
  | "submission:create"
  | "submission:read"
  | "submission:update"
  | "submission:amend"
  | "submission:lock"
  | "submission:unlock"
  | "note:create"
  | "note:read"
  | "note:update"
  | "note:amend"
  | "note:remap"
  | "comment:create"
  | "comment:read"
  | "rate:read"
  | "rate:write"
  | "cost:read"
  | "cost:write"
  | "plan:read"
  | "plan:write"
  | "export:read"
  | "ai:configure"
  | "ai:query";

/**
 * Already-resolved membership facts for one user in one company (and,
 * where relevant, one project). Resolving this is the DB-backed part
 * (lib/authz/service.ts); `can()` itself is pure and knows nothing about
 * Prisma.
 */
export interface AuthzSubject {
  userId: string;
  companyRole: MembershipRole | null;
  companyStatus: MembershipStatus | null;
  canViewCosts: boolean;
  /** Null when the action isn't project-scoped, or the user has no standing on this specific project. */
  projectRole: ProjectRole | null;
}

/**
 * Resource facts `can()` needs beyond the subject's own membership —
 * currently just who owns a submission/note, for the hard
 * no-one-edits-another's-capture rule.
 */
export interface ResourceContext {
  ownerId?: string;
}
