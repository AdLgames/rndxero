import type { PrismaClient } from "@/lib/generated/prisma/client";
import { can } from "@/lib/authz/permissions";
import type { Action, AuthzSubject, ResourceContext } from "@/lib/authz/types";

export class AuthorizationError extends Error {
  constructor(action: Action) {
    super(`Not authorized to perform ${action}`);
    this.name = "AuthorizationError";
  }
}

/**
 * Resolves an AuthzSubject from the database: the user's company
 * Membership, and — for project-scoped actions — their ProjectMember row
 * on that specific project, if any. This is the *only* place either of
 * those tables should be queried for authorization purposes; every route
 * handler goes through authorize()/canDo() below rather than querying
 * Membership directly and eyeballing the role.
 */
export async function resolveSubject(
  prisma: PrismaClient,
  params: { userId: string; companyId: string; projectId?: string }
): Promise<AuthzSubject> {
  const membership = await prisma.membership.findUnique({
    where: { userId_companyId: { userId: params.userId, companyId: params.companyId } },
  });

  let projectRole: AuthzSubject["projectRole"] = null;
  if (params.projectId) {
    const projectMember = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId: params.projectId, userId: params.userId } },
    });
    projectRole = projectMember?.role ?? null;
  }

  return {
    userId: params.userId,
    companyRole: membership?.role ?? null,
    companyStatus: membership?.status ?? null,
    canViewCosts: membership?.canViewCosts ?? false,
    projectRole,
  };
}

export interface AuthorizeParams {
  userId: string;
  companyId: string;
  projectId?: string;
  action: Action;
  resource?: ResourceContext;
}

/** Resolves the subject and checks the action; throws AuthorizationError on denial. */
export async function authorize(prisma: PrismaClient, params: AuthorizeParams): Promise<AuthzSubject> {
  const subject = await resolveSubject(prisma, {
    userId: params.userId,
    companyId: params.companyId,
    projectId: params.projectId,
  });

  if (!can(subject, params.action, params.resource ?? {})) {
    throw new AuthorizationError(params.action);
  }

  return subject;
}

/** Same resolution as authorize(), but returns a boolean instead of throwing — for conditional UI/query logic. */
export async function canDo(prisma: PrismaClient, params: AuthorizeParams): Promise<boolean> {
  const subject = await resolveSubject(prisma, {
    userId: params.userId,
    companyId: params.companyId,
    projectId: params.projectId,
  });
  return can(subject, params.action, params.resource ?? {});
}

/**
 * Every project a user has standing on for a given company — as a
 * ProjectMember, or implicitly all of them if they're OWNER/FINANCE
 * (who act company-wide without needing a ProjectMember row, per the
 * permission matrix). Pages that list "your projects" (capture, the
 * board, the planner) should use this rather than querying ProjectMember
 * alone, or an Owner who never explicitly joined their own project would
 * see none of them.
 */
export async function listAccessibleProjectIds(
  prisma: PrismaClient,
  params: { userId: string; companyId: string }
): Promise<string[]> {
  const membership = await prisma.membership.findUnique({
    where: { userId_companyId: { userId: params.userId, companyId: params.companyId } },
  });
  if (!membership || membership.status !== "ACTIVE") return [];

  if (membership.role === "OWNER" || membership.role === "FINANCE") {
    const projects = await prisma.project.findMany({
      where: { companyId: params.companyId },
      select: { id: true },
    });
    return projects.map((p) => p.id);
  }

  const memberships = await prisma.projectMember.findMany({
    where: { userId: params.userId, project: { companyId: params.companyId } },
    select: { projectId: true },
  });
  return memberships.map((m) => m.projectId);
}
