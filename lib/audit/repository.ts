import type { AuditLog, PrismaClient } from "@/lib/generated/prisma/client";

export interface ProjectAuditEntry {
  action: string;
  entityType: string;
  entityId: string;
  actorName: string | null;
  before: unknown;
  after: unknown;
  reason: string | null;
  createdAt: string;
}

/**
 * AuditLog rows are keyed by (companyId, entityType, entityId) with no
 * projectId of their own — a row might point at the project itself, one
 * of its submissions, or one of its notes. This gathers all three so "the
 * audit trail for this project" means what it sounds like, not just the
 * subset that happens to be tagged with the project's own id.
 */
export async function getProjectAuditTrail(prisma: PrismaClient, projectId: string): Promise<ProjectAuditEntry[]> {
  const project = await prisma.project.findUniqueOrThrow({ where: { id: projectId }, select: { companyId: true } });

  const submissions = await prisma.weeklySubmission.findMany({ where: { projectId }, select: { id: true } });
  const submissionIds = submissions.map((s) => s.id);

  const notes = submissionIds.length
    ? await prisma.uncertaintyNote.findMany({ where: { submissionId: { in: submissionIds } }, select: { id: true } })
    : [];
  const noteIds = notes.map((n) => n.id);

  const entries: AuditLog[] = await prisma.auditLog.findMany({
    where: { companyId: project.companyId, entityId: { in: [projectId, ...submissionIds, ...noteIds] } },
    orderBy: { createdAt: "asc" },
  });

  const actorIds = [...new Set(entries.map((e) => e.actorId).filter((id): id is string => id !== null))];
  const actors = actorIds.length ? await prisma.user.findMany({ where: { id: { in: actorIds } }, select: { id: true, name: true } }) : [];
  const actorNameById = new Map(actors.map((a) => [a.id, a.name]));

  return entries.map((e) => ({
    action: e.action,
    entityType: e.entityType,
    entityId: e.entityId,
    actorName: e.actorId ? (actorNameById.get(e.actorId) ?? "unknown") : null,
    before: e.before,
    after: e.after,
    reason: e.reason,
    createdAt: e.createdAt.toISOString(),
  }));
}
