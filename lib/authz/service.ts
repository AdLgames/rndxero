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
